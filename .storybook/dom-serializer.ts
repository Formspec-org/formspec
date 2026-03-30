/** @filedesc Serialize rendered DOM into a compact, AI-readable text representation for debugging. */

const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE']);

const FORM_ATTRS = ['type', 'checked', 'disabled', 'required', 'readonly',
    'placeholder', 'min', 'max', 'step', 'pattern', 'multiple', 'selected'] as const;

/** Attributes only emitted with a non-empty value (bare `name` or `value` with no content is noise). */
const FORM_VALUE_ATTRS = ['name', 'value', 'for'] as const;

const SEMANTIC_ATTRS = ['role', 'aria-label', 'aria-labelledby', 'aria-describedby',
    'aria-expanded', 'aria-hidden', 'aria-checked', 'aria-selected', 'aria-disabled',
    'aria-required', 'aria-invalid', 'aria-live', 'aria-controls', 'aria-haspopup',
    'tabindex'] as const;

const LINK_ATTRS = ['href', 'target'] as const;
const MEDIA_ATTRS = ['src', 'alt'] as const;

interface Inherited {
    color: string;
    fontSize: string;
    fontWeight: string;
}

const DEFAULT_INHERITED: Inherited = { color: '', fontSize: '', fontWeight: '' };

function shortPx(v: number): string {
    return Math.round(v).toString();
}

/** Format box values (margin/padding): collapse when uniform */
function boxStr(t: number, r: number, b: number, l: number): string {
    const [rt, rr, rb, rl] = [Math.round(t), Math.round(r), Math.round(b), Math.round(l)];
    if (rt === rr && rr === rb && rb === rl) return rt.toString();
    if (rt === rb && rl === rr) return `${rt},${rr}`;
    return `${rt},${rr},${rb},${rl}`;
}

function getLayoutProps(el: Element, cs: CSSStyleDeclaration): string[] {
    const props: string[] = [];
    const rect = el.getBoundingClientRect();

    // Dimensions
    props.push(`${shortPx(rect.width)}×${shortPx(rect.height)}`);

    // Position (only non-static)
    const pos = cs.position;
    if (pos && pos !== 'static') props.push(`pos:${pos}`);

    // Display (only non-default)
    const disp = cs.display;
    if (disp && disp !== 'block' && disp !== 'inline') props.push(`d:${disp}`);

    // Flex/grid container props
    if (disp === 'flex' || disp === 'inline-flex') {
        const dir = cs.flexDirection;
        if (dir && dir !== 'row') props.push(`dir:${dir}`);
        const wrap = cs.flexWrap;
        if (wrap && wrap !== 'nowrap') props.push(`wrap:${wrap}`);
        const gap = cs.gap;
        if (gap && gap !== 'normal' && gap !== '0px') props.push(`gap:${gap}`);
        const justify = cs.justifyContent;
        if (justify && justify !== 'normal' && justify !== 'flex-start') props.push(`jc:${justify}`);
        const align = cs.alignItems;
        if (align && align !== 'normal' && align !== 'stretch') props.push(`ai:${align}`);
    }
    if (disp === 'grid' || disp === 'inline-grid') {
        const cols = cs.gridTemplateColumns;
        if (cols && cols !== 'none') props.push(`cols:${cols}`);
        const rows = cs.gridTemplateRows;
        if (rows && rows !== 'none') props.push(`rows:${rows}`);
        const gap = cs.gap;
        if (gap && gap !== 'normal' && gap !== '0px') props.push(`gap:${gap}`);
    }

    // Margin
    const m = boxStr(
        parseFloat(cs.marginTop) || 0, parseFloat(cs.marginRight) || 0,
        parseFloat(cs.marginBottom) || 0, parseFloat(cs.marginLeft) || 0,
    );
    if (m !== '0') props.push(`m:${m}`);

    // Padding
    const p = boxStr(
        parseFloat(cs.paddingTop) || 0, parseFloat(cs.paddingRight) || 0,
        parseFloat(cs.paddingBottom) || 0, parseFloat(cs.paddingLeft) || 0,
    );
    if (p !== '0') props.push(`p:${p}`);

    // Overflow
    const ox = cs.overflowX, oy = cs.overflowY;
    if (ox === oy && ox && ox !== 'visible') {
        props.push(`overflow:${ox}`);
    } else {
        if (ox && ox !== 'visible') props.push(`overflow-x:${ox}`);
        if (oy && oy !== 'visible') props.push(`overflow-y:${oy}`);
    }

    return props;
}

function getVisualProps(cs: CSSStyleDeclaration, parent: Inherited): string[] {
    const props: string[] = [];

    // Background (never inherited, always show when set)
    const bg = cs.backgroundColor;
    if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') props.push(`bg:${bg}`);

    // Color — only when different from parent
    const color = cs.color;
    if (color && color !== parent.color) props.push(`color:${color}`);

    // Border (simplified)
    const bw = cs.borderWidth;
    const bs = cs.borderStyle;
    const bc = cs.borderColor;
    if (bs && bs !== 'none' && bw && bw !== '0px') {
        props.push(`border:${bw} ${bs} ${bc}`);
    }

    // Border radius
    const br = cs.borderRadius;
    if (br && br !== '0px') props.push(`radius:${br}`);

    // Box shadow (useful for focus rings, elevation)
    const shadow = cs.boxShadow;
    if (shadow && shadow !== 'none') {
        const short = shadow.length > 60 ? shadow.slice(0, 57) + '...' : shadow;
        props.push(`shadow:${short}`);
    }

    // Opacity
    const opacity = cs.opacity;
    if (opacity && opacity !== '1') props.push(`opacity:${opacity}`);

    // Visibility
    const vis = cs.visibility;
    if (vis && vis !== 'visible') props.push(`vis:${vis}`);

    // Font — only when different from parent
    const fs = cs.fontSize;
    const fw = cs.fontWeight;
    const fsChanged = fs !== parent.fontSize;
    const fwChanged = fw !== parent.fontWeight;
    if (fsChanged || fwChanged) {
        const fwShort = fw === '400' ? '' : fw === '700' ? 'bold' : fw;
        if (fwShort && fsChanged) {
            props.push(`font:${fs}/${fwShort}`);
        } else if (fwShort) {
            props.push(`font-weight:${fwShort}`);
        } else if (fsChanged) {
            props.push(`font:${fs}`);
        }
    }

    return props;
}

