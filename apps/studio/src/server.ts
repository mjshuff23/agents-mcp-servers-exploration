import { randomUUID } from 'node:crypto';
import { promises as fs } from 'node:fs';
import http, { type IncomingMessage, type ServerResponse } from 'node:http';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { Client, StdioClientTransport, type JSONRPCNotification } from '@modelcontextprotocol/client';
import { agentRecipeSchema, recipePromptName, slugify, type AgentMode, type AgentRecipe, type CapabilityMatrix, type PrimitiveCatalog, type PrimitiveSummary, type RunMessage, type StudioSnapshot, type TraceCategory, type TraceDirection } from '@agents/shared';

const SESSION_RESOURCE_URI = 'session://latest-run';
const WORKSPACE_TREE_URI = 'workspace://tree';
const DEFAULT_MODE = (process.env.AGENTS_DEFAULT_MODE as AgentMode | undefined) ?? 'deterministic';
const DEFAULT_TOOL_TIMEOUT_MS = 60_000;
const INTERACTIVE_TOOL_TIMEOUT_MS = 15 * 60_000;

type StartStudioServerOptions = {
  port?: number;
  rootDir?: string;
  dataDir?: string;
};

type SamplingRequest = {
  params: {
    messages: Array<{
      role: string;
      content: { type?: string; text?: string } | Array<{ type?: string; text?: string }>;
    }>;
    systemPrompt?: string;
    maxTokens?: number;
  };
};

type ElicitationContent = Record<string, string | number | boolean | string[]>;

type PendingElicitationResolver = {
  id: string;
  resolve: (value: { action: 'accept' | 'decline'; content?: ElicitationContent }) => void;
};

// v1 only uses stdio, but the studio state model should survive a later HTTP transport.
type TransportAdapter = {
  kind: 'stdio' | 'streamable-http';
  connect(client: Client): Promise<void>;
  close(): Promise<void>;
};

class StdioTransportAdapter implements TransportAdapter {
  readonly kind = 'stdio' as const;
  private transport?: StdioClientTransport;

  constructor(
    private readonly rootDir: string,
    private readonly dataDir: string
  ) {}

  async connect(client: Client): Promise<void> {
    const studioFile = fileURLToPath(import.meta.url);
    const studioDir = path.dirname(studioFile);
    const workspaceRoot = path.resolve(studioDir, '../../..');
    const tsxCli = path.join(workspaceRoot, 'node_modules', 'tsx', 'dist', 'cli.mjs');
    const serverEntry = path.join(workspaceRoot, 'packages', 'workspace-mcp', 'dist', 'index.js');

    this.transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntry],
      cwd: this.rootDir,
      env: {
        ...process.env,
        AGENTS_DATA_DIR: this.dataDir,
        AGENTS_DEFAULT_MODE: DEFAULT_MODE
      }
    });

    await client.connect(this.transport);
  }

  async close(): Promise<void> {
    if (this.transport && 'close' in this.transport && typeof this.transport.close === 'function') {
      await this.transport.close();
    }
  }
}

class StudioRuntime {
  private readonly clients = new Set<ServerResponse>();
  private readonly client: Client;
  private readonly transport: TransportAdapter;
  private readonly recipeFile: string;
  private readonly publicDir: string;
  private readonly server: http.Server;
  private snapshot: StudioSnapshot;
  private pendingElicitation?: PendingElicitationResolver;
  private activeRun = false;

