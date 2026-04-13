# Protocol Tour Sequence

Back to [Diagrams README](./README.md)

This is the happy-path teaching flow that the browser's `Run protocol tour` button drives.

```mermaid
sequenceDiagram
  participant Browser
  participant Studio as Studio Server / MCP Client
  participant MCP as Workspace MCP Server
  participant Files as Workspace Files

  Browser->>Studio: POST /api/run-tour
  Studio->>MCP: prompts/get bootstrap-agent
  Studio->>MCP: resources/read workspace://tree
  MCP->>Studio: roots/list
  Studio-->>MCP: allowed root
  MCP->>Files: read tree / files
  Studio->>MCP: tools/call workspace.search
  MCP->>Files: search root
  Studio->>MCP: tools/call file.summarize
  MCP->>Studio: sampling/createMessage
  Studio-->>MCP: summary text
  Studio->>MCP: tools/call agent.scaffold
  MCP->>Studio: elicitation/create
  Browser->>Studio: submit elicitation form
  Studio-->>MCP: elicitation response
  MCP-->>Studio: notifications/prompts/list_changed
  MCP-->>Studio: notifications/resources/updated
  Studio-->>Browser: updated snapshot over SSE
```

## What To Notice

- The client owns the root boundary.
- Sampling and elicitation both reverse the normal request direction.
- The tour intentionally touches every major primitive so the trace is educational, not just functional.
