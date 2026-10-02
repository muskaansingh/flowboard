import { useMemo, useState } from 'react';
import {
  DndContext,
  DragOverlay,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
  type DragStartEvent,
} from '@dnd-kit/core';
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { restrictToVerticalAxis } from '@dnd-kit/modifiers';
import type { Container, ID } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify } from '@/store/toastStore';
import { useIsAdmin, useSelector, selectVisibleTree } from '@/store/selectors';
import type { TreeNode } from '@/domain/tree';
import { useDialogStore } from '@/components/dialogs/dialogStore';
import { IconButton, Skeleton } from '@/components/ui/primitives';
import { Plus } from '@/ui/icons';
import { TreeItem, TreeItemPreview } from './TreeItem';
import { ArchivedSection } from './ArchivedSection';

/** Recursive renderer — each sibling group is its own SortableContext. */
function Branch({
  nodes,
  depth,
  collapsed,
  toggle,
  taskCounts,
  dragParentId,
}: {
  nodes: TreeNode[];
  depth: number;
  collapsed: Set<ID>;
  toggle: (id: ID) => void;
  taskCounts: Record<ID, number>;
  dragParentId: ID | null | undefined;
}) {
  return (
    <SortableContext items={nodes.map((n) => n.container.id)} strategy={verticalListSortingStrategy}>
      <ul role="group" className="space-y-px">
        {nodes.map((n) => (
          <TreeItem
            key={n.container.id}
            node={n}
            depth={depth}
            expanded={!collapsed.has(n.container.id)}
            onToggle={() => toggle(n.container.id)}
            taskCount={taskCounts[n.container.id]}
            // While dragging, only the active item's siblings accept drops.
            dropDisabled={dragParentId !== undefined && dragParentId !== n.container.parentId}
          >
            {n.children.length > 0 && !collapsed.has(n.container.id) && (
              <Branch
                nodes={n.children}
                depth={depth + 1}
                collapsed={collapsed}
                toggle={toggle}
                taskCounts={taskCounts}
                dragParentId={dragParentId}
              />
            )}
          </TreeItem>
        ))}
      </ul>
    </SortableContext>
  );
}

function TreeSkeleton() {
  return (
    <div className="space-y-2.5 px-3 py-2" aria-label="Loading workspace" role="status">
      {[0, 1, 2, 1, 2, 0, 1].map((indent, i) => (
        <div key={i} className="flex items-center gap-2">
          <span className={indent === 0 ? 'w-0' : indent === 1 ? 'w-4' : 'w-8'} />
          <Skeleton className="h-4 w-4 bg-white/10" />
          <Skeleton className={`h-3.5 bg-white/10 ${i % 2 ? 'w-24' : 'w-32'}`} />
        </div>
      ))}
    </div>
  );
}

export function Sidebar() {
  const boot = useAppStore((s) => s.boot);
  const workspaceId = useAppStore((s) => s.workspaceId);
  const tree = useSelector(selectVisibleTree);
  const tasks = useAppStore((s) => s.tasks);
  const containers = useAppStore((s) => s.containers);
  const isAdmin = useIsAdmin();
  const openDialog = useDialogStore((s) => s.open);

  const [collapsed, setCollapsed] = useState<Set<ID>>(new Set());
  const [active, setActive] = useState<Container | null>(null);

  const taskCounts = useMemo(() => {
    const counts: Record<ID, number> = {};
    for (const t of Object.values(tasks)) if (!t.parentTaskId) counts[t.primaryListId] = (counts[t.primaryListId] ?? 0) + 1;
    return counts;
  }, [tasks]);

  const toggle = (id: ID) =>
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 4 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const onDragStart = (e: DragStartEvent) => setActive(containers[String(e.active.id)] ?? null);
  const onDragEnd = (e: DragEndEvent) => {
    setActive(null);
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const dragged = containers[String(a.id)];
    const target = containers[String(over.id)];
    if (!dragged || !target || dragged.parentId !== target.parentId) return;
    notify(useAppStore.getState().reorderContainer(dragged.id, target.position));
  };

  return (
    <aside className="flex h-full w-64 shrink-0 flex-col bg-sidebar text-ink-inverse" aria-label="Workspace navigation">
      <div className="flex h-14 items-center gap-2.5 border-b border-white/5 px-4">
        <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-brand-600 text-xs font-bold text-white shadow-card">F</span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold leading-tight">Flowboard</p>
          <p className="truncate text-2xs leading-tight text-ink-inverse/50">{containers[workspaceId]?.name}</p>
        </div>
      </div>

      <div className="flex items-center justify-between px-4 pb-1 pt-4">
        <span className="text-2xs font-semibold uppercase tracking-wider text-ink-inverse/40">Spaces</span>
        {isAdmin && (
          <IconButton tone="dark" label="New space" onClick={() => openDialog({ kind: 'create', parentId: workspaceId })}>
            <Plus size={14} />
          </IconButton>
        )}
      </div>

      <nav className="min-h-0 flex-1 overflow-y-auto px-2 pb-4" aria-label="Spaces, folders and lists">
        {boot === 'loading' ? (
          <TreeSkeleton />
        ) : !tree || tree.children.length === 0 ? (
          <p className="px-3 py-6 text-center text-xs text-ink-inverse/50">
            {isAdmin ? 'No spaces yet. Create one to get started.' : 'Nothing has been shared with you yet.'}
          </p>
        ) : (
          <DndContext
            sensors={sensors}
            collisionDetection={closestCenter}
            modifiers={[restrictToVerticalAxis]}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDragCancel={() => setActive(null)}
          >
            <div role="tree" aria-label="Workspace tree">
              <Branch
                nodes={tree.children}
                depth={0}
                collapsed={collapsed}
                toggle={toggle}
                taskCounts={taskCounts}
                dragParentId={active ? active.parentId : undefined}
              />
            </div>
            <DragOverlay dropAnimation={null}>{active ? <TreeItemPreview container={active} /> : null}</DragOverlay>
          </DndContext>
        )}
      </nav>

      {isAdmin && <ArchivedSection />}
    </aside>
  );
}
