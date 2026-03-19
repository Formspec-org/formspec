"""Auto-discover and validate all Formspec JSON artifacts in a directory.

CLI usage::

    python3 -m formspec.validate path/to/artifacts/
    python3 -m formspec.validate path/to/artifacts/ --registry common.registry.json
    python3 -m formspec.validate path/to/artifacts/ --title "My Project"

Library usage::

    from formspec.validate import discover_artifacts, validate_all, print_report
    artifacts = discover_artifacts(Path("my-project/"))
    sys.exit(print_report(validate_all(artifacts)))
"""
from __future__ import annotations

import argparse
import json
import re
import sys
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

from formspec.changelog import generate_changelog
from formspec.evaluator import DefinitionEvaluator
from formspec.factories import create_form_processor, create_mapping_engine
from formspec.fel import extract_dependencies
from formspec.fel.errors import FelSyntaxError
from formspec.mapping import MappingEngine
from formspec.registry import Registry
from formspec.validator import LintDiagnostic, lint
from formspec.validator.references import canonical_item_path
from formspec.validator.schema import SchemaValidator

# ── Artifact data structures ─────────────────────────────────────────────────


@dataclass
class ArtifactFile:
    path: Path
    doc: dict


@dataclass
class DefinitionArtifact(ArtifactFile):
    url: str = ""
    version: str = ""
    derived_from_url: str = ""


@dataclass
class ThemeArtifact(ArtifactFile):
    target_def_url: str = ""


@dataclass
class ComponentArtifact(ArtifactFile):
    target_def_url: str = ""


@dataclass
class MappingArtifact(ArtifactFile):
    definition_ref: str = ""


@dataclass
class ResponseArtifact(ArtifactFile):
    definition_url: str = ""
    definition_version: str = ""
    status: str = ""


@dataclass
class ChangelogArtifact(ArtifactFile):
    definition_url: str = ""


@dataclass
class DiscoveredArtifacts:
    definitions: dict[str, DefinitionArtifact] = field(default_factory=dict)
    definition_versions: dict[tuple[str, str], DefinitionArtifact] = field(default_factory=dict)
    fragments: dict[str, DefinitionArtifact] = field(default_factory=dict)
    components: list[ComponentArtifact] = field(default_factory=list)
    themes: list[ThemeArtifact] = field(default_factory=list)
    mappings: list[MappingArtifact] = field(default_factory=list)
    responses: list[ResponseArtifact] = field(default_factory=list)
    changelogs: list[ChangelogArtifact] = field(default_factory=list)
    registries: list[ArtifactFile] = field(default_factory=list)
    changelog_pairs: list[tuple[DefinitionArtifact, DefinitionArtifact]] = field(
        default_factory=list
    )
    unknown: list[Path] = field(default_factory=list)


# ── Report data structures ───────────────────────────────────────────────────


@dataclass
class PassItemResult:
    label: str
    error_count: int = 0
    warning_count: int = 0
    diagnostics: list[LintDiagnostic] = field(default_factory=list)
    runtime_results: list[dict] = field(default_factory=list)


@dataclass
class PassResult:
    title: str
    items: list[PassItemResult] = field(default_factory=list)
    empty: bool = False


@dataclass
class ValidationReport:
    passes: list[PassResult] = field(default_factory=list)


# ── Discovery ────────────────────────────────────────────────────────────────


def _find_refs(obj: Any) -> set[str]:
    """Walk a JSON tree and collect all $ref URL strings."""
    refs: set[str] = set()
    if isinstance(obj, dict):
        if "$ref" in obj and isinstance(obj["$ref"], str):
            # Strip fragment (#...) to get the base URL
            url = obj["$ref"].split("#")[0]
            if url:
                refs.add(url)
        for v in obj.values():
            refs.update(_find_refs(v))
    elif isinstance(obj, list):
        for v in obj:
            refs.update(_find_refs(v))
    return refs