function getAttrProps(el: Element): string[] {
    const props: string[] = [];

    // ID
    if (el.id) props.push(`#${el.id}`);

    // Classes
    const cls = el.className;
    if (typeof cls === 'string' && cls.trim()) {
        props.push(`.${cls.trim().split(/\s+/).join('.')}`);
    }

    // Form boolean attributes
    for (const attr of FORM_ATTRS) {
        if (el.hasAttribute(attr)) {
            const val = el.getAttribute(attr);
            if (val === '' || val === 'true' || val === attr) {
                props.push(attr);
            } else if (val !== null) {
                props.push(`${attr}=${JSON.stringify(val)}`);
            }
        }
    }

    // Form value attributes — only emit when non-empty
    for (const attr of FORM_VALUE_ATTRS) {
        if (el.hasAttribute(attr)) {
            const val = el.getAttribute(attr);
            if (val) props.push(`${attr}=${JSON.stringify(val)}`);
        }
    }

    // Semantic attributes
    for (const attr of SEMANTIC_ATTRS) {
        if (el.hasAttribute(attr)) {
            const val = el.getAttribute(attr);
            if (val === '' || val === 'true' || val === attr) {
                props.push(attr);
            } else if (val !== null) {
                props.push(`${attr}=${JSON.stringify(val)}`);
            }
        }
    }

    // Links
    for (const attr of LINK_ATTRS) {
        if (el.hasAttribute(attr)) {
            const val = el.getAttribute(attr);
            if (val) props.push(`${attr}=${JSON.stringify(val)}`);
        }
    }

    // Media
    for (const attr of MEDIA_ATTRS) {
        if (el.hasAttribute(attr)) {
            const val = el.getAttribute(attr);
            if (val !== null) props.push(`${attr}=${JSON.stringify(val)}`);
        }
    }

    // data-* attributes
    if (el instanceof HTMLElement) {
        for (const key of Object.keys(el.dataset)) {
            const val = el.dataset[key];
            props.push(`data-${key}=${JSON.stringify(val)}`);
        }
    }

    return props;
}

function serializeNode(node: Element, depth: number, lines: string[], parent: Inherited): void {
    if (SKIP_TAGS.has(node.tagName)) return;

    const cs = getComputedStyle(node);

    // Skip display:none — just mark it
    if (cs.display === 'none') {
        const tag = node.tagName.toLowerCase();
        const id = node.id ? ` #${node.id}` : '';
        const cls = typeof node.className === 'string' && node.className.trim()
            ? ` .${node.className.trim().split(/\s+/).join('.')}`
            : '';
        lines.push(`${'  '.repeat(depth)}${tag}${id}${cls} [hidden]`);
        return;
    }

    // Skip zero-size elements with no children (likely spacers or empty slots)
    const rect = node.getBoundingClientRect();
    if (rect.width === 0 && rect.height === 0 && node.children.length === 0 && !node.textContent?.trim()) {
        return;
    }

    const tag = node.tagName.toLowerCase();
    const attrs = getAttrProps(node);
    const layout = getLayoutProps(node, cs);
    const visual = getVisualProps(cs, parent);

    // Current inherited values for children
    const current: Inherited = {
        color: cs.color,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
    };

    // Build the line: tag  attrs  |  layout  |  visual
    const parts = [tag, ...attrs].join('  ');
    const layoutStr = layout.join('  ');
    const visualStr = visual.join('  ');

    let line = parts;
    if (layoutStr) line += `  |  ${layoutStr}`;
    if (visualStr) line += `  |  ${visualStr}`;

    lines.push(`${'  '.repeat(depth)}${line}`);

    // Text content for leaf-ish nodes
    const textNodes: string[] = [];
    for (const child of node.childNodes) {
        if (child.nodeType === Node.TEXT_NODE) {
            const text = child.textContent?.trim();
            if (text) textNodes.push(text);
        }
    }
    if (textNodes.length > 0) {
        const text = textNodes.join(' ');
        const display = text.length > 120 ? text.slice(0, 117) + '...' : text;
        lines.push(`${'  '.repeat(depth + 1)}"${display}"`);
    }

    // Recurse into shadow DOM (reset inherited — shadow boundary)
    if (node.shadowRoot) {
        lines.push(`${'  '.repeat(depth + 1)}#shadow-root`);
        for (const child of node.shadowRoot.children) {
            serializeNode(child, depth + 2, lines, current);
        }
    }

    // Recurse into children
    for (const child of node.children) {
        serializeNode(child, depth + 1, lines, current);
    }
}

/** Serialize a DOM element tree into a compact, AI-readable text format. */
export function serializeDOM(root: Element): string {
    const lines: string[] = [];
    const cs = getComputedStyle(root);
    const rootInherited: Inherited = {
        color: cs.color,
        fontSize: cs.fontSize,
        fontWeight: cs.fontWeight,
    };
    // Serialize children of root (skip the root container itself — it's just #storybook-root)
    for (const child of root.children) {
        serializeNode(child, 0, lines, rootInherited);
    }
    return lines.join('\n');
}
