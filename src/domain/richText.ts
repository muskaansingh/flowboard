/**
 * Task descriptions are stored as HTML produced by the rich-text editor. Older/seeded
 * descriptions are plain text, so both shapes are accepted everywhere.
 */

export const isHtml = (s: string) => /^\s*<(p|h[1-6]|ul|ol|blockquote|pre|div)[\s>]/i.test(s);

const escapeHtml = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

/** Plain text → editor HTML (one paragraph per line). */
export function toEditorHtml(s: string): string {
  if (!s) return '';
  if (isHtml(s)) return s;
  return s
    .split(/\n/)
    .map((line) => `<p>${escapeHtml(line)}</p>`)
    .join('');
}

const ENTITIES: Record<string, string> = { '&amp;': '&', '&lt;': '<', '&gt;': '>', '&quot;': '"', '&#39;': "'", '&nbsp;': ' ' };

/** Text content for search/filtering — tags stripped, entities decoded, whitespace collapsed. */
export function toPlainText(s: string): string {
  if (!s || !isHtml(s)) return s;
  return s
    .replace(/<[^>]+>/g, ' ')
    .replace(/&(amp|lt|gt|quot|#39|nbsp);/g, (m) => ENTITIES[m] ?? m)
    .replace(/\s+/g, ' ')
    .trim();
}
