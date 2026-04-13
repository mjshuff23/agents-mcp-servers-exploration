# Studio

Previous: [Apps](../README.md) | Next: [Studio Source](./src/README.md) | Parent: [Apps](../README.md)

## Why This Folder Exists

`apps/studio/` is the local web app. It serves the browser shell, owns the MCP client connection, and translates browser actions into protocol activity.

## Runtime / Data Flow

The studio process has three jobs:

- serve static browser assets
- speak MCP over stdio to the local server
- stream one evolving snapshot back to the browser over SSE

## Key Files

- [package.json](./package.json)
  Declares the studio package entrypoint and the tiny browser build script.
- [src/server.ts](./src/server.ts)
  The main runtime for the studio server and MCP client session.
- [public/README.md](./public/README.md)
  Explains the static shell and CSS that the browser loads.
- [scripts/README.md](./scripts/README.md)
  Explains the small build step that bundles the browser entrypoint.

## What To Read Next

Continue into [apps/studio/src/README.md](./src/README.md) to see where the studio runtime actually lives.

## Try This

Look for `runProtocolTour` in `src/server.ts` and list the primitives it touches in order.
