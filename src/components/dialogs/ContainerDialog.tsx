import { useEffect, useState, type FormEvent } from 'react';
import { CHILD_TYPE, type Visibility } from '@/domain/types';
import { useAppStore } from '@/store/appStore';
import { toast } from '@/store/toastStore';
import { useUiStore } from '@/store/uiStore';
import { Modal } from '@/components/ui/overlays';
import { Button, FieldError, inputClass, labelClass } from '@/components/ui/primitives';
import { LIMITS } from '@/domain/validation';
import { Lock, Users } from '@/ui/icons';
import { cx } from '@/ui/tokens';
import { useDialogStore } from './dialogStore';

const LABEL = { workspace: 'workspace', space: 'space', folder: 'folder', list: 'list' } as const;

/** Create-child and rename dialog for spaces / folders / lists. */
export function ContainerDialog() {
  const dialog = useDialogStore((s) => s.dialog);
  const close = useDialogStore((s) => s.close);
  const containers = useAppStore((s) => s.containers);
  const open = dialog?.kind === 'create' || dialog?.kind === 'rename';

  const target = dialog?.kind === 'rename' ? containers[dialog.id] : dialog?.kind === 'create' ? containers[dialog.parentId] : undefined;
  const type = dialog?.kind === 'create' && target ? CHILD_TYPE[target.type] : target?.type;

  const [name, setName] = useState('');
  const [visibility, setVisibility] = useState<Visibility>('public');
  const [error, setError] = useState<string>();

  useEffect(() => {
    if (!open) return;
    setName(dialog?.kind === 'rename' ? (target?.name ?? '') : '');
    setVisibility('public');
    setError(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, dialog]);

  if (!type) return null;
  const label = LABEL[type];

  const submit = (e: FormEvent) => {
    e.preventDefault();
    const store = useAppStore.getState();
    const res =
      dialog?.kind === 'create'
        ? store.createContainer({ parentId: dialog.parentId, name, visibility })
        : dialog?.kind === 'rename'
          ? store.renameContainer(dialog.id, name)
          : null;
    if (!res) return;
    if (res.error) {
      // Field-level problems stay inline; anything else (e.g. permission) also toasts.
      setError(res.error.fields?.name ?? res.error.message);
      if (!res.error.fields) toast.error(res.error);
      return;
    }
    if (dialog?.kind === 'create') {
      toast.success(`${label[0]!.toUpperCase()}${label.slice(1)} created`, res.data.name);
      if (res.data.type === 'list') void useUiStore.getState().selectList(res.data.id);
    }
    close();
  };

  return (
    <Modal
      open={open}
      onClose={close}
      title={dialog?.kind === 'create' ? `New ${label}` : `Rename ${label}`}
      description={dialog?.kind === 'create' && target ? `Inside “${target.name}”` : undefined}
    >
      <form onSubmit={submit} className="space-y-4">
        <div>
          <label htmlFor="container-name" className={labelClass}>
            Name
          </label>
          <input
            id="container-name"
            data-autofocus
            className={inputClass}
            value={name}
            maxLength={LIMITS.containerName + 20}
            onChange={(e) => {
              setName(e.target.value);
              setError(undefined);
            }}
            placeholder={type === 'space' ? 'e.g. Engineering' : type === 'folder' ? 'e.g. Q3 Launch' : 'e.g. Backlog'}
            aria-invalid={!!error}
            aria-describedby={error ? 'container-name-error' : undefined}
          />
          <FieldError id="container-name-error" message={error} />
        </div>

        {dialog?.kind === 'create' && (
          <fieldset>
            <legend className={labelClass}>Visibility</legend>
            <div className="grid grid-cols-2 gap-2">
              {(
                [
                  ['public', 'Public', 'Everyone in the workspace', <Users key="u" />],
                  ['private', 'Private', 'Only people you invite', <Lock key="l" />],
                ] as const
              ).map(([value, title, hint, icon]) => (
                <label
                  key={value}
                  className={cx(
                    'flex cursor-pointer gap-2.5 rounded-card p-3 ring-1 ring-inset transition-colors',
                    visibility === value ? 'bg-brand-50 ring-brand-500' : 'ring-line-strong hover:bg-canvas',
                  )}
                >
                  <input
                    type="radio"
                    name="visibility"
                    value={value}
                    checked={visibility === value}
                    onChange={() => setVisibility(value)}
                    className="sr-only"
                  />
                  <span className={visibility === value ? 'text-brand-600' : 'text-ink-subtle'}>{icon}</span>
                  <span>
                    <span className="block text-sm font-medium text-ink">{title}</span>
                    <span className="block text-2xs text-ink-muted">{hint}</span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <Button onClick={close}>Cancel</Button>
          <Button type="submit" variant="primary">
            {dialog?.kind === 'create' ? `Create ${label}` : 'Save'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
