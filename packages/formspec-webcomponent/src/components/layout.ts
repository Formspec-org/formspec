/** @filedesc Layout component plugins — delegate DOM to the active render adapter (falls back to default). */
import { ComponentPlugin, RenderContext } from '../types';
import { globalRegistry } from '../registry';
import { layoutHostSlice } from '../adapters/layout-host';
import type {
    PageLayoutBehavior,
    StackLayoutBehavior,
    GridLayoutBehavior,
    DividerLayoutBehavior,
    CollapsibleLayoutBehavior,
    ColumnsLayoutBehavior,
    PanelLayoutBehavior,
    AccordionLayoutBehavior,
    ModalLayoutBehavior,
    PopoverLayoutBehavior,
} from '../adapters/layout-behaviors';

/** Resolve a component string via $component.<id>.<prop> locale key, falling back to inline. */
function resolveCompText(ctx: RenderContext, comp: any, prop: string, fallback: string): string {
    if (!comp.id) return fallback;
    return ctx.engine.resolveLocaleString(`$component.${comp.id}.${prop}`, fallback);
}

function runLayoutAdapter<T>(type: string, behavior: T, parent: HTMLElement, ctx: RenderContext): void {
    const fn = globalRegistry.resolveAdapterFn(type);
    if (fn) fn(behavior as any, parent, ctx.adapterContext);
}

/** Renders a `<section>` page container with optional `<h2>` title and `<p>` description. */
export const PagePlugin: ComponentPlugin = {
    type: 'Page',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: PageLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleText: comp.title ? resolveCompText(ctx, comp, 'title', comp.title) : null,
            headingLevel: comp.headingLevel || 'h2',
            descriptionText: comp.description ?? null,
        };
        runLayoutAdapter('Page', behavior, parent, ctx);
    }
};

/** Renders a flex `<div>` stack with configurable direction, alignment, wrap, and gap (token-resolved). */
export const StackPlugin: ComponentPlugin = {
    type: 'Stack',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: StackLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleText: comp.title ? resolveCompText(ctx, comp, 'title', comp.title) : null,
            descriptionText: comp.description ? resolveCompText(ctx, comp, 'description', comp.description) : null,
        };
        runLayoutAdapter('Stack', behavior, parent, ctx);
    }
};

/** Renders a CSS grid `<div>` with configurable column count, gap, and row gap. */
export const GridPlugin: ComponentPlugin = {
    type: 'Grid',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: GridLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleText: comp.title ? resolveCompText(ctx, comp, 'title', comp.title) : null,
            descriptionText: comp.description ? resolveCompText(ctx, comp, 'description', comp.description) : null,
        };
        runLayoutAdapter('Grid', behavior, parent, ctx);
    }
};

/** Renders an `<hr>` divider, or a labeled divider with `<hr>` lines flanking a `<span>` label. */
export const DividerPlugin: ComponentPlugin = {
    type: 'Divider',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: DividerLayoutBehavior = {
            comp,
            labelText: comp.label ? resolveCompText(ctx, comp, 'label', comp.label) : null,
        };
        runLayoutAdapter('Divider', behavior, parent, ctx);
    }
};

/** Renders a `<details>`/`<summary>` collapsible section with optional default-open state. */
export const CollapsiblePlugin: ComponentPlugin = {
    type: 'Collapsible',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: CollapsibleLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleText: resolveCompText(ctx, comp, 'title', comp.title || 'Details'),
            descriptionText: comp.description ? resolveCompText(ctx, comp, 'description', comp.description) : null,
        };
        runLayoutAdapter('Collapsible', behavior, parent, ctx);
    }
};

/** Renders a multi-column `<div>` layout with configurable column count and token-resolved gap. */
export const ColumnsPlugin: ComponentPlugin = {
    type: 'Columns',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: ColumnsLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleText: comp.title ? resolveCompText(ctx, comp, 'title', comp.title) : null,
            descriptionText: comp.description ? resolveCompText(ctx, comp, 'description', comp.description) : null,
        };
        runLayoutAdapter('Columns', behavior, parent, ctx);
    }
};

/** Renders a `<div>` panel container with optional header and configurable width. */
export const PanelPlugin: ComponentPlugin = {
    type: 'Panel',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: PanelLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleText: comp.title ? resolveCompText(ctx, comp, 'title', comp.title) : null,
            descriptionText: comp.description ? resolveCompText(ctx, comp, 'description', comp.description) : null,
        };
        runLayoutAdapter('Panel', behavior, parent, ctx);
    }
};

/**
 * Renders an accordion using `<details>`/`<summary>` elements for each child.
 * Supports single-open mode (default) via toggle event listeners, or multi-open via `allowMultiple`.
 * If `bind` is present, each instance of the repeating group becomes one accordion section.
 */
export const AccordionPlugin: ComponentPlugin = {
    type: 'Accordion',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const bindKey = comp.bind;
        const fullName = ctx.prefix ? `${ctx.prefix}.${bindKey}` : bindKey;
        const repeatCount = bindKey ? ctx.engine.repeats[fullName] : { value: 0 };
        const item = bindKey ? ctx.findItemByKey(bindKey) : null;
        const groupLabel = item?.label || bindKey || '';

        const behavior: AccordionLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            repeatCount: repeatCount as any,
            groupLabel,
            addInstance: () => {
                if (bindKey) ctx.engine.addRepeatInstance(fullName);
            },
            removeInstance: (index: number) => {
                if (bindKey) ctx.engine.removeRepeatInstance(fullName, index);
            }
        };
        runLayoutAdapter('Accordion', behavior, parent, ctx);
    }
};

/** Renders a `<dialog>` modal with optional close button, title, and a trigger button that calls `showModal()`. */
export const ModalPlugin: ComponentPlugin = {
    type: 'Modal',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: ModalLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleText: comp.title ? resolveCompText(ctx, comp, 'title', comp.title) : null,
            triggerLabelText: resolveCompText(ctx, comp, 'triggerLabel', comp.triggerLabel || 'Open'),
        };
        runLayoutAdapter('Modal', behavior, parent, ctx);
    }
};

/**
 * Renders a popover with a trigger button and content panel.
 * Trigger label can be bound to a field signal. Uses the Popover API when available, falls back to hidden toggle.
 */
export const PopoverPlugin: ComponentPlugin = {
    type: 'Popover',
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => {
        const behavior: PopoverLayoutBehavior = {
            comp,
            host: layoutHostSlice(ctx),
            titleResolved: resolveCompText(ctx, comp, 'title', comp.title || comp.triggerLabel || 'Popover'),
            triggerLabelFallback: comp.triggerLabel || 'Open',
        };
        runLayoutAdapter('Popover', behavior, parent, ctx);
    }
};
