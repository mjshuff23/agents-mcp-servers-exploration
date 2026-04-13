# Workspace MCP Package

Previous: [Shared Source](../shared/src/README.md) | Next: [Workspace MCP Source](./src/README.md) | Parent: [Packages](../README.md)

## Why This Folder Exists

`packages/workspace-mcp/` contains the local MCP server that powers the playground.

## Runtime / Data Flow

The studio launches this package over stdio. The server then exposes tools, resources, prompts, logging, and completions while asking the client for roots, sampling, and elicitation when needed.

## Key Files

- [package.json](./package.json)
  Declares the MCP package boundary and runtime dependencies.
- [src/README.md](./src/README.md)
  Explains the source files that implement the server behavior.

## What To Read Next

Continue into [packages/workspace-mcp/src/README.md](./src/README.md) for the server entrypoint and runtime implementation.

## Try This

Use the studio to call `workspace.search`, then find the matching implementation in `src/runtime.ts`.
