import { v4 as uuidv4 } from 'uuid';
import type { Project } from 'formspec-studio-core';
import type { SchemaValidationError } from 'formspec-engine';
import { HelperError } from 'formspec-studio-core';

const MAX_PROJECTS = 20;

export interface DraftState {
  definition?: unknown;
  component?: unknown;
  theme?: unknown;
  errors: Map<string, SchemaValidationError[]>;
}

export interface ProjectEntry {
  id: string;
  project: Project | null;
  draft: DraftState | null;
  sourcePath?: string;
}

export class ProjectRegistry {
  private entries = new Map<string, ProjectEntry>();
  private pathIndex = new Map<string, string>();

  newProject(): string {
    if (this.entries.size >= MAX_PROJECTS) {
      throw new HelperError('TOO_MANY_PROJECTS', `Maximum number of open projects (${MAX_PROJECTS}) reached`);
    }
    const id = uuidv4();
    const draft: DraftState = { errors: new Map() };
    this.entries.set(id, { id, project: null, draft });
    return id;
  }

  getEntry(id: string): ProjectEntry {
    const entry = this.entries.get(id);
    if (!entry) {
      throw new HelperError('PROJECT_NOT_FOUND', `Project '${id}' not found`);
    }
    return entry;
  }

  getProject(id: string): Project {
    const entry = this.getEntry(id);
    if (entry.project === null) {
      throw new HelperError('WRONG_PHASE', `Project '${id}' is in bootstrap phase; authoring phase required`, {
        currentPhase: 'bootstrap',
        expectedPhase: 'authoring',
      });
    }
    return entry.project;
  }

  getDraft(id: string): DraftState {
    const entry = this.getEntry(id);
    if (entry.draft === null) {
      throw new HelperError('WRONG_PHASE', `Project '${id}' is in authoring phase; bootstrap phase required`, {
        currentPhase: 'authoring',
        expectedPhase: 'bootstrap',
      });
    }
    return entry.draft;
  }

  transitionToAuthoring(id: string, project: Project): void {
    const entry = this.getEntry(id);
    entry.project = project;
    entry.draft = null;
  }

  registerOpen(path: string, project: Project): string {
    const existing = this.pathIndex.get(path);
    if (existing) {
      return existing;
    }
    if (this.entries.size >= MAX_PROJECTS) {
      throw new HelperError('TOO_MANY_PROJECTS', `Maximum number of open projects (${MAX_PROJECTS}) reached`);
    }
    const id = uuidv4();
    this.entries.set(id, { id, project, draft: null, sourcePath: path });
    this.pathIndex.set(path, id);
    return id;
  }

  close(id: string): void {
    const entry = this.getEntry(id);
    if (entry.sourcePath) {
      this.pathIndex.delete(entry.sourcePath);
    }
    this.entries.delete(id);
  }

  listAll(): ProjectEntry[] {
    return Array.from(this.entries.values());
  }

  authoringProjects(): Array<{ id: string; project: Project; sourcePath?: string }> {
    const result: Array<{ id: string; project: Project; sourcePath?: string }> = [];
    for (const entry of this.entries.values()) {
      if (entry.project !== null) {
        const item: { id: string; project: Project; sourcePath?: string } = {
          id: entry.id,
          project: entry.project,
        };
        if (entry.sourcePath !== undefined) {
          item.sourcePath = entry.sourcePath;
        }
        result.push(item);
      }
    }
    return result;
  }
}
