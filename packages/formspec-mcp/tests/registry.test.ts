import { describe, it, expect, beforeEach } from 'vitest';
import { ProjectRegistry } from '../src/registry.js';
import { Project, createProject } from 'formspec-studio-core';
import { HelperError } from 'formspec-studio-core';

function makeProject(): Project {
  return createProject({ title: 'Test Form' });
}

describe('ProjectRegistry', () => {
  let registry: ProjectRegistry;

  beforeEach(() => {
    registry = new ProjectRegistry();
  });

  // ── newProject ──────────────────────────────────────────────────────

  describe('newProject()', () => {
    it('returns a UUID string', () => {
      const id = registry.newProject();
      expect(typeof id).toBe('string');
      // UUID v4 format
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('starts in bootstrap phase (draft is set, project is null)', () => {
      const id = registry.newProject();
      const entry = registry.getEntry(id);
      expect(entry.draft).not.toBeNull();
      expect(entry.project).toBeNull();
    });

    it('each call returns a unique id', () => {
      const id1 = registry.newProject();
      const id2 = registry.newProject();
      expect(id1).not.toBe(id2);
    });

    it('throws TOO_MANY_PROJECTS when at limit (20)', () => {
      for (let i = 0; i < 20; i++) {
        registry.newProject();
      }
      expect(() => registry.newProject()).toThrow(HelperError);
      try {
        registry.newProject();
      } catch (err) {
        expect((err as HelperError).code).toBe('TOO_MANY_PROJECTS');
      }
    });
  });

  // ── getEntry ────────────────────────────────────────────────────────

  describe('getEntry()', () => {
    it('throws PROJECT_NOT_FOUND for unknown id', () => {
      expect(() => registry.getEntry('nonexistent-id')).toThrow(HelperError);
      try {
        registry.getEntry('nonexistent-id');
      } catch (err) {
        expect((err as HelperError).code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('returns entry for known id', () => {
      const id = registry.newProject();
      const entry = registry.getEntry(id);
      expect(entry.id).toBe(id);
    });
  });

  // ── getProject ──────────────────────────────────────────────────────

  describe('getProject()', () => {
    it('throws PROJECT_NOT_FOUND for unknown id', () => {
      expect(() => registry.getProject('nonexistent-id')).toThrow(HelperError);
      try {
        registry.getProject('nonexistent-id');
      } catch (err) {
        expect((err as HelperError).code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('throws WRONG_PHASE during bootstrap with currentPhase=bootstrap, expectedPhase=authoring', () => {
      const id = registry.newProject();
      expect(() => registry.getProject(id)).toThrow(HelperError);
      try {
        registry.getProject(id);
      } catch (err) {
        const helperErr = err as HelperError;
        expect(helperErr.code).toBe('WRONG_PHASE');
        expect(helperErr.detail).toEqual({
          currentPhase: 'bootstrap',
          expectedPhase: 'authoring',
        });
      }
    });

    it('returns project after transitioning to authoring', () => {
      const id = registry.newProject();
      const project = makeProject();
      registry.transitionToAuthoring(id, project);
      const result = registry.getProject(id);
      expect(result).toBe(project);
    });
  });

  // ── getDraft ────────────────────────────────────────────────────────

  describe('getDraft()', () => {
    it('throws PROJECT_NOT_FOUND for unknown id', () => {
      expect(() => registry.getDraft('nonexistent-id')).toThrow(HelperError);
      try {
        registry.getDraft('nonexistent-id');
      } catch (err) {
        expect((err as HelperError).code).toBe('PROJECT_NOT_FOUND');
      }
    });

    it('returns draft state during bootstrap', () => {
      const id = registry.newProject();
      const draft = registry.getDraft(id);
      expect(draft).not.toBeNull();
      expect(draft.errors).toBeInstanceOf(Map);
    });

    it('throws WRONG_PHASE during authoring with currentPhase=authoring, expectedPhase=bootstrap', () => {
      const id = registry.newProject();
      const project = makeProject();
      registry.transitionToAuthoring(id, project);
      expect(() => registry.getDraft(id)).toThrow(HelperError);
      try {
        registry.getDraft(id);
      } catch (err) {
        const helperErr = err as HelperError;
        expect(helperErr.code).toBe('WRONG_PHASE');
        expect(helperErr.detail).toEqual({
          currentPhase: 'authoring',
          expectedPhase: 'bootstrap',
        });
      }
    });
  });

  // ── transitionToAuthoring ───────────────────────────────────────────

  describe('transitionToAuthoring()', () => {
    it('sets project on entry', () => {
      const id = registry.newProject();
      const project = makeProject();
      registry.transitionToAuthoring(id, project);
      const entry = registry.getEntry(id);
      expect(entry.project).toBe(project);
    });

    it('nulls draft after transition', () => {
      const id = registry.newProject();
      const project = makeProject();
      registry.transitionToAuthoring(id, project);
      const entry = registry.getEntry(id);
      expect(entry.draft).toBeNull();
    });

    it('throws PROJECT_NOT_FOUND for unknown id', () => {
      expect(() => registry.transitionToAuthoring('bad-id', makeProject())).toThrow(HelperError);
      try {
        registry.transitionToAuthoring('bad-id', makeProject());
      } catch (err) {
        expect((err as HelperError).code).toBe('PROJECT_NOT_FOUND');
      }
    });
  });

  // ── registerOpen ────────────────────────────────────────────────────

  describe('registerOpen()', () => {
    it('returns an id for a new path', () => {
      const project = makeProject();
      const id = registry.registerOpen('/some/path/form.json', project);
      expect(typeof id).toBe('string');
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    });

    it('returns same id for same path (idempotent)', () => {
      const project = makeProject();
      const id1 = registry.registerOpen('/some/path/form.json', project);
      const id2 = registry.registerOpen('/some/path/form.json', project);
      expect(id1).toBe(id2);
    });

    it('returns different id for different path', () => {
      const project = makeProject();
      const id1 = registry.registerOpen('/path/a/form.json', project);
      const id2 = registry.registerOpen('/path/b/form.json', project);
      expect(id1).not.toBe(id2);
    });

    it('registers project in authoring phase immediately', () => {
      const project = makeProject();
      const id = registry.registerOpen('/some/path/form.json', project);
      const entry = registry.getEntry(id);
      expect(entry.project).toBe(project);
      expect(entry.draft).toBeNull();
    });

    it('stores sourcePath on entry', () => {
      const project = makeProject();
      const path = '/some/path/form.json';
      const id = registry.registerOpen(path, project);
      const entry = registry.getEntry(id);
      expect(entry.sourcePath).toBe(path);
    });

    it('throws TOO_MANY_PROJECTS when at limit', () => {
      // Fill with newProject first (19 bootstrap + 1 registerOpen)
      for (let i = 0; i < 20; i++) {
        registry.newProject();
      }
      expect(() => registry.registerOpen('/path/overflow.json', makeProject())).toThrow(HelperError);
      try {
        registry.registerOpen('/path/overflow.json', makeProject());
      } catch (err) {
        expect((err as HelperError).code).toBe('TOO_MANY_PROJECTS');
      }
    });
  });

  // ── close ───────────────────────────────────────────────────────────

  describe('close()', () => {
    it('removes entry from registry', () => {
      const id = registry.newProject();
      registry.close(id);
      expect(() => registry.getEntry(id)).toThrow(HelperError);
    });

    it('removes path index entry for path-opened projects', () => {
      const project = makeProject();
      const path = '/some/path/form.json';
      const id = registry.registerOpen(path, project);
      registry.close(id);
      // After close, opening same path should give a new id
      const newProject = makeProject();
      const newId = registry.registerOpen(path, newProject);
      expect(newId).not.toBe(id);
    });

    it('throws PROJECT_NOT_FOUND for unknown id', () => {
      expect(() => registry.close('nonexistent-id')).toThrow(HelperError);
      try {
        registry.close('nonexistent-id');
      } catch (err) {
        expect((err as HelperError).code).toBe('PROJECT_NOT_FOUND');
      }
    });
  });

  // ── listAll ─────────────────────────────────────────────────────────

  describe('listAll()', () => {
    it('returns empty array when no projects', () => {
      expect(registry.listAll()).toEqual([]);
    });

    it('returns all entries', () => {
      const id1 = registry.newProject();
      const id2 = registry.newProject();
      const entries = registry.listAll();
      expect(entries).toHaveLength(2);
      const ids = entries.map((e) => e.id);
      expect(ids).toContain(id1);
      expect(ids).toContain(id2);
    });

    it('includes both bootstrap and authoring entries', () => {
      const bootstrapId = registry.newProject();
      const authoringId = registry.newProject();
      registry.transitionToAuthoring(authoringId, makeProject());
      const entries = registry.listAll();
      expect(entries).toHaveLength(2);
    });
  });

  // ── authoringProjects ───────────────────────────────────────────────

  describe('authoringProjects()', () => {
    it('returns empty array when no projects', () => {
      expect(registry.authoringProjects()).toEqual([]);
    });

    it('returns only authoring-phase projects', () => {
      const bootstrapId = registry.newProject();
      const authoringId = registry.newProject();
      const project = makeProject();
      registry.transitionToAuthoring(authoringId, project);

      const authoring = registry.authoringProjects();
      expect(authoring).toHaveLength(1);
      expect(authoring[0].id).toBe(authoringId);
      expect(authoring[0].project).toBe(project);
    });

    it('includes sourcePath when present', () => {
      const project = makeProject();
      const path = '/some/path/form.json';
      const id = registry.registerOpen(path, project);

      const authoring = registry.authoringProjects();
      expect(authoring).toHaveLength(1);
      expect(authoring[0].sourcePath).toBe(path);
    });

    it('does not include sourcePath when not set', () => {
      const id = registry.newProject();
      registry.transitionToAuthoring(id, makeProject());

      const authoring = registry.authoringProjects();
      expect(authoring).toHaveLength(1);
      expect(authoring[0].sourcePath).toBeUndefined();
    });
  });
});
