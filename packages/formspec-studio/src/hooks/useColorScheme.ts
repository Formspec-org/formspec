/** @filedesc Hook for managing light/dark/system color scheme preference with localStorage persistence. */
import { useContext } from 'react';
import { ColorSchemeContext, type ColorScheme } from '../providers/ColorSchemeProvider';

export type { ThemePreference, ResolvedTheme, ColorScheme } from '../providers/ColorSchemeProvider';

export function useColorScheme(): ColorScheme {
  const ctx = useContext(ColorSchemeContext);
  if (!ctx) throw new Error('useColorScheme must be used within ColorSchemeProvider');
  return ctx;
}
