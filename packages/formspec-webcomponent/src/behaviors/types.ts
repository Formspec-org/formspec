/** @filedesc Core behavior contract types for the headless component architecture. */
import type { Signal } from '@preact/signals-core';
import type { FormEngine } from 'formspec-engine';
import type { PresentationBlock, ItemDescriptor } from 'formspec-layout';

/**
 * Pre-resolved PresentationBlock — all $token. references already
 * substituted with concrete values. Adapters never need token resolution.
 */
export interface ResolvedPresentationBlock {
    widget?: string;
    widgetConfig?: Record<string, any>;
    labelPosition?: 'top' | 'start' | 'hidden';
    style?: Record<string, string>;
    accessibility?: { role?: string; description?: string; liveRegion?: string };
    cssClass?: string | string[];
    fallback?: string[];
}

export interface FieldRefs {
    root: HTMLElement;
    label: HTMLElement;
    control: HTMLElement;
    hint?: HTMLElement;
    error?: HTMLElement;
    optionControls?: Map<string, HTMLInputElement>;
    rebuildOptions?: (
        container: HTMLElement,
        options: ReadonlyArray<{ value: string; label: string }>
    ) => Map<string, HTMLInputElement>;
}

/** Returned by every field behavior hook. */
export interface FieldBehavior {
    fieldPath: string;
    id: string;
    label: string;
    hint: string | null;
    description: string | null;
    presentation: ResolvedPresentationBlock;
    widgetClassSlots: { root?: unknown; label?: unknown; control?: unknown; hint?: unknown; error?: unknown };
    compOverrides: {
        cssClass?: any;
        style?: any;
        accessibility?: any;
    };
    remoteOptionsState: { loading: boolean; error: string | null };
    options(): ReadonlyArray<{ value: string; label: string }>;
    bind(refs: FieldRefs): () => void;
}

export interface RadioGroupBehavior extends FieldBehavior {
    groupRole: 'radiogroup';
    inputName: string;
    orientation?: string;
}

export interface CheckboxGroupBehavior extends FieldBehavior {
    groupRole: 'group';
    selectAll: boolean;
    columns?: number;
    setValue(val: any): void;
}

export interface SelectBehavior extends FieldBehavior {
    placeholder?: string;
    clearable?: boolean;
}

export interface ToggleBehavior extends FieldBehavior {
    onLabel?: string;
    offLabel?: string;
}

export interface TextInputBehavior extends FieldBehavior {
    placeholder?: string;
    inputMode?: string;
    maxLines?: number;
    prefix?: string;
    suffix?: string;
    resolvedInputType?: string;
    extensionAttrs: Record<string, string>;
}

export interface NumberInputBehavior extends FieldBehavior {
    min?: number;
    max?: number;
    step?: number;
    dataType: string;
}

export interface DatePickerBehavior extends FieldBehavior {
    inputType: string;
    minDate?: string;
    maxDate?: string;
}

export interface MoneyInputBehavior extends FieldBehavior {
    min?: number;
    max?: number;
    step?: number;
    placeholder?: string;
    resolvedCurrency: string | null;
}

export interface SliderBehavior extends FieldBehavior {
    min?: number;
    max?: number;
    step?: number;
    showTicks: boolean;
    showValue: boolean;
}

export interface RatingBehavior extends FieldBehavior {
    maxRating: number;
    icon: string;
    allowHalf: boolean;
    isInteger: boolean;
    setValue(value: number): void;
}

export interface FileUploadBehavior extends FieldBehavior {
    accept?: string;
    multiple: boolean;
    dragDrop: boolean;
}

export interface SignatureBehavior extends FieldBehavior {
    height: number;
    strokeColor: string;
}

export interface WizardRefs {
    root: HTMLElement;
    stepIndicators?: HTMLElement[];
    stepContent: HTMLElement;
    prevButton?: HTMLButtonElement;
    nextButton?: HTMLButtonElement;
}

export interface WizardBehavior {
    steps: ReadonlyArray<{ id: string; title: string }>;
    showSideNav: boolean;
    showProgress: boolean;
    allowSkip: boolean;
    activeStep(): number;
    totalSteps(): number;
    canGoNext(): boolean;
    canGoPrev(): boolean;
    goNext(): void;
    goPrev(): void;
    goToStep(index: number): void;
    renderStep(index: number, parent: HTMLElement): void;
    bind(refs: WizardRefs): () => void;
}

export interface TabsRefs {
    root: HTMLElement;
    tabBar: HTMLElement;
    panels: HTMLElement[];
    buttons: HTMLButtonElement[];
}

export interface TabsBehavior {
    tabLabels: string[];
    position: 'top' | 'bottom';
    defaultTab: number;
    activeTab(): number;
    setActiveTab(index: number): void;
    renderTab(index: number, parent: HTMLElement): void;
    bind(refs: TabsRefs): () => void;
}

/**
 * Context passed to behavior hooks. Subset of RenderContext
 * focused on what behaviors actually need.
 */
export interface BehaviorContext {
    engine: FormEngine;
    prefix: string;
    cleanupFns: Array<() => void>;
    touchedFields: Set<string>;
    touchedVersion: Signal<number>;
    latestSubmitDetailSignal: Signal<any>;
    resolveToken: (val: any) => any;
    resolveItemPresentation: (item: ItemDescriptor) => PresentationBlock;
    resolveWidgetClassSlots: (presentation: PresentationBlock) => {
        root?: unknown; label?: unknown; control?: unknown; hint?: unknown; error?: unknown;
    };
    findItemByKey: (key: string) => any | null;
    renderComponent: (comp: any, parent: HTMLElement, prefix?: string) => void;
    submit: (options?: any) => any;
    registryEntries: Map<string, any>;
    rerender: () => void;
}
