import { useEffect, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, useEditorState, type Editor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import { Placeholder } from '@tiptap/extensions';
import { TaskItem, TaskList } from '@tiptap/extension-list';
import { toEditorHtml } from '@/domain/richText';
import { Button } from '@/components/ui/primitives';
import { Code, LinkIcon, ListBullet, ListChecks, ListOrdered, Quote } from '@/ui/icons';
import { cx } from '@/ui/tokens';

/** Typography for editor content — scoped arbitrary variants (no global CSS / typography plugin). */
const CONTENT = cx(
  'text-sm leading-relaxed text-ink focus:outline-none',
  '[&_p]:my-1 [&_h2]:mb-1 [&_h2]:mt-3 [&_h2]:text-base [&_h2]:font-semibold [&_h3]:mb-1 [&_h3]:mt-2 [&_h3]:text-sm [&_h3]:font-semibold',
  '[&_ul]:my-1 [&_ul]:list-disc [&_ul]:pl-5 [&_ol]:my-1 [&_ol]:list-decimal [&_ol]:pl-5 [&_li>p]:my-0.5',
  '[&_ul[data-type=taskList]]:list-none [&_ul[data-type=taskList]]:pl-0.5 [&_li[data-type=taskItem]]:flex [&_li[data-type=taskItem]]:items-start [&_li[data-type=taskItem]]:gap-2',
  '[&_li[data-type=taskItem]>label]:mt-[3px] [&_li[data-type=taskItem]>div]:flex-1 [&_li[data-checked=true]>div]:text-ink-subtle [&_li[data-checked=true]>div]:line-through',
  '[&_input[type=checkbox]]:h-3.5 [&_input[type=checkbox]]:w-3.5 [&_input[type=checkbox]]:accent-brand-600',
  '[&_blockquote]:my-2 [&_blockquote]:border-l-2 [&_blockquote]:border-line-strong [&_blockquote]:pl-3 [&_blockquote]:text-ink-muted',
  '[&_code]:rounded [&_code]:bg-canvas [&_code]:px-1 [&_code]:py-0.5 [&_code]:font-mono [&_code]:text-[0.8125rem] [&_code]:ring-1 [&_code]:ring-line',
  '[&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-lg [&_pre]:bg-ink [&_pre]:p-3 [&_pre]:text-ink-inverse [&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:text-ink-inverse [&_pre_code]:ring-0',
  '[&_a]:text-brand-700 [&_a]:underline [&_a]:underline-offset-2 [&_strong]:font-semibold',
  '[&_p.is-editor-empty:first-child]:before:pointer-events-none [&_p.is-editor-empty:first-child]:before:float-left [&_p.is-editor-empty:first-child]:before:h-0 [&_p.is-editor-empty:first-child]:before:text-ink-subtle [&_p.is-editor-empty:first-child]:before:content-[attr(data-placeholder)]',
);

function ToolButton({ label, active, onClick, children }: { label: string; active?: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button
      type="button"
      title={label}
      aria-label={label}
      aria-pressed={active}
      // Keep the editor's selection: don't let the toolbar steal focus on mousedown.
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={cx(
        'inline-flex h-7 min-w-7 items-center justify-center rounded px-1.5 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500',
        active ? 'bg-brand-100 text-brand-800' : 'text-ink-muted hover:bg-black/5 hover:text-ink',
      )}
    >
      {children}
    </button>
  );
}

function Toolbar({ editor }: { editor: Editor }) {
  const s = useEditorState({
    editor,
    selector: ({ editor: e }) => ({
      bold: e.isActive('bold'),
      italic: e.isActive('italic'),
      strike: e.isActive('strike'),
      code: e.isActive('code'),
      h2: e.isActive('heading', { level: 2 }),
      h3: e.isActive('heading', { level: 3 }),
      bullet: e.isActive('bulletList'),
      ordered: e.isActive('orderedList'),
      task: e.isActive('taskList'),
      quote: e.isActive('blockquote'),
      codeBlock: e.isActive('codeBlock'),
      link: e.isActive('link'),
    }),
  });
  const chain = () => editor.chain().focus();
  const [linkDraft, setLinkDraft] = useState<string | null>(null);
  const setLink = () => (s.link ? chain().unsetLink().run() : setLinkDraft('https://'));
  const applyLink = () => {
    const url = linkDraft?.trim() ?? '';
    // Only web/mail links — never javascript: or data: URLs.
    if (/^(https?:\/\/\S+|mailto:\S+)$/i.test(url)) chain().extendMarkRange('link').setLink({ href: url }).run();
    setLinkDraft(null);
  };
  const sep = <span className="mx-0.5 h-4 w-px bg-line" aria-hidden />;
  return (
    <div role="toolbar" aria-label="Formatting" className="flex flex-wrap items-center gap-0.5 border-b border-line px-1.5 py-1">
      <ToolButton label="Heading" active={s.h2} onClick={() => chain().toggleHeading({ level: 2 }).run()}>H2</ToolButton>
      <ToolButton label="Subheading" active={s.h3} onClick={() => chain().toggleHeading({ level: 3 }).run()}>H3</ToolButton>
      {sep}
      <ToolButton label="Bold (⌘B)" active={s.bold} onClick={() => chain().toggleBold().run()}>B</ToolButton>
      <ToolButton label="Italic (⌘I)" active={s.italic} onClick={() => chain().toggleItalic().run()}>
        <span className="italic">I</span>
      </ToolButton>
      <ToolButton label="Strikethrough" active={s.strike} onClick={() => chain().toggleStrike().run()}>
        <span className="line-through">S</span>
      </ToolButton>
      <ToolButton label="Inline code" active={s.code} onClick={() => chain().toggleCode().run()}>
        <Code size={14} />
      </ToolButton>
      <ToolButton label="Link" active={s.link} onClick={setLink}>
        <LinkIcon size={14} />
      </ToolButton>
      {sep}
      <ToolButton label="Bulleted list" active={s.bullet} onClick={() => chain().toggleBulletList().run()}>
        <ListBullet size={15} />
      </ToolButton>
      <ToolButton label="Numbered list" active={s.ordered} onClick={() => chain().toggleOrderedList().run()}>
        <ListOrdered size={15} />
      </ToolButton>
      <ToolButton label="Checklist" active={s.task} onClick={() => chain().toggleTaskList().run()}>
        <ListChecks size={15} />
      </ToolButton>
      <ToolButton label="Quote" active={s.quote} onClick={() => chain().toggleBlockquote().run()}>
        <Quote size={13} />
      </ToolButton>
      <ToolButton label="Code block" active={s.codeBlock} onClick={() => chain().toggleCodeBlock().run()}>
        {'{ }'}
      </ToolButton>
      {linkDraft !== null && (
        <input
          autoFocus
          aria-label="Link URL"
          value={linkDraft}
          onChange={(e) => setLinkDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              e.stopPropagation();
              applyLink();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              e.stopPropagation();
              setLinkDraft(null);
              editor.commands.focus();
            }
          }}
          onBlur={() => setLinkDraft(null)}
          className="ml-1 h-7 min-w-0 flex-1 rounded border-0 bg-canvas px-2 text-xs text-ink ring-1 ring-inset ring-line focus:outline-none focus:ring-2 focus:ring-brand-500"
          placeholder="https://… then Enter"
        />
      )}
    </div>
  );
}

