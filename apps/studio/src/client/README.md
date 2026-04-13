# Studio Client

Previous: [Studio Source](../README.md) | Next: [Studio Public Assets](../../public/README.md) | Parent: [Studio Source](../README.md)

## Why This Folder Exists

`apps/studio/src/client/` contains the browser renderer. It intentionally stays light: no framework, one entrypoint, one snapshot, one render function.

## Runtime / Data Flow

The client fetches the current snapshot once, subscribes to SSE updates, and rerenders whenever the studio server pushes fresh state. Form submissions go back to the studio's HTTP API rather than talking to MCP directly.

## Key Files

- [index.ts](./index.ts)
  Bootstraps the browser app, keeps theme state, renders the four panes, and wires forms to the studio HTTP endpoints.

## What To Read Next

Move into [apps/studio/public/README.md](../../public/README.md) to see how the browser shell and layout are styled.

## Try This

Search for `EventSource('/api/events')` and connect that line to the live trace panel you see in the browser.
