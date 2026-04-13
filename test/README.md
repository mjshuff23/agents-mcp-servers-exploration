# Test Helpers

Previous: [Workspace MCP Source](../packages/workspace-mcp/src/README.md) | Next: [Test Suites](../tests/README.md) | Parent: [Repository Root](../README.md)

## Why This Folder Exists

`test/` holds shared test setup that multiple suites rely on.

## Runtime / Data Flow

This folder does not implement product behavior. It stabilizes test behavior by setting deterministic defaults and test-local data directories before the suites run.

## Key Files

- [setup.ts](./setup.ts)
  Establishes deterministic test defaults and isolates test data under `.studio-data/test`.

## What To Read Next

Continue into [tests/README.md](../tests/README.md) to see how the test suites are organized.

## Try This

Change the default data dir in `setup.ts`, run the tests, and observe where recipe fixtures are written.
