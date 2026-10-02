import type { ReactNode } from 'react';
import { Menu, MenuButton, MenuItem, MenuItems } from '@headlessui/react';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import type { Container } from '@/domain/types';
import type { TreeNode } from '@/domain/tree';
import { useAppStore } from '@/store/appStore';
import { useUiStore } from '@/store/uiStore';
import { notify } from '@/store/toastStore';
import { useIsAdmin } from '@/store/selectors';
import { useDialogStore } from '@/components/dialogs/dialogStore';
import { confirmAction } from '@/components/ui/overlays';
import { IconButton } from '@/components/ui/primitives';
import { Archive, ChevronRight, Folder, Grip, ListIcon, Lock, More, Pencil, Plus, Settings, Share, Space } from '@/ui/icons';
import { cx } from '@/ui/tokens';

const TYPE_ICON = { workspace: Space, space: Space, folder: Folder, list: ListIcon };
const INDENT = ['pl-1', 'pl-4', 'pl-7', 'pl-10'];

function ItemMenu({ node }: { node: Container }) {
  const open = useDialogStore((s) => s.open);
  const items: { label: string; icon: ReactNode; onClick: () => void; danger?: boolean }[] = [
    { label: 'Rename', icon: <Pencil size={14} />, onClick: () => open({ kind: 'rename', id: node.id }) },
    { label: 'Sharing & permissions', icon: <Share size={14} />, onClick: () => open({ kind: 'sharing', id: node.id }) },
    ...(node.type === 'list'
      ? [{ label: 'Edit statuses', icon: <Settings size={14} />, onClick: () => open({ kind: 'statuses', listId: node.id }) }]
      : []),
    {
      label: 'Archive',
      icon: <Archive size={14} />,
      danger: true,
      onClick: async () => {
        const ok = await confirmAction({
          title: `Archive “${node.name}”?`,
          message:
            node.type === 'list'
              ? 'The list and its tasks will be hidden from everyone. Admins can restore it from Archived.'
              : `This ${node.type} and everything inside it will be hidden from everyone. Admins can restore it from Archived.`,
          confirmLabel: 'Archive',
        });
        if (ok) notify(useAppStore.getState().archiveContainer(node.id), `Archived “${node.name}”`);
      },
    },
  ];
  return (
    <Menu>
      <MenuButton
        aria-label={`Actions for ${node.name}`}
        className="inline-flex h-6 w-6 items-center justify-center rounded text-ink-inverse/60 hover:bg-white/10 hover:text-ink-inverse focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400 data-[open]:bg-white/10 data-[open]:text-ink-inverse"
        onClick={(e) => e.stopPropagation()}
      >
        <More size={14} />
      </MenuButton>
      <MenuItems
        anchor="bottom start"
        className="z-50 w-52 rounded-card bg-surface p-1 text-sm text-ink shadow-pop ring-1 ring-black/5 focus:outline-none [--anchor-gap:4px]"
      >
        {items.map((it) => (
          <MenuItem key={it.label}>
            <button
              type="button"
              onClick={it.onClick}
              className={cx(
                'flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left data-[focus]:bg-canvas',
                it.danger ? 'text-rose-600' : 'text-ink',
              )}
            >
              <span className={it.danger ? 'text-rose-500' : 'text-ink-subtle'}>{it.icon}</span>
              {it.label}
            </button>
          </MenuItem>
        ))}
      </MenuItems>
    </Menu>
  );
}

