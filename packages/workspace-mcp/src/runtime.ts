import { agentModeSchema, agentRecipeDraftSchema, agentRecipeSchema, filePathToResourceUri, recipePromptName, recipeToPromptDescriptor, slugify, type AgentMode, type AgentRecipe } from '@agents/shared';
import { McpServer, ResourceTemplate, StdioServerTransport, completable, type GetPromptResult, type ReadResourceResult, type RegisteredPrompt } from '@modelcontextprotocol/server';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { z } from 'zod';

const execFileAsync = promisify(execFile);
const SESSION_RESOURCE_URI = 'session://latest-run';
const WORKSPACE_TREE_URI = 'workspace://tree';
const MODE_OPTIONS = ['deterministic', 'live'] as const;
const DEFAULT_ALLOWED_TOOLS = ['workspace.search', 'file.summarize', 'agent.scaffold'];
const DEFAULT_PINNED_RESOURCES = [WORKSPACE_TREE_URI, SESSION_RESOURCE_URI];
const IGNORED_DIRECTORIES = new Set(['.git', '.studio-data', 'node_modules', 'dist', 'coverage', 'playwright-report', 'test-results']);

type WorkspaceMcpRuntimeOptions = {
  cwd: string;
  dataDir: string;
};

type SearchMatch = {
  file: string;
  line: number;
  column: number;
  excerpt: string;
};

type LatestRunState = {
  updatedAt: string;
  operation: string;
  summary: string;
  details?: Record<string, unknown>;
};

type CompletedRecipeDraft = {
  id?: string;
  name: string;
  description: string;
  systemPrompt: string;
  allowedTools: string[];
  pinnedResources: string[];
  starterPrompt: string;
  mode: AgentMode;
};

export class WorkspaceMcpRuntime {
  readonly server: McpServer;

  private readonly cwd: string;
  private readonly dataDir: string;
  private readonly recipeFile: string;
  private readonly recipePrompts = new Map<string, RegisteredPrompt>();
  private recipes = new Map<string, AgentRecipe>();
  private latestRun: LatestRunState = {
    updatedAt: new Date(0).toISOString(),
    operation: 'boot',
    summary: 'No runs yet. Start the protocol tour from the studio to populate this resource.'
  };

  constructor(options: WorkspaceMcpRuntimeOptions) {
    this.cwd = options.cwd;
    this.dataDir = options.dataDir;
    this.recipeFile = path.join(this.dataDir, 'recipes.json');
    this.server = new McpServer(
      {
        name: 'workspace-learning-mcp',
        version: '0.1.0'
      },
      {
        instructions:
          'This MCP server is a learning playground. Prefer safe, local operations, explain what you are doing, and surface the differences between tools, resources, prompts, sampling, roots, and elicitation.',
        capabilities: {
          logging: {},
          completions: {},
          prompts: { listChanged: true },
          resources: { listChanged: true, subscribe: true },
          tools: { listChanged: true }
        }
      }
    );
  }

  async initialize(): Promise<void> {
    await fs.mkdir(this.dataDir, { recursive: true });
    await this.loadRecipes();
    // Register primitives before connect() so discovery is the first thing the studio sees.
    this.registerResources();
    this.registerPrompts();
    this.registerTools();
    this.server.server.setRequestHandler('resources/subscribe' as never, (async () => ({}) as Promise<never>) as never);
    this.server.server.setRequestHandler('resources/unsubscribe' as never, (async () => ({}) as Promise<never>) as never);
    for (const recipe of this.recipes.values()) {
      this.upsertRecipePrompt(recipe);
    }
  }

  async start(): Promise<void> {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
  }

