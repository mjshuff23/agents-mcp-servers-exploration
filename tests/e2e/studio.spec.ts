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
