/** @filedesc Styling barrel: StylingHost interface, presentation resolution, and re-exports. */
import {
    ThemeDocument,
    PresentationBlock,
    ItemDescriptor,
    Tier1Hints,
    resolvePresentation,
} from '@formspec-org/layout';

export interface StylingHost {
    _componentDocument: any;
    _definition: any;
    _themeDocument: ThemeDocument | null;
    stylesheetHrefs: string[];
    getEffectiveTheme(): ThemeDocument;
    findItemByKey(key: string, items?: any[]): any | null;
}

export function resolveItemPresentation(host: StylingHost, itemDesc: ItemDescriptor): PresentationBlock {
    const item = host.findItemByKey(itemDesc.key);
    const tier1: Tier1Hints = {
        formPresentation: host._definition?.formPresentation,
        itemPresentation: item?.presentation
    };
    const theme: ThemeDocument = host.getEffectiveTheme();
    return resolvePresentation(theme, itemDesc, tier1);
}

export { resolveToken, emitThemeTokens, emitTokenProperties } from './tokens';
export { applyCssClass, applyClassValue, resolveWidgetClassSlots } from './classes';
export { applyStyle } from './style';
export { applyAccessibility } from './accessibility';
export {
    stylesheetRefCounts,
    canonicalizeStylesheetHref,
    findThemeStylesheet,
    loadStylesheets,
    cleanupStylesheets,
} from './stylesheets';
