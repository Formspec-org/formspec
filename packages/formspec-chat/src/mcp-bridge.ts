/** @filedesc In-process MCP bridge: connects a Client to a formspec-mcp Server via InMemoryTransport. */
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { createFormspecServer } from 'formspec-mcp/server';
import { ProjectRegistry } from 'formspec-mcp/registry';
import { createProject } from 'formspec-studio-core';
import type { FormDefinition } from 'formspec-types';
import type { ProjectBundle } from 'formspec-core';
import type { ToolDeclaration, ToolContext, ToolCallResult, Issue } from './types.js';

/** Tools not useful in the chat refinement context. */
const EXCLUDED_TOOLS = new Set([
  'formspec_guide',     // chat handles the interview
  'formspec_create',    // bridge creates the project
  'formspec_open',      // no filesystem in chat
  'formspec_save',      // no filesystem in chat
  'formspec_list',      // single project
  'formspec_publish',   // not relevant during refinement
  'formspec_draft',     // bootstrap only
  'formspec_load',      // bootstrap only
]);

/**
 * In-process bridge from chat to the formspec MCP tool surface.
 *
 * Creates a formspec-mcp Server + Client connected via InMemoryTransport.
 * The bridge owns a single Project loaded from the scaffolded definition.
 * All tool calls are routed through the MCP protocol, giving the AI adapter
 * the same tool schemas and dispatch as a standalone MCP session.
 */
export class McpBridge {
  private client: Client;
  private projectId: string;
  private cachedTools: ToolDeclaration[] | null = null;
  private registry: ProjectRegistry;

  private constructor(client: Client, projectId: string, registry: ProjectRegistry) {
    this.client = client;
    this.projectId = projectId;
    this.registry = registry;
  }

  /**
   * Create a bridge with a project pre-loaded from the given definition.
   */
  static async create(definition: FormDefinition): Promise<McpBridge> {
    const registry = new ProjectRegistry();

    // Create a Project directly and load the definition
    const project = createProject();
    project.loadBundle({ definition } as Partial<ProjectBundle>);
    const projectId = registry.registerOpen(`chat://${Date.now()}`, project);

    // Wire up MCP server + client via in-memory transport
    const server = createFormspecServer(registry);
    const [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();
    await server.connect(serverTransport);

    const client = new Client({ name: 'formspec-chat', version: '0.1.0' });
    await client.connect(clientTransport);

    const bridge = new McpBridge(client, projectId, registry);

    // Run diagnostics on the loaded definition to catch AI-generated issues
    bridge._loadDiagnostics = await bridge.audit();

    return bridge;
  }

  /** Diagnostics from the initial load — consumed once by ChatSession. */
  private _loadDiagnostics: Omit<Issue, 'id' | 'status'>[] = [];

  /** Consume and clear the diagnostics from the initial load. */
  consumeLoadDiagnostics(): Omit<Issue, 'id' | 'status'>[] {
    const d = this._loadDiagnostics;
    this._loadDiagnostics = [];
    return d;
  }

  /**
   * Run project diagnostics via formspec_describe(mode="audit").
   * Returns issues found in the current project state.
   */
  async audit(): Promise<Omit<Issue, 'id' | 'status'>[]> {
    const result = await this.callTool('formspec_describe', { mode: 'audit' });
    if (result.isError) return [];

    try {
      const parsed = JSON.parse(result.content);
      // Diagnostics shape: { structural: Diagnostic[], expressions: [], extensions: [], consistency: [] }
      const allDiags: Array<{ severity: string; code: string; message: string; path?: string }> = [
        ...(parsed.structural ?? []),
        ...(parsed.expressions ?? []),
        ...(parsed.extensions ?? []),
        ...(parsed.consistency ?? []),
      ];
      return allDiags
        .filter(d => d.severity === 'error' || d.severity === 'warning')
        .map(d => ({
          severity: d.severity as 'error' | 'warning',
          category: 'validation' as const,
          title: d.code,
          description: d.message,
          elementPath: d.path,
          sourceIds: [],
        }));
    } catch {
      return [];
    }
  }

  /**
   * Get tool declarations for LLM consumption (project_id stripped).
   */
  async getTools(): Promise<ToolDeclaration[]> {
    if (this.cachedTools) return this.cachedTools;

    const result = await this.client.listTools();
    this.cachedTools = result.tools
      .filter(t => !EXCLUDED_TOOLS.has(t.name))
      .map(t => {
        // Strip project_id from schema — bridge injects it automatically
        const schema = { ...(t.inputSchema as Record<string, unknown>) };
        const properties = { ...(schema.properties as Record<string, unknown> ?? {}) };
        delete properties.project_id;
        const required = ((schema.required as string[]) ?? []).filter(r => r !== 'project_id');
        return {
          name: t.name,
          description: t.description ?? '',
          inputSchema: { ...schema, properties, required },
        };
      });

    return this.cachedTools;
  }

  /**
   * Build a ToolContext for adapter consumption.
   */
  async getToolContext(): Promise<ToolContext> {
    const tools = await this.getTools();
    return {
      tools,
      callTool: (name, args) => this.callTool(name, args),
    };
  }

  /**
   * Execute a tool call, injecting project_id automatically.
   */
  async callTool(name: string, args: Record<string, unknown>): Promise<ToolCallResult> {
    const result = await this.client.callTool({
      name,
      arguments: { ...args, project_id: this.projectId },
    });

    const text = (result.content as Array<{ type: string; text?: string }>)
      .filter(c => c.type === 'text')
      .map(c => c.text ?? '')
      .join('\n');

    return {
      content: text,
      isError: Boolean((result as { isError?: boolean }).isError),
    };
  }

  /**
   * Read the current definition from the underlying project.
   */
  getDefinition(): FormDefinition {
    const project = this.registry.getProject(this.projectId);
    return project.export().definition;
  }

  /**
   * Read the full project bundle.
   */
  getBundle(): ProjectBundle {
    const project = this.registry.getProject(this.projectId);
    return project.export();
  }

  /**
   * Tear down the bridge.
   */
  async close(): Promise<void> {
    await this.client.close();
  }
}
