# End-to-End Tests

Previous: [Integration Tests](../integration/README.md) | Next: [Repository Root](../../README.md) | Parent: [Test Suites](../README.md)

## Why This Folder Exists

`tests/e2e/` verifies the whole user-facing experience: browser, studio server, MCP server, and local state.

## Runtime / Data Flow

Playwright starts the real studio, drives the browser, submits elicitation forms, and confirms that the UI reflects the protocol changes triggered underneath.

## Key Files

- [studio.spec.ts](./studio.spec.ts)
  Covers the guided tour and the browser-facing regression checks for layout containment.

## What To Read Next

Head back to [README.md](../../README.md) or jump into any part of the codebase with the full system map in mind.

## Try This

Run the browser tests with the Playwright HTML report, then compare what the test looks for to what a human notices in the UI.
