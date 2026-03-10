"""Formspec extension registry client: parse, query, and validate extension entries.

Indexes registry documents by name for O(1) lookup, supports semver constraint
matching (>=, <=, >, <, exact, range), and enforces lifecycle state machine
transitions (draft -> stable -> deprecated -> retired, with un-deprecate path).
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


# Well-known URL path for registry discovery (§3.1)
WELL_KNOWN_PATH = '/.well-known/formspec-extensions'

# Valid lifecycle transitions: from -> set of valid to states
_LIFECYCLE_TRANSITIONS = {
    'draft': {'draft', 'stable', 'deprecated', 'retired'},
    'stable': {'stable', 'deprecated', 'retired'},
    'deprecated': {'deprecated', 'retired', 'stable'},  # can un-deprecate back to stable
    'retired': set(),  # terminal state, no transitions
}

# Valid status values
VALID_STATUSES = {'draft', 'stable', 'deprecated', 'retired'}


@dataclass
class RegistryEntry:
    """A single extension entry with metadata, versioning, and category-specific fields."""
    name: str
    category: str
    version: str
    status: str
    description: str
    compatibility: dict
    publisher: dict | None = None
    spec_url: str | None = None
    schema_url: str | None = None
    license: str | None = None
    deprecation_notice: str | None = None
    base_type: str | None = None
    parameters: list[dict] | None = None
    returns: str | None = None
    members: list[str] | None = None
    constraints: dict | None = None
    metadata: dict | None = None
    raw: dict | None = None

    @staticmethod
    def from_dict(d: dict) -> RegistryEntry:
        """Deserialize from a registry JSON entry, mapping camelCase keys to snake_case fields."""
        return RegistryEntry(
            name=d['name'],
            category=d['category'],
            version=d['version'],
            status=d['status'],
            description=d['description'],
            compatibility=d['compatibility'],
            publisher=d.get('publisher'),
            spec_url=d.get('specUrl'),
            schema_url=d.get('schemaUrl'),
            license=d.get('license'),
            deprecation_notice=d.get('deprecationNotice'),
            base_type=d.get('baseType'),
            parameters=d.get('parameters'),
            returns=d.get('returns'),
            members=d.get('members'),
            constraints=d.get('constraints'),
            metadata=d.get('metadata'),
            raw=d,
        )


class Registry:
    """Parsed extension registry indexed by name for fast lookup.

    Accepts a registry document (conforming to registry.schema.json), parses
    all entries into RegistryEntry objects, and indexes them by name. Provides
    filtered search with semver constraint matching.
    """

    def __init__(self, doc: dict):
        self.doc = doc
        self.publisher = doc.get('publisher', {})
        self.published = doc.get('published')
        self.entries: list[RegistryEntry] = [
            RegistryEntry.from_dict(e) for e in doc.get('entries', [])
        ]
        # Index by name for fast lookup
        self._by_name: dict[str, list[RegistryEntry]] = {}
        for entry in self.entries:
            self._by_name.setdefault(entry.name, []).append(entry)

    def find(
        self,
        name: str,
        *,
        version: str | None = None,
        category: str | None = None,
        status: str | None = None,
    ) -> list[RegistryEntry]:
        """Find entries by name with optional version/category/status filters, sorted version-descending."""
        candidates = self._by_name.get(name, [])
        results = []
        for entry in candidates:
            if category and entry.category != category:
                continue
            if status and entry.status != status:
                continue
            if version and not _version_satisfies(entry.version, version):
                continue
            results.append(entry)
        results.sort(key=lambda e: _parse_version(e.version), reverse=True)
        return results

    def find_one(
        self,
        name: str,
        *,
        version: str | None = None,
        category: str | None = None,
        status: str | None = None,
    ) -> RegistryEntry | None:
        """Return the highest-version matching entry, or None if no match."""
        results = self.find(name, version=version, category=category, status=status)
        return results[0] if results else None

    def list_by_category(self, category: str) -> list[RegistryEntry]:
        """List all entries of a given category."""
        return [e for e in self.entries if e.category == category]

    def list_by_status(self, status: str) -> list[RegistryEntry]:
        """List all entries with a given status."""
        return [e for e in self.entries if e.status == status]

    def validate(self) -> list[str]:
        """Check internal consistency: x- naming, deprecation notices, category-specific required fields."""
        errors = []
        for entry in self.entries:
            # Name must match x- pattern
            if not re.match(r'^x-[a-z][a-z0-9]*(-[a-z][a-z0-9]*)*$', entry.name):
                errors.append(f"Invalid extension name: '{entry.name}'")
            # Deprecated entries must have deprecationNotice
            if entry.status == 'deprecated' and not entry.deprecation_notice:
                errors.append(f"Entry '{entry.name}' is deprecated but missing deprecationNotice")
            # DataType entries must have baseType
            if entry.category == 'dataType' and not entry.base_type:
                errors.append(f"DataType entry '{entry.name}' missing baseType")
            # Function entries must have parameters and returns
            if entry.category == 'function':
                if not entry.parameters:
                    errors.append(f"Function entry '{entry.name}' missing parameters")
                if not entry.returns:
                    errors.append(f"Function entry '{entry.name}' missing returns")
        return errors


def validate_lifecycle_transition(from_status: str, to_status: str) -> bool:
    """Check if a lifecycle transition is valid per the spec state machine.

    retired is terminal (no outgoing transitions); deprecated can un-deprecate
    back to stable. Returns False for unknown statuses.
    """
    if from_status not in _LIFECYCLE_TRANSITIONS:
        return False
    return to_status in _LIFECYCLE_TRANSITIONS[from_status]


def well_known_url(base_url: str) -> str:
    """Join base_url with WELL_KNOWN_PATH for registry discovery."""
    base = base_url.rstrip('/')
    return f"{base}{WELL_KNOWN_PATH}"


def _parse_version(version: str) -> tuple[int, int, int]:
    """Parse a dotted version string (e.g. '1.2.3' or '1.0') into a 3-part comparable tuple, padded with zeros."""
    try:
        parts = version.split('.')
        ints = [int(p) for p in parts]
        while len(ints) < 3:
            ints.append(0)
        return (ints[0], ints[1], ints[2])
    except (ValueError, AttributeError):
        return (0, 0, 0)


def _version_satisfies(version: str, constraint: str) -> bool:
    """Test version against a space-separated constraint (e.g. '>=1.0.0 <2.0.0').

    Supports exact match, and >=, <=, >, < prefix operators. Multiple
    constraints are ANDed together.
    """
    ver = _parse_version(version)
    parts = constraint.strip().split()

    for part in parts:
        if part.startswith('>='):
            target = _parse_version(part[2:])
            if ver < target:
                return False
        elif part.startswith('<='):
            target = _parse_version(part[2:])
            if ver > target:
                return False
        elif part.startswith('>'):
            target = _parse_version(part[1:])
            if ver <= target:
                return False
        elif part.startswith('<'):
            target = _parse_version(part[1:])
            if ver >= target:
                return False
        else:
            # Exact match
            target = _parse_version(part)
            if ver != target:
                return False
    return True
