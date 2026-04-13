# Apps

Previous: [Diagrams](../docs/diagrams/README.md) | Next: [Studio](./studio/README.md) | Parent: [Repository Root](../README.md)

## Why This Folder Exists

`apps/` holds runnable user-facing surfaces. In this repo that means the local studio, which is both a teaching UI and the active MCP client.

## Runtime / Data Flow

The browser talks to the studio over HTTP and SSE. The studio then talks to the MCP server over stdio and keeps the browser synchronized with a normalized snapshot.

## Key Files

- [studio/README.md](./studio/README.md)
  The runnable app and the bridge between browser interactions and MCP traffic.

## What To Read Next

Go to [apps/studio/README.md](./studio/README.md). That folder is the actual product surface of the playground.

## Try This

Start the studio, then trace one browser action to one MCP call by reading `apps/studio/src/server.ts`.
