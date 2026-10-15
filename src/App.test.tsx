import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { resetStores } from '@/test/resetStores';
import { useUiStore } from '@/store/uiStore';
import { useAppStore } from '@/store/appStore';
import { IDS } from '@/data/seed';

const tree = () => screen.getByRole('tree', { name: 'Workspace tree' });

describe('<App /> integration', () => {
  beforeEach(() => resetStores());

  it('loads the tree (after skeleton) and opens the first visible list', async () => {
    render(<App />);
    expect(screen.getByRole('status', { name: 'Loading workspace' })).toBeInTheDocument();
    expect(await within(await screen.findByRole('tree')).findByRole('button', { name: 'Marketing' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'Backlog' })).toBeInTheDocument();
  });

  it('switching from Alice to Bob immediately hides Marketing and shows a 403 on its list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('tree');
    await user.click(within(tree()).getByRole('button', { name: 'Launch Campaign' }));
    expect(await screen.findByRole('heading', { name: 'Launch Campaign' })).toBeInTheDocument();

    await user.click(screen.getByTestId('user-switcher'));
    await user.click(await screen.findByRole('option', { name: /Bob Martins/ }));

    await waitFor(() => expect(within(tree()).queryByRole('button', { name: 'Marketing' })).not.toBeInTheDocument());
    expect(await screen.findByTestId('list-error')).toHaveTextContent('You don’t have access to this list');
    expect(within(tree()).getByRole('button', { name: 'Sprint 14' })).toBeInTheDocument();
  });

  it('task drawer opens from a card and closes with Escape', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    const cards = await screen.findAllByTestId('task-card');
    await user.click(cards[0]!);
    const drawer = await screen.findByTestId('task-drawer');
    expect(within(drawer).getByLabelText('Task title', { exact: true })).toHaveValue('Design onboarding checklist');
    await user.keyboard('{Escape}');
    await waitFor(() => expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument());
    expect(useUiStore.getState().drawerTaskId).toBeNull();
  });

  it('a member sees no structural controls', async () => {
    resetStores(IDS.bob);
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    expect(screen.queryByRole('button', { name: 'New space' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Statuses' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'New task' })).toBeInTheDocument();
  });

  it('drawer: J moves to the next task, priority dropdown saves, C completes', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    await user.click((await screen.findAllByTestId('task-card'))[0]!);
    const drawer = await screen.findByTestId('task-drawer');
    const firstId = useUiStore.getState().drawerTaskId;

    await user.click(within(drawer).getByRole('button', { name: 'Priority' }));
    await user.click(await screen.findByRole('option', { name: /Urgent/ }));
    expect(useAppStore.getState().tasks[firstId!]!.priority).toBe('urgent');

    await user.click(within(drawer).getByRole('button', { name: 'Close task' }));
    await user.click((await screen.findAllByTestId('task-card'))[0]!);
    const reopened = await screen.findByTestId('task-drawer');
    within(reopened).getByRole('button', { name: 'Close task' }).focus();
    await user.keyboard('j');
    const nextId = useUiStore.getState().drawerTaskId;
    expect(nextId).not.toBe(firstId);

    await user.keyboard('c');
    const s = useAppStore.getState();
    expect(s.statuses[s.tasks[nextId!]!.statusId]!.category).toBe('done');
  });

  it('filter narrows the board and Escape in the drawer title discards the draft', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    const before = (await screen.findAllByTestId('task-card')).length;
    await user.type(screen.getByLabelText('Filter tasks in this list'), 'onboarding');
    expect(screen.getAllByTestId('task-card').length).toBeLessThan(before);

    await user.click(screen.getAllByTestId('task-card')[0]!);
    const title = within(await screen.findByTestId('task-drawer')).getByLabelText('Task title', { exact: true });
    await user.type(title, ' draft');
    await user.keyboard('{Escape}');
    expect(title).toHaveValue('Design onboarding checklist');
    expect(screen.getByTestId('task-drawer')).toBeInTheDocument();
  });

  it('card priority badge opens a menu and changes priority without opening the drawer', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    const card = (await screen.findAllByTestId('task-card'))[0]!;
    await user.click(within(card).getByRole('button', { name: /Change priority/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Low' }));

    const taskId = Object.values(useAppStore.getState().tasks).find((t) => t.title === 'Design onboarding checklist')!.id;
    expect(useAppStore.getState().tasks[taskId]!.priority).toBe('low');
    expect(screen.queryByTestId('task-drawer')).not.toBeInTheDocument();
  });

  it('status quick-filter narrows the board to the chosen column', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    const columnsBefore = screen.getAllByRole('region', { name: / column$/ }).length;
    await user.click(screen.getByRole('button', { name: 'Filter by status' }));
    await user.click((await screen.findAllByRole('option'))[0]!);
    await user.keyboard('{Escape}');
    expect(screen.getAllByRole('region', { name: / column$/ })).toHaveLength(1);
    expect(columnsBefore).toBeGreaterThan(1);
    await user.click(screen.getByRole('button', { name: 'Clear all' }));
    expect(screen.getAllByRole('region', { name: / column$/ })).toHaveLength(columnsBefore);
  });

  it('description editor: click to edit, Save stores HTML, Esc discards', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    await user.click((await screen.findAllByTestId('task-card'))[0]!);
    const drawer = await screen.findByTestId('task-drawer');
    const taskId = useUiStore.getState().drawerTaskId!;

    await user.click(await within(drawer).findByRole('button', { name: /Description\. Press Enter to edit/ }));
    expect(within(drawer).getByRole('toolbar', { name: 'Formatting' })).toBeInTheDocument();
    const box = await within(drawer).findByRole('textbox', { name: 'Description' });
    expect(box).toHaveAttribute('contenteditable', 'true');
    await user.click(box);
    await user.keyboard(' extra c 1'); // drawer shortcuts (C complete, 1 urgent) must not fire while typing
    await user.click(within(drawer).getByRole('button', { name: 'Save' }));
    const html = useAppStore.getState().tasks[taskId]!.description;
    expect(html.startsWith('<p>')).toBe(true);
    expect(html).toContain('extra c 1');
    const after = useAppStore.getState();
    expect(after.statuses[after.tasks[taskId]!.statusId]!.category).not.toBe('done');
    expect(within(drawer).queryByRole('toolbar')).not.toBeInTheDocument();

    const saved = useAppStore.getState().tasks[taskId]!.description;
    await user.click(within(drawer).getByRole('button', { name: /Description\. Press Enter to edit/ }));
    await user.keyboard(' discarded{Escape}');
    expect(useAppStore.getState().tasks[taskId]!.description).toBe(saved);
    expect(screen.getByTestId('task-drawer')).toBeInTheDocument();
  });

  it('cards show Jira keys and the task view shows the key in its header', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    const card = (await screen.findAllByTestId('task-card'))[0]!;
    expect(card).toHaveTextContent('BAC-1');
    await user.click(card);
    expect(within(await screen.findByTestId('task-drawer')).getByTestId('task-key')).toHaveTextContent('BAC-1');
  });

  it('comments: post with ⌘Enter, appears in the list', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    await user.click((await screen.findAllByTestId('task-card'))[0]!);
    const drawer = await screen.findByTestId('task-drawer');
    await user.click(within(drawer).getByLabelText('Add a comment'));
    await user.keyboard('Ship it{Meta>}{Enter}{/Meta}');
    expect(await within(drawer).findByText('Ship it')).toBeInTheDocument();
    expect(within(drawer).getAllByTestId('comment')).toHaveLength(1);
  });

  it('deleting a task can be undone from the toast', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    const before = (await screen.findAllByTestId('task-card')).length;
    await user.click(screen.getAllByTestId('task-card')[0]!);
    const drawer = await screen.findByTestId('task-drawer');
    await user.click(within(drawer).getByRole('button', { name: 'Delete task' }));
    await user.click(within(drawer).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.getAllByTestId('task-card')).toHaveLength(before - 1));
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getAllByTestId('task-card')).toHaveLength(before));
  });

  it('⌘K opens the command palette and can switch to List view', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    await user.keyboard('{Meta>}k{/Meta}');
    const palette = await screen.findByTestId('command-palette');
    await user.type(within(palette).getByRole('combobox'), 'list view');
    await user.keyboard('{Enter}');
    await waitFor(() => expect(useUiStore.getState().view).toBe('list'));
  });

  it('list view: select rows and bulk-change priority with one undo', async () => {
    useUiStore.setState({ view: 'list' });
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('heading', { name: 'Backlog' });
    await user.click(await screen.findByRole('checkbox', { name: 'Select BAC-1' }));
    await user.click(screen.getByRole('checkbox', { name: 'Select BAC-2' }));
    const bar = screen.getByRole('toolbar', { name: 'Bulk actions' });
    expect(bar).toHaveTextContent('2 selected');
    await user.click(within(bar).getByRole('button', { name: /Priority/ }));
    await user.click(await screen.findByRole('menuitem', { name: 'Low' }));
    const t = useAppStore.getState().tasks;
    expect([t.tk_1!.priority, t.tk_2!.priority]).toEqual(['low', 'low']);
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    const u = useAppStore.getState().tasks;
    expect([u.tk_1!.priority, u.tk_2!.priority]).not.toEqual(['low', 'low']);
  });
});
