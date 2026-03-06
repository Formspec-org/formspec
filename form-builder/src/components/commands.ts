/**
 * @module Studio command palette API.
 * Provides command registry construction and fuzzy search ranking helpers.
 */
import type { Signal } from '@preact/signals';
import type { FormspecItem } from 'formspec-engine';
import {
  addItem,
  deleteItem,
  duplicateItem,
  setJsonEditorOpen,
  setInspectorSectionOpen,
  setMobilePanel,
  setSelection,
  toggleDiagnosticsOpen,
  togglePreviewMode,
  toggleStructurePanel
} from '../state/mutations';
import type { ProjectState } from '../state/project';
import { joinPath } from '../state/wiring';

/** Command palette grouping used for sorting and display. */
export type CommandCategory = 'Navigation' | 'Actions' | 'Advanced';

/** Command palette action descriptor. */
export interface StudioCommand {
  id: string;
  title: string;
  subtitle?: string;
  shortcut?: string;
  category: CommandCategory;
  keywords?: string[];
  run: () => void;
}

/** Ranked command match produced by `searchCommands`. */
export interface CommandSearchResult {
  command: StudioCommand;
  score: number;
}

const RECENT_COMMANDS_KEY = 'studio_recent_commands';
const RECENT_COMMANDS_MAX = 8;

/** Records a command execution in the recency store. */
export function recordCommandUsed(commandId: string): void {
  try {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    const recent: string[] = stored ? (JSON.parse(stored) as string[]) : [];
    const filtered = recent.filter((id) => id !== commandId);
    filtered.unshift(commandId);
    localStorage.setItem(RECENT_COMMANDS_KEY, JSON.stringify(filtered.slice(0, RECENT_COMMANDS_MAX)));
  } catch {
    // localStorage unavailable — silently ignore
  }
}

