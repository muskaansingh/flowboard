import { expect, test } from '@playwright/test';
import { column, freshApp } from './helpers';

test('drag a card to another column updates status and persists after reload', async ({ page }) => {
  await freshApp(page, '#/list/ls_backlog');
  const card = column(page, 'To do').getByTestId('task-card').filter({ hasText: 'Design onboarding checklist' });
  const target = column(page, 'In review');
  await expect(card).toBeVisible();

  const from = (await card.boundingBox())!;
  const to = (await target.boundingBox())!;
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + 40, from.y + 20, { steps: 5 });
  await page.mouse.move(to.x + to.width / 2, to.y + to.height - 40, { steps: 15 });
  await expect(target).toHaveClass(/ring-brand-300/); // drop-target highlight
  await page.mouse.up();

  await expect(target.getByText('Design onboarding checklist')).toBeVisible();
  await expect(column(page, 'To do').getByText('Design onboarding checklist')).toHaveCount(0);

  await page.reload();
  await expect(column(page, 'In review').getByText('Design onboarding checklist')).toBeVisible();
});

test('keyboard drag reorders within a column', async ({ page }) => {
  await freshApp(page, '#/list/ls_backlog');
  const todo = column(page, 'To do');
  const titles = () => todo.getByTestId('task-card').allInnerTexts();
  await expect(todo.getByTestId('task-card').first()).toBeVisible();
  expect((await titles())[0]).toContain('Design onboarding checklist');

  await todo.getByTestId('task-card').first().focus();
  // dnd-kit measures droppables between key presses, so give each step a frame or two.
  await page.keyboard.press('Space');
  await page.waitForTimeout(150);
  await page.keyboard.press('ArrowDown');
  await page.waitForTimeout(150);
  await page.keyboard.press('Space');
  await expect.poll(async () => (await titles())[1]).toContain('Design onboarding checklist');
});

test('task drawer: opens on click, closes on Escape and overlay click, edits persist', async ({ page }) => {
  await freshApp(page, '#/list/ls_backlog');
  await page.getByTestId('task-card').filter({ hasText: 'Audit bundle size' }).click();
  const drawer = page.getByTestId('task-drawer');
  await expect(drawer).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(drawer).toHaveCount(0);

  await page.getByTestId('task-card').filter({ hasText: 'Audit bundle size' }).click();
  await drawer.getByLabel('Task title', { exact: true }).fill('Audit bundle size (charts only)');
  await drawer.getByLabel('Task title', { exact: true }).press('Enter');
  await expect(drawer).toContainText('Saved');
  await page.mouse.click(300, 600); // overlay
  await expect(drawer).toHaveCount(0);
  await expect(page.getByTestId('task-card').filter({ hasText: 'Audit bundle size (charts only)' })).toBeVisible();
});

test('quick-add validates and creates a task in the column', async ({ page }) => {
  await freshApp(page, '#/list/ls_sprint');
  const done = column(page, 'Done');
  await done.getByRole('button', { name: 'Add task' }).click();
  await done.getByLabel('New task title in Done').fill('x'.repeat(501));
  await done.getByLabel('New task title in Done').press('Enter');
  await expect(done.getByRole('alert')).toContainText('500');
  await done.getByLabel('New task title in Done').fill('Write release notes');
  await done.getByLabel('New task title in Done').press('Enter');
  await expect(done.getByTestId('task-card').filter({ hasText: 'Write release notes' })).toBeVisible();
});

test('list view sorts by priority and due date', async ({ page }) => {
  await freshApp(page, '#/list/ls_backlog');
  await page.getByRole('tab', { name: 'List' }).click();
  await page.getByRole('button', { name: /Priority/ }).click();
  await expect(page.getByTestId('list-row').first()).toContainText('Rate-limit public search endpoint');
  await page.getByRole('button', { name: /Due date/ }).click();
  await expect(page.getByTestId('list-row').first()).toContainText('Fix flaky checkout E2E test');
  await expect(page.getByTestId('list-row').last()).toContainText('Add SSO via Google Workspace'); // no due date sinks
});
