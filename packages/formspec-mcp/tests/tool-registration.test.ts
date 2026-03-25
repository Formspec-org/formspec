/** @filedesc Tests that all expanded tools are registered in createFormspecServer. */
import { describe, it, expect } from 'vitest';
import { createFormspecServer } from '../src/create-server.js';
import { ProjectRegistry } from '../src/registry.js';

function getRegisteredToolNames(server: ReturnType<typeof createFormspecServer>): string[] {
  const tools = (server as any)._registeredTools as Record<string, unknown>;
  return Object.keys(tools);
}

describe('tool registration — expanded tools', () => {
  const registry = new ProjectRegistry();
  const server = createFormspecServer(registry);
  const toolNames = getRegisteredToolNames(server);

  it('registers formspec_behavior_expanded', () => {
    expect(toolNames).toContain('formspec_behavior_expanded');
  });

  it('registers formspec_composition', () => {
    expect(toolNames).toContain('formspec_composition');
  });

  it('registers formspec_response', () => {
    expect(toolNames).toContain('formspec_response');
  });

  it('registers formspec_mapping', () => {
    expect(toolNames).toContain('formspec_mapping');
  });

  it('registers formspec_migration', () => {
    expect(toolNames).toContain('formspec_migration');
  });

  it('registers formspec_changelog', () => {
    expect(toolNames).toContain('formspec_changelog');
  });

  it('registers formspec_lifecycle', () => {
    expect(toolNames).toContain('formspec_lifecycle');
  });

  it('registers 42 tools total', () => {
    expect(toolNames).toHaveLength(42);
  });
});
