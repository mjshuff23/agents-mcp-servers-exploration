# Studio Source

Previous: [Studio](../README.md) | Next: [Studio Client](./client/README.md) | Parent: [Studio](../README.md)

## Why This Folder Exists

`apps/studio/src/` holds the executable TypeScript for the studio runtime.

## Runtime / Data Flow

This folder is where HTTP routes, SSE updates, and MCP client handlers meet. It is the control room for the browser-facing part of the playground.

## Key Files

- [server.ts](./server.ts)
  Starts the HTTP server, creates the MCP client, handles sampling and elicitation, and manages the snapshot that the browser renders.
- [client/README.md](./client/README.md)
  Dives into the browser-side renderer that consumes the snapshot.

## What To Read Next

Open [apps/studio/src/client/README.md](./client/README.md) after you understand that the studio server is the real MCP client.

## Try This

Find where `notifications/prompts/list_changed` is handled and compare it to the prompt-catalog UI refresh.
