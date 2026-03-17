/** @filedesc Theme workspace tab composing color, typography, field style, selector, page, and breakpoint sections. */
import { useState } from 'react';
import { HelpTip } from '../../components/ui/HelpTip';
import { WorkspacePage, WorkspacePageSection } from '../../components/ui/WorkspacePage';
import { ColorPalette } from './ColorPalette';
import { TypographySpacing } from './TypographySpacing';
import { AllTokens } from './AllTokens';
import { DefaultFieldStyle } from './DefaultFieldStyle';
import { FieldTypeRules } from './FieldTypeRules';
import { ScreenSizes } from './ScreenSizes';

type ZoneFilter = 'all' | 'brand' | 'presentation' | 'layout';

const ZONE_TABS: { id: ZoneFilter; label: string }[] = [
  { id: 'all', label: 'All Theme' },
  { id: 'brand', label: 'Brand & Colors' },
  { id: 'presentation', label: 'Field Presentation' },
  { id: 'layout', label: 'Layout' },
];

function ThemePillar({
  title,
  subtitle,
  helpText,
  children,
  accentColor = 'bg-accent',
}: {
  title: string;
  subtitle: string;
  helpText: string;
  children: React.ReactNode;
  accentColor?: string;
}) {
  return (
    <div className="mb-12 last:mb-0 group animate-in fade-in slide-in-from-bottom-2 duration-500">
      <header className="mb-6">
        <div className="flex items-center gap-3 mb-1">
          <div className={`w-1 h-5 rounded-full ${accentColor}`} />
          <h3 className="font-mono text-[13px] font-bold tracking-[0.2em] uppercase text-ink">
            {title}
          </h3>
        </div>
        <div className="flex items-center gap-2 pl-4">
          <HelpTip text={helpText}>
            <span className="text-[12px] text-muted italic tracking-tight">{subtitle}</span>
          </HelpTip>
        </div>
      </header>
      <div className="pl-6 border-l border-border/60 ml-0.5 mt-4">
        {children}
      </div>
    </div>
  );
}

export function ThemeTab() {
  const [zoneFilter, setZoneFilter] = useState<ZoneFilter>('all');

  const showBrand = zoneFilter === 'all' || zoneFilter === 'brand';
  const showPresentation = zoneFilter === 'all' || zoneFilter === 'presentation';
  const showLayout = zoneFilter === 'all' || zoneFilter === 'layout';

  return (
    <WorkspacePage className="overflow-y-auto">
      <WorkspacePageSection
        padding="px-7"
        className="sticky top-0 bg-bg-default/80 backdrop-blur-md z-20 pt-6 pb-2 border-b border-border/40"
      >
        <div className="flex items-center gap-1.5 p-1 bg-subtle/50 rounded-[8px] border border-border/50 w-fit">
          {ZONE_TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setZoneFilter(tab.id)}
              className={`px-3 py-1.5 text-[12px] font-bold uppercase tracking-wider rounded-[6px] transition-all duration-200 ${
                zoneFilter === tab.id
                  ? 'bg-ink text-white shadow-sm'
                  : 'text-muted hover:text-ink hover:bg-subtle'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </WorkspacePageSection>

      <WorkspacePageSection className="flex-1 py-10">
        {showBrand && (
          <ThemePillar
            title="Color Palette"
            subtitle="Your form's color identity"
            helpText="Define the primary, error, warning, success, and custom colors that brand your form."
            accentColor="bg-accent"
          >
            <ColorPalette />
          </ThemePillar>
        )}

        {showBrand && (
          <ThemePillar
            title="Typography & Spacing"
            subtitle="Fonts, sizes, and whitespace"
            helpText="Set font families, base sizes, spacing scale, and border styles for consistent visual rhythm."
            accentColor="bg-logic"
          >
            <TypographySpacing />
          </ThemePillar>
        )}

        {showBrand && (
          <ThemePillar
            title="All Tokens"
            subtitle="Full design token reference"
            helpText="View and edit every design token in the theme — colors, typography, spacing, and custom values."
            accentColor="bg-muted"
          >
            <AllTokens />
          </ThemePillar>
        )}

        {showPresentation && (
          <ThemePillar
            title="Default Field Style"
            subtitle="Baseline look for every field"
            helpText="Set the default label position, widget, CSS class, and style properties that apply to all fields unless overridden."
            accentColor="bg-green-500"
          >
            <DefaultFieldStyle />
          </ThemePillar>
        )}

        {showPresentation && (
          <ThemePillar
            title="Field Type Rules"
            subtitle="Automatic styling by field type"
            helpText="Define selector rules that automatically apply widgets and styles based on field type and data type. Rules cascade in order."
            accentColor="bg-amber-500"
          >
            <FieldTypeRules />
          </ThemePillar>
        )}

        {showLayout && (
          <ThemePillar
            title="Screen Sizes"
            subtitle="Responsive viewport breakpoints"
            helpText="Define named breakpoints for responsive form layouts. Breakpoints control when the form adapts to different screen sizes."
            accentColor="bg-logic"
          >
            <ScreenSizes />
          </ThemePillar>
        )}
      </WorkspacePageSection>
    </WorkspacePage>
  );
}
