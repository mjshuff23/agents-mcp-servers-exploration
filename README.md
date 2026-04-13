# Agent + MCP Learning Playground

A local TypeScript workspace for exploring self-serve agents and the full MCP surface area through a browser studio and a local stdio MCP server.

## What This Repo Is

This playground is built to make the Model Context Protocol legible from the wire up. Instead of hiding the protocol behind one chat box, it exposes the moving parts:

- lifecycle and capability negotiation
- `tools`, `resources`, and `prompts`
- `logging` and prompt `completions`
- client-provided `roots`
- server-driven `sampling` and `elicitation`
- live `listChanged` notifications
- subscribed resource updates

The default mode is deterministic, so the full flow works without any API key. If you want live sampling, you can opt into it with `OPENAI_API_KEY`.

## Architecture

The workspace is split into two packages and one app:

- `apps/studio`
  The local web studio. It serves the UI, owns the MCP client connection, spawns the server over `stdio`, handles server-initiated requests like sampling and elicitation, and streams a normalized trace into the browser.
- `packages/workspace-mcp`
  The MCP server. It advertises the learning-focused capability set and exposes local tools, resources, and prompts rooted in the client-provided workspace directory.
- `packages/shared`
  Shared schemas, types, and helpers used on both sides of the browser/server boundary.

The browser UI is organized around four panes:

- Run / Chat
- Capability Matrix
- Primitive Catalog
- Live Trace Timeline

## Implemented Capabilities

### Server capabilities

- `tools` with `listChanged`
- `resources` with `listChanged` and `subscribe`
- `prompts` with `listChanged`
- `logging`
- `completions`

### Client capabilities

- `roots` with `listChanged`
- `sampling`
- `elicitation` in `form` mode

### Tools

- `workspace.search`
  Searches the allowed workspace root for plain-text matches.
- `file.summarize`
  Reads a file and asks the client to summarize it through MCP sampling.
- `agent.scaffold`
  Creates or updates a self-serve agent recipe, persists it locally, and republishes it as a prompt template.

### Resources

- `workspace://tree`
  A compact tree of the current allowed workspace.
- `workspace://file/{path}`
  Reads a file from the allowed workspace root.
- `session://latest-run`
  A subscribed live resource that updates after tool activity.

### Prompts

- `bootstrap-agent`
  A starter prompt for a self-serve workspace agent.
- `explain-trace`
  A prompt for turning the latest trace into a teaching artifact.
- `recipe.*`
  Dynamic prompts generated from saved agent recipes.

## Agent Recipes

The studio includes a small self-serve recipe system. Each recipe stores:

- `id`
- `name`
- `description`
- `systemPrompt`
- `allowedTools`
- `pinnedResources`
- `starterPrompt`
- `mode`

Recipes are persisted locally in `.studio-data/recipes.json` and ignored by git. When a recipe is created or updated, the server publishes a matching `recipe.*` prompt and emits a real `prompts/list_changed` notification so the UI can show the change.

## Deterministic vs Live Mode

`deterministic` is the default and requires no credentials. Sampling requests return a predictable teaching response so you can explore the protocol shape safely.

`live` uses the browser studio’s client-side sampling handler to call the OpenAI Responses API if `OPENAI_API_KEY` is present. If the key is missing or the live request fails, the studio falls back to the deterministic explanation and says so in the transcript.

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

Then open `http://127.0.0.1:4321`.

### Environment

Copy `.env.example` to `.env` if you want to change defaults:

```bash
AGENTS_STUDIO_PORT=4321
AGENTS_DATA_DIR=.studio-data
AGENTS_DEFAULT_MODE=deterministic
OPENAI_API_KEY=
```

## Learning Flow

The easiest way to explore the repo is:

1. Start the studio.
2. Click `Run protocol tour`.
3. Watch the trace fill in with initialize, discovery, prompt fetches, resource reads, tool calls, sampling, and elicitation.
4. Answer the elicitation form.
5. Verify that the new `recipe.*` prompt appears in the prompt catalog and that the recipe shows up in the persisted recipe list.

## Tests

The repo includes three layers of verification:

- unit tests for shared schemas and recipe-to-prompt conversion
- stdio integration tests for handshake, discovery, roots, resource reads, prompt fetches, sampling, elicitation, and `prompts/list_changed`
- a browser smoke test that runs the protocol tour, answers elicitation, and verifies the prompt catalog update

Run them with:

```bash
npm test
```

You can also run each layer separately:

```bash
npm run test:unit
npm run test:integration
npm run test:e2e
```

## Project Layout

```text
.
├── apps/
│   └── studio/
├── packages/
│   ├── shared/
│   └── workspace-mcp/
├── tests/
│   ├── e2e/
│   ├── integration/
│   └── unit/
├── .env.example
├── package.json
├── playwright.config.ts
└── vitest.config.ts
```

## Phase 2

Intentionally deferred:

- streamable HTTP transport
- auth
- multi-user state
- experimental `tasks` support
- production deployment concerns

The transport boundary in the studio is already isolated behind a `TransportAdapter` so a future HTTP transport can slot in without rewriting the UI or the runtime model.
