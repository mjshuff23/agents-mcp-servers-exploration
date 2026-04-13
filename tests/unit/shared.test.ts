import {
  agentRecipeSchema,
  capabilityMatrixSchema,
  primitiveCatalogSchema,
  primitiveSummarySchema,
  recipePromptDescriptorSchema,
  recipeToPromptDescriptor,
  studioSnapshotSchema,
  traceEventSchema,
  type AgentRecipe
} from '@agents/shared';

describe('shared schemas', () => {
  it('validates primitive summaries for tools, resources, and prompts', () => {
    expect(() =>
      primitiveSummarySchema.parse({
        name: 'workspace.search',
        title: 'Workspace Search',
        description: 'Search for local matches.'
      })
    ).not.toThrow();

    expect(() =>
      primitiveSummarySchema.parse({
        name: 'workspace-tree',
        title: 'Workspace Tree',
        uri: 'workspace://tree'
      })
    ).not.toThrow();

    expect(() =>
      primitiveSummarySchema.parse({
        name: 'bootstrap-agent',
        title: 'Bootstrap Agent',
        description: 'Create a starter prompt.'
      })
    ).not.toThrow();
  });

  it('validates recipe, capability matrix, trace, catalog, and studio snapshot contracts', () => {
    const recipe = agentRecipeSchema.parse({
      id: 'trace-guide',
      name: 'Trace Guide',
      description: 'Explains the latest trace.',
      systemPrompt: 'Teach through the trace.',
      allowedTools: ['workspace.search', 'file.summarize'],
      pinnedResources: ['workspace://tree', 'session://latest-run'],
      starterPrompt: 'Explain the latest run.',
      mode: 'deterministic'
    });

    const trace = traceEventSchema.parse({
      id: 'trace-1',
      timestamp: new Date().toISOString(),
      category: 'prompt',
      direction: 'client->server',
      title: 'prompts/get',
      detail: 'Fetching bootstrap-agent.'
    });

    const catalog = primitiveCatalogSchema.parse({
      tools: [{ name: 'workspace.search', title: 'Workspace Search' }],
      resources: [{ name: 'workspace-tree', title: 'Workspace Tree', uri: 'workspace://tree' }],
      prompts: [{ name: 'bootstrap-agent', title: 'Bootstrap Agent' }]
    });

    const capabilityMatrix = capabilityMatrixSchema.parse({
      transport: 'stdio',
      negotiatedAt: new Date().toISOString(),
      client: {
        sampling: { enabled: true }
      },
      server: {
        prompts: { enabled: true, detail: 'listChanged' }
      }
    });

    expect(() =>
      studioSnapshotSchema.parse({
        mode: 'deterministic',
        capabilityMatrix,
        primitiveCatalog: catalog,
        trace: [trace],
        messages: [
          {
            id: 'message-1',
            role: 'assistant',
            text: 'The playground is ready.'
          }
        ],
        recipes: [recipe],
        latestRunResource: '{"operation":"boot"}',
        connected: true
      })
    ).not.toThrow();
  });
});

describe('recipe prompt descriptors', () => {
  it('derives a stable prompt descriptor from a recipe', () => {
    const recipe: AgentRecipe = {
      id: 'trace-guide',
      name: 'Trace Guide',
      description: 'Explains the latest trace.',
      systemPrompt: 'Teach through the trace.',
      allowedTools: ['workspace.search'],
      pinnedResources: ['session://latest-run'],
      starterPrompt: 'Explain the latest run.',
      mode: 'deterministic'
    };

    const descriptor = recipeToPromptDescriptor(recipe);

    expect(recipePromptDescriptorSchema.parse(descriptor)).toEqual({
      name: 'recipe.trace-guide',
      title: 'Trace Guide Recipe',
      description: 'Explains the latest trace.'
    });
  });
});
