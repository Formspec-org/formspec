import type { Signal } from '@preact/signals';
import { NumberInput } from '../controls/NumberInput';
import { TextInput } from '../controls/TextInput';
import { Toggle } from '../controls/Toggle';
import { setThemePages } from '../../state/mutations';
import type {
  FormspecThemePage,
  ProjectState,
  ThemePageRegion,
  ThemePageRegionResponsiveOverride
} from '../../state/project';

export interface PageLayoutEditorProps {
  project: Signal<ProjectState>;
}

export function PageLayoutEditor(props: PageLayoutEditorProps) {
  const pages = props.project.value.theme.pages ?? [];
  const breakpoints = Object.entries(props.project.value.theme.breakpoints ?? {}).sort((left, right) => left[1] - right[1]);
  const getPages = () => props.project.value.theme.pages ?? [];

  const updatePages = (nextPages: FormspecThemePage[]) => {
    setThemePages(props.project, nextPages.length > 0 ? nextPages : undefined);
  };

  const updatePage = (pageIndex: number, patch: Partial<FormspecThemePage>) => {
    updatePages(
      getPages().map((page, index) => (index === pageIndex ? { ...page, ...patch } : page))
    );
  };

  const updateRegion = (pageIndex: number, regionIndex: number, patch: Partial<ThemePageRegion>) => {
    updatePages(
      getPages().map((page, index) => {
        if (index !== pageIndex) {
          return page;
        }
        const nextRegions = (page.regions ?? []).map((region, innerIndex) =>
          innerIndex === regionIndex ? { ...region, ...patch } : region
        );
        return {
          ...page,
          regions: nextRegions
        };
      })
    );
  };

  const updateRegionResponsiveOverride = (
    pageIndex: number,
    regionIndex: number,
    breakpointName: string,
    patch: Partial<ThemePageRegionResponsiveOverride>
  ) => {
    const currentPages = getPages();
    const page = currentPages[pageIndex];
    const region = page?.regions?.[regionIndex];
    if (!page || !region) {
      return;
    }

    const responsive = { ...(region.responsive ?? {}) };
    const nextOverride = { ...(responsive[breakpointName] ?? {}) };

    if ('span' in patch) {
      if (typeof patch.span === 'number') {
        nextOverride.span = patch.span;
      } else {
        delete nextOverride.span;
      }
    }
    if ('start' in patch) {
      if (typeof patch.start === 'number') {
        nextOverride.start = patch.start;
      } else {
        delete nextOverride.start;
      }
    }
    if ('hidden' in patch) {
      if (patch.hidden === true) {
        nextOverride.hidden = true;
      } else {
        delete nextOverride.hidden;
      }
    }

    if (Object.keys(nextOverride).length === 0) {
      delete responsive[breakpointName];
    } else {
      responsive[breakpointName] = nextOverride;
    }

    updateRegion(pageIndex, regionIndex, {
      responsive: Object.keys(responsive).length > 0 ? responsive : undefined
    });
  };

  return (
    <div class="theme-pages-editor" data-testid="theme-pages-editor">
      {pages.length === 0 ? <p class="inspector-hint">No theme pages defined.</p> : null}

      {pages.map((page, pageIndex) => (
        <article class="theme-pages-editor__page" key={`${page.id || 'page'}-${pageIndex}`}>
          <div class="theme-pages-editor__header">
            <p class="theme-pages-editor__title">Page {pageIndex + 1}</p>
            <button
              type="button"
              class="selector-rules__remove"
              data-testid={`theme-page-remove-${pageIndex}`}
              onClick={() => {
                updatePages(getPages().filter((_, index) => index !== pageIndex));
              }}
            >
              Remove
            </button>
          </div>

          <TextInput
            label="Page ID"
            value={page.id}
            testId={`theme-page-id-${pageIndex}`}
            onInput={(value) => {
              updatePage(pageIndex, { id: value });
            }}
          />
          <TextInput
            label="Title"
            value={page.title}
            testId={`theme-page-title-${pageIndex}`}
            onInput={(value) => {
              updatePage(pageIndex, { title: value });
            }}
          />
          <TextInput
            label="Description"
            value={page.description}
            testId={`theme-page-description-${pageIndex}`}
            onInput={(value) => {
              updatePage(pageIndex, { description: value || undefined });
            }}
          />

          <div class="theme-pages-editor__regions">
            <div class="theme-pages-editor__region-header">
              <p class="theme-pages-editor__subtitle">Regions</p>
              <button
                type="button"
                class="selector-rules__add"
                data-testid={`theme-page-add-region-${pageIndex}`}
                onClick={() => {
                  const currentPages = getPages();
                  const currentPage = currentPages[pageIndex];
                  updatePage(pageIndex, {
                    regions: [...(currentPage?.regions ?? []), { key: '', span: 12 }]
                  });
                }}
              >
                Add region
              </button>
            </div>

            {(page.regions ?? []).map((region, regionIndex) => (
              <div class="theme-pages-editor__region" key={`${pageIndex}-${regionIndex}`}>
                <div class="theme-pages-editor__region-actions">
                  <p class="theme-pages-editor__subtitle">Region {regionIndex + 1}</p>
                  <button
                    type="button"
                    class="selector-rules__remove"
                    data-testid={`theme-page-remove-region-${pageIndex}-${regionIndex}`}
                    onClick={() => {
                      const currentPages = getPages();
                      const currentPage = currentPages[pageIndex];
                      updatePage(pageIndex, {
                        regions: (currentPage?.regions ?? []).filter((_, index) => index !== regionIndex)
                      });
                    }}
                  >
                    Remove
                  </button>
                </div>

                <TextInput
                  label="Item key"
                  value={region.key}
                  testId={`theme-page-region-key-${pageIndex}-${regionIndex}`}
                  onInput={(value) => {
                    updateRegion(pageIndex, regionIndex, { key: value });
                  }}
                />
                <div class="theme-pages-editor__region-grid">
                  <NumberInput
                    label="Span (1-12)"
                    value={region.span}
                    min={1}
                    max={12}
                    testId={`theme-page-region-span-${pageIndex}-${regionIndex}`}
                    onInput={(value) => {
                      updateRegion(pageIndex, regionIndex, { span: value });
                    }}
                  />
                  <NumberInput
                    label="Start (1-12)"
                    value={region.start}
                    min={1}
                    max={12}
                    testId={`theme-page-region-start-${pageIndex}-${regionIndex}`}
                    onInput={(value) => {
                      updateRegion(pageIndex, regionIndex, { start: value });
                    }}
                  />
                </div>

                {breakpoints.length > 0 ? (
                  <div class="theme-pages-editor__responsive">
                    {breakpoints.map(([breakpointName, minWidth]) => {
                      const override = region.responsive?.[breakpointName] ?? {};
                      return (
                        <div class="theme-pages-editor__breakpoint" key={breakpointName}>
                          <p class="theme-pages-editor__breakpoint-title">{breakpointName} ({minWidth}px)</p>
                          <div class="theme-pages-editor__region-grid">
                            <NumberInput
                              label="Span"
                              value={override.span}
                              min={1}
                              max={12}
                              testId={`theme-page-region-responsive-span-${pageIndex}-${regionIndex}-${breakpointName}`}
                              onInput={(value) => {
                                updateRegionResponsiveOverride(pageIndex, regionIndex, breakpointName, { span: value });
                              }}
                            />
                            <NumberInput
                              label="Start"
                              value={override.start}
                              min={1}
                              max={12}
                              testId={`theme-page-region-responsive-start-${pageIndex}-${regionIndex}-${breakpointName}`}
                              onInput={(value) => {
                                updateRegionResponsiveOverride(pageIndex, regionIndex, breakpointName, { start: value });
                              }}
                            />
                          </div>
                          <Toggle
                            label="Hidden"
                            checked={override.hidden === true}
                            testId={`theme-page-region-responsive-hidden-${pageIndex}-${regionIndex}-${breakpointName}`}
                            onToggle={(value) => {
                              updateRegionResponsiveOverride(pageIndex, regionIndex, breakpointName, { hidden: value ? true : undefined });
                            }}
                          />
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p class="inspector-hint">Define breakpoints to add responsive region overrides.</p>
                )}
              </div>
            ))}
          </div>
        </article>
      ))}

      <button
        type="button"
        class="variables-panel__add"
        data-testid="theme-page-add-button"
        onClick={() => {
          updatePages([
            ...getPages(),
            {
              id: '',
              title: '',
              regions: []
            }
          ]);
        }}
      >
        + Add page
      </button>
    </div>
  );
}
