/** @filedesc Package entry point: registers components and re-exports public API. */
// Side effects — layout is always loaded; default provides visual styling
import './formspec-layout.css';
import './formspec-default.css';
import { initFormspecEngine } from 'formspec-engine';
import { registerDefaultComponents } from './components';

/** Start WASM load as soon as the package is imported (FormEngine needs it before construction). */
void initFormspecEngine();
registerDefaultComponents();

/** Await before setting `definition` if you need the engine to exist synchronously (e.g. immediate `getEngine()` / `setValue`). */
export { initFormspecEngine } from 'formspec-engine';

// Main class
export { FormspecRender } from './element';

// Registry
export { ComponentRegistry, globalRegistry } from './registry';

// Utilities
export { formatMoney } from './format';

// Re-exports from formspec-layout
export { resolvePresentation, resolveWidget, interpolateParams, resolveResponsiveProps, resolveToken, getDefaultComponent } from 'formspec-layout';
export type { ThemeDocument, PresentationBlock, ItemDescriptor, AccessibilityBlock, ThemeSelector, SelectorMatch, Tier1Hints, FormspecDataType, Page, Region, LayoutHints, StyleHints } from 'formspec-layout';

// Types
export type { RenderContext, ComponentPlugin, ValidationTargetMetadata, ScreenerRoute, ScreenerRouteType, ScreenerStateSnapshot } from './types';

// Default theme
import defaultThemeJson from './default-theme.json';
export { defaultThemeJson as defaultTheme };

// Headless adapter public API
export type { RenderAdapter, AdapterRenderFn, AdapterContext } from './adapters/types';
export { createSignatureCanvas } from './adapters/signature-canvas';
export type { SignatureCanvasConfig, SignatureCanvasResult } from './adapters/signature-canvas';
export type {
    FieldBehavior, FieldRefs, ResolvedPresentationBlock, BehaviorContext,
    TextInputBehavior, NumberInputBehavior, RadioGroupBehavior,
    CheckboxGroupBehavior, SelectBehavior, ToggleBehavior,
    DatePickerBehavior, MoneyInputBehavior, SliderBehavior,
    RatingBehavior, FileUploadBehavior, SignatureBehavior,
    WizardBehavior, WizardRefs, WizardSidenavItemRefs, WizardProgressItemRefs,
    TabsBehavior, TabsRefs,
} from './behaviors/types';
