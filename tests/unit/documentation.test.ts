import { promises as fs } from 'node:fs';
import path from 'node:path';

const orderedReadmes = [
  'README.md',
  'docs/README.md',
  'docs/diagrams/README.md',
  'apps/README.md',
  'apps/studio/README.md',
  'apps/studio/src/README.md',
  'apps/studio/src/client/README.md',
  'apps/studio/public/README.md',
  'apps/studio/scripts/README.md',
  'packages/README.md',
  'packages/shared/README.md',
  'packages/shared/src/README.md',
  'packages/workspace-mcp/README.md',
  'packages/workspace-mcp/src/README.md',
  'test/README.md',
  'tests/README.md',
  'tests/unit/README.md',
  'tests/integration/README.md',
  'tests/e2e/README.md'
] as const;

const parentReadmes: Record<(typeof orderedReadmes)[number], string> = {
  'README.md': 'README.md',
  'docs/README.md': 'README.md',
  'docs/diagrams/README.md': 'docs/README.md',
  'apps/README.md': 'README.md',
  'apps/studio/README.md': 'apps/README.md',
  'apps/studio/src/README.md': 'apps/studio/README.md',
  'apps/studio/src/client/README.md': 'apps/studio/src/README.md',
  'apps/studio/public/README.md': 'apps/studio/README.md',
  'apps/studio/scripts/README.md': 'apps/studio/README.md',
  'packages/README.md': 'README.md',
  'packages/shared/README.md': 'packages/README.md',
  'packages/shared/src/README.md': 'packages/shared/README.md',
  'packages/workspace-mcp/README.md': 'packages/README.md',
  'packages/workspace-mcp/src/README.md': 'packages/workspace-mcp/README.md',
  'test/README.md': 'README.md',
  'tests/README.md': 'README.md',
  'tests/unit/README.md': 'tests/README.md',
  'tests/integration/README.md': 'tests/README.md',
  'tests/e2e/README.md': 'tests/README.md'
};

function extractLink(markdown: string, label: 'Previous' | 'Next' | 'Parent'): string {
  const match = markdown.match(new RegExp(`${label}:\\s*\\[[^\\]]+\\]\\(([^)]+)\\)`));
  expect(match?.[1]).toBeTruthy();
  return match![1];
}

function resolveFrom(readmePath: string, relativeLink: string): string {
  return path.normalize(path.resolve(process.cwd(), path.dirname(readmePath), relativeLink));
}

describe('documentation learning path', () => {
  it('includes every in-scope folder readme and keeps Previous/Next/Parent links coherent', async () => {
    for (const [index, readmePath] of orderedReadmes.entries()) {
      const absolutePath = path.resolve(process.cwd(), readmePath);
      await expect(fs.access(absolutePath)).resolves.toBeUndefined();

      const markdown = await fs.readFile(absolutePath, 'utf8');
      const previousLink = extractLink(markdown, 'Previous');
      const nextLink = extractLink(markdown, 'Next');
      const parentLink = extractLink(markdown, 'Parent');

      const expectedPrevious = orderedReadmes[index - 1] ?? readmePath;
      const expectedNext = orderedReadmes[index + 1] ?? 'README.md';
      const expectedParent = parentReadmes[readmePath];

      expect(resolveFrom(readmePath, previousLink)).toBe(path.resolve(process.cwd(), expectedPrevious));
      expect(resolveFrom(readmePath, nextLink)).toBe(path.resolve(process.cwd(), expectedNext));
      expect(resolveFrom(readmePath, parentLink)).toBe(path.resolve(process.cwd(), expectedParent));
    }
  });
});
