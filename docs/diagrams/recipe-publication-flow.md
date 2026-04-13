# Recipe Publication Flow

Back to [Diagrams README](./README.md)

This diagram focuses on the most "self-serve agent" part of the playground.

```mermaid
flowchart LR
  Browser["Recipe form in browser"] -->|POST /api/recipes| Studio["Studio server"]
  Studio -->|tools/call agent.scaffold| MCP["workspace-mcp runtime"]
  MCP -->|optional elicitation| Studio
  Studio -->|answer from browser form| MCP
  MCP -->|validate with shared schema| Shared["packages/shared"]
  MCP -->|persist recipe JSON| Data[".studio-data/recipes.json"]
  MCP -->|upsert dynamic prompt| Prompt["recipe.<slug> prompt"]
  MCP -->|prompts/list_changed| Studio
  MCP -->|resources/updated session://latest-run| Studio
  Studio -->|SSE snapshot| Browser
  Browser -->|shows recipe + new prompt| Catalog["Prompt catalog / recipe list"]
```

## What To Notice

- A recipe is both persisted data and a new MCP prompt.
- `prompts/list_changed` is the mechanism that tells the studio to refresh discovery state.
- The latest-run resource lets the UI reflect tool activity without inventing a separate custom event channel.
