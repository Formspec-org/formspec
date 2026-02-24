import { globalRegistry } from '../registry';
import { PagePlugin, StackPlugin, GridPlugin, DividerPlugin, CollapsiblePlugin, ColumnsPlugin, PanelPlugin, AccordionPlugin, ModalPlugin } from './layout';
import { InputPlugins } from './inputs';
import { HeadingPlugin, TextPlugin, CardPlugin, SpacerPlugin, AlertPlugin, BadgePlugin, ProgressBarPlugin, SummaryPlugin } from './display';
import { WizardPlugin, TabsPlugin } from './interactive';
import { ConditionalGroupPlugin, DataTablePlugin } from './special';

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
    InputPlugins.forEach(p => globalRegistry.register(p));
    globalRegistry.register(HeadingPlugin);
    globalRegistry.register(TextPlugin);
    globalRegistry.register(CardPlugin);
    globalRegistry.register(SpacerPlugin);
    globalRegistry.register(AlertPlugin);
    globalRegistry.register(BadgePlugin);
    globalRegistry.register(ProgressBarPlugin);
    globalRegistry.register(SummaryPlugin);
    globalRegistry.register(WizardPlugin);
    globalRegistry.register(TabsPlugin);
    globalRegistry.register(ConditionalGroupPlugin);
    globalRegistry.register(DataTablePlugin);
}
