import { describe, expect, it, beforeEach } from 'vitest';
import { render, screen, within, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import App from './App';
import { resetStores } from '@/test/resetStores';
import { useUiStore } from '@/store/uiStore';
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
});
