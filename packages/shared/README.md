# Shared Package

Previous: [Packages](../README.md) | Next: [Shared Source](./src/README.md) | Parent: [Packages](../README.md)

## Why This Folder Exists

`packages/shared/` keeps the browser snapshot contract, recipe schema, and helper functions in one place so the studio and MCP runtime do not drift apart.

## Runtime / Data Flow

This package is imported by both `apps/studio` and `packages/workspace-mcp`. It defines the shapes used for runtime state, trace events, recipe persistence, and prompt naming.

## Key Files

- [package.json](./package.json)
  Declares the shared package boundary for the workspace.
- [src/README.md](./src/README.md)
  Explains the actual source files.

## What To Read Next

Continue into [packages/shared/src/README.md](./src/README.md) to see the schemas and helpers directly.

## Try This

Find `recipePromptName` in the source and then search for where that exact prefix appears in tests and UI code.
