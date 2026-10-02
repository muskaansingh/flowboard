import { expect, type Page } from '@playwright/test';

/** Fresh state for every test: clear persisted store and load the app. */
export async function freshApp(page: Page, hash = '') {
  await page.goto('/');
  await page.evaluate(() => localStorage.clear());
  await page.goto(`/${hash}`);
  await expect(page.getByRole('tree', { name: 'Workspace tree' })).toBeVisible();
}

export async function switchUser(page: Page, name: RegExp) {
  await page.getByTestId('user-switcher').click();
  await page.getByRole('option', { name }).click();
}

export const column = (page: Page, name: string) => page.getByTestId(`column-${name}`);
