/**
 * Minimal reproduction: does registerTool + Zod inference cause OOM?
 */
import { z } from 'zod';
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';

export async function main() {
  const server = new McpServer({ name: 'test', version: '0.1.0' });

  // Just 5 registerTool calls with inline Zod schemas
  server.registerTool('tool_1', {
    title: 'Tool 1',
    description: 'Test tool 1',
    inputSchema: {
      project_id: z.string(),
      json: z.record(z.string(), z.unknown()),
    },
  }, async ({ project_id, json }) => {
    return { content: [{ type: 'text' as const, text: `${project_id} ${JSON.stringify(json)}` }] };
  });

  server.registerTool('tool_2', {
    title: 'Tool 2',
    description: 'Test tool 2',
    inputSchema: {
      project_id: z.string(),
      path: z.string(),
      label: z.string(),
      type: z.string(),
      props: z.object({
        placeholder: z.string(),
        hint: z.string(),
        description: z.string(),
        choices: z.array(z.object({ value: z.string(), label: z.string() })),
        widget: z.string(),
        required: z.boolean(),
        readonly: z.boolean(),
        initialValue: z.unknown(),
      }).partial().optional(),
    },
  }, async ({ project_id, path, label, type, props }) => {
    return { content: [{ type: 'text' as const, text: `${project_id} ${path} ${label} ${type} ${JSON.stringify(props)}` }] };
  });

  server.registerTool('tool_3', {
    title: 'Tool 3',
    description: 'Test tool 3',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      condition: z.string(),
    },
  }, async ({ project_id, target, condition }) => {
    return { content: [{ type: 'text' as const, text: `${project_id} ${target} ${condition}` }] };
  });

  server.registerTool('tool_4', {
    title: 'Tool 4',
    description: 'Test tool 4',
    inputSchema: {
      project_id: z.string(),
      on: z.string(),
      paths: z.array(z.object({
        when: z.union([z.string(), z.number(), z.boolean()]),
        show: z.union([z.string(), z.array(z.string())]),
        mode: z.enum(['equals', 'contains']).optional(),
      })),
      otherwise: z.union([z.string(), z.array(z.string())]).optional(),
    },
  }, async ({ project_id, on, paths, otherwise }) => {
    return { content: [{ type: 'text' as const, text: `${project_id} ${on} ${JSON.stringify(paths)} ${otherwise}` }] };
  });

  server.registerTool('tool_5', {
    title: 'Tool 5',
    description: 'Test tool 5',
    inputSchema: {
      project_id: z.string(),
      target: z.string(),
      rule: z.string(),
      message: z.string(),
      options: z.object({
        timing: z.enum(['continuous', 'submit', 'demand']),
        severity: z.enum(['error', 'warning', 'info']),
        code: z.string(),
        activeWhen: z.string(),
      }).partial().optional(),
    },
  }, async ({ project_id, target, rule, message, options }) => {
    return { content: [{ type: 'text' as const, text: `${project_id} ${target} ${rule} ${message} ${JSON.stringify(options)}` }] };
  });
}
