# Workspace MCP Source

Previous: [Workspace MCP Package](../README.md) | Next: [Test Helpers](../../../test/README.md) | Parent: [Workspace MCP Package](../README.md)

## Why This Folder Exists

`packages/workspace-mcp/src/` is where the local MCP server is actually assembled.

## Runtime / Data Flow

The entrypoint creates the runtime. The runtime registers resources, prompts, and tools, persists recipes, asks the client for missing information, and emits the notifications the studio visualizes.

## Key Files

- [index.ts](./index.ts)
  Minimal process entrypoint that boots the runtime.
- [runtime.ts](./runtime.ts)
  The real implementation of the server: primitive registration, file access, recipe persistence, sampling requests, elicitation, and latest-run updates.

## What To Read Next

Move into [test/README.md](../../../test/README.md). Once you understand the runtime, the tests become a second explanation of the same system.

## Try This

Search for `sendPromptListChanged()` and then check how the browser and integration tests react to that notification.
