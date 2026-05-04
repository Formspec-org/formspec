/** @filedesc Single source for workspace tab ids shared by Header and WorkspaceRouterProvider. */

/** All tab ids the router accepts (includes Layout for blueprint deep-links). */
export const WORKSPACE_SHELL_TAB_ORDER = [
  'Editor',
  'Design',
  'Layout',
  'Evidence',
  'Mapping',
  'Preview',
] as const;

export type WorkspaceShellTab = (typeof WORKSPACE_SHELL_TAB_ORDER)[number];

/** Header strip: same order as router except Layout (opened from blueprint / navigate events only). */
export const WORKSPACE_HEADER_TAB_CONFIG = [
  { name: 'Editor', help: 'Build your form structure and manage shared resources' },
  { name: 'Design', help: 'Visual brand, layout regions, and style controls' },
  { name: 'Evidence', help: 'Review source documents, citations, missing coverage, and conflicts' },
  { name: 'Mapping', help: 'Bidirectional data transforms for import/export formats' },
  { name: 'Preview', help: 'Live form preview, behavior lab, and JSON document view' },
] as const satisfies readonly { name: Exclude<WorkspaceShellTab, 'Layout'>; help: string }[];
