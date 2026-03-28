/** @filedesc Core layout plan types: LayoutNode and PlanContext interfaces. */
import type { PresentationBlock } from './theme-resolver.js';

/**
 * A JSON-serializable layout plan node. Produced by the planner and consumed
 * by renderers (webcomponent, React, PDF, SSR, etc.).
 *
 * All values are plain data — no functions, class instances, or signals.
 */
export interface LayoutNode {
    /** Stable ID for diffing/keying (auto-generated during planning). */
    id: string;

    /** Resolved component type: "Stack", "TextInput", "Page", etc. */
    component: string;

    /** Node classification for renderer dispatch. */
    category: 'layout' | 'container' | 'field' | 'display' | 'interactive' | 'special';

    /** All resolved component props (tokens resolved, responsive merged). JSON-serializable. */
    props: Record<string, unknown>;

    /** Resolved inline styles (tokens resolved). */
    style?: Record<string, string | number>;

    /** Merged CSS class list from theme cascade + component doc. */
    cssClasses: string[];

    /** Accessibility attributes. */
    accessibility?: { role?: string; description?: string; liveRegion?: string };

    /** Ordered child nodes. */
    children: LayoutNode[];

    // ── Field binding ──

    /** Full bind path (e.g. "applicantInfo.orgName"). */
    bindPath?: string;

    /** Snapshot of the definition item this field maps to. */
    fieldItem?: {
        key: string;
        label: string;
        hint?: string;
        dataType?: string;
        options?: Array<{ value: string; label: string }>;
        optionSet?: string;
        extensions?: Record<string, boolean>;
    };

    /** Resolved presentation block from 5-level theme cascade. */
    presentation?: PresentationBlock;

    /** Effective label position. */
    labelPosition?: 'top' | 'start' | 'hidden';

    // ── Conditional rendering (deferred to renderer) ──

    /** FEL expression string — renderer subscribes to this for reactive visibility. */
    when?: string;

    /** Path prefix for evaluating the when expression. */
    whenPrefix?: string;

    /** Fallback content when when=false. */
    fallback?: string;

    // ── Repeat groups (deferred to renderer) ──

    /** Group name for repeat signals. */
    repeatGroup?: string;

    /** Full path of the repeat group. */
    repeatPath?: string;

    /** If true, children are a template to stamp per instance. */
    isRepeatTemplate?: boolean;

    // ── Scope markers ──

    /** If true, this node's bind path creates a new scope (prefix) for child rendering.
     *  Used by definition-fallback groups where item keys are relative. */
    scopeChange?: boolean;
}

/**
 * Plain-value snapshot the planner needs to produce a layout plan.
 * Contains no signals or reactive references — just data.
 */
export interface PlanContext {
    /** The definition items array. */
    items: any[];

    /** Definition-level formPresentation block. */
    formPresentation?: any;

    /** The loaded component document (tree, components, tokens, breakpoints). */
    componentDocument?: any;

    /** The loaded theme document. */
    theme?: any;

    /** Currently active breakpoint name, or null. */
    activeBreakpoint?: string | null;

    /** Lookup a definition item by key (supports dotted paths). */
    findItem: (key: string) => any | null;

    /** Check if a component type is registered in the renderer. */
    isComponentAvailable?: (type: string) => boolean;
}
