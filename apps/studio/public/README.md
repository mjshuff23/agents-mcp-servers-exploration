# Studio Public Assets

Previous: [Studio Client](../src/client/README.md) | Next: [Studio Scripts](../scripts/README.md) | Parent: [Studio](../README.md)

## Why This Folder Exists

`apps/studio/public/` holds the static browser shell and CSS that the studio serves directly.

## Runtime / Data Flow

The HTML shell loads first, then the bundled client script hydrates `#app` with the live snapshot. The CSS is responsible for making the teaching UI readable even when panels fill with long traces and payloads.

## Key Files

- [index.html](./index.html)
  Minimal shell for the browser app.
- [app.css](./app.css)
  Defines the studio theme, layout, panel styling, and the responsive containment rules that keep the panes from colliding.

## What To Read Next

Continue into [apps/studio/scripts/README.md](../scripts/README.md) to see how the browser TypeScript gets bundled into a static asset.

## Try This

Resize the browser with devtools open and then find the breakpoint in `app.css` that collapses the layout.
