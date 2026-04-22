/** @filedesc Shared mapping rule types for the mapping workspace. */

export interface MappingRule {
  source?: string;
  sourcePath?: string;
  target?: string;
  targetPath?: string;
  transform?: string;
  expression?: string;
  description?: string;
  priority?: number;
  bidirectional?: boolean;
  condition?: string;
  default?: unknown;
  reverse?: { expression?: string } & Record<string, unknown>;
  innerRules?: MappingRule[];
  [key: string]: unknown;
}
