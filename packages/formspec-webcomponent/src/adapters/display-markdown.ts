/** @filedesc Minimal markdown-to-HTML for Text `format: 'markdown'` — shared by default and design-system adapters. */

/**
 * Minimal markdown-to-HTML converter for Text component `format: 'markdown'`.
 * Handles: **bold**, *italic*, `code`, ordered/unordered lists, line breaks.
 * Output is pre-sanitized (no raw HTML passthrough).
 */
export function renderMarkdown(src: string): string {
    let html = src
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    const lines = html.split('\n');
    const out: string[] = [];
    let inUl = false;
    let inOl = false;

    for (const line of lines) {
        const trimmed = line.trim();

        if (/^[-*]\s+/.test(trimmed)) {
            if (!inUl) {
                out.push('<ul>');
                inUl = true;
            }
            if (inOl) {
                out.push('</ol>');
                inOl = false;
            }
            out.push(`<li>${trimmed.replace(/^[-*]\s+/, '')}</li>`);
            continue;
        }

        if (/^\d+\.\s+/.test(trimmed)) {
            if (!inOl) {
                out.push('<ol>');
                inOl = true;
            }
            if (inUl) {
                out.push('</ul>');
                inUl = false;
            }
            out.push(`<li>${trimmed.replace(/^\d+\.\s+/, '')}</li>`);
            continue;
        }

        if (inUl) {
            out.push('</ul>');
            inUl = false;
        }
        if (inOl) {
            out.push('</ol>');
            inOl = false;
        }

        if (trimmed === '') {
            out.push('<br>');
        } else {
            out.push(`<p>${trimmed}</p>`);
        }
    }
    if (inUl) out.push('</ul>');
    if (inOl) out.push('</ol>');

    let result = out.join('\n');
    result = result.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    result = result.replace(/\*(.+?)\*/g, '<em>$1</em>');
    result = result.replace(/`(.+?)`/g, '<code>$1</code>');

    return result;
}
