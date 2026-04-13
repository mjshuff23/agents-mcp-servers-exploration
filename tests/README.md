# Test Suites

Previous: [Test Helpers](../test/README.md) | Next: [Unit Tests](./unit/README.md) | Parent: [Repository Root](../README.md)

## Why This Folder Exists

`tests/` holds the verification story for the playground.

## Runtime / Data Flow

The test pyramid mirrors the product:

- unit tests validate contracts and documentation structure
- integration tests boot the MCP server over stdio
- end-to-end tests run the browser against the real studio

## Key Files

- [unit/README.md](./unit/README.md)
  Contract and documentation-spine tests.
- [integration/README.md](./integration/README.md)
  Real stdio MCP session tests.
- [e2e/README.md](./e2e/README.md)
  Browser regression and smoke coverage.

## What To Read Next

Start with [tests/unit/README.md](./unit/README.md) and then move down the stack.

## Try This

Read the same feature in all three layers: recipe creation in the UI, stdio integration, and unit-level contract coverage.