export function TreeItem({
  node,
  depth,
  expanded,
  onToggle,
  taskCount,
  dropDisabled,
  children,
}: {
  node: TreeNode;
  depth: number;
  expanded: boolean;
  onToggle: () => void;
  taskCount?: number;
  dropDisabled: boolean;
  children?: ReactNode;
}) {
  const c = node.container;
  const isAdmin = useIsAdmin();
  const selected = useUiStore((s) => s.selectedListId === c.id);
  const selectList = useUiStore((s) => s.selectList);
  const openDialog = useDialogStore((s) => s.open);
  const { attributes, listeners, setNodeRef, setActivatorNodeRef, transform, transition, isDragging } = useSortable({
    id: c.id,
    disabled: { draggable: !isAdmin, droppable: dropDisabled },
  });
  const Icon = TYPE_ICON[c.type];
  const isList = c.type === 'list';
  const hasChildren = node.children.length > 0;

  const activate = () => (isList ? void selectList(c.id) : onToggle());

  return (
    <li
      ref={setNodeRef}
      role="treeitem"
      aria-expanded={isList ? undefined : expanded}
      aria-selected={isList ? selected : undefined}
      // dnd-kit requires inline transform/transition on sortable nodes (documented exception).
      style={{ transform: CSS.Translate.toString(transform), transition }}
      className={cx(isDragging && 'opacity-40')}
    >
      <div
        className={cx(
          'group relative flex h-8 items-center gap-1 rounded-md pr-1 text-sm transition-colors',
          INDENT[Math.min(depth, 3)],
          selected ? 'bg-sidebar-active text-white' : 'text-ink-inverse/80 hover:bg-sidebar-hover hover:text-ink-inverse',
        )}
      >
        {selected && <span className="absolute inset-y-1.5 left-0 w-0.5 rounded-full bg-brand-400" />}
        {isAdmin ? (
          <button
            ref={setActivatorNodeRef}
            {...attributes}
            {...listeners}
            aria-label={`Reorder ${c.name}`}
            className="flex h-6 w-4 shrink-0 cursor-grab items-center justify-center text-ink-inverse/30 opacity-0 transition-opacity hover:text-ink-inverse/70 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-brand-400 active:cursor-grabbing group-hover:opacity-100"
          >
            <Grip size={12} />
          </button>
        ) : (
          <span className="w-4 shrink-0" />
        )}

        {!isList ? (
          <button
            type="button"
            onClick={onToggle}
            aria-label={expanded ? `Collapse ${c.name}` : `Expand ${c.name}`}
            className={cx(
              'flex h-5 w-5 shrink-0 items-center justify-center rounded text-ink-inverse/40 hover:bg-white/10 hover:text-ink-inverse',
              !hasChildren && 'invisible',
            )}
          >
            <ChevronRight size={13} className={cx('transition-transform', expanded && 'rotate-90')} />
          </button>
        ) : (
          <span className="w-5 shrink-0" />
        )}

        <button
          type="button"
          onClick={activate}
          className="flex min-w-0 flex-1 items-center gap-2 rounded py-1 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-400"
        >
          <Icon
            size={15}
            className={cx('shrink-0', c.type === 'space' ? 'text-brand-300' : c.type === 'folder' ? 'text-amber-300/80' : 'text-ink-inverse/50', selected && 'text-white')}
          />
          <span className={cx('truncate', c.type === 'space' && 'font-medium')}>{c.name}</span>
          {c.visibility === 'private' && <Lock size={11} className="shrink-0 text-ink-inverse/40" aria-label="Private" />}
        </button>

        {isList && taskCount !== undefined && (
          <span className={cx('text-2xs tabular-nums text-ink-inverse/40', isAdmin && 'group-hover:hidden')}>{taskCount}</span>
        )}

        {isAdmin && (
          <span className="flex items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
            {!isList && (
              <IconButton
                tone="dark"
                className="h-6 w-6"
                label={`Add ${c.type === 'space' ? 'folder' : 'list'} to ${c.name}`}
                onClick={() => openDialog({ kind: 'create', parentId: c.id })}
              >
                <Plus size={13} />
              </IconButton>
            )}
            <ItemMenu node={c} />
          </span>
        )}
      </div>
      {children}
    </li>
  );
}

export function TreeItemPreview({ container }: { container: Container }) {
  const Icon = TYPE_ICON[container.type];
  return (
    <div className="flex h-8 items-center gap-2 rounded-md bg-sidebar-active px-3 text-sm text-white shadow-lift ring-1 ring-brand-400/60">
      <Icon size={15} className="text-brand-300" />
      {container.name}
    </div>
  );
}
