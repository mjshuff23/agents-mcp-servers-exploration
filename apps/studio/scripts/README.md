# Studio Scripts

Previous: [Studio Public Assets](../public/README.md) | Next: [Packages](../../../packages/README.md) | Parent: [Studio](../README.md)

## Why This Folder Exists

`apps/studio/scripts/` keeps the studio's browser build step separate from the runtime server code.

## Runtime / Data Flow

This folder is build-time only. It bundles the browser entrypoint into a static file that the studio can serve from `public/assets`.

## Key Files

- [build-client.mjs](./build-client.mjs)
  Uses esbuild to bundle the browser client into `public/assets/client.js`.

## What To Read Next

Move to [packages/README.md](../../../packages/README.md). The next part of the story is the shared package and the local MCP server package.

## Try This

Change one line in the browser client, run `npm run build`, and trace which output file this script regenerates.
