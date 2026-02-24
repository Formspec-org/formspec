"""Tests for the Formspec Changelog generation (Phase 12).

Tests cover: diffing items/binds/shapes, impact classification,
semver impact computation, metadata changes, screener/migration changes.
"""

import pytest
from formspec.changelog import generate_changelog


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _def(version='1.0.0', **kwargs):
    """Build a minimal definition."""
    d = {
        '$formspec': '1.0',
        'url': 'https://example.org/form',
        'version': version,
        'title': 'Test Form',
        'items': [],
    }
    d.update(kwargs)
    return d


def _changelog(old, new, url='https://example.org/form'):
    return generate_changelog(old, new, url)


# ===========================================================================
# Item diffing
# ===========================================================================

class TestItemDiff:
    def test_added_item(self):
        old = _def(items=[])
        new = _def(version='1.1.0', items=[
            {'key': 'name', 'type': 'field', 'dataType': 'string', 'label': 'Name'},
        ])
        cl = _changelog(old, new)
        assert len(cl['changes']) == 2  # item added + version metadata changed
        item_change = next(c for c in cl['changes'] if c['target'] == 'item')
        assert item_change['type'] == 'added'
        assert item_change['path'] == 'items.name'
        assert item_change['impact'] == 'compatible'

    def test_removed_item(self):
        old = _def(items=[
            {'key': 'age', 'type': 'field', 'dataType': 'integer', 'label': 'Age'},
        ])
        new = _def(version='2.0.0', items=[])
        cl = _changelog(old, new)
        item_change = next(c for c in cl['changes'] if c['target'] == 'item')
        assert item_change['type'] == 'removed'
        assert item_change['impact'] == 'breaking'

    def test_modified_item_type_change_is_breaking(self):
        old = _def(items=[
            {'key': 'val', 'type': 'field', 'dataType': 'string', 'label': 'Val'},
        ])
        new = _def(version='2.0.0', items=[
            {'key': 'val', 'type': 'field', 'dataType': 'integer', 'label': 'Val'},
        ])
        cl = _changelog(old, new)
        item_change = next(c for c in cl['changes'] if c['target'] == 'item')
        assert item_change['type'] == 'modified'
        assert item_change['impact'] == 'breaking'

    def test_modified_item_label_only_is_cosmetic(self):
        old = _def(items=[
            {'key': 'name', 'type': 'field', 'dataType': 'string', 'label': 'Name'},
        ])
        new = _def(items=[
            {'key': 'name', 'type': 'field', 'dataType': 'string', 'label': 'Full Name'},
        ])
        cl = _changelog(old, new)
        item_change = next(c for c in cl['changes'] if c['target'] == 'item')
        assert item_change['type'] == 'modified'
        assert item_change['impact'] == 'cosmetic'


# ===========================================================================
# Bind diffing
# ===========================================================================

class TestBindDiff:
    def test_added_required_bind_is_breaking(self):
        old = _def(binds=[])
        new = _def(binds=[{'path': 'name', 'required': True}])
        cl = _changelog(old, new)
        bind_change = next(c for c in cl['changes'] if c['target'] == 'bind')
        assert bind_change['type'] == 'added'
        assert bind_change['impact'] == 'breaking'

    def test_added_optional_bind_is_compatible(self):
        old = _def(binds=[])
        new = _def(binds=[{'path': 'name', 'readonly': True}])
        cl = _changelog(old, new)
        bind_change = next(c for c in cl['changes'] if c['target'] == 'bind')
        assert bind_change['impact'] == 'compatible'

    def test_removed_bind_is_breaking(self):
        old = _def(binds=[{'path': 'name', 'required': True}])
        new = _def(binds=[])
        cl = _changelog(old, new)
        bind_change = next(c for c in cl['changes'] if c['target'] == 'bind')
        assert bind_change['type'] == 'removed'
        assert bind_change['impact'] == 'breaking'

    def test_modified_bind_adding_required_is_breaking(self):
        old = _def(binds=[{'path': 'email'}])
        new = _def(binds=[{'path': 'email', 'required': True}])
        cl = _changelog(old, new)
        bind_change = next(c for c in cl['changes'] if c['target'] == 'bind')
        assert bind_change['impact'] == 'breaking'

    def test_modified_bind_removing_required_is_compatible(self):
        old = _def(binds=[{'path': 'email', 'required': True}])
        new = _def(binds=[{'path': 'email'}])
        cl = _changelog(old, new)
        bind_change = next(c for c in cl['changes'] if c['target'] == 'bind')
        assert bind_change['impact'] == 'compatible'


# ===========================================================================
# Shape diffing
# ===========================================================================

