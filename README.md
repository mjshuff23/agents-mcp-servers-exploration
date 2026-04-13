# Agent + MCP Learning Playground

Previous: [Repository Root](./README.md) | Next: [Docs](./docs/README.md) | Parent: [Repository Root](./README.md)

A local TypeScript workspace for learning self-serve agents from both sides of the glass: the browser studio shows the protocol as it happens, and the codebase now doubles as a guided reading path.

## Why This Repo Exists

Most MCP demos make the protocol disappear behind a chat box. This repository does the opposite:

- the studio owns the MCP client session
- the local MCP server exposes tools, resources, prompts, logging, completions, roots, sampling, elicitation, and `listChanged`
- the UI renders a live trace so you can see lifecycle and capability negotiation instead of guessing
- the repo itself is documented like a walkthrough, not just a source dump

The default experience is deterministic, which means the full tour works without an API key. Live sampling is optional.

## Learning Path

Read the repo in this order:

1. [Docs](./docs/README.md)
2. [Diagrams](./docs/diagrams/README.md)
3. [Apps](./apps/README.md)
4. [Studio](./apps/studio/README.md)
5. [Studio Source](./apps/studio/src/README.md)
6. [Studio Client](./apps/studio/src/client/README.md)
7. [Studio Public Assets](./apps/studio/public/README.md)
8. [Studio Scripts](./apps/studio/scripts/README.md)
9. [Packages](./packages/README.md)
10. [Shared Package](./packages/shared/README.md)
11. [Shared Source](./packages/shared/src/README.md)
12. [Workspace MCP Package](./packages/workspace-mcp/README.md)
13. [Workspace MCP Source](./packages/workspace-mcp/src/README.md)
14. [Test Helpers](./test/README.md)
15. [Test Suites](./tests/README.md)
16. [Unit Tests](./tests/unit/README.md)
17. [Integration Tests](./tests/integration/README.md)
18. [End-to-End Tests](./tests/e2e/README.md)

## What You Can Learn Here

### Protocol surfaces

- lifecycle and capability negotiation
- `tools`, `resources`, and `prompts`
- prompt `completions`
- `logging`
- client-provided `roots`
- server-driven `sampling`
- server-driven `elicitation`
- live `prompts/list_changed`, `tools/list_changed`, and resource updates

### Product surfaces

- a browser studio that visualizes MCP behavior
- a local stdio MCP server with safe workspace-scoped primitives
- a self-serve agent recipe flow that republishes recipes back into the prompt catalog

## Architecture At A Glance

- `apps/studio`
  The local web app. It serves the browser shell, owns the MCP client connection, handles server-initiated requests like `sampling/createMessage` and `elicitation/create`, and streams a normalized snapshot to the browser over SSE.
- `packages/workspace-mcp`
  The MCP server. It exposes learning-focused tools, resources, and prompts that are scoped to the client-provided workspace root.
- `packages/shared`
  Shared schemas and helpers used by both sides so the studio, browser, and MCP runtime all agree on the same shapes.
- `docs/diagrams`
  The canonical repo-native flow diagrams, written in Mermaid so they stay versioned with the code.

## Repo-Native Diagram Set

The canonical diagrams live in [docs/diagrams/README.md](./docs/diagrams/README.md):

- [Architecture Overview](./docs/diagrams/architecture-overview.md)
- [Protocol Tour Sequence](./docs/diagrams/protocol-tour-sequence.md)
- [Recipe Publication Flow](./docs/diagrams/recipe-publication-flow.md)

Figma write access can be limited by the connected account seat. When that happens, these markdown diagrams remain the source of truth and the external diagram links are treated as optional mirrors rather than blockers.

## External References

- Notion page: [Agent + MCP Learning Playground](https://www.notion.so/341c2ea5f18f8161a5bac1d466e26600)
- FigJam mirrors:
  - [Architecture Overview](https://www.figma.com/online-whiteboard/create-diagram/ad27f2ea-8360-4fcb-81e5-a0e7c1743c53?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=6c9d3598-897d-4c15-b5f9-535df2917989)
  - [Protocol Tour Sequence](https://www.figma.com/online-whiteboard/create-diagram/27df7f85-7c5d-4f37-afb4-432a5948f69b?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=3f326942-79c1-4af3-bdcb-a4758f0b06cd)
  - [Recipe Publication Flow](https://www.figma.com/online-whiteboard/create-diagram/682da6fe-ca6f-45bd-9746-2d26dbf66b82?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=2947e8ab-5352-466c-b672-fceeae3bb58e)

## Getting Started

### Requirements

- Node 22
- `npm`

### Install

```bash
npm install
```

### Build

```bash
npm run build
```

### Start the studio

```bash
npm start
```

Open `http://127.0.0.1:4321` and run the protocol tour.

## Suggested Walkthrough

1. Start the studio and confirm the terminal prints the connection banner.
2. Open the browser and inspect the capability matrix before you click anything.
3. Run `Run protocol tour`.
4. When the server asks for missing recipe input, answer the elicitation form.
5. Watch the trace show prompt fetches, resource reads, tool calls, notifications, and client-side sampling.
6. Compare the live UI to the corresponding code in [`apps/studio/src/server.ts`](./apps/studio/src/server.ts) and [`packages/workspace-mcp/src/runtime.ts`](./packages/workspace-mcp/src/runtime.ts).
7. Read the tests to see how the same flow is asserted without the UI.

## Key Files

- [`package.json`](./package.json)
  Defines the workspace scripts and the top-level build/test workflow.
- [`tsconfig.base.json`](./tsconfig.base.json)
  Sets the shared TypeScript baseline for every project in the repo.
- [`playwright.config.ts`](./playwright.config.ts)
  Boots the studio for browser verification and regression coverage.
- [`vitest.config.ts`](./vitest.config.ts)
  Splits fast contract tests from stdio integration tests.

## What To Read Next

Move into [docs/README.md](./docs/README.md). That folder explains how the written materials in this repo are organized before you dive into runtime code.

## Try This

- Open [docs/diagrams/protocol-tour-sequence.md](./docs/diagrams/protocol-tour-sequence.md) and compare the sequence diagram to the live trace after a tour run.
- Open [apps/studio/src/server.ts](./apps/studio/src/server.ts) and find where the studio answers `roots/list`.
- Open [packages/workspace-mcp/src/runtime.ts](./packages/workspace-mcp/src/runtime.ts) and find where a saved recipe becomes a new prompt.
