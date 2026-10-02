import { expect, test } from '@playwright/test';
import { freshApp, switchUser } from './helpers';

test('Alice vs Bob: switching user immediately changes the tree and boards', async ({ page }) => {
  await freshApp(page);
  const tree = page.getByRole('tree', { name: 'Workspace tree' });
  await expect(tree.getByRole('button', { name: 'Marketing', exact: true })).toBeVisible();
  await expect(tree.getByRole('button', { name: 'Launch Campaign', exact: true })).toBeVisible();

  await switchUser(page, /Bob Martins/);
  await expect(tree.getByRole('button', { name: 'Marketing', exact: true })).toHaveCount(0);
  await expect(tree.getByRole('button', { name: 'Sprint 14', exact: true })).toBeVisible();
  // Members don't get structural controls.
  await expect(page.getByRole('button', { name: 'New space' })).toHaveCount(0);
});

test('deep-linking to a hidden list shows a 403 state, not data', async ({ page }) => {
  await freshApp(page);
  await switchUser(page, /Bob Martins/);
  await page.goto('/#/list/ls_launch');
  await expect(page.getByTestId('list-error')).toContainText('You don’t have access to this list');
  await expect(page.getByTestId('list-error')).toContainText('403');
  await expect(page.getByTestId('board')).toHaveCount(0);
});

test('admin revoking access hides the list for that member', async ({ page }) => {
  await freshApp(page, '#/list/ls_sprint');
  await page.getByRole('button', { name: 'Share' }).click();
  await page.getByLabel('Access for Bob Martins').selectOption('');
  await expect(page.getByRole('dialog')).toContainText('Hidden');
  await page.getByRole('button', { name: 'Done' }).click();

  await switchUser(page, /Bob Martins/);
  await expect(page.getByTestId('list-error')).toBeVisible();
  await expect(page.getByRole('tree').getByRole('button', { name: 'Sprint 14', exact: true })).toHaveCount(0);
});