class TestShapeDiff:
    def test_added_shape(self):
        old = _def(shapes=[])
        new = _def(shapes=[{'name': 'ageCheck', 'constraint': 'age >= 0'}])
        cl = _changelog(old, new)
        shape_change = next(c for c in cl['changes'] if c['target'] == 'shape')
        assert shape_change['type'] == 'added'
        assert shape_change['impact'] == 'compatible'

    def test_removed_shape_is_compatible(self):
        """Removing validation loosens constraints — compatible."""
        old = _def(shapes=[{'name': 'ageCheck', 'constraint': 'age >= 0'}])
        new = _def(shapes=[])
        cl = _changelog(old, new)
        shape_change = next(c for c in cl['changes'] if c['target'] == 'shape')
        assert shape_change['type'] == 'removed'
        assert shape_change['impact'] == 'compatible'


# ===========================================================================
# Metadata diffing
# ===========================================================================

class TestMetadataDiff:
    def test_title_change_is_cosmetic(self):
        old = _def(title='Old Title')
        new = _def(title='New Title')
        cl = _changelog(old, new)
        meta_change = next(c for c in cl['changes'] if c['target'] == 'metadata')
        assert meta_change['type'] == 'modified'
        assert meta_change['path'] == 'title'
        assert meta_change['impact'] == 'cosmetic'

    def test_version_change_tracked(self):
        old = _def(version='1.0.0')
        new = _def(version='2.0.0')
        cl = _changelog(old, new)
        ver_change = next(c for c in cl['changes'] if c['path'] == 'version')
        assert ver_change['type'] == 'modified'
        assert ver_change['before'] == '1.0.0'
        assert ver_change['after'] == '2.0.0'


# ===========================================================================
# Screener and migration
# ===========================================================================

class TestScreenerMigration:
    def test_screener_added(self):
        old = _def()
        new = _def(screener={'routes': [{'target': '/next'}]})
        cl = _changelog(old, new)
        sc = next(c for c in cl['changes'] if c['target'] == 'screener')
        assert sc['type'] == 'added'
        assert sc['impact'] == 'compatible'

    def test_screener_removed_is_breaking(self):
        old = _def(screener={'routes': [{'target': '/next'}]})
        new = _def()
        cl = _changelog(old, new)
        sc = next(c for c in cl['changes'] if c['target'] == 'screener')
        assert sc['type'] == 'removed'
        assert sc['impact'] == 'breaking'

    def test_migration_added(self):
        old = _def()
        new = _def(migrations=[{'fromVersion': '1.0.0', 'changes': []}])
        cl = _changelog(old, new)
        mc = next(c for c in cl['changes'] if c['target'] == 'migration')
        assert mc['type'] == 'added'
        assert mc['impact'] == 'compatible'


# ===========================================================================
# Semver impact computation
# ===========================================================================

class TestSemverImpact:
    def test_breaking_change_yields_major(self):
        old = _def(items=[
            {'key': 'x', 'type': 'field', 'dataType': 'string', 'label': 'X'},
        ])
        new = _def(version='2.0.0', items=[])
        cl = _changelog(old, new)
        assert cl['semverImpact'] == 'major'

    def test_compatible_change_yields_minor(self):
        old = _def(items=[])
        new = _def(version='1.1.0', items=[
            {'key': 'x', 'type': 'field', 'dataType': 'string', 'label': 'X'},
        ])
        cl = _changelog(old, new)
        assert cl['semverImpact'] == 'minor'

    def test_cosmetic_change_yields_patch(self):
        old = _def(title='Old')
        new = _def(title='New')
        cl = _changelog(old, new)
        assert cl['semverImpact'] == 'patch'

    def test_no_changes_yields_patch(self):
        d = _def()
        cl = _changelog(d, d)
        assert cl['semverImpact'] == 'patch'


# ===========================================================================
# Output structure
# ===========================================================================

class TestOutputStructure:
    def test_required_fields_present(self):
        old = _def()
        new = _def(version='1.1.0', items=[
            {'key': 'x', 'type': 'field', 'dataType': 'string', 'label': 'X'},
        ])
        cl = _changelog(old, new)
        assert 'definitionUrl' in cl
        assert 'fromVersion' in cl
        assert 'toVersion' in cl
        assert 'semverImpact' in cl
        assert 'changes' in cl
        assert 'generatedAt' in cl

    def test_change_has_required_fields(self):
        old = _def(items=[])
        new = _def(items=[
            {'key': 'x', 'type': 'field', 'dataType': 'string', 'label': 'X'},
        ])
        cl = _changelog(old, new)
        for change in cl['changes']:
            assert 'type' in change
            assert 'target' in change
            assert 'path' in change
            assert 'impact' in change
