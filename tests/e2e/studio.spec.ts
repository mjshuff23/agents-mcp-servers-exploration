import { expect, test } from '@playwright/test';

test('runs the protocol tour, answers elicitation, and shows the new recipe prompt', async ({ page }) => {
  await page.goto('/');

  await expect(page.getByText('Local stdio MCP playground')).toBeVisible();
  await expect(page.getByRole('heading', { name: 'Capability Matrix' })).toBeVisible();

  await page.getByRole('button', { name: 'Run protocol tour' }).click();

  await expect(page.getByRole('heading', { name: 'Pending Elicitation' })).toBeVisible();
  await page
    .getByRole('textbox', { name: 'systemPrompt *' })
    .fill('Explain the trace in a calm, teacherly voice and name the active MCP primitive at each step.');
  await page.getByRole('button', { name: 'Submit elicitation' }).click();

  await expect(
    page.getByText('Protocol tour complete. Explore the capability matrix, catalog, and live trace to keep going.')
  ).toBeVisible({ timeout: 15_000 });

  await expect(page.locator('code').filter({ hasText: 'recipe.trace-guide' }).first()).toBeVisible();
  await expect(page.getByText('Trace Guide Recipe').first()).toBeVisible();
  await expect(page.getByText('Trace Guide').first()).toBeVisible();
  await expect(page.getByText('prompts/list_changed').first()).toBeVisible();
});

test('keeps the main panels contained across representative desktop widths', async ({ page }) => {
  const viewports = [
    { width: 1600, height: 1200 },
    { width: 1480, height: 1100 },
    { width: 1024, height: 1400 }
  ] as const;

  for (const viewport of viewports) {
    await page.setViewportSize(viewport);
    await page.goto('/');
    await expect(page.getByRole('heading', { name: 'Run / Chat' })).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Capability Matrix' })).toBeVisible();

    const metrics = await page.evaluate(() => {
      const getPanelRect = (headingText: string) => {
        const heading = [...document.querySelectorAll('h2')].find(node => node.textContent?.trim() === headingText);
        const panel = heading?.closest('section');
        if (!panel) {
          return null;
        }
        const rect = panel.getBoundingClientRect();
        return {
          left: rect.left,
          right: rect.right,
          top: rect.top,
          bottom: rect.bottom
        };
      };

      return {
        scrollWidth: document.documentElement.scrollWidth,
        clientWidth: document.documentElement.clientWidth,
        runChat: getPanelRect('Run / Chat'),
        capability: getPanelRect('Capability Matrix'),
        primitive: getPanelRect('Primitive Catalog')
      };
    });

    expect(metrics.scrollWidth).toBeLessThanOrEqual(metrics.clientWidth + 1);

    const panels = [metrics.runChat, metrics.capability, metrics.primitive];
    for (const panel of panels) {
      expect(panel).not.toBeNull();
    }

    const intersects = (left: NonNullable<(typeof panels)[number]>, right: NonNullable<(typeof panels)[number]>) =>
      left.left < right.right && left.right > right.left && left.top < right.bottom && left.bottom > right.top;

    expect(intersects(metrics.runChat!, metrics.capability!)).toBe(false);
    expect(intersects(metrics.runChat!, metrics.primitive!)).toBe(false);
    expect(intersects(metrics.capability!, metrics.primitive!)).toBe(false);
  }
});
