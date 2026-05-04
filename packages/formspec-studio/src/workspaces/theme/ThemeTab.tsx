/** @filedesc Theme workspace tab composing ColorPalette, TypographySpacing, DefaultFieldStyle, and other theme panels. */
import { ColorPalette } from './ColorPalette';
import { TypographySpacing } from './TypographySpacing';
import { DefaultFieldStyle } from './DefaultFieldStyle';
import { FieldTypeRules } from './FieldTypeRules';
import { ScreenSizes } from './ScreenSizes';
import { AllTokens } from './AllTokens';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { Pillar } from '../shared/Pillar';
import { SectionFilterBar } from '../shared/SectionFilterBar';
import { useControllableState } from '../../hooks/useControllableState';

const sectionTabs = [
  { id: 'all', label: 'All Theme' },
  { id: 'colors', label: 'Colors' },
  { id: 'typography', label: 'Typography' },
  { id: 'fields', label: 'Fields' },
  { id: 'breakpoints', label: 'Breakpoints' },
  { id: 'tokens', label: 'Tokens' },
] as const;

export type ThemeSectionFilter = typeof sectionTabs[number]['id'];

interface ThemeTabProps {
  sectionFilter?: ThemeSectionFilter;
  onSectionFilterChange?: (filter: ThemeSectionFilter) => void;
}

export function ThemeTab({ sectionFilter: controlledFilter, onSectionFilterChange }: ThemeTabProps = {}) {
  const [sectionFilter, setSectionFilter] = useControllableState(controlledFilter, onSectionFilterChange, 'all' as ThemeSectionFilter);

  const showColors = sectionFilter === 'all' || sectionFilter === 'colors';
  const showTypography = sectionFilter === 'all' || sectionFilter === 'typography';
  const showFields = sectionFilter === 'all' || sectionFilter === 'fields';
  const showBreakpoints = sectionFilter === 'all' || sectionFilter === 'breakpoints';
  const showTokens = sectionFilter === 'all' || sectionFilter === 'tokens';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection padding="px-8" className="sticky top-0 bg-surface z-20 pt-6 pb-2 border-b border-border shadow-sm">
        <SectionFilterBar
          tabs={sectionTabs}
          activeTab={sectionFilter}
          onTabChange={setSectionFilter}
          ariaLabel="Theme section filter"
        />
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-12 px-8">
        {showColors && (
          <Pillar
            title="Color Palette"
            subtitle="Brand colors and semantic assignments"
            helpText="Define primary, accent, and semantic colors for your form."
            accentColor="bg-accent"
          >
            <ColorPalette />
          </Pillar>
        )}

        {showTypography && (
          <Pillar
            title="Typography & Spacing"
            subtitle="Fonts, scales, and layout rhythm"
            helpText="Control text sizing, weights, and global spacing increments."
            accentColor="bg-logic"
          >
            <TypographySpacing />
          </Pillar>
        )}

        {showFields && (
          <>
            <Pillar
              title="Field Defaults"
              subtitle="Default styles for all input components"
              helpText="Global defaults for borders, padding, and corner radius."
              accentColor="bg-teal"
            >
              <DefaultFieldStyle />
            </Pillar>
            <Pillar
              title="Field Type Rules"
              subtitle="Specialized styles by data type"
              helpText="Override defaults for specific input types like dates or currency."
              accentColor="bg-teal/70"
            >
              <FieldTypeRules />
            </Pillar>
          </>
        )}

        {showBreakpoints && (
          <Pillar
            title="Breakpoints"
            subtitle="Responsive layout screen sizes"
            helpText="Define the screen widths used for responsive layout changes."
            accentColor="bg-amber"
          >
            <ScreenSizes />
          </Pillar>
        )}

        {showTokens && (
          <Pillar
            title="All Design Tokens"
            subtitle="Raw design token registry"
            helpText="Low-level access to every design token in the theme."
            accentColor="bg-muted"
          >
            <AllTokens />
          </Pillar>
        )}

      </WorkspacePageSection>
    </WorkspacePage>
  );
}