def discover_artifacts(
    directory: Path,
    *,
    fixture_subdirs: tuple[str, ...] = ("fixtures",),
    registry_paths: tuple[Path, ...] = (),
) -> DiscoveredArtifacts:
    """Glob *.json files, classify via schema detection, and pair by URL references."""
    sv = SchemaValidator()
    arts = DiscoveredArtifacts()

    # Collect all JSON paths
    json_paths: list[Path] = sorted(directory.glob("*.json"))
    for subdir in fixture_subdirs:
        sub = directory / subdir
        if sub.is_dir():
            json_paths.extend(sorted(sub.glob("*.json")))

    # Classify each file
    for path in json_paths:
        try:
            doc = json.loads(path.read_text())
        except (json.JSONDecodeError, OSError):
            arts.unknown.append(path)
            continue

        doc_type = sv.detect_document_type(doc)
        if doc_type == "definition":
            url = doc.get("url", "")
            version = doc.get("version", "")
            derived = ""
            if isinstance(doc.get("derivedFrom"), dict):
                derived = doc["derivedFrom"].get("url", "")
            artifact = DefinitionArtifact(
                path=path, doc=doc, url=url, version=version, derived_from_url=derived
            )
            arts.definitions[url] = artifact
            arts.definition_versions[(url, version)] = artifact
        elif doc_type == "component":
            target = ""
            if isinstance(doc.get("targetDefinition"), dict):
                target = doc["targetDefinition"].get("url", "")
            arts.components.append(
                ComponentArtifact(path=path, doc=doc, target_def_url=target)
            )
        elif doc_type == "theme":
            target = ""
            if isinstance(doc.get("targetDefinition"), dict):
                target = doc["targetDefinition"].get("url", "")
            arts.themes.append(
                ThemeArtifact(path=path, doc=doc, target_def_url=target)
            )
        elif doc_type == "mapping":
            arts.mappings.append(
                MappingArtifact(
                    path=path, doc=doc, definition_ref=doc.get("definitionRef", "")
                )
            )
        elif doc_type == "response":
            arts.responses.append(
                ResponseArtifact(
                    path=path,
                    doc=doc,
                    definition_url=doc.get("definitionUrl", ""),
                    definition_version=doc.get("definitionVersion", ""),
                    status=doc.get("status", ""),
                )
            )
        elif doc_type == "changelog":
            arts.changelogs.append(
                ChangelogArtifact(
                    path=path,
                    doc=doc,
                    definition_url=doc.get("definitionUrl", ""),
                )
            )
        elif doc_type == "registry":
            arts.registries.append(ArtifactFile(path=path, doc=doc))
        else:
            arts.unknown.append(path)

    # Add external registry paths
    for rp in registry_paths:
        if rp.exists():
            try:
                doc = json.loads(rp.read_text())
                arts.registries.append(ArtifactFile(path=rp, doc=doc))
            except (json.JSONDecodeError, OSError):
                arts.unknown.append(rp)

    # Separate fragments: any definition whose URL is a $ref target of another definition
    ref_targets: set[str] = set()
    for da in arts.definitions.values():
        ref_targets.update(_find_refs(da.doc))

    for url in list(arts.definitions.keys()):
        if url and url in ref_targets:
            arts.fragments[url] = arts.definitions.pop(url)

    # Build changelog pairs from derivedFrom cross-references
    all_defs = {**arts.definitions, **arts.fragments}
    for da in arts.definitions.values():
        if da.derived_from_url and da.derived_from_url in all_defs:
            parent = all_defs[da.derived_from_url]
            arts.changelog_pairs.append((parent, da))

    return arts


# ── Validation passes ────────────────────────────────────────────────────────


def _lint_pass(
    title: str,
    artifacts: list[ArtifactFile],
    **lint_kwargs: Any,
) -> PassResult:
    """Run lint() on each artifact and collect results."""
    if not artifacts:
        return PassResult(title=title, empty=True)

    pr = PassResult(title=title)
    for a in artifacts:
        diags = lint(a.doc, **lint_kwargs)
        errors = [d for d in diags if d.severity == "error"]
        warnings = [d for d in diags if d.severity == "warning"]
        pr.items.append(
            PassItemResult(
                label=a.path.name,
                error_count=len(errors),
                warning_count=len(warnings),
                diagnostics=diags,
            )
        )
    return pr