/** Returns recently-used command IDs in order of most recent first. */
function loadRecentCommandIds(): string[] {
  try {
    const stored = localStorage.getItem(RECENT_COMMANDS_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

interface FieldReference {
  path: string;
  key: string;
  label: string;
}

/** Builds command palette entries for the current project snapshot. */
export function buildStudioCommands(project: Signal<ProjectState>): StudioCommand[] {
  const state = project.value;
  const formTitle = state.definition.title ?? 'Untitled Form';
  const fieldReferences = collectFieldReferences(state.definition.items);

  const navigationCommands: StudioCommand[] = [
    {
      id: 'nav-form-settings',
      title: 'Go to form settings',
      category: 'Navigation',
      keywords: ['form', 'settings', 'inspector', 'metadata'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
      }
    },
    {
      id: 'nav-page-main',
      title: `Go to page: ${formTitle}`,
      category: 'Navigation',
      subtitle: 'Main page',
      keywords: [formTitle, 'page', 'form'],
      run: () => {
        setSelection(project, null);
      }
    },
    ...fieldReferences.map((field) => ({
      id: `nav-field-${field.path.replaceAll('.', '-')}`,
      title: `Go to field: ${field.label}`,
      category: 'Navigation' as const,
      keywords: [field.label, field.key, field.path, 'field', 'navigate'],
      run: () => {
        setSelection(project, field.path);
        setMobilePanel(project, 'inspector');
      }
    }))
  ];

  const actionCommands: StudioCommand[] = [
    {
      id: 'action-add-field',
      title: 'Add field',
      category: 'Actions',
      keywords: ['insert', 'new', 'field'],
      run: () => {
        addItem(project, {
          type: 'field',
          dataType: 'string',
          key: 'field',
          label: 'Untitled field',
          parentPath: null
        });
      }
    },
    {
      id: 'action-duplicate-field',
      title: 'Duplicate selected field',
      shortcut: '⌘D',
      category: 'Actions',
      keywords: ['duplicate', 'copy', 'clone', 'field'],
      run: () => {
        const sel = project.value.selection;
        if (sel) {
          duplicateItem(project, sel);
        }
      }
    },
    {
      id: 'action-delete-field',
      title: 'Delete selected field',
      shortcut: '⌫',
      category: 'Actions',
      keywords: ['delete', 'remove', 'field'],
      run: () => {
        const sel = project.value.selection;
        if (sel) {
          deleteItem(project, sel);
        }
      }
    },
    {
      id: 'action-toggle-preview',
      title: 'Toggle preview',
      shortcut: '⌘⇧P',
      category: 'Actions',
      keywords: ['preview', 'view'],
      run: () => {
        togglePreviewMode(project);
      }
    },
    {
      id: 'action-toggle-structure',
      title: 'Toggle structure panel',
      shortcut: '⌘\\',
      category: 'Actions',
      keywords: ['structure', 'tree', 'panel'],
      run: () => {
        toggleStructurePanel(project);
      }
    },
    {
      id: 'action-form-rules',
      title: 'Open form rules',
      category: 'Actions',
      keywords: ['shapes', 'rules', 'constraint'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
        setInspectorSectionOpen(project, 'form:rules', true);
      }
    },
    {
      id: 'action-insert-subform',
      title: 'Insert sub-form',
      category: 'Actions',
      keywords: ['insert', 'subform', 'sub-form', 'ref', 'import'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
        setInspectorSectionOpen(project, 'form:subforms', true);
      }
    },
    {
      id: 'action-mapping-editor',
      title: 'Open mapping editor',
      category: 'Actions',
      keywords: ['mapping', 'rules', 'roundtrip', 'integration'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
        setInspectorSectionOpen(project, 'form:mapping', true);
      }
    },
    {
      id: 'action-extension-browser',
      title: 'Open extension browser',
      category: 'Actions',
      keywords: ['extensions', 'registry', 'custom', 'functions', 'data types'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
        setInspectorSectionOpen(project, 'form:extensions', true);
      }
    },
    {
      id: 'action-import-export',
      title: 'Open import export',
      category: 'Actions',
      keywords: ['import', 'export', 'template', 'bundle', 'download', 'upload'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
        setInspectorSectionOpen(project, 'form:import-export', true);
      }
    },
    {
      id: 'action-version-management',
      title: 'Open version management',
      category: 'Actions',
      keywords: ['version', 'publish', 'changelog', 'release'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
        setInspectorSectionOpen(project, 'form:version', true);
      }
    },
    {
      id: 'action-form-settings',
      title: 'Open form settings',
      category: 'Actions',
      keywords: ['settings', 'form', 'inspector'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
      }
    }
  ];

  const advancedCommands: StudioCommand[] = [
    {
      id: 'advanced-json-editor',
      title: 'Open JSON editor',
      shortcut: '⌘⇧J',
      category: 'Advanced',
      keywords: ['json', 'raw', 'editor'],
      run: () => {
        setJsonEditorOpen(project, true, 'definition');
      }
    },
    {
      id: 'advanced-validate',
      title: 'Validate form',
      category: 'Advanced',
      keywords: ['validate', 'diagnostics', 'errors'],
      run: () => {
        if (!project.value.uiState.diagnosticsOpen) {
          toggleDiagnosticsOpen(project);
        }
      }
    },
    {
      id: 'advanced-export',
      title: 'Export artifacts',
      category: 'Advanced',
      keywords: ['export', 'download', 'bundle'],
      run: () => {
        setSelection(project, null);
        setMobilePanel(project, 'inspector');
        setInspectorSectionOpen(project, 'form:import-export', true);
      }
    }
  ];

  return [...navigationCommands, ...actionCommands, ...advancedCommands];
}

/**
 * Performs token-aware fuzzy search over command title/subtitle/category/keywords.
 * Returns results sorted by descending score.
 */
export function searchCommands(
  commands: StudioCommand[],
  query: string,
  limit = 24
): CommandSearchResult[] {
  const normalizedQuery = normalizeText(query);
  if (!normalizedQuery) {
    const recentIds = loadRecentCommandIds();
    const recentSet = new Map(recentIds.map((id, i) => [id, recentIds.length - i]));
    return [...commands]
      .sort((a, b) => {
        const ra = recentSet.get(a.id) ?? 0;
        const rb = recentSet.get(b.id) ?? 0;
        return rb - ra;
      })
      .slice(0, limit)
      .map((command, index) => ({ command, score: 1000 - index }));
  }

  const queryTokens = normalizedQuery.split(/\s+/).filter(Boolean);
  const results: CommandSearchResult[] = [];

  for (const command of commands) {
    const searchText = buildSearchText(command);
    let score = 0;
    let matched = true;

    for (const token of queryTokens) {
      const tokenScore = scoreToken(searchText, token);
      if (tokenScore < 0) {
        matched = false;
        break;
      }
      score += tokenScore;
    }

    if (!matched) {
      continue;
    }

    const titlePrefix = normalizeText(command.title).startsWith(queryTokens[0] ?? '') ? 24 : 0;
    const categoryBoost = command.category === 'Navigation' ? 3 : 0;
    results.push({
      command,
      score: score + titlePrefix + categoryBoost
    });
  }

  return results
    .sort((left, right) => {
      if (left.score !== right.score) {
        return right.score - left.score;
      }
      return left.command.title.localeCompare(right.command.title);
    })
    .slice(0, limit);
}

function collectFieldReferences(
  items: FormspecItem[],
  parentPath: string | null = null,
  output: FieldReference[] = []
): FieldReference[] {
  for (const item of items) {
    const path = joinPath(parentPath, item.key);
    if (item.type === 'field') {
      output.push({
        path,
        key: item.key,
        label: item.label ?? item.key
      });
    }
    if (item.type === 'group' && item.children?.length) {
      collectFieldReferences(item.children, path, output);
    }
  }
  return output;
}

function buildSearchText(command: StudioCommand): string {
  return normalizeText([command.title, command.subtitle, command.category, ...(command.keywords ?? [])].join(' '));
}

function scoreToken(text: string, token: string): number {
  if (!token) {
    return 0;
  }

  const substringIndex = text.indexOf(token);
  if (substringIndex >= 0) {
    return 220 - Math.min(substringIndex, 180);
  }

  const subsequenceScore = scoreSubsequence(text, token);
  if (subsequenceScore >= 0) {
    return 80 + subsequenceScore;
  }

  return -1;
}

function scoreSubsequence(text: string, token: string): number {
  let textIndex = 0;
  let tokenIndex = 0;
  let gaps = 0;
  let contiguousRuns = 0;
  let activeRun = 0;

  while (textIndex < text.length && tokenIndex < token.length) {
    if (text[textIndex] === token[tokenIndex]) {
      tokenIndex += 1;
      activeRun += 1;
    } else if (activeRun > 0) {
      contiguousRuns += activeRun * activeRun;
      activeRun = 0;
      gaps += 1;
    } else {
      gaps += 1;
    }

    textIndex += 1;
  }

  if (tokenIndex < token.length) {
    return -1;
  }

  contiguousRuns += activeRun * activeRun;
  return Math.max(4, contiguousRuns - gaps);
}

function normalizeText(value: string): string {
  return value.toLowerCase().replace(/\s+/g, ' ').trim();
}
