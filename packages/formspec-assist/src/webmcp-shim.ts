/** @filedesc WebMCP-compatible shim for registering Assist tools in non-native environments. */

import type { ToolResult } from './types.js';

export interface ModelContextTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  annotations?: Record<string, unknown>;
  handler: (input: Record<string, unknown>) => Promise<ToolResult> | ToolResult;
}

export interface ModelContextLike {
  registerTool(tool: ModelContextTool): void;
  unregisterTool(name: string): void;
  provideContext(init: { tools: ModelContextTool[] }): void;
  listTools(): Array<Omit<ModelContextTool, 'handler'>>;
  callTool(name: string, input: Record<string, unknown>): Promise<ToolResult>;
}

class WebMCPShim implements ModelContextLike {
  private readonly tools = new Map<string, ModelContextTool>();

  registerTool(tool: ModelContextTool): void {
    this.tools.set(tool.name, tool);
  }

  unregisterTool(name: string): void {
    this.tools.delete(name);
  }

  provideContext(init: { tools: ModelContextTool[] }): void {
    for (const tool of init.tools) {
      this.registerTool(tool);
    }
  }

  listTools(): Array<Omit<ModelContextTool, 'handler'>> {
    return [...this.tools.values()].map(({ handler: _handler, ...tool }) => tool);
  }

  async callTool(name: string, input: Record<string, unknown>): Promise<ToolResult> {
    const tool = this.tools.get(name);
    if (!tool) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ code: 'UNSUPPORTED', message: `Unknown tool: ${name}` }) }],
        isError: true,
      };
    }
    return await tool.handler(input);
  }
}

export function ensureModelContext(host?: Record<string, unknown>): ModelContextLike {
  const target = host ?? (
    typeof navigator !== 'undefined' && navigator && typeof navigator === 'object'
      ? (navigator as unknown as Record<string, unknown>)
      : (globalThis as unknown as Record<string, unknown>)
  );

  if (target.modelContext && typeof (target.modelContext as ModelContextLike).registerTool === 'function') {
    return target.modelContext as ModelContextLike;
  }

  const shim = new WebMCPShim();
  Object.defineProperty(target, 'modelContext', {
    value: shim,
    configurable: true,
    enumerable: true,
    writable: true,
  });
  return shim;
}