/**
 * Jira-style description: reads as formatted content; click to edit with a toolbar,
 * then Save (⌘/Ctrl+Enter) or Cancel (Esc). Value in/out is HTML.
 */
export function RichTextEditor({
  value,
  onSave,
  onEditStart,
  placeholder = 'Add a description…',
  label = 'Description',
}: {
  value: string;
  onSave: (html: string) => void;
  onEditStart?: () => void;
  placeholder?: string;
  label?: string;
}) {
  const [editing, setEditing] = useState(false);
  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [2, 3] }, link: { openOnClick: false, autolink: true } }),
      TaskList,
      TaskItem.configure({ nested: true }),
      Placeholder.configure({ placeholder }),
    ],
    content: toEditorHtml(value),
    editable: false,
    immediatelyRender: true,
    editorProps: { attributes: { 'aria-label': label, 'aria-multiline': 'true', role: 'textbox' } },
  });

  // Mirror external changes (another tab, conflict reload) while not editing.
  useEffect(() => {
    if (!editor || editing) return;
    const html = toEditorHtml(value);
    if (editor.getHTML() !== html) editor.commands.setContent(html, { emitUpdate: false });
  }, [editor, value, editing]);

  if (!editor) return null;

  const start = () => {
    if (editing) return;
    onEditStart?.();
    editor.setEditable(true);
    setEditing(true);
    requestAnimationFrame(() => editor.commands.focus('end'));
  };
  const finish = (save: boolean) => {
    if (save) onSave(editor.isEmpty ? '' : editor.getHTML());
    else editor.commands.setContent(toEditorHtml(value), { emitUpdate: false });
    editor.setEditable(false);
    setEditing(false);
  };

  const empty = editor.isEmpty && !editing;

  return (
    <div>
      <div
        className={cx(
          'rounded-lg ring-1 ring-inset transition-colors',
          editing ? 'bg-surface ring-2 ring-brand-500' : 'cursor-text ring-transparent hover:bg-canvas',
        )}
        onClick={start}
        onKeyDown={(e) => {
          if (!editing) {
            if (e.key === 'Enter') {
              e.preventDefault();
              start();
            }
            return;
          }
          if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            finish(true);
          } else if (e.key === 'Escape') {
            // Swallow so the drawer stays open; Esc here means "discard edits".
            e.preventDefault();
            e.stopPropagation();
            finish(false);
          }
        }}
        role={editing ? undefined : 'button'}
        tabIndex={editing ? -1 : 0}
        aria-label={editing ? undefined : `${label}. Press Enter to edit`}
      >
        {editing && <Toolbar editor={editor} />}
        {empty ? (
          <p className="px-3 py-2 text-sm text-ink-subtle">{placeholder}</p>
        ) : (
          <EditorContent editor={editor} className={cx(CONTENT, editing ? 'max-h-[50vh] min-h-[7rem] overflow-y-auto px-3 py-2 [&_.ProseMirror]:min-h-[6rem] [&_.ProseMirror]:outline-none' : 'px-3 py-1.5')} />
        )}
      </div>
      {editing && (
        <div className="mt-2 flex items-center gap-2">
          <Button size="sm" variant="primary" onClick={() => finish(true)}>
            Save
          </Button>
          <Button size="sm" variant="ghost" onClick={() => finish(false)}>
            Cancel
          </Button>
          <span className="ml-auto text-2xs text-ink-subtle">⌘/Ctrl+Enter to save · Esc to cancel</span>
        </div>
      )}
    </div>
  );
}
