# Unit Tests

Previous: [Test Suites](../README.md) | Next: [Integration Tests](../integration/README.md) | Parent: [Test Suites](../README.md)

## Why This Folder Exists

`tests/unit/` protects the lightweight rules of the repo: shared contracts and the documentation structure itself.

## Runtime / Data Flow

These tests never boot the studio or the MCP server. They validate schemas, prompt-descriptor helpers, and the shape of the learning-path docs.

## Key Files

- [shared.test.ts](./shared.test.ts)
  Validates shared schemas and recipe prompt descriptor behavior.
- [documentation.test.ts](./documentation.test.ts)
  Verifies that every in-scope folder has a `README.md` and that the linear navigation links resolve correctly.

## What To Read Next

Continue into [tests/integration/README.md](../integration/README.md) for the first place the real MCP runtime is exercised.

## Try This

Read the unit tests before the source and see what they tell you about the repo's core contracts.
