import { expect, test } from '@playwright/test';

const TEMPLATE_KEY = 'juicy-calendar:file:templates/new.json';

test('[TC-06][FR-05,R-4,R-6] a template named New can be edited in place and deleted', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-02T12:00:00-05:00'));
  await page.goto('/');
  await page.getByRole('button', { name: 'Create workspace' }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await page.getByTestId('add-template').click();
  const editor = page.getByTestId('template-editor');
  await editor.getByLabel('Template name').fill('New');
  await editor.getByLabel('Default duration').fill('95');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(7);
  await expect(page.locator('[data-template-id="new"]')).toHaveCount(1);

  await page.getByTestId('template-name').filter({ hasText: /^New$/ }).click();
  await expect(editor.getByLabel('Template name')).toHaveValue('New');
  await expect(editor.getByLabel('Default duration')).toHaveValue('95');
  await expect(editor.getByRole('button', { name: 'Delete', exact: true })).toBeVisible();
  await editor.getByLabel('Template name').fill('New updated');
  await editor.getByRole('button', { name: 'Save', exact: true }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(7);
  await expect.poll(() => page.evaluate((key) => JSON.parse(localStorage.getItem(key) ?? 'null'), TEMPLATE_KEY))
    .toMatchObject({ id: 'new', name: 'New updated', defaultDuration: 95 });

  await page.reload();
  await expect(page.getByTestId('template-ball')).toHaveCount(7);
  await page.getByTestId('template-name').filter({ hasText: /^New updated$/ }).click();
  await expect(editor.getByLabel('Template name')).toHaveValue('New updated');
  await editor.getByRole('button', { name: 'Delete', exact: true }).click();
  await editor.getByRole('button', { name: 'Confirm', exact: true }).click();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await expect.poll(() => page.evaluate((key) => localStorage.getItem(key), TEMPLATE_KEY)).toBeNull();
  await page.reload();
  await expect(page.getByTestId('template-ball')).toHaveCount(6);
  await expect(page.locator('[data-template-id="new"]')).toHaveCount(0);
});
