/** @filedesc Registers all built-in component plugins with the global registry. */
import { globalRegistry } from '../registry';
import { defaultAdapter } from '../adapters/default/index';
import { PagePlugin, StackPlugin, GridPlugin, DividerPlugin, CollapsiblePlugin, ColumnsPlugin, PanelPlugin, AccordionPlugin, ModalPlugin, PopoverPlugin } from './layout';
import { InputPlugins } from './inputs';
import { HeadingPlugin, TextPlugin, CardPlugin, SpacerPlugin, AlertPlugin, BadgePlugin, ProgressBarPlugin, SummaryPlugin, ValidationSummaryPlugin } from './display';
import { TabsPlugin, SubmitButtonPlugin } from './interactive';
import { ConditionalGroupPlugin, DataTablePlugin } from './special';

/**
 * Registers all 36 built-in component plugins with the global registry.
 * Includes layout (10), input (13), display (9), interactive (2), and special (2) plugins.
 * Wizard behavior is driven by formPresentation.pageMode, not a component plugin.
 */
export function registerDefaultComponents() {
    globalRegistry.register(PagePlugin);
    globalRegistry.register(StackPlugin);
    globalRegistry.register(GridPlugin);
    globalRegistry.register(DividerPlugin);
    globalRegistry.register(CollapsiblePlugin);
    globalRegistry.register(ColumnsPlugin);
    globalRegistry.register(PanelPlugin);
    globalRegistry.register(AccordionPlugin);
    globalRegistry.register(ModalPlugin);
    globalRegistry.register(PopoverPlugin);
    InputPlugins.forEach(p => globalRegistry.register(p));
    globalRegistry.register(HeadingPlugin);
    globalRegistry.register(TextPlugin);
    globalRegistry.register(CardPlugin);
    globalRegistry.register(SpacerPlugin);
    globalRegistry.register(AlertPlugin);
    globalRegistry.register(BadgePlugin);
    globalRegistry.register(ProgressBarPlugin);
    globalRegistry.register(SummaryPlugin);
    globalRegistry.register(TabsPlugin);
    globalRegistry.register(SubmitButtonPlugin);
    globalRegistry.register(ValidationSummaryPlugin);
    globalRegistry.register(ConditionalGroupPlugin);
    globalRegistry.register(DataTablePlugin);
    globalRegistry.registerAdapter(defaultAdapter);
}
