# Integration Tests

Previous: [Unit Tests](../unit/README.md) | Next: [End-to-End Tests](../e2e/README.md) | Parent: [Test Suites](../README.md)

## Why This Folder Exists

`tests/integration/` proves that the local MCP server actually works over stdio, not just in isolated helpers.

## Runtime / Data Flow

These tests boot the built MCP server, act as the client, answer roots, sampling, and elicitation requests, and assert that discovery, resources, prompts, tools, and notifications behave correctly.

## Key Files

- [workspace-mcp.test.ts](./workspace-mcp.test.ts)
  Full stdio session coverage for discovery, tool calls, prompt fetches, sampling, elicitation, and `prompts/list_changed`.

## What To Read Next

Finish with [tests/e2e/README.md](../e2e/README.md), which verifies the browser experience against the real running studio.

## Try This

Search for `createDeferred` in the integration test and see how notification timing is made explicit.
