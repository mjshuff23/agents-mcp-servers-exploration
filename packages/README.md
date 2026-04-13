# Packages

Previous: [Studio Scripts](../apps/studio/scripts/README.md) | Next: [Shared Package](./shared/README.md) | Parent: [Repository Root](../README.md)

## Why This Folder Exists

`packages/` holds reusable workspace pieces that are not themselves the user-facing app.

## Runtime / Data Flow

The studio and MCP runtime meet here:

- `shared` defines the contracts both sides depend on
- `workspace-mcp` implements the local MCP server

## Key Files

- [shared/README.md](./shared/README.md)
  The cross-boundary type and helper package.
- [workspace-mcp/README.md](./workspace-mcp/README.md)
  The local MCP server package.

## What To Read Next

Go to [packages/shared/README.md](./shared/README.md) first. Understanding the shared schemas makes the rest of the runtime easier to read.

## Try This

Compare the same `TraceEvent` shape in the shared package to how it is rendered in the browser.