  private registerResources(): void {
    this.server.registerResource(
      'workspace-tree',
      WORKSPACE_TREE_URI,
      {
        title: 'Workspace Tree',
        description: 'A compact snapshot of the current workspace rooted at the client-provided MCP roots.',
        mimeType: 'text/plain'
      },
      async (_uri, ctx) => {
        const root = await this.getPrimaryRoot(ctx);
        const tree = await this.buildWorkspaceTree(root, 3);
        return {
          contents: [
            {
              uri: WORKSPACE_TREE_URI,
              text: tree
            }
          ]
        };
      }
    );

    this.server.registerResource(
      'workspace-file',
      new ResourceTemplate('workspace://file/{path}', {
        list: async ctx => {
          const root = await this.getPrimaryRoot(ctx);
          const files = await this.scanWorkspaceFiles(root, 25);
          return {
            resources: files.map(relativePath => ({
              uri: filePathToResourceUri(relativePath),
              name: relativePath
            }))
          };
        },
        complete: {
          path: async (value, context) => {
            const root = await this.getPrimaryRoot();
            const files = await this.scanWorkspaceFiles(root, 60);
            const prefix = context?.arguments?.path ?? value ?? '';
            return files.filter(item => item.startsWith(prefix)).slice(0, 12);
          }
        }
      }),
      {
        title: 'Workspace File',
        description: 'Read a file under an allowed workspace root by relative path.',
        mimeType: 'text/plain'
      },
      async (_uri, variables, ctx): Promise<ReadResourceResult> => {
        const relativePath = decodeURIComponent(String(variables.path ?? ''));
        const root = await this.getPrimaryRoot(ctx);
        const absolutePath = this.resolveAllowedPath(root, relativePath);
        const text = await fs.readFile(absolutePath, 'utf8');
        return {
          contents: [
            {
              uri: filePathToResourceUri(relativePath),
              text
            }
          ]
        };
      }
    );

    this.server.registerResource(
      'latest-run',
      SESSION_RESOURCE_URI,
      {
        title: 'Latest Run',
        description: 'The newest protocol tour or tool execution summary, updated in real time.',
        mimeType: 'application/json'
      },
      async () => ({
        contents: [
          {
            uri: SESSION_RESOURCE_URI,
            text: JSON.stringify(this.latestRun, null, 2)
          }
        ]
      })
    );
  }

