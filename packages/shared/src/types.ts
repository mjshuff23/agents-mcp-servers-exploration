import { z } from 'zod';

// These schemas are the shared contract between the browser, the studio server, and the MCP runtime.
export const agentModeSchema = z.enum(['deterministic', 'live']);
export type AgentMode = z.infer<typeof agentModeSchema>;

export const agentRecipeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().min(1),
  systemPrompt: z.string().min(1),
  allowedTools: z.array(z.string()).min(1),
  pinnedResources: z.array(z.string()),
  starterPrompt: z.string().min(1),
  mode: agentModeSchema
});

export type AgentRecipe = z.infer<typeof agentRecipeSchema>;

export const agentRecipeDraftSchema = agentRecipeSchema.partial().extend({
  id: z.string().optional(),
  name: z.string().min(1).optional()
});

export type AgentRecipeDraft = z.infer<typeof agentRecipeDraftSchema>;

export const capabilityFlagSchema = z.object({
  enabled: z.boolean(),
  detail: z.string().optional()
});

export type CapabilityFlag = z.infer<typeof capabilityFlagSchema>;

export const capabilityMatrixSchema = z.object({
  transport: z.enum(['stdio', 'streamable-http']),
  negotiatedAt: z.string().min(1),
  client: z.record(z.string(), capabilityFlagSchema),
  server: z.record(z.string(), capabilityFlagSchema)
});

export type CapabilityMatrix = z.infer<typeof capabilityMatrixSchema>;

export const traceCategorySchema = z.enum([
  'lifecycle',
  'discovery',
  'tool',
  'resource',
  'prompt',
  'notification',
  'sampling',
  'elicitation',
  'logging',
  'recipe',
  'ui'
]);

export type TraceCategory = z.infer<typeof traceCategorySchema>;

export const traceDirectionSchema = z.enum(['client->server', 'server->client', 'studio']);

export type TraceDirection = z.infer<typeof traceDirectionSchema>;

export const traceEventSchema = z.object({
  id: z.string().min(1),
  timestamp: z.string().min(1),
  category: traceCategorySchema,
  direction: traceDirectionSchema,
  title: z.string().min(1),
  detail: z.string().optional(),
  payload: z.unknown().optional()
});

export type TraceEvent = z.infer<typeof traceEventSchema>;

export const primitiveSummarySchema = z.object({
  name: z.string().min(1),
  title: z.string().optional(),
  description: z.string().optional(),
  uri: z.string().optional()
});

export type PrimitiveSummary = z.infer<typeof primitiveSummarySchema>;

export const primitiveCatalogSchema = z.object({
  tools: z.array(primitiveSummarySchema),
  resources: z.array(primitiveSummarySchema),
  prompts: z.array(primitiveSummarySchema)
});

export type PrimitiveCatalog = z.infer<typeof primitiveCatalogSchema>;

export const runMessageSchema = z.object({
  id: z.string().min(1),
  role: z.enum(['system', 'assistant', 'user']),
  text: z.string(),
  tone: z.enum(['neutral', 'success', 'warning']).optional()
});

export type RunMessage = z.infer<typeof runMessageSchema>;

export const pendingElicitationSchema = z.object({
  id: z.string().min(1),
  message: z.string().min(1),
  requestedSchema: z.record(z.string(), z.unknown())
});

export type PendingElicitation = z.infer<typeof pendingElicitationSchema>;

export const studioSnapshotSchema = z.object({
  mode: agentModeSchema,
  capabilityMatrix: capabilityMatrixSchema,
  primitiveCatalog: primitiveCatalogSchema,
  trace: z.array(traceEventSchema),
  messages: z.array(runMessageSchema),
  recipes: z.array(agentRecipeSchema),
  latestRunResource: z.string(),
  pendingElicitation: pendingElicitationSchema.optional(),
  connected: z.boolean()
});

export type StudioSnapshot = z.infer<typeof studioSnapshotSchema>;

export const recipePromptDescriptorSchema = z.object({
  name: z.string().min(1),
  title: z.string().min(1),
  description: z.string().min(1)
});

export type RecipePromptDescriptor = z.infer<typeof recipePromptDescriptorSchema>;
