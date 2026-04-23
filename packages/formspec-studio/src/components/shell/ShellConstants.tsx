import React from 'react';
import { StructureTree } from '../blueprint/StructureTree';
import { ComponentTree } from '../blueprint/ComponentTree';
import { ScreenerSummary } from '../blueprint/ScreenerSummary';
import { VariablesList } from '../blueprint/VariablesList';
import { DataSourcesList } from '../blueprint/DataSourcesList';
import { OptionSetsList } from '../blueprint/OptionSetsList';
import { MappingsList } from '../blueprint/MappingsList';
import { SettingsSection } from '../blueprint/SettingsSection';
import { ThemeOverview } from '../blueprint/ThemeOverview';

import { ColorPalette } from '../../workspaces/theme/ColorPalette';
import { TypographySpacing } from '../../workspaces/theme/TypographySpacing';
import { DefaultFieldStyle } from '../../workspaces/theme/DefaultFieldStyle';
import { FieldTypeRules } from '../../workspaces/theme/FieldTypeRules';
import { ScreenSizes } from '../../workspaces/theme/ScreenSizes';
import { AllTokens } from '../../workspaces/theme/AllTokens';
import { ThemeTab } from '../../workspaces/theme/ThemeTab';

import { LayoutCanvas as LayoutWorkspace } from '../../workspaces/layout/LayoutCanvas';
import { MappingTab } from '../../workspaces/mapping/MappingTab';
import { PreviewTab } from '../../workspaces/preview/PreviewTab';

export const WORKSPACES: Record<string, React.FC<any>> = {
  Layout: LayoutWorkspace,
  Theme: ThemeTab,
  Mapping: MappingTab,
  Preview: PreviewTab,
};

export const SIDEBAR_COMPONENTS: Record<string, React.FC<any>> = {
  'Structure': StructureTree,
  'Component Tree': ComponentTree,
  'Screener': ScreenerSummary,
  'Variables': VariablesList,
  'Data Sources': DataSourcesList,
  'Option Sets': OptionSetsList,
  'Mappings': MappingsList,
  'Settings': SettingsSection,
  'Theme': ThemeOverview,
  'Colors': ColorPalette,
  'Typography': TypographySpacing,
  'Field Defaults': DefaultFieldStyle,
  'Field Rules': FieldTypeRules,
  'Breakpoints': ScreenSizes,
  'All Tokens': AllTokens,
};

export const THEME_MODE_BLUEPRINT_SECTIONS = [
  'Colors',
  'Typography',
  'Field Defaults',
  'Field Rules',
  'Breakpoints',
  'All Tokens',
  'Settings'
];

export const BLUEPRINT_SECTIONS_BY_TAB: Record<string, string[]> = {
  Editor: ['Structure', 'Variables', 'Data Sources', 'Option Sets', 'Screener', 'Settings'],
  Layout: ['Structure', 'Component Tree', 'Screener', 'Variables', 'Data Sources', 'Option Sets', 'Mappings', 'Settings', 'Theme'],
  Theme: THEME_MODE_BLUEPRINT_SECTIONS,
  Mapping: ['Mappings', 'Structure', 'Data Sources', 'Option Sets', 'Settings'],
  Preview: ['Structure', 'Component Tree', 'Theme', 'Settings'],
};
