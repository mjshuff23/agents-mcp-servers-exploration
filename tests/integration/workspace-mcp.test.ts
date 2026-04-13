import { Client, StdioClientTransport } from '@modelcontextprotocol/client';
import { afterEach, describe, expect, it } from 'vitest';
import { promises as fs } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

type Deferred<T> = {
  promise: Promise<T>;
  resolve: (value: T) => void;
  reject: (error: unknown) => void;
};

function createDeferred<T>(): Deferred<T> {
  let resolve!: (value: T) => void;
  let reject!: (error: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number, label: string): Promise<T> {
  let timeout: NodeJS.Timeout | undefined;
  const timed = new Promise<T>((_, reject) => {
    timeout = setTimeout(() => reject(new Error(`${label} timed out after ${timeoutMs}ms`)), timeoutMs);
  });

  try {
    return await Promise.race([promise, timed]);
  } finally {
    if (timeout) {
      clearTimeout(timeout);
    }
  }
}

async function createWorkspaceFixture(): Promise<{ rootDir: string; dataDir: string }> {
  const rootDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-workspace-'));
  const dataDir = await fs.mkdtemp(path.join(os.tmpdir(), 'agents-data-'));

  await fs.mkdir(path.join(rootDir, 'src'), { recursive: true });
  await fs.writeFile(
    path.join(rootDir, 'README.md'),
    '# Sample Workspace\n\nThis repo exists to test MCP tools, prompts, resources, and roots.\n',
    'utf8'
  );
  await fs.writeFile(
    path.join(rootDir, 'src', 'greeting.ts'),
    'export const greeting = "Hello from workspace.search";\n',
    'utf8'
  );

  return { rootDir, dataDir };
}

describe('workspace MCP stdio integration', () => {
  const cleanupTargets: string[] = [];

  afterEach(async () => {
    await Promise.all(
      cleanupTargets.splice(0).map(target =>
        fs.rm(target, {
          recursive: true,
          force: true
        })
      )
    );
  });

  it('supports discovery, roots, resources, prompts, sampling, elicitation, and listChanged notifications', async () => {
    const { rootDir, dataDir } = await createWorkspaceFixture();
    cleanupTargets.push(rootDir, dataDir);

    const serverEntry = path.resolve(process.cwd(), 'packages/workspace-mcp/dist/index.js');
    const client = new Client(
      { name: 'workspace-mcp-integration-test', version: '0.1.0' },
      {
        capabilities: {
          roots: { listChanged: true },
          sampling: {},
          elicitation: { form: {} }
        }
      }
    );

    let rootsListRequests = 0;
    let samplingRequests = 0;
    let elicitationRequests = 0;

    const promptListChanged = createDeferred<string>();
    const resourceUpdated = createDeferred<string>();

    client.setRequestHandler('roots/list', async () => {
      rootsListRequests += 1;
      return {
        roots: [
          {
            uri: pathToFileURL(rootDir).href,
            name: 'fixture-root'
          }
        ]
      };
    });

    client.setRequestHandler('sampling/createMessage', async request => {
      samplingRequests += 1;
      expect(request.params.messages[0]?.content).toBeDefined();
      return {
        model: 'integration-test-model',
        role: 'assistant' as const,
        content: {
          type: 'text' as const,
          text: 'Sampled summary from the client.'
        }
      };
    });

    client.setRequestHandler('elicitation/create', async request => {
      elicitationRequests += 1;
      expect(request.params.message).toContain('systemPrompt');
      return {
        action: 'accept' as const,
        content: {
          systemPrompt: 'Explain the trace and name the active MCP primitive.'
        }
      };
    });

    client.setNotificationHandler('notifications/prompts/list_changed', () => {
      promptListChanged.resolve('notifications/prompts/list_changed');
    });

    client.setNotificationHandler('notifications/resources/updated', notification => {
      resourceUpdated.resolve(String(notification.params.uri));
    });

    const transport = new StdioClientTransport({
      command: process.execPath,
      args: [serverEntry],
      cwd: rootDir,
      env: {
        ...process.env,
        AGENTS_DATA_DIR: dataDir,
        AGENTS_DEFAULT_MODE: 'deterministic'
      }
    });

    await client.connect(transport);

    try {
      const serverCapabilities = client.getServerCapabilities();
      expect(serverCapabilities?.tools).toBeTruthy();
      expect(serverCapabilities?.resources?.subscribe).toBe(true);
      expect(serverCapabilities?.prompts?.listChanged).toBe(true);
      expect(serverCapabilities?.completions).toBeTruthy();

      const listedTools = await client.listTools();
      expect(listedTools.tools.map(tool => tool.name)).toEqual(
        expect.arrayContaining(['workspace.search', 'file.summarize', 'agent.scaffold'])
      );

      const listedResources = await client.listResources();
      expect(listedResources.resources.map(resource => resource.uri)).toEqual(
        expect.arrayContaining(['workspace://tree', 'session://latest-run', 'workspace://file/README.md'])
      );

      const listedPrompts = await client.listPrompts();
      expect(listedPrompts.prompts.map(prompt => prompt.name)).toEqual(
        expect.arrayContaining(['bootstrap-agent', 'explain-trace'])
      );

      const completion = await client.complete({
        ref: { type: 'ref/prompt', name: 'bootstrap-agent' },
        argument: { name: 'mode', value: 'de' }
      });
      expect(completion.completion.values).toContain('deterministic');

      const bootstrapPrompt = await client.getPrompt({
        name: 'bootstrap-agent',
        arguments: {
          goal: 'Learn how MCP hangs together.',
          mode: 'deterministic'
        }
      });
      const bootstrapText = bootstrapPrompt.messages
        .map(message => ('text' in message.content ? message.content.text : ''))
        .join('\n');
      expect(bootstrapText).toContain('Learn how MCP hangs together.');

      const workspaceTree = await client.readResource({ uri: 'workspace://tree' });
      expect(workspaceTree.contents[0]?.text).toContain('README.md');

      const workspaceFile = await client.readResource({ uri: 'workspace://file/src%2Fgreeting.ts' });
      expect(workspaceFile.contents[0]?.text).toContain('workspace.search');

      await client.subscribeResource({ uri: 'session://latest-run' });

      const searchResult = await client.callTool({
        name: 'workspace.search',
        arguments: {
          query: 'workspace.search',
          limit: 5
        }
      });
      expect(searchResult.content?.[0] && 'text' in searchResult.content[0] ? searchResult.content[0].text : '').toContain('greeting.ts');
      expect(rootsListRequests).toBeGreaterThan(0);

      const updatedUri = await withTimeout(resourceUpdated.promise, 5_000, 'resource update notification');
      expect(updatedUri).toBe('session://latest-run');

      const summaryResult = await client.callTool({
        name: 'file.summarize',
        arguments: {
          path: 'README.md',
          audience: 'beginner'
        }
      });
      expect(summaryResult.content?.[0] && 'text' in summaryResult.content[0] ? summaryResult.content[0].text : '').toContain(
        'Sampled summary from the client.'
      );
      expect(samplingRequests).toBe(1);

      const scaffoldResult = await client.callTool(
        {
          name: 'agent.scaffold',
          arguments: {
            name: 'Trace Guide',
            description: 'A teaching recipe for the newest trace.',
            starterPrompt: 'Walk me through the newest run.',
            mode: 'deterministic'
          }
        },
        {
          timeout: 10_000
        }
      );

      expect(scaffoldResult.content?.[0] && 'text' in scaffoldResult.content[0] ? scaffoldResult.content[0].text : '').toContain(
        'Saved recipe "Trace Guide"'
      );
      expect(elicitationRequests).toBe(1);

      const promptChangedMethod = await withTimeout(promptListChanged.promise, 5_000, 'prompts/list_changed');
      expect(promptChangedMethod).toBe('notifications/prompts/list_changed');

      const promptsAfterScaffold = await client.listPrompts();
      expect(promptsAfterScaffold.prompts.map(prompt => prompt.name)).toContain('recipe.trace-guide');

      const recipePrompt = await client.getPrompt({
        name: 'recipe.trace-guide',
        arguments: {
          task: 'Explain the latest run.',
          mode: 'deterministic'
        }
      });
      const recipePromptText = recipePrompt.messages
        .map(message => ('text' in message.content ? message.content.text : ''))
        .join('\n');
      expect(recipePromptText).toContain('Explain the trace and name the active MCP primitive.');

      const latestRun = await client.readResource({ uri: 'session://latest-run' });
      expect(latestRun.contents[0]?.text).toContain('agent.scaffold');
      expect(latestRun.contents[0]?.text).toContain('recipe.trace-guide');
    } finally {
      await client.close();
    }
  });
});
