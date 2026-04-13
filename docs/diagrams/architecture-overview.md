# Architecture Overview

Back to [Diagrams README](./README.md)

This diagram shows the major runtime boundaries in the playground.

```mermaid
flowchart LR
  Browser["Browser UI<br/>renders snapshot + forms"] -->|HTTP + SSE| Studio["apps/studio<br/>local web server + MCP client"]
  Studio -->|stdio transport| Mcp["packages/workspace-mcp<br/>local MCP server"]
  Studio -->|reads/writes| Data[".studio-data<br/>recipes + local state"]
  Mcp -->|roots-scoped reads| Workspace["Workspace files"]
  Mcp -->|resources / prompts / tools| Studio
  Studio -->|sampling + elicitation responses| Mcp
  Shared["packages/shared<br/>schemas + helpers"] --- Studio
  Shared --- Mcp
```

## What To Notice

- The browser never speaks MCP directly.
- The studio process is both a web server and an MCP client.
- The MCP server can ask the studio for roots, sampling, and elicitation.
- Shared schemas keep the browser snapshot and MCP-facing data structures aligned.
