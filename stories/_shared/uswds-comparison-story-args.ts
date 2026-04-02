/** @filedesc Builds USWDSSideBySideStory args; merges adapter hydration from uswds-comparison-presets by title. */
import type { USWDSSideBySideStoryProps } from './USWDSSideBySideStory';
import { getAdapterHydrationForDefinition } from './uswds-comparison-presets';

const DEFAULT_MAX_WIDTH = 1400;

/**
 * Args for adapter vs Real USWDS stories. Hydration (`initialData`, `touchAll`) is inferred from
 * `definition.title` when it matches a comparison preset unless overridden.
 */
export function uswdsComparisonArgs(options: {
    definition: any;
    componentDocument?: any;
    /** Default false — use true for validation demos and wizard submit UX. */
    showSubmit?: boolean;
    maxWidth?: number;
    initialData?: Record<string, any>;
    touchAll?: boolean;
}): USWDSSideBySideStoryProps {
    const fromPreset = getAdapterHydrationForDefinition(options.definition);
    return {
        definition: options.definition,
        componentDocument: options.componentDocument,
        showSubmit: options.showSubmit ?? false,
        maxWidth: options.maxWidth ?? DEFAULT_MAX_WIDTH,
        initialData: options.initialData !== undefined ? options.initialData : fromPreset.initialData,
        touchAll: options.touchAll !== undefined ? options.touchAll : fromPreset.touchAll ?? false,
    };
}