def _pass_definition_linting(arts: DiscoveredArtifacts) -> PassResult:
    all_defs = list(arts.definitions.values()) + list(arts.fragments.values())
    regs = [r.doc for r in arts.registries]
    return _lint_pass("Definition linting", all_defs, registry_documents=regs)


def _pass_sidecar_linting(arts: DiscoveredArtifacts) -> PassResult:
    sidecars: list[ArtifactFile] = []
    sidecars.extend(arts.mappings)
    sidecars.extend(arts.changelogs)
    return _lint_pass("Sidecar document linting (mapping, changelog)", sidecars)


def _pass_theme_linting(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.themes:
        return PassResult(title="Theme linting (with definition context)", empty=True)

    all_defs = {**arts.definitions, **arts.fragments}
    pr = PassResult(title="Theme linting (with definition context)")
    for theme in arts.themes:
        paired_def = all_defs.get(theme.target_def_url)
        kwargs: dict[str, Any] = {}
        if paired_def:
            kwargs["component_definition"] = paired_def.doc

        diags = lint(theme.doc, **kwargs)
        errors = [d for d in diags if d.severity == "error"]
        warnings = [d for d in diags if d.severity == "warning"]

        label = theme.path.name
        if paired_def:
            label += f" (def: {paired_def.path.name})"

        pr.items.append(
            PassItemResult(
                label=label,
                error_count=len(errors),
                warning_count=len(warnings),
                diagnostics=diags,
            )
        )
    return pr


def _pass_component_linting(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.components:
        return PassResult(title="Component linting (with definition context)", empty=True)

    all_defs = {**arts.definitions, **arts.fragments}
    pr = PassResult(title="Component linting (with definition context)")
    for comp in arts.components:
        paired_def = all_defs.get(comp.target_def_url)
        kwargs: dict[str, Any] = {}
        if paired_def:
            kwargs["component_definition"] = paired_def.doc

        diags = lint(comp.doc, **kwargs)
        errors = [d for d in diags if d.severity == "error"]
        warnings = [d for d in diags if d.severity == "warning"]

        label = comp.path.name
        if paired_def:
            label += f" (def: {paired_def.path.name})"

        pr.items.append(
            PassItemResult(
                label=label,
                error_count=len(errors),
                warning_count=len(warnings),
                diagnostics=diags,
            )
        )
    return pr


def _pass_response_schema(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.responses:
        return PassResult(title="Response fixture schema validation", empty=True)

    sv = SchemaValidator()
    pr = PassResult(title="Response fixture schema validation")
    for resp in arts.responses:
        result = sv.validate(resp.doc)
        errors = [d for d in result.diagnostics if d.severity == "error"]
        warnings = [d for d in result.diagnostics if d.severity == "warning"]
        pr.items.append(
            PassItemResult(
                label=resp.path.name,
                error_count=len(errors),
                warning_count=len(warnings),
                diagnostics=result.diagnostics,
            )
        )
    return pr


def _pass_runtime_evaluation(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.responses or not arts.definitions:
        return PassResult(title="Runtime evaluation (DefinitionEvaluator)", empty=True)

    registries = []
    for reg_art in arts.registries:
        try:
            registries.append(Registry(reg_art.doc))
        except Exception:
            pass

    evaluators: dict[tuple[str, str], DefinitionEvaluator] = {}
    for identity, da in arts.definition_versions.items():
        evaluators[identity] = create_form_processor(da.doc, registries=registries)

    pr = PassResult(title="Runtime evaluation (DefinitionEvaluator)")
    for resp in arts.responses:
        ev = evaluators.get((resp.definition_url, resp.definition_version))
        if not ev:
            message = (
                "No definition found for pinned response "
                f"{resp.definition_url}@{resp.definition_version}"
            )
            available_versions = sorted(
                version
                for (url, version) in arts.definition_versions
                if url == resp.definition_url
            )
            if available_versions:
                message += f"; available versions: {', '.join(available_versions)}"

            pr.items.append(
                PassItemResult(
                    label=resp.path.name,
                    error_count=1,
                    runtime_results=[
                        {"severity": "error", "message": message, "path": ""}
                    ],
                )
            )
            continue

        data = resp.doc.get("data", {})
        mode = "submit" if resp.status == "completed" else "continuous"
        result = ev.process(data, mode=mode)

        errors = [r for r in result.results if r["severity"] == "error"]
        warnings = [r for r in result.results if r["severity"] == "warning"]

        if mode == "submit":
            pr.items.append(
                PassItemResult(
                    label=f"{resp.path.name} ({mode})",
                    error_count=len(errors),
                    warning_count=len(warnings),
                    runtime_results=result.results,
                )
            )
        else:
            # Continuous-mode errors are expected — show summary only
            summary = f"valid={result.valid}, {len(errors)} error(s), {len(warnings)} warning(s) (expected for in-progress)"
            pr.items.append(
                PassItemResult(
                    label=f"{resp.path.name} ({mode})",
                    runtime_results=[
                        {"severity": "info", "message": summary, "path": ""}
                    ],
                )
            )
    return pr


def _pass_mapping_forward(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.mappings:
        return PassResult(title="Mapping engine (forward transform)", empty=True)

    pr = PassResult(title="Mapping engine (forward transform)")

    # Index completed responses by definition URL
    completed: dict[str, list[ResponseArtifact]] = {}
    for resp in arts.responses:
        if resp.status == "completed":
            completed.setdefault(resp.definition_url, []).append(resp)

    for mapping in arts.mappings:
        try:
            engine = create_mapping_engine(mapping.doc)
        except Exception as e:
            pr.items.append(
                PassItemResult(
                    label=f"MappingEngine init ({mapping.path.name})",
                    error_count=1,
                    runtime_results=[
                        {"severity": "error", "message": str(e), "path": ""}
                    ],
                )
            )
            continue

        matching_responses = completed.get(mapping.definition_ref, [])
        if not matching_responses:
            pr.items.append(
                PassItemResult(
                    label=f"{mapping.path.name} (no matching completed responses)"
                )
            )
            continue

        for resp in matching_responses:
            data = resp.doc.get("data", {})
            try:
                result = engine.forward(data)
                keys = len(result)
                pr.items.append(
                    PassItemResult(
                        label=f"forward({resp.path.name}) via {mapping.path.name}",
                        runtime_results=[
                            {
                                "severity": "info",
                                "message": f"{keys} top-level keys in output",
                                "path": "",
                            }
                        ],
                    )
                )
            except Exception as e:
                pr.items.append(
                    PassItemResult(
                        label=f"forward({resp.path.name}) via {mapping.path.name}",
                        error_count=1,
                        runtime_results=[
                            {"severity": "error", "message": str(e), "path": ""}
                        ],
                    )
                )
    return pr


def _pass_changelog_generation(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.changelog_pairs:
        return PassResult(title="Changelog generation", empty=True)

    sv = SchemaValidator()
    pr = PassResult(title="Changelog generation")

    for parent, child in arts.changelog_pairs:
        pair_label = f"{parent.path.name} → {child.path.name}"
        try:
            changelog = generate_changelog(parent.doc, child.doc, child.url)
        except Exception as e:
            pr.items.append(
                PassItemResult(
                    label=f"generate_changelog({pair_label})",
                    error_count=1,
                    runtime_results=[
                        {"severity": "error", "message": str(e), "path": ""}
                    ],
                )
            )
            continue

        changes = changelog.get("changes", [])
        impact = changelog.get("semverImpact", "unknown")
        pr.items.append(
            PassItemResult(
                label=f"generate_changelog({pair_label})",
                runtime_results=[
                    {
                        "severity": "info",
                        "message": f"{len(changes)} change(s), semverImpact={impact}",
                        "path": "",
                    }
                ],
            )
        )

        # Validate the generated changelog against schema
        result = sv.validate(changelog)
        errors = [d for d in result.diagnostics if d.severity == "error"]
        warnings = [d for d in result.diagnostics if d.severity == "warning"]
        pr.items.append(
            PassItemResult(
                label="generated changelog schema",
                error_count=len(errors),
                warning_count=len(warnings),
                diagnostics=result.diagnostics,
            )
        )
    return pr


def _walk_items(items: list) -> list[dict]:
    """Recursively yield all items from a definition item tree."""
    result = []
    for item in items:
        result.append(item)
        result.extend(_walk_items(item.get("children", [])))
    return result


def _collect_full_paths(items: list, prefix: str, paths: set) -> None:
    """Build full dotted paths for all items (e.g. 'expenditures.employment')."""
    for item in items:
        key = item.get("key")
        if not key:
            continue
        full = f"{prefix}{key}" if prefix else key
        paths.add(full)
        children = item.get("children", [])
        if children:
            _collect_full_paths(children, f"{full}.", paths)


def _pass_registry(arts: DiscoveredArtifacts) -> PassResult:
    if not arts.registries:
        return PassResult(title="Extension registry", empty=True)

    all_defs = {**arts.definitions, **arts.fragments}
    pr = PassResult(title="Extension registry")

    for reg_file in arts.registries:
        try:
            registry = Registry(reg_file.doc)
        except Exception as e:
            pr.items.append(
                PassItemResult(
                    label=f"Registry init ({reg_file.path.name})",
                    error_count=1,
                    runtime_results=[
                        {"severity": "error", "message": str(e), "path": ""}
                    ],
                )
            )
            continue

        issues = registry.validate()
        if issues:
            pr.items.append(
                PassItemResult(
                    label=f"registry.validate() ({reg_file.path.name})",
                    error_count=len(issues),
                    runtime_results=[
                        {"severity": "error", "message": issue, "path": ""}
                        for issue in issues
                    ],
                )
            )
        else:
            pr.items.append(
                PassItemResult(
                    label=f"registry.validate() ({reg_file.path.name})",
                    runtime_results=[
                        {
                            "severity": "info",
                            "message": "0 consistency issues",
                            "path": "",
                        }
                    ],
                )
            )

    # Resolve extensions referenced in definitions
    for da in all_defs.values():
        ext_names: set[str] = set()
        for item in _walk_items(da.doc.get("items", [])):
            for ext_key in item.get("extensions", {}).keys():
                ext_names.add(ext_key)

        if not ext_names:
            continue

        # Try to resolve against all loaded registries
        for ext_name in sorted(ext_names):
            found = False
            for reg_file in arts.registries:
                try:
                    reg = Registry(reg_file.doc)
                    entry = reg.find_one(ext_name)
                    if entry:
                        pr.items.append(
                            PassItemResult(
                                label=f"{da.path.name}: {ext_name}",
                                runtime_results=[
                                    {
                                        "severity": "info",
                                        "message": f"v{entry.version} ({entry.status})",
                                        "path": "",
                                    }
                                ],
                            )
                        )
                        found = True
                        break
                except Exception:
                    pass
            if not found:
                pr.items.append(
                    PassItemResult(
                        label=f"{da.path.name}: {ext_name}",
                        error_count=1,
                        runtime_results=[
                            {
                                "severity": "error",
                                "message": "not found in registry",
                                "path": "",
                            }
                        ],
                    )
                )
    return pr


def _pass_fel_expressions(arts: DiscoveredArtifacts) -> PassResult:
    all_defs = list(arts.definitions.values()) + list(arts.fragments.values())
    if not all_defs:
        return PassResult(
            title="FEL expression parsing & dependency resolution", empty=True
        )

    pr = PassResult(title="FEL expression parsing & dependency resolution")

    for da in all_defs:
        items = da.doc.get("items", [])
        binds = da.doc.get("binds", [])
        shapes = da.doc.get("shapes", [])

        # Build set of all known item paths
        known_paths: set[str] = set()
        for item in _walk_items(items):
            key = item.get("key")
            if key:
                known_paths.add(key)
        _collect_full_paths(items, "", known_paths)
        known_paths_norm = {_normalize_dep_path(p) for p in known_paths}

        # Collect all FEL expressions from binds and shapes
        fel_exprs: list[tuple[str, str]] = []
        for bind in binds:
            path = bind.get("path", "?")
            for prop in ("calculate", "constraint", "relevant", "readonly", "required"):
                expr = bind.get(prop)
                if isinstance(expr, str) and expr not in ("true", "false"):
                    fel_exprs.append((f"bind:{path}.{prop}", expr))
            default = bind.get("default")
            if isinstance(default, str) and default.startswith("="):
                fel_exprs.append((f"bind:{path}.default", default[1:]))
            cm = bind.get("constraintMessage")
            if isinstance(cm, str) and "{{" in cm:
                for m in re.finditer(r"\{\{(.+?)\}\}", cm):
                    fel_exprs.append((f"bind:{path}.constraintMessage", m.group(1)))

        for shape in shapes:
            sid = shape.get("id", "?")
            for prop in ("constraint", "activeWhen"):
                expr = shape.get(prop)
                if isinstance(expr, str):
                    fel_exprs.append((f"shape:{sid}.{prop}", expr))
            msg = shape.get("message", "")
            if "{{" in msg:
                for m in re.finditer(r"\{\{(.+?)\}\}", msg):
                    fel_exprs.append((f"shape:{sid}.message", m.group(1)))

        parse_errors = 0
        dep_warnings = 0
        for location, expr in fel_exprs:
            try:
                deps = extract_dependencies(expr)
            except FelSyntaxError:
                parse_errors += 1
                continue

            for dep_field in deps.fields:
                if not _is_dependency_resolved(dep_field, location, known_paths_norm):
                    dep_warnings += 1

        expr_count = len(fel_exprs)
        if parse_errors:
            pr.items.append(
                PassItemResult(
                    label=da.path.name,
                    error_count=parse_errors,
                    runtime_results=[
                        {
                            "severity": "error",
                            "message": f"{parse_errors} parse error(s) in {expr_count} expressions",
                            "path": "",
                        }
                    ],
                )
            )
        else:
            pr.items.append(
                PassItemResult(
                    label=da.path.name,
                    runtime_results=[
                        {
                            "severity": "info",
                            "message": f"{expr_count} FEL expressions parsed, {dep_warnings} unresolved dep(s)",
                            "path": "",
                        }
                    ],
                )
            )
    return pr


def _is_dependency_resolved(dep_field: str, location: str, known_paths: set[str]) -> bool:
    """Resolve absolute and context-relative FEL field deps against known definition paths."""
    dep = _normalize_dep_path(dep_field)
    if dep in known_paths:
        return True

    bind_path = _location_bind_path(location)
    if bind_path is None:
        return False

    bind_norm = _normalize_dep_path(bind_path)
    parts = bind_norm.split(".")
    if parts:
        parts = parts[:-1]  # parent scope of the current bind field

    # Resolve relative deps by walking up parent scopes and testing suffix joins.
    for i in range(len(parts), -1, -1):
        candidate = ".".join([*parts[:i], dep]) if dep else ".".join(parts[:i])
        if candidate in known_paths:
            return True

    return False


def _normalize_dep_path(path: str) -> str:
    """Normalize path for dep matching by removing root markers and wildcard/indices."""
    normalized = canonical_item_path(path)
    normalized = re.sub(r"\[\*]|\[\d+]", "", normalized)
    return normalized


def _location_bind_path(location: str) -> str | None:
    """Extract bind path from a location label like `bind:path.prop`."""
    if not location.startswith("bind:"):
        return None
    payload = location[len("bind:") :]
    dot = payload.rfind(".")
    return payload[:dot] if dot != -1 else payload


# ── Orchestrator ─────────────────────────────────────────────────────────────


def validate_all(artifacts: DiscoveredArtifacts) -> ValidationReport:
    """Run all 9 validation passes and return a structured report."""
    return ValidationReport(
        passes=[
            _pass_definition_linting(artifacts),
            _pass_sidecar_linting(artifacts),
            _pass_theme_linting(artifacts),
            _pass_component_linting(artifacts),
            _pass_response_schema(artifacts),
            _pass_runtime_evaluation(artifacts),
            _pass_mapping_forward(artifacts),
            _pass_changelog_generation(artifacts),
            _pass_registry(artifacts),
            _pass_fel_expressions(artifacts),
        ]
    )


# ── Terminal output ──────────────────────────────────────────────────────────


def print_report(report: ValidationReport, *, title: str | None = None) -> int:
    """Print colored terminal output. Returns total error count (0 = success)."""
    header = title or "Artifact Validation"
    print(f"\033[1m═══ {header} ═══\033[0m")

    total_errors = 0
    for i, pr in enumerate(report.passes, 1):
        print(f"\n\033[1m{i}. {pr.title}\033[0m")

        if pr.empty:
            print("  (no artifacts)")
            continue

        for item in pr.items:
            total_errors += item.error_count
            pad = "  "

            if item.diagnostics:
                # Lint-style output
                if not item.diagnostics:
                    print(f"{pad}\033[32m✓\033[0m {item.label}: 0 diagnostics")
                else:
                    marker = (
                        "\033[31m✗\033[0m"
                        if item.error_count
                        else "\033[33m!\033[0m"
                    )
                    print(
                        f"{pad}{marker} {item.label}: "
                        f"{item.error_count} error(s), {item.warning_count} warning(s)"
                    )
                    for d in item.diagnostics:
                        color = "\033[31m" if d.severity == "error" else "\033[33m"
                        print(
                            f"{pad}  {color}{d.severity.upper()}\033[0m "
                            f"{d.code} {d.path}: {d.message}"
                        )
            elif item.runtime_results:
                # Runtime-style output
                has_errors = any(
                    r["severity"] == "error" for r in item.runtime_results
                )
                if has_errors:
                    marker = "\033[31m✗\033[0m"
                elif any(
                    r["severity"] == "warning" for r in item.runtime_results
                ):
                    marker = "\033[33m!\033[0m"
                else:
                    marker = "\033[32m✓\033[0m"

                # Single-line summary for info-only results
                if (
                    len(item.runtime_results) == 1
                    and item.runtime_results[0]["severity"] == "info"
                ):
                    msg = item.runtime_results[0]["message"]
                    print(f"{pad}{marker} {item.label} — {msg}")
                else:
                    errors = [
                        r for r in item.runtime_results if r["severity"] == "error"
                    ]
                    warnings = [
                        r
                        for r in item.runtime_results
                        if r["severity"] == "warning"
                    ]
                    print(
                        f"{pad}{marker} {item.label}: "
                        f"valid={'false' if errors else 'true'}, "
                        f"{len(errors)} error(s), {len(warnings)} warning(s)"
                    )
                    for r in item.runtime_results:
                        color = (
                            "\033[31m"
                            if r["severity"] == "error"
                            else "\033[33m"
                        )
                        code = r.get("code", "?")
                        print(
                            f"{pad}  {color}{r['severity'].upper()}\033[0m "
                            f"{code} {r['path']}: {r['message']}"
                        )
            else:
                # No diagnostics, no runtime results — clean
                print(f"{pad}\033[32m✓\033[0m {item.label}: 0 diagnostics")

    print()
    if total_errors == 0:
        print("\033[32;1m✓ All artifacts clean — 0 errors\033[0m")
    else:
        print(f"\033[31;1m✗ {total_errors} total error(s)\033[0m")
    return 1 if total_errors else 0


# ── CLI ──────────────────────────────────────────────────────────────────────


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        prog="formspec-validate",
        description="Auto-discover and validate all Formspec JSON artifacts in a directory.",
    )
    parser.add_argument(
        "directory",
        type=Path,
        help="Directory containing Formspec JSON artifacts",
    )
    parser.add_argument(
        "--registry",
        type=Path,
        action="append",
        default=[],
        help="Additional registry JSON file(s) to include (repeatable)",
    )
    parser.add_argument(
        "--fixtures",
        action="append",
        default=[],
        help="Subdirectory name(s) to scan for fixtures (default: 'fixtures')",
    )
    parser.add_argument(
        "--title",
        help="Title shown in the report header",
    )
    args = parser.parse_args(argv)

    directory = args.directory.resolve()
    if not directory.is_dir():
        print(f"Error: {args.directory} is not a directory", file=sys.stderr)
        return 2

    fixture_subdirs = tuple(args.fixtures) if args.fixtures else ("fixtures",)
    registry_paths = tuple(p.resolve() for p in args.registry)

    artifacts = discover_artifacts(
        directory,
        fixture_subdirs=fixture_subdirs,
        registry_paths=registry_paths,
    )
    title = args.title or directory.name
    return print_report(validate_all(artifacts), title=title)


if __name__ == "__main__":
    raise SystemExit(main())
