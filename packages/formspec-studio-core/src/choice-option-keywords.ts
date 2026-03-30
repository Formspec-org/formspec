/** @filedesc Serialize option.keywords for Studio inputs (comma-separated) per definition OptionEntry. */

/** Parse comma-separated type-ahead aliases; returns undefined when empty so JSON omits the key. */
export function parseCommaSeparatedKeywords(raw: string): string[] | undefined {
    const parts = raw
        .split(',')
        .map((s) => s.trim())
        .filter((s) => s.length > 0);
    return parts.length > 0 ? parts : undefined;
}

/** Display keywords in a single-line editor. */
export function formatCommaSeparatedKeywords(keywords: string[] | undefined): string {
    return keywords?.length ? keywords.join(', ') : '';
}
