# Diagrams

Previous: [Docs](../README.md) | Next: [Apps](../../apps/README.md) | Parent: [Docs](../README.md)

## Why This Folder Exists

This folder stores the canonical, repo-native diagrams for the playground. They are versioned with the code so explanations evolve together with implementation changes.

## Runtime / Data Flow

Each diagram focuses on a different slice of the same system:

- architecture: who talks to whom
- protocol tour: what happens across a single guided run
- recipe publication: how user input becomes a persisted recipe and a new prompt

## Key Files

- [architecture-overview.md](./architecture-overview.md)
  Shows the major components and their boundaries.
- [protocol-tour-sequence.md](./protocol-tour-sequence.md)
  Walks through the guided tour from browser click to trace updates.
- [recipe-publication-flow.md](./recipe-publication-flow.md)
  Explains how a recipe becomes both stored data and a live prompt-catalog update.

## External Diagram Mirrors

- [Architecture Overview](https://www.figma.com/online-whiteboard/create-diagram/ad27f2ea-8360-4fcb-81e5-a0e7c1743c53?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=6c9d3598-897d-4c15-b5f9-535df2917989)
- [Protocol Tour Sequence](https://www.figma.com/online-whiteboard/create-diagram/27df7f85-7c5d-4f37-afb4-432a5948f69b?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=3f326942-79c1-4af3-bdcb-a4758f0b06cd)
- [Recipe Publication Flow](https://www.figma.com/online-whiteboard/create-diagram/682da6fe-ca6f-45bd-9746-2d26dbf66b82?utm_source=other&utm_content=edit_in_figjam&oai_id=&request_id=2947e8ab-5352-466c-b672-fceeae3bb58e)

## What To Read Next

Move into [apps/README.md](../../apps/README.md) once you have the diagrams in your head. The next stop is the executable entrypoint into the system.

## Try This

Run the studio, trigger the tour, and compare the trace to [protocol-tour-sequence.md](./protocol-tour-sequence.md) line by line.
