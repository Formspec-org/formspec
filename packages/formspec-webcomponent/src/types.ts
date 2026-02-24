import { FormEngine } from 'formspec-engine';
import { ThemeDocument, PresentationBlock, ItemDescriptor } from './theme-resolver';

export interface RenderContext {
    engine: FormEngine;
    componentDocument: any;
    themeDocument: ThemeDocument | null;
    prefix: string;
    renderComponent: (comp: any, parent: HTMLElement, prefix?: string) => void;
    resolveToken: (val: any) => any;
    applyStyle: (el: HTMLElement, style: any) => void;
    applyCssClass: (el: HTMLElement, comp: any) => void;
    applyAccessibility: (el: HTMLElement, comp: any) => void;
    resolveItemPresentation: (item: ItemDescriptor) => PresentationBlock;
    cleanupFns: Array<() => void>;
    findItemByKey: (key: string, items?: any[]) => any | null;
    renderInputComponent: (comp: any, item: any, fullName: string) => HTMLElement;
    activeBreakpoint: string | null;
}

export interface ComponentPlugin {
    type: string;
    render: (comp: any, parent: HTMLElement, ctx: RenderContext) => void;
}
