# Docs

Previous: [Repository Root](../README.md) | Next: [Diagrams](./diagrams/README.md) | Parent: [Repository Root](../README.md)

## Why This Folder Exists

`docs/` is where the repository stops being "just the implementation" and starts acting like a teaching artifact. The goal is to explain the runtime shape before you have to decode it from source.

## Runtime / Data Flow

Nothing in this folder executes at runtime. Instead, these docs mirror the runtime relationships between the browser, the studio server, the stdio transport, and the MCP server so you can map concepts before reading code.

## Key Files

- [README.md](./README.md)
  You are here. This is the documentation hub for the repo-native learning path.
- [diagrams/README.md](./diagrams/README.md)
  Collects the Mermaid diagrams that explain the major flows visually.

## What To Read Next

Continue into [docs/diagrams/README.md](./diagrams/README.md) to get the visual model first. It makes the code path easier to understand once you move into the app and package folders.

## Try This

Read the diagrams before opening any TypeScript files, then see how much of the runtime you can predict from the picture alone.
