import { describe, expect, it } from 'vitest';
import { ensureModelContext } from '../src/webmcp-shim.js';

describe('WebMCP shim', () => {
  it('installs a configurable modelContext shim and supports tool registration', async () => {
    const host = {} as { modelContext?: unknown };
    const modelContext = ensureModelContext(host);
    expect(modelContext).toBe(host.modelContext);
    expect(typeof (modelContext as { registerTool?: unknown }).registerTool).toBe('function');

    const tool = {
      name: 'formspec.form.describe',
      description: 'Describe the form',
      inputSchema: {},
      annotations: { readOnlyHint: true },
      handler: async () => ({ content: [{ type: 'text', text: '{"ok":true}' }] }),
    };

    modelContext.registerTool(tool);
    const tools = modelContext.listTools();
    expect(tools.map((entry) => entry.name)).toContain('formspec.form.describe');
    expect(await modelContext.callTool('formspec.form.describe', {})).toEqual({
      content: [{ type: 'text', text: '{"ok":true}' }],
    });
  });
});
