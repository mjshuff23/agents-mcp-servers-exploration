# Shared Source

Previous: [Shared Package](../README.md) | Next: [Workspace MCP Package](../../workspace-mcp/README.md) | Parent: [Shared Package](../README.md)

## Why This Folder Exists

`packages/shared/src/` is the contract layer. It answers "what shapes do all three surfaces agree on?"

## Runtime / Data Flow

Every time the studio builds a snapshot, the browser renders a trace, or the MCP runtime validates a recipe, code from this folder is involved.

## Key Files

- [types.ts](./types.ts)
  Zod schemas and inferred types for snapshots, recipes, primitive catalogs, and trace events.
- [index.ts](./index.ts)
  Re-exports shared types and provides helper functions like slugging and recipe prompt naming.

## What To Read Next

Move into [packages/workspace-mcp/README.md](../../workspace-mcp/README.md) to see the server that uses these shared contracts.

## Try This

Read the `agentRecipeSchema`, then compare it to the payload that `agent.scaffold` writes into `.studio-data/recipes.json`.