  constructor(
    private readonly rootDir: string,
    private readonly dataDir: string,
    private readonly port: number
  ) {
    this.recipeFile = path.join(this.dataDir, 'recipes.json');
    this.publicDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public');
    this.transport = new StdioTransportAdapter(this.rootDir, this.dataDir);
    this.client = new Client(
      { name: 'studio-client', version: '0.1.0' },
      {
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
          elicitation: { form: {} }
        }
      }
    );
    this.snapshot = this.createInitialSnapshot();
    this.server = http.createServer((request, response) => {
      void this.handleRequest(request, response);
    });
  }

  async start(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    this.installClientHandlers();
    await this.transport.connect(this.client);
    await this.client.setLoggingLevel('debug');
    this.snapshot.connected = true;
    this.snapshot.capabilityMatrix = this.buildCapabilityMatrix();
    this.trace('lifecycle', 'client->server', 'initialize', 'Studio connected to the MCP server.', {
      serverVersion: this.client.getServerVersion(),
      serverCapabilities: this.client.getServerCapabilities()
    });

    const instructions = this.client.getInstructions();
    if (instructions) {
      this.pushMessage('system', instructions);
    }

    await this.refreshCatalog('initial load');
    await this.refreshRecipes();
    await this.readLatestRunResource();
    await this.client.subscribeResource({ uri: SESSION_RESOURCE_URI });
    this.trace('resource', 'client->server', 'subscribeResource', 'Subscribed to the live latest-run resource.', {
      uri: SESSION_RESOURCE_URI
    });

    await new Promise<void>(resolve => {
      this.server.listen(this.port, '127.0.0.1', () => resolve());
    });
    console.log(`[studio] MCP client connected over ${this.transport.kind}.`);
    console.log(`[studio] Web Instance running on port ${this.port}!`);
    this.pushMessage('assistant', `Studio ready on http://127.0.0.1:${this.port}.`, 'success');
    this.broadcastSnapshot();
  }

  async close(): Promise<void> {
    await this.client.close();
    await this.transport.close();
    await new Promise<void>((resolve, reject) => {
      this.server.close(error => {
        if (error) {
          reject(error);
          return;
        }
        resolve();
      });
    });
  }

  private createInitialSnapshot(): StudioSnapshot {
    return {
      mode: DEFAULT_MODE,
      capabilityMatrix: {
        transport: 'stdio',
        negotiatedAt: new Date(0).toISOString(),
        client: {
          roots: { enabled: true, detail: 'listChanged' },
          sampling: { enabled: true },
          elicitation: { enabled: true, detail: 'form' }
        },
        server: {}
      },
      primitiveCatalog: {
        tools: [],
        resources: [],
        prompts: []
      },
      trace: [],
      messages: [
        {
          id: randomUUID(),
          role: 'system',
          text: 'The studio will show every major MCP interaction here as you explore the server.',
          tone: 'neutral'
        }
      ],
      recipes: [],
      latestRunResource: 'Waiting for the latest-run resource…',
      connected: false
    };
  }

  private installClientHandlers(): void {
    // Server-initiated MCP requests land here because the studio is the active client.
    this.client.setRequestHandler('roots/list', async () => {
      const root = pathToFileURL(this.rootDir).href;
      this.trace('lifecycle', 'server->client', 'roots/list', 'Server requested the allowed workspace roots.', {
        root
      });
      return {
        roots: [
          {
            uri: root,
            name: path.basename(this.rootDir) || 'workspace'
          }
        ]
      };
    });

    this.client.setRequestHandler('sampling/createMessage', async (request: SamplingRequest) => {
      this.trace('sampling', 'server->client', 'sampling/createMessage', 'Server requested a client-side model response.', request.params);
      const text =
        this.snapshot.mode === 'live'
          ? await this.generateLiveSamplingResponse(request)
          : this.generateDeterministicSamplingResponse(request);
      this.pushMessage('assistant', `Sampling reply (${this.snapshot.mode}): ${text}`, 'success');
      this.trace('sampling', 'client->server', 'sampling result', 'Returned sampling content to the server.', { text });
      return {
        model: this.snapshot.mode === 'live' ? 'openai.responses' : 'deterministic-simulator',
        role: 'assistant' as const,
        content: {
          type: 'text' as const,
          text
        }
      };
    });

    this.client.setRequestHandler('elicitation/create', async request => {
      if (!('requestedSchema' in request.params)) {
        this.trace('elicitation', 'server->client', 'elicitation/create', 'Received a non-form elicitation request.', request.params);
        return { action: 'decline' as const };
      }

      const id = randomUUID();
      this.snapshot.pendingElicitation = {
        id,
        message: request.params.message,
        requestedSchema: request.params.requestedSchema as Record<string, unknown>
      };
      this.trace('elicitation', 'server->client', 'elicitation/create', request.params.message, request.params);
      this.pushMessage('assistant', 'The server asked for one more piece of input. Fill out the elicitation form to continue.', 'warning');
      this.broadcastSnapshot();

      return await new Promise(resolve => {
        this.pendingElicitation = {
          id,
          resolve
        };
      });
    });

    this.client.setNotificationHandler('notifications/message', notification => {
      this.trace('logging', 'server->client', 'notifications/message', 'Server emitted a log message.', notification.params);
    });

    this.client.setNotificationHandler('notifications/prompts/list_changed', notification => {
      this.trace('notification', 'server->client', 'prompts/list_changed', 'The prompt catalog changed.', notification.params);
      void this.refreshPrompts('notification');
      void this.refreshRecipes();
    });

    this.client.setNotificationHandler('notifications/tools/list_changed', notification => {
      this.trace('notification', 'server->client', 'tools/list_changed', 'The tool catalog changed.', notification.params);
      void this.refreshTools('notification');
    });

    this.client.setNotificationHandler('notifications/resources/list_changed', notification => {
      this.trace('notification', 'server->client', 'resources/list_changed', 'The resource catalog changed.', notification.params);
      void this.refreshResources('notification');
    });

    this.client.setNotificationHandler('notifications/resources/updated', notification => {
      this.trace('notification', 'server->client', 'resources/updated', 'A subscribed resource changed.', notification.params);
      if (notification.params.uri === SESSION_RESOURCE_URI) {
        // The "latest run" card updates from this push path instead of polling the server.
        void this.readLatestRunResource();
      }
    });
  }

  private async handleRequest(request: IncomingMessage, response: ServerResponse): Promise<void> {
    const url = new URL(request.url ?? '/', `http://${request.headers.host ?? '127.0.0.1'}`);

    if (request.method === 'GET' && url.pathname === '/api/state') {
      this.sendJson(response, 200, this.snapshot);
      return;
    }

    if (request.method === 'GET' && url.pathname === '/api/events') {
      this.handleEventStream(response);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/run-tour') {
      const body = await this.readBody(request);
      const mode = body.mode === 'live' ? 'live' : 'deterministic';
      const goal = typeof body.goal === 'string' && body.goal.trim().length > 0 ? body.goal.trim() : 'Understand how self-serve agents and MCP fit together.';

      if (this.activeRun) {
        this.sendJson(response, 409, { error: 'A protocol tour is already running.' });
        return;
      }

      this.activeRun = true;
      this.snapshot.mode = mode;
      this.pushMessage('user', `Run the protocol tour in ${mode} mode: ${goal}`);
      this.broadcastSnapshot();

      void this.runProtocolTour(goal, mode)
        .catch(error => {
          this.pushMessage('assistant', `Protocol tour failed: ${error instanceof Error ? error.message : String(error)}`, 'warning');
          this.trace('ui', 'studio', 'tour error', 'The protocol tour failed.', { error: String(error) });
        })
        .finally(() => {
          this.activeRun = false;
          this.broadcastSnapshot();
        });

      this.sendJson(response, 202, { ok: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/actions/search') {
      const body = await this.readBody(request);
      const query = typeof body.query === 'string' && body.query.trim().length > 0 ? body.query.trim() : 'McpServer';
      const result = await this.callTool('workspace.search', { query, limit: 8 });
      this.sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/actions/summarize') {
      const body = await this.readBody(request);
      const filePath = typeof body.path === 'string' && body.path.trim().length > 0 ? body.path.trim() : 'README.md';
      const audience = typeof body.audience === 'string' && body.audience.trim().length > 0 ? body.audience.trim() : 'beginner';
      const result = await this.callTool('file.summarize', { path: filePath, audience });
      this.sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/recipes') {
      const body = await this.readBody(request);
      const result = await this.callTool('agent.scaffold', body, {
        timeout: INTERACTIVE_TOOL_TIMEOUT_MS
      });
      await this.refreshRecipes();
      this.sendJson(response, 200, result);
      return;
    }

    if (request.method === 'POST' && url.pathname.startsWith('/api/elicitation/')) {
      const id = url.pathname.split('/').at(-1);
      const body = await this.readBody(request);

      if (!id || !this.pendingElicitation || this.pendingElicitation.id !== id) {
        this.sendJson(response, 404, { error: 'No matching elicitation is pending.' });
        return;
      }

      const rawContent = typeof body.content === 'object' && body.content ? body.content : body;
      const content = Object.fromEntries(
        Object.entries(rawContent).map(([key, value]) => [
          key,
          Array.isArray(value) ? value.map(item => String(item)) : typeof value === 'boolean' || typeof value === 'number' ? value : String(value ?? '')
        ])
      ) as ElicitationContent;
      this.pendingElicitation.resolve({
        action: body.action === 'decline' ? 'decline' : 'accept',
        content
      });
      this.pendingElicitation = undefined;
      this.snapshot.pendingElicitation = undefined;
      this.trace('elicitation', 'client->server', 'elicitation response', 'Submitted elicitation data back to the server.', content);
      this.broadcastSnapshot();
      this.sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'POST' && url.pathname === '/api/refresh') {
      await this.refreshCatalog('manual refresh');
      await this.refreshRecipes();
      await this.readLatestRunResource();
      this.sendJson(response, 200, { ok: true });
      return;
    }

    if (request.method === 'GET') {
      await this.serveStatic(url.pathname, response);
      return;
    }

    this.sendJson(response, 404, { error: 'Not found' });
  }

  private handleEventStream(response: ServerResponse): void {
    response.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive'
    });
    response.write(this.serializeSseEvent('snapshot', this.snapshot));
    this.clients.add(response);
    response.on('close', () => {
      this.clients.delete(response);
    });
  }

  private async serveStatic(pathname: string, response: ServerResponse): Promise<void> {
    const filePath = pathname === '/' ? path.join(this.publicDir, 'index.html') : path.join(this.publicDir, pathname.replace(/^\/+/, ''));
    try {
      const data = await fs.readFile(filePath);
      response.writeHead(200, { 'Content-Type': this.mimeTypeFor(filePath) });
      response.end(data);
    } catch {
      response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      response.end('Not found');
    }
  }

  private mimeTypeFor(filePath: string): string {
    if (filePath.endsWith('.html')) return 'text/html; charset=utf-8';
    if (filePath.endsWith('.css')) return 'text/css; charset=utf-8';
    if (filePath.endsWith('.js')) return 'application/javascript; charset=utf-8';
    if (filePath.endsWith('.map')) return 'application/json; charset=utf-8';
    return 'text/plain; charset=utf-8';
  }

  private async readBody(request: IncomingMessage): Promise<Record<string, unknown>> {
    const chunks: Buffer[] = [];
    for await (const chunk of request) {
      chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
    }

    if (chunks.length === 0) {
      return {};
    }

    const text = Buffer.concat(chunks).toString('utf8');
    return JSON.parse(text) as Record<string, unknown>;
  }

  private sendJson(response: ServerResponse, statusCode: number, payload: unknown): void {
    response.writeHead(statusCode, { 'Content-Type': 'application/json; charset=utf-8' });
    response.end(JSON.stringify(payload));
  }

  private serializeSseEvent(event: string, payload: unknown): string {
    return `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  }

  private broadcastSnapshot(): void {
    // The browser always renders from one normalized snapshot so the UI is easy to inspect.
    const payload = this.serializeSseEvent('snapshot', this.snapshot);
    for (const client of this.clients) {
      client.write(payload);
    }
  }

  private trace(category: TraceCategory, direction: TraceDirection, title: string, detail?: string, payload?: unknown): void {
    this.snapshot.trace = [
      ...this.snapshot.trace.slice(-119),
      {
        id: randomUUID(),
        timestamp: new Date().toISOString(),
        category,
        direction,
        title,
        detail,
        payload
      }
    ];
    this.broadcastSnapshot();
  }

  private pushMessage(role: RunMessage['role'], text: string, tone: RunMessage['tone'] = 'neutral'): void {
    this.snapshot.messages = [...this.snapshot.messages.slice(-23), { id: randomUUID(), role, text, tone }];
  }

  private buildCapabilityMatrix(): CapabilityMatrix {
    const serverCapabilities = this.client.getServerCapabilities() ?? {};
    return {
      transport: 'stdio',
      negotiatedAt: new Date().toISOString(),
      client: {
        roots: { enabled: true, detail: 'listChanged' },
        sampling: { enabled: true },
        elicitation: { enabled: true, detail: 'form' }
      },
      server: {
        tools: { enabled: Boolean(serverCapabilities.tools), detail: serverCapabilities.tools?.listChanged ? 'listChanged' : undefined },
        resources: {
          enabled: Boolean(serverCapabilities.resources),
          detail: [serverCapabilities.resources?.subscribe ? 'subscribe' : '', serverCapabilities.resources?.listChanged ? 'listChanged' : '']
            .filter(Boolean)
            .join(', ')
        },
        prompts: { enabled: Boolean(serverCapabilities.prompts), detail: serverCapabilities.prompts?.listChanged ? 'listChanged' : undefined },
        logging: { enabled: Boolean(serverCapabilities.logging) },
        completions: { enabled: Boolean(serverCapabilities.completions) }
      }
    };
  }

  private async refreshCatalog(reason: string): Promise<void> {
    await Promise.all([this.refreshTools(reason), this.refreshResources(reason), this.refreshPrompts(reason)]);
  }

  private async refreshTools(reason: string): Promise<void> {
    this.trace('discovery', 'client->server', 'tools/list', `Refreshing tools because of ${reason}.`);
    const result = await this.client.listTools();
    this.snapshot.primitiveCatalog.tools = result.tools.map(tool => this.summarizePrimitive(tool));
    this.trace('discovery', 'server->client', 'tools/list result', `Received ${result.tools.length} tools.`, result);
    this.broadcastSnapshot();
  }

  private async refreshResources(reason: string): Promise<void> {
    this.trace('discovery', 'client->server', 'resources/list', `Refreshing resources because of ${reason}.`);
    const result = await this.client.listResources();
    this.snapshot.primitiveCatalog.resources = result.resources.map(resource => this.summarizePrimitive(resource));
    this.trace('discovery', 'server->client', 'resources/list result', `Received ${result.resources.length} resources.`, result);
    this.broadcastSnapshot();
  }

  private async refreshPrompts(reason: string): Promise<void> {
    this.trace('discovery', 'client->server', 'prompts/list', `Refreshing prompts because of ${reason}.`);
    const result = await this.client.listPrompts();
    this.snapshot.primitiveCatalog.prompts = result.prompts.map(prompt => this.summarizePrimitive(prompt));
    this.trace('discovery', 'server->client', 'prompts/list result', `Received ${result.prompts.length} prompts.`, result);
    this.broadcastSnapshot();
  }

  private summarizePrimitive(value: { name: string; title?: string; description?: string; uri?: string }): PrimitiveSummary {
    return {
      name: value.name,
      title: value.title,
      description: value.description,
      uri: value.uri
    };
  }

  private async refreshRecipes(): Promise<AgentRecipe[]> {
    try {
      const raw = await fs.readFile(this.recipeFile, 'utf8');
      const recipes = agentRecipeSchema.array().parse(JSON.parse(raw));
      this.snapshot.recipes = recipes;
      this.broadcastSnapshot();
      return recipes;
    } catch {
      this.snapshot.recipes = [];
      this.broadcastSnapshot();
      return [];
    }
  }

  private async readLatestRunResource(): Promise<void> {
    this.trace('resource', 'client->server', 'resources/read', 'Reading the live latest-run resource.', { uri: SESSION_RESOURCE_URI });
    const result = await this.client.readResource({ uri: SESSION_RESOURCE_URI });
    const text = this.extractTextContent(result.contents);
    this.snapshot.latestRunResource = text;
    this.trace('resource', 'server->client', 'resources/read result', 'Updated the studio with the newest latest-run resource payload.', result);
    this.broadcastSnapshot();
  }

  private extractTextContent(contents: Array<{ text?: string; blob?: string }>): string {
    return contents
      .map(item => ('text' in item && item.text ? item.text : 'blob' in item && item.blob ? `[binary:${item.blob.length}]` : ''))
      .join('\n')
      .trim();
  }

  private async callTool(
    name: string,
    args: Record<string, unknown>,
    options: {
      timeout?: number;
    } = {}
  ): Promise<Record<string, unknown>> {
    this.trace('tool', 'client->server', 'tools/call', `Calling ${name}.`, { name, args });
    const result = await this.client.callTool(
      { name, arguments: args },
      {
        timeout: options.timeout ?? DEFAULT_TOOL_TIMEOUT_MS
      }
    );
    this.trace('tool', 'server->client', 'tools/call result', `Received result from ${name}.`, result);
    const text = this.extractToolText(result.content ?? []);
    if (text) {
      this.pushMessage('assistant', `${name}: ${text}`, 'success');
    }
    await this.refreshRecipes();
    this.broadcastSnapshot();
    return result as unknown as Record<string, unknown>;
  }

  private extractToolText(content: Array<{ text?: string; type?: string }>): string {
    return content
      .map(item => ('text' in item && item.text ? item.text : item.type ? `[${item.type}]` : ''))
      .filter(Boolean)
      .join('\n')
      .trim();
  }

  private async getPrompt(name: string, args: Record<string, string>): Promise<void> {
    this.trace('prompt', 'client->server', 'prompts/get', `Fetching prompt ${name}.`, { name, args });
    const result = await this.client.getPrompt({ name, arguments: args });
    this.trace('prompt', 'server->client', 'prompts/get result', `Fetched prompt ${name}.`, result);
    const text = result.messages
      .map(message => {
        const content = Array.isArray(message.content) ? message.content.map(block => ('text' in block ? block.text : '')).join('\n') : 'text' in message.content ? message.content.text : '';
        return `${message.role}: ${content}`;
      })
      .join('\n\n');
    this.pushMessage('assistant', `Prompt ${name}:\n${text}`);
    this.broadcastSnapshot();
  }

  private async completePrompt(name: string, argumentName: string, value: string): Promise<void> {
    this.trace('prompt', 'client->server', 'complete', `Requesting completions for ${name}.${argumentName}.`, { name, argumentName, value });
    const result = await this.client.complete({
      ref: { type: 'ref/prompt', name },
      argument: {
        name: argumentName,
        value
      }
    });
    this.trace('prompt', 'server->client', 'complete result', `Completion suggestions arrived for ${name}.${argumentName}.`, result);
    this.pushMessage('assistant', `Completions for ${name}.${argumentName}: ${result.completion.values.join(', ') || 'none'}`);
    this.broadcastSnapshot();
  }

  private async runProtocolTour(goal: string, mode: AgentMode): Promise<void> {
    await this.refreshCatalog('protocol tour');
    await this.completePrompt('bootstrap-agent', 'mode', mode.slice(0, 2));
    await this.getPrompt('bootstrap-agent', { goal, mode });
    await this.readWorkspaceTree();
    await this.callTool('workspace.search', { query: 'McpServer', limit: 6 });
    await this.callTool('file.summarize', { path: 'README.md', audience: 'beginner' });
    await this.callTool(
      'agent.scaffold',
      {
        name: 'Trace Guide',
        description: 'A teaching recipe that explains the newest MCP trace.',
        starterPrompt: 'Explain the newest trace like we are pairing on the codebase.',
        allowedTools: ['workspace.search', 'file.summarize'],
        pinnedResources: [SESSION_RESOURCE_URI, WORKSPACE_TREE_URI],
        mode
      },
      {
        timeout: INTERACTIVE_TOOL_TIMEOUT_MS
      }
    );
    const promptName = recipePromptName(slugify('Trace Guide'));
    await this.getPrompt(promptName, {
      task: 'Walk through the newest trace and explain the interesting protocol moments.',
      mode
    });
    this.pushMessage('assistant', 'Protocol tour complete. Explore the capability matrix, catalog, and live trace to keep going.', 'success');
    this.broadcastSnapshot();
  }

  private async readWorkspaceTree(): Promise<void> {
    this.trace('resource', 'client->server', 'resources/read', 'Reading the workspace tree resource.', { uri: WORKSPACE_TREE_URI });
    const result = await this.client.readResource({ uri: WORKSPACE_TREE_URI });
    const text = this.extractTextContent(result.contents);
    this.trace('resource', 'server->client', 'resources/read result', 'Fetched the workspace tree resource.', result);
    this.pushMessage('assistant', `Workspace tree:\n${text}`);
    this.broadcastSnapshot();
  }

  private extractSamplingInput(request: SamplingRequest): string {
    return request.params.messages
      .map(message => {
        const content = Array.isArray(message.content)
          ? message.content.map(block => block.text ?? '').join('\n')
          : message.content.text ?? '';
        return `${message.role}: ${content}`;
      })
      .join('\n\n');
  }

  private generateDeterministicSamplingResponse(request: SamplingRequest): string {
    const prompt = this.extractSamplingInput(request);
    const lines = prompt.split('\n').filter(Boolean);
    const focus = lines.at(-1) ?? 'the provided content';
    return `Deterministic summary: this request is about ${focus.slice(0, 180)}. In a live client, the user-configured model would produce a richer answer here.`;
  }

  private async generateLiveSamplingResponse(request: SamplingRequest): Promise<string> {
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) {
      return `${this.generateDeterministicSamplingResponse(request)}\n\nLive mode fallback: set OPENAI_API_KEY to enable live sampling.`;
    }

    try {
      const input = [];
      if (request.params.systemPrompt) {
        input.push({
          role: 'system',
          content: [{ type: 'input_text', text: request.params.systemPrompt }]
        });
      }
      for (const message of request.params.messages) {
        input.push({
          role: message.role,
          content: [
            {
              type: 'input_text',
              text: Array.isArray(message.content)
                ? message.content.map(block => block.text ?? '').join('\n')
                : message.content.text ?? ''
            }
          ]
        });
      }

      const response = await fetch('https://api.openai.com/v1/responses', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: process.env.OPENAI_MODEL ?? 'gpt-4.1-mini',
          input,
          max_output_tokens: request.params.maxTokens ?? 250
        })
      });

      if (!response.ok) {
        const errorText = await response.text();
        return `${this.generateDeterministicSamplingResponse(request)}\n\nLive mode fallback: OpenAI request failed with ${response.status} ${errorText.slice(0, 180)}.`;
      }

      const payload = (await response.json()) as { output_text?: string; output?: Array<{ content?: Array<{ text?: string }> }> };
      const text =
        payload.output_text ||
        payload.output?.flatMap(item => item.content?.map(part => part.text ?? '') ?? []).join('\n').trim() ||
        this.generateDeterministicSamplingResponse(request);
      return text;
    } catch (error) {
      return `${this.generateDeterministicSamplingResponse(request)}\n\nLive mode fallback: ${error instanceof Error ? error.message : String(error)}`;
    }
  }
}

export async function startStudioServer(options: StartStudioServerOptions = {}): Promise<StudioRuntime> {
  const rootDir = options.rootDir ?? path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
  const dataDir = path.resolve(options.dataDir ?? process.env.AGENTS_DATA_DIR ?? path.join(rootDir, '.studio-data'));
  const port = options.port ?? Number(process.env.AGENTS_STUDIO_PORT ?? 4321);
  const studio = new StudioRuntime(rootDir, dataDir, port);
  await studio.start();
  return studio;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  startStudioServer().catch(error => {
    console.error('[studio] fatal error');
    console.error(error);
    process.exit(1);
  });
}
