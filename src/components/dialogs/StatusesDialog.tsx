import { useState } from 'react';
import { STATUS_COLORS, type Status, type StatusCategory, type StatusColor } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { notify } from '@/store/toastStore';
import { statusesForList } from '@/domain/commands/statuses';
import { Modal } from '@/components/ui/overlays';
import { Button, IconButton, inputBase } from '@/components/ui/primitives';
import { ArrowDown, ArrowUp, Plus, Trash } from '@/ui/icons';
import { CATEGORY_LABEL, STATUS_STYLES, cx } from '@/ui/tokens';
import { useDialogStore } from './dialogStore';

function ColorPicker({ value, onChange, label }: { value: StatusColor; onChange: (c: StatusColor) => void; label: string }) {
  return (
    <div className="flex gap-1" role="radiogroup" aria-label={label}>
      {STATUS_COLORS.map((c) => (
        <button
          key={c}
          type="button"
          role="radio"
          aria-checked={value === c}
          aria-label={c}
          onClick={() => onChange(c)}
          className={cx(
            'h-4 w-4 rounded-full transition-transform hover:scale-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 focus-visible:ring-offset-1',
            STATUS_STYLES[c].dot,
            value === c && 'ring-2 ring-ink ring-offset-1',
          )}
        />
      ))}
    </div>
  );
}

function StatusRow({ status, index, count, siblings }: { status: Status; index: number; count: number; siblings: Status[] }) {
  const store = useAppStore.getState;
  const taskCount = useAppStore((s) => Object.values(s.tasks).filter((t) => t.statusId === status.id).length);
  const [name, setName] = useState(status.name);
  const [reassignTo, setReassignTo] = useState<string>('');
  const [deleting, setDeleting] = useState(false);

  const commitName = () => {
    if (name.trim() === status.name) return;
    if (!notify(store().updateStatus(status.id, { name }))) setName(status.name);
  };

  // Inline two-step confirmation (avoids stacking a second modal on top of this one).
  const startDelete = () => {
    setReassignTo(siblings.find((s) => s.id !== status.id)?.id ?? '');
    setDeleting(true);
  };
  const confirmDelete = () => {
    if (notify(store().deleteStatus(status.id, taskCount > 0 ? reassignTo : undefined), 'Status deleted')) setDeleting(false);
  };

  return (
    <li className="px-3 py-2.5">
      <div className="flex items-center gap-2">
        <span className={cx('h-2.5 w-2.5 shrink-0 rounded-full', STATUS_STYLES[status.color].dot)} />
        <input
          aria-label="Status name"
          className={cx(inputBase, 'h-8 min-w-0 flex-1 py-1 text-sm shadow-none')}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={commitName}
          onKeyDown={(e) => e.key === 'Enter' && (e.currentTarget as HTMLInputElement).blur()}
        />
        <select
          aria-label="Category"
          className={cx(inputBase, 'h-8 w-32 shrink-0 py-1 text-xs shadow-none')}
          value={status.category}
          onChange={(e) => notify(store().updateStatus(status.id, { category: e.target.value as StatusCategory }))}
        >
          {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <span className="w-14 text-right text-2xs text-ink-subtle">{taskCount} task{taskCount === 1 ? '' : 's'}</span>
        <IconButton label="Move up" disabled={index === 0} onClick={() => notify(store().reorderStatus(status.id, index - 1))} className="disabled:opacity-30">
          <ArrowUp size={14} />
        </IconButton>
        <IconButton label="Move down" disabled={index === count - 1} onClick={() => notify(store().reorderStatus(status.id, index + 1))} className="disabled:opacity-30">
          <ArrowDown size={14} />
        </IconButton>
        <IconButton label={`Delete ${status.name}`} onClick={startDelete} className="hover:!bg-rose-50 hover:!text-rose-600">
          <Trash size={14} />
        </IconButton>
      </div>
      <div className="mt-2 flex items-center gap-3 pl-[18px]">
        <ColorPicker label={`${status.name} colour`} value={status.color} onChange={(color) => notify(store().updateStatus(status.id, { color }))} />
      </div>
      {deleting && (
        <div className="mt-2 flex items-center gap-2 rounded-lg bg-rose-50 p-2 pl-3 text-xs text-rose-800">
          {taskCount > 0 ? <span>Delete and move {taskCount} task(s) to</span> : <span className="flex-1">Delete this status?</span>}
          {taskCount > 0 && (
          <select aria-label="Move tasks to" className={cx(inputBase, 'h-8 w-36 py-1 text-xs')} value={reassignTo} onChange={(e) => setReassignTo(e.target.value)}>
            {siblings
              .filter((s) => s.id !== status.id)
              .map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
          </select>
          )}
          <Button size="sm" variant="danger" onClick={confirmDelete}>
            Delete
          </Button>
          <Button size="sm" variant="ghost" onClick={() => setDeleting(false)}>
            Cancel
          </Button>
        </div>
      )}
    </li>
  );
}

export function StatusesDialog() {
  const dialog = useDialogStore((s) => s.dialog);
  const close = useDialogStore((s) => s.close);
  const allStatuses = useAppStore((s) => s.statuses);
  const list = useAppStore((s) => (dialog?.kind === 'statuses' ? s.containers[dialog.listId] : undefined));
  const [draft, setDraft] = useState<{ name: string; category: StatusCategory; color: StatusColor }>({
    name: '',
    category: 'in_progress',
    color: 'teal',
  });
  if (dialog?.kind !== 'statuses' || !list) return null;
  const statuses = statusesForList(allStatuses, list.id);

  const add = () => {
    if (notify(useAppStore.getState().createStatus(list.id, draft), 'Status added')) setDraft({ ...draft, name: '' });
  };

  return (
    <Modal open onClose={close} title={`Statuses · ${list.name}`} description="Columns on the board. Each list owns its own set." size="lg" footer={<Button onClick={close}>Done</Button>}>
      <ul className="divide-y divide-line rounded-card ring-1 ring-line">
        {statuses.map((s, i) => (
          <StatusRow key={s.id} status={s} index={i} count={statuses.length} siblings={statuses} />
        ))}
      </ul>
      <form
        className="mt-4 flex items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          add();
        }}
      >
        <input
          aria-label="New status name"
          className={cx(inputBase, 'h-9 min-w-0 flex-1')}
          placeholder="New status, e.g. QA"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
        <select
          aria-label="New status category"
          className={cx(inputBase, 'h-9 w-32 shrink-0 text-xs')}
          value={draft.category}
          onChange={(e) => setDraft({ ...draft, category: e.target.value as StatusCategory })}
        >
          {(Object.keys(CATEGORY_LABEL) as StatusCategory[]).map((c) => (
            <option key={c} value={c}>
              {CATEGORY_LABEL[c]}
            </option>
          ))}
        </select>
        <ColorPicker label="New status colour" value={draft.color} onChange={(color) => setDraft({ ...draft, color })} />
        <Button type="submit" variant="primary" icon={<Plus />} disabled={!draft.name.trim()}>
          Add
        </Button>
      </form>
    </Modal>
  );
}
