import { useEffect, useState, type FormEvent } from 'react';
import { PRIORITIES, type ID, type Priority } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import type { ListViewModel } from '@/store/selectors';
import { usersWithAccess } from '@/domain/permissions';
import { Modal } from '@/components/ui/overlays';
import { SelectMenu } from '@/components/ui/SelectMenu';
import { Avatar, Button, FieldError, StatusDot, inputClass, labelClass } from '@/components/ui/primitives';
import { Flag } from '@/ui/icons';
import { PRIORITY_META } from '@/ui/tokens';

const fromLocalInput = (v: string) => (v ? new Date(v).toISOString() : null);

export function NewTaskDialog({ vm, open, onClose }: { vm: ListViewModel; open: boolean; onClose: () => void }) {
  const state = useAppStore();
  const assignable = usersWithAccess(state, vm.list.id);
  const defaultStatus = vm.statuses[0]?.id ?? '';
  const [title, setTitle] = useState('');
  const [statusId, setStatusId] = useState<ID>(defaultStatus);
  const [priority, setPriority] = useState<Priority>('none');
  const [assigneeIds, setAssigneeIds] = useState<ID[]>([]);
  const [due, setDue] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) return;
    setTitle('');
    setStatusId(defaultStatus);
    setPriority('none');
    setAssigneeIds([]);
    setDue('');
    setErrors({});
  }, [open, defaultStatus]);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const res = useAppStore.getState().createTask(vm.list.id, {
      title,
      statusId,
      priority,
      assigneeIds,
      dueDate: fromLocalInput(due),
    });
    if (res.error) {
      if (res.error.fields) setErrors(res.error.fields);
      else toast.error(res.error);
      return;
    }
    toast.success('Task created', res.data.title);
    onClose();
    useUiStore.getState().openTask(res.data.id);
  };

  return (
    <Modal open={open} onClose={onClose} title="New task" description={`In ${vm.list.name}`} size="lg">
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="new-task-title" className={labelClass}>
            Title
          </label>
          <input
            id="new-task-title"
            data-autofocus
            className={inputClass}
            value={title}
            placeholder="What needs to be done?"
            onChange={(e) => {
              setTitle(e.target.value);
              setErrors((x) => ({ ...x, title: '' }));
            }}
            aria-invalid={!!errors.title}
          />
          <FieldError message={errors.title} />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className={labelClass}>Status</span>
            <SelectMenu
              label="Status"
              value={statusId}
              options={vm.statuses.map((s) => ({ value: s.id, label: s.name, icon: <StatusDot status={s} /> }))}
              onChange={setStatusId}
            />
          </div>
          <div>
            <span className={labelClass}>Priority</span>
            <SelectMenu<Priority>
              label="Priority"
              value={priority}
              options={PRIORITIES.map((p) => ({ value: p, label: PRIORITY_META[p].label, icon: <Flag size={13} className={PRIORITY_META[p].icon} /> }))}
              onChange={setPriority}
            />
          </div>
          <div>
            <span className={labelClass}>Assignees</span>
            <SelectMenu
              multiple
              label="Assignees"
              placeholder="Unassigned"
              value={assigneeIds}
              options={assignable.map((u) => ({ value: u.id, label: u.name, icon: <Avatar user={u} size="xs" /> }))}
              onChange={setAssigneeIds}
            />
            <FieldError message={errors.assigneeIds} />
          </div>
          <div>
            <label htmlFor="new-task-due" className={labelClass}>
              Due date
            </label>
            <input id="new-task-due" type="datetime-local" className={inputClass} value={due} onChange={(e) => setDue(e.target.value)} />
            <FieldError message={errors.dueDate} />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={onClose}>Cancel</Button>
          <Button type="submit" variant="primary">
            Create task
          </Button>
        </div>
      </form>
    </Modal>
  );
}