  private registerPrompts(): void {
    // Static prompts explain the protocol before dynamic recipe prompts start appearing.
    this.server.registerPrompt(
      'bootstrap-agent',
      {
        title: 'Bootstrap Agent',
        description: 'Create a practical starter prompt for a self-serve workspace agent.',
        argsSchema: z.object({
          goal: z.string().describe('What the agent should help the user accomplish.'),
          mode: completable(
            agentModeSchema.describe('Whether the studio will simulate or use a live model.'),
            value => MODE_OPTIONS.filter(mode => mode.startsWith(value))
          )
        })
      },
      ({ goal, mode }): GetPromptResult => ({
        description: `Starter prompt for a ${mode} workspace agent.`,
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `You are a self-serve workspace agent operating in ${mode} mode. Use MCP tools for actions, resources for context, prompts for templates, and narrate what you are doing so the user can learn the protocol.`
            }
          },
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Help me with this goal: ${goal}`
            }
          }
        ]
      })
    );

    this.server.registerPrompt(
      'explain-trace',
      {
        title: 'Explain Trace',
        description: 'Turn a protocol trace into a short explanation tailored to the audience.',
        argsSchema: z.object({
          audience: completable(
            z.string().describe('The intended audience for the explanation.'),
            value => ['beginner', 'intermediate', 'advanced'].filter(item => item.startsWith(value))
          ),
          focus: completable(
            z.string().describe('What part of the trace deserves extra attention.'),
            value => ['lifecycle', 'tool call', 'resource read', 'prompt fetch', 'sampling', 'elicitation'].filter(item =>
              item.startsWith(value)
            )
          )
        })
      },
      ({ audience, focus }): GetPromptResult => ({
        description: 'A reusable prompt for explaining the latest run trace.',
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `Explain MCP traces clearly for a ${audience} audience.`
            }
          },
          {
            role: 'user',
            content: {
              type: 'text',
              text: `Explain the latest trace with emphasis on ${focus}. Current latest run summary:\n${JSON.stringify(this.latestRun, null, 2)}`
            }
          }
        ]
      })
    );
  }

  private registerTools(): void {
    this.server.registerTool(
      'workspace.search',
      {
        title: 'Workspace Search',
        description: 'Search for plain-text matches inside the allowed workspace roots.',
        inputSchema: z.object({
          query: z.string().min(1),
          limit: z.number().int().min(1).max(20).default(8),
          filePattern: z.string().optional()
        })
      },
      async ({ query, limit, filePattern }, ctx) => {
        const root = await this.getPrimaryRoot(ctx);
        await this.server.sendLoggingMessage({
          level: 'info',
          data: `workspace.search: "${query}" under ${root}`
        });
        const matches = await this.searchWorkspace(root, query, limit, filePattern);
        const summary =
          matches.length === 0
            ? `No matches for "${query}" inside ${path.relative(this.cwd, root) || '.'}.`
            : matches
                .map(match => `${match.file}:${match.line}:${match.column} ${match.excerpt}`)
                .join('\n');

        await this.setLatestRun({
          updatedAt: new Date().toISOString(),
          operation: 'workspace.search',
          summary: `Searched for "${query}" and found ${matches.length} match${matches.length === 1 ? '' : 'es'}.`,
          details: { query, matches }
        });

        return {
          content: [
            {
              type: 'text',
              text: summary
            }
          ],
          structuredContent: {
            query,
            matches
          }
        };
      }
    );

    this.server.registerTool(
      'file.summarize',
      {
        title: 'File Summarizer',
        description: 'Summarize a file using the client sampling capability, with deterministic fallback in the studio.',
        inputSchema: z.object({
          path: z.string().optional(),
          audience: z.string().default('beginner')
        })
      },
      async ({ path: maybePath, audience }, ctx) => {
        let relativePath = maybePath;
        if (!relativePath) {
          const elicited = await this.server.server.elicitInput({
            mode: 'form',
            message: 'Which file should I summarize?',
            requestedSchema: {
              type: 'object',
              properties: {
                path: {
                  type: 'string',
                  description: 'A file path relative to the workspace root, for example README.md'
                }
              },
              required: ['path']
            }
          });

          if (elicited.action !== 'accept') {
            return {
              content: [
                {
                  type: 'text',
                  text: 'File summarization was cancelled by the client.'
                }
              ]
            };
          }

          relativePath = String((elicited.content as Record<string, unknown>).path ?? '');
        }

        const root = await this.getPrimaryRoot(ctx);
        const absolutePath = this.resolveAllowedPath(root, relativePath);
        const fileContent = await fs.readFile(absolutePath, 'utf8');
        const snippet = fileContent.slice(0, 6000);
        await this.server.sendLoggingMessage({
          level: 'info',
          data: `file.summarize: ${relativePath}`
        });

        const sample = await this.server.server.createMessage({
          messages: [
            {
              role: 'user',
              content: {
                type: 'text',
                text: `Summarize the following file for a ${audience} audience.\n\nPath: ${relativePath}\n\n${snippet}`
              }
            }
          ],
          systemPrompt:
            'You are generating short educational file summaries for an MCP playground. Mention what the file is for and one useful next step.',
          maxTokens: 250
        });

        const summaryText = this.extractSamplingText(sample);

        await this.setLatestRun({
          updatedAt: new Date().toISOString(),
          operation: 'file.summarize',
          summary: `Summarized ${relativePath} for a ${audience} audience.`,
          details: {
            path: relativePath,
            audience,
            summaryText
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: summaryText
            }
          ],
          structuredContent: {
            path: relativePath,
            audience,
            summary: summaryText
          }
        };
      }
    );

    this.server.registerTool(
      'agent.scaffold',
      {
        title: 'Agent Scaffold',
        description: 'Create or update a self-serve agent recipe and publish it back into the prompt catalog.',
        inputSchema: z.object({
          id: z.string().optional(),
          name: z.string().optional(),
          description: z.string().optional(),
          systemPrompt: z.string().optional(),
          allowedTools: z.array(z.string()).optional(),
          pinnedResources: z.array(z.string()).optional(),
          starterPrompt: z.string().optional(),
          mode: agentModeSchema.optional()
        })
      },
      async args => {
        const draft = agentRecipeDraftSchema.parse(args);
        const completedDraft = await this.completeRecipeDraft(draft);
        const recipe = agentRecipeSchema.parse({
          id: draft.id || slugify(completedDraft.name),
          name: completedDraft.name,
          description: completedDraft.description,
          systemPrompt: completedDraft.systemPrompt,
          allowedTools: completedDraft.allowedTools?.length ? completedDraft.allowedTools : DEFAULT_ALLOWED_TOOLS,
          pinnedResources: completedDraft.pinnedResources?.length ? completedDraft.pinnedResources : DEFAULT_PINNED_RESOURCES,
          starterPrompt: completedDraft.starterPrompt,
          mode: completedDraft.mode ?? 'deterministic'
        });

        this.recipes.set(recipe.id, recipe);
        this.upsertRecipePrompt(recipe);
        await this.persistRecipes();
        this.server.sendPromptListChanged();

        await this.setLatestRun({
          updatedAt: new Date().toISOString(),
          operation: 'agent.scaffold',
          summary: `Upserted recipe "${recipe.name}" and published prompt ${recipePromptName(recipe.id)}.`,
          details: {
            recipe
          }
        });

        return {
          content: [
            {
              type: 'text',
              text: `Saved recipe "${recipe.name}". You can fetch prompt "${recipePromptName(recipe.id)}" from the prompt catalog now.`
            }
          ],
          structuredContent: {
            recipe,
            prompt: recipeToPromptDescriptor(recipe)
          }
        };
      }
    );
  }

  private async completeRecipeDraft(draft: z.infer<typeof agentRecipeDraftSchema>): Promise<CompletedRecipeDraft> {
    const missing = ['name', 'description', 'systemPrompt', 'starterPrompt'].filter(key => {
      const value = draft[key as keyof typeof draft];
      return typeof value !== 'string' || value.trim().length === 0;
    });

    if (missing.length === 0) {
      return {
        id: draft.id,
        name: draft.name ?? '',
        description: draft.description ?? '',
        systemPrompt: draft.systemPrompt ?? '',
        allowedTools: draft.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
        pinnedResources: draft.pinnedResources ?? DEFAULT_PINNED_RESOURCES,
        starterPrompt: draft.starterPrompt ?? '',
        mode: draft.mode ?? 'deterministic'
      };
    }

    const elicited = await this.server.server.elicitInput({
      mode: 'form',
      message: `Help me finish this recipe by filling the missing fields: ${missing.join(', ')}`,
      requestedSchema: {
        type: 'object',
        properties: Object.fromEntries(
          missing.map(field => [
            field,
            {
              type: 'string',
              description: `Value for ${field}`
            }
          ])
        ),
        required: missing
      }
    });

    if (elicited.action !== 'accept') {
      throw new Error('Recipe scaffolding was cancelled during elicitation.');
    }

    return {
      id: draft.id,
      name: String((elicited.content as Record<string, unknown>).name ?? draft.name ?? ''),
      description: String((elicited.content as Record<string, unknown>).description ?? draft.description ?? ''),
      systemPrompt: String((elicited.content as Record<string, unknown>).systemPrompt ?? draft.systemPrompt ?? ''),
      allowedTools: draft.allowedTools ?? DEFAULT_ALLOWED_TOOLS,
      pinnedResources: draft.pinnedResources ?? DEFAULT_PINNED_RESOURCES,
      starterPrompt: String((elicited.content as Record<string, unknown>).starterPrompt ?? draft.starterPrompt ?? ''),
      mode: draft.mode ?? 'deterministic'
    };
  }

  private upsertRecipePrompt(recipe: AgentRecipe): void {
    const descriptor = recipeToPromptDescriptor(recipe);
    const existing = this.recipePrompts.get(recipe.id);

    if (existing) {
      existing.update({
        title: descriptor.title,
        description: descriptor.description,
        callback: args => this.buildRecipePrompt(recipe.id, args as { task?: string; mode?: AgentMode })
      });
      return;
    }

    const prompt = this.server.registerPrompt(
      descriptor.name,
      {
        title: descriptor.title,
        description: descriptor.description,
        argsSchema: z.object({
          task: z.string().default(recipe.starterPrompt),
          mode: completable(
            agentModeSchema.default(recipe.mode).describe('Execution mode for the recipe.'),
            value => MODE_OPTIONS.filter(mode => mode.startsWith(value ?? ''))
          )
        })
      },
      args => this.buildRecipePrompt(recipe.id, args as { task?: string; mode?: AgentMode })
    );

    this.recipePrompts.set(recipe.id, prompt);
  }

  private buildRecipePrompt(recipeId: string, args: { task?: string; mode?: AgentMode }): GetPromptResult {
    const recipe = this.recipes.get(recipeId);
    if (!recipe) {
      return {
        description: 'Recipe not found.',
        messages: [
          {
            role: 'user',
            content: {
              type: 'text',
              text: `The recipe with id "${recipeId}" is no longer available.`
            }
          }
        ]
      };
    }

    const task = args.task || recipe.starterPrompt;
    const mode = args.mode || recipe.mode;

    return {
        description: `Runtime prompt for recipe ${recipe.name}.`,
        messages: [
          {
            role: 'assistant',
            content: {
              type: 'text',
              text: `${recipe.systemPrompt}\n\nAllowed tools: ${recipe.allowedTools.join(', ')}\nPinned resources: ${recipe.pinnedResources.join(', ')}\nMode: ${mode}`
          }
        },
        {
          role: 'user',
          content: {
            type: 'text',
            text: task
          }
        }
      ]
    };
  }

  private async loadRecipes(): Promise<void> {
    try {
      const raw = await fs.readFile(this.recipeFile, 'utf8');
      const parsed = z.array(agentRecipeSchema).parse(JSON.parse(raw));
      for (const recipe of parsed) {
        this.recipes.set(recipe.id, recipe);
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error;
      }
      await this.persistRecipes();
    }
  }

  private async persistRecipes(): Promise<void> {
    const recipes = [...this.recipes.values()].sort((left, right) => left.name.localeCompare(right.name));
    await fs.writeFile(this.recipeFile, `${JSON.stringify(recipes, null, 2)}\n`, 'utf8');
  }

  private async getPrimaryRoot(ctx?: unknown): Promise<string> {
    // roots/list is a client-owned capability, so the server asks the studio what is in bounds.
    const roots = await this.server.server.listRoots();
    const root = roots.roots[0]?.uri;
    if (!root) {
      return this.cwd;
    }
    return fileURLToPath(root);
  }

  private async scanWorkspaceFiles(root: string, limit: number): Promise<string[]> {
    const results: string[] = [];
    await this.walkWorkspace(root, async absolutePath => {
      if (results.length >= limit) {
        return false;
      }

      if (await this.isTextFile(absolutePath)) {
        results.push(path.relative(root, absolutePath));
      }
      return true;
    });
    return results;
  }

  private async buildWorkspaceTree(root: string, maxDepth: number): Promise<string> {
    const lines: string[] = [path.basename(root) || '.'];

    const visit = async (current: string, depth: number): Promise<void> => {
      if (depth > maxDepth) {
        return;
      }

      const entries = (await fs.readdir(current, { withFileTypes: true }))
        .filter(entry => !IGNORED_DIRECTORIES.has(entry.name))
        .sort((left, right) => Number(right.isDirectory()) - Number(left.isDirectory()) || left.name.localeCompare(right.name))
        .slice(0, 18);

      for (const entry of entries) {
        const relativeDepth = depth - 1;
        lines.push(`${'  '.repeat(relativeDepth)}- ${entry.name}${entry.isDirectory() ? '/' : ''}`);
        if (entry.isDirectory()) {
          await visit(path.join(current, entry.name), depth + 1);
        }
      }
    };

    await visit(root, 1);
    return lines.join('\n');
  }

  private async walkWorkspace(root: string, visitFile: (absolutePath: string) => Promise<boolean>): Promise<void> {
    const stack = [root];

    while (stack.length > 0) {
      const current = stack.pop();
      if (!current) {
        continue;
      }

      const entries = await fs.readdir(current, { withFileTypes: true });
      for (const entry of entries) {
        if (IGNORED_DIRECTORIES.has(entry.name)) {
          continue;
        }
        const absolutePath = path.join(current, entry.name);
        if (entry.isDirectory()) {
          stack.push(absolutePath);
          continue;
        }
        const shouldContinue = await visitFile(absolutePath);
        if (!shouldContinue) {
          return;
        }
      }
    }
  }

  private async isTextFile(absolutePath: string): Promise<boolean> {
    try {
      const buffer = await fs.readFile(absolutePath);
      const chunk = buffer.subarray(0, 1024);
      return !chunk.includes(0);
    } catch {
      return false;
    }
  }

  private resolveAllowedPath(root: string, relativePath: string): string {
    const absolutePath = path.resolve(root, relativePath);
    const normalizedRoot = path.resolve(root);
    if (!absolutePath.startsWith(normalizedRoot)) {
      throw new Error(`Path "${relativePath}" falls outside the allowed root.`);
    }
    return absolutePath;
  }

  private async searchWorkspace(root: string, query: string, limit: number, filePattern?: string): Promise<SearchMatch[]> {
    try {
      const args = ['--line-number', '--column', '--no-heading', '--fixed-strings', '--max-count', String(limit)];
      if (filePattern) {
        args.push('--glob', filePattern);
      }
      args.push(query, '.');
      const result = await execFileAsync('rg', args, { cwd: root });
      return result.stdout
        .trim()
        .split('\n')
        .filter(Boolean)
        .slice(0, limit)
        .map(line => {
          const [file, lineNumber, column, ...excerptParts] = line.split(':');
          return {
            file,
            line: Number(lineNumber),
            column: Number(column),
            excerpt: excerptParts.join(':')
          };
        });
    } catch (error) {
      const exitCode = (error as { code?: number | string }).code;
      if (exitCode !== 1 && exitCode !== 'ENOENT') {
        throw error;
      }

      const matches: SearchMatch[] = [];
      await this.walkWorkspace(root, async absolutePath => {
        if (matches.length >= limit || !(await this.isTextFile(absolutePath))) {
          return matches.length < limit;
        }

        const text = await fs.readFile(absolutePath, 'utf8');
        const lines = text.split('\n');
        for (let index = 0; index < lines.length; index += 1) {
          const line = lines[index] ?? '';
          const column = line.indexOf(query);
          if (column !== -1) {
            matches.push({
              file: path.relative(root, absolutePath),
              line: index + 1,
              column: column + 1,
              excerpt: line.trim()
            });
            if (matches.length >= limit) {
              return false;
            }
          }
        }
        return true;
      });
      return matches;
    }
  }

  private extractSamplingText(result: Record<string, unknown>): string {
    const content = result.content;
    if (Array.isArray(content)) {
      return content
        .map(block => (typeof block === 'object' && block && 'text' in block ? String((block as { text: unknown }).text) : ''))
        .filter(Boolean)
        .join('\n')
        .trim();
    }

    if (typeof content === 'object' && content && 'text' in content) {
      return String((content as { text: unknown }).text);
    }

    return JSON.stringify(result, null, 2);
  }

  private async setLatestRun(next: LatestRunState): Promise<void> {
    this.latestRun = next;
    // A subscribed resource makes tool activity visible in the studio without custom polling logic.
    await this.server.server.sendResourceUpdated({ uri: SESSION_RESOURCE_URI });
  }
}
