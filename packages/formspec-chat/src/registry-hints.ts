/** @filedesc Extracts concise extension hints from a registry document for AI prompt injection. */

export interface RegistryHintEntry {
  name: string;
  category: string;
  description: string;
  baseType?: string;
  constraints?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  parameters?: Array<{ name: string; type: string; description: string }>;
  returns?: string;
  examples?: Array<Record<string, unknown> | string>;
}

/** Minimal registry document shape accepted by {@link extractRegistryHints}. */
export interface RegistryDocument {
  entries: RegistryHintEntry[];
}

/**
 * Extracts a compact text block from a registry document that an AI model
 * can use to generate fields with the correct extension declarations.
 *
 * Groups entries by category (dataType, constraint, function) and produces
 * usage examples the model can follow.
 */
export function extractRegistryHints(registry: RegistryDocument): string {
  const entries = registry.entries.filter(e => e.category !== 'namespace');

  const dataTypes = entries.filter(e => e.category === 'dataType');
  const constraints = entries.filter(e => e.category === 'constraint');
  const functions = entries.filter(e => e.category === 'function');

  const lines: string[] = [];

  if (dataTypes.length > 0) {
    lines.push('## Extension Data Types');
    lines.push('When a field needs one of these types, set `dataType` to the `baseType` and add `"extensions": { "<name>": true }`.');
    lines.push('');
    for (const entry of dataTypes) {
      const displayName = (entry.metadata as Record<string, unknown>)?.displayName ?? entry.name;
      lines.push(`- **${displayName}** (\`${entry.name}\`): ${entry.description} Base type: \`${entry.baseType}\`. Usage: \`"extensions": { "${entry.name}": true }\``);
    }
    lines.push('');
  }

  if (functions.length > 0) {
    lines.push('## Extension Functions (FEL)');
    lines.push('These functions can be used in FEL expressions (calculate, constraint, relevant, etc.).');
    lines.push('');
    for (const entry of functions) {
      const params = entry.parameters?.map(p => `${p.name}: ${p.type}`).join(', ') ?? '';
      lines.push(`- \`${entry.name}(${params})\` → ${entry.returns}: ${entry.description}`);
    }
    lines.push('');
  }

  if (constraints.length > 0) {
    lines.push('## Extension Constraints (FEL)');
    lines.push('These can be used in constraint expressions.');
    lines.push('');
    for (const entry of constraints) {
      const params = entry.parameters?.map(p => `${p.name}: ${p.type}`).join(', ') ?? '';
      lines.push(`- \`${entry.name}(${params})\`: ${entry.description}`);
    }
    lines.push('');
  }

  return lines.join('\n');
}
