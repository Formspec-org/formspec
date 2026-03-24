/**
 * Locale command handlers.
 *
 * Locale documents provide translated strings for a form definition.
 * Each locale is keyed by its BCP 47 code in ProjectState.locales.
 *
 * All handlers return `{ rebuildComponentTree: false }` because locale
 * mutations do not alter the definition item tree structure.
 *
 * @module handlers/locale
 */
import type { CommandHandler, ProjectState, LocaleState } from '../types.js';

/** Valid metadata properties that can be set via locale.setMetadata. */
const METADATA_PROPERTIES = new Set(['name', 'title', 'description', 'version', 'url']);

/** Normalize BCP 47: lowercase language, title-case script, uppercase region. */
function normalizeBcp47(code: string): string {
  const parts = code.split('-');
  parts[0] = parts[0].toLowerCase();
  for (let i = 1; i < parts.length; i++) {
    const part = parts[i];
    if (part.length === 2) {
      parts[i] = part.toUpperCase();
    } else if (part.length === 4 && /^[a-zA-Z]+$/.test(part)) {
      parts[i] = part.charAt(0).toUpperCase() + part.slice(1).toLowerCase();
    } else {
      parts[i] = part.toLowerCase();
    }
  }
  return parts.join('-');
}

/** Resolve the target locale from state, using explicit localeId or selectedLocaleId. */
function getLocale(state: ProjectState, localeId?: string): LocaleState {
  const id = localeId || state.selectedLocaleId;
  if (!id) throw new Error('No locale specified and no locale is selected');
  const locale = state.locales[id];
  if (!locale) throw new Error(`Locale not found: ${id}`);
  return locale;
}

export const localeHandlers: Record<string, CommandHandler> = {

  'locale.load': (state, payload) => {
    const { document: doc } = payload as { document: Record<string, unknown> };
    const rawLocale = doc.locale as string;
    if (!rawLocale) throw new Error('Locale document must have a locale field');
    // Normalize BCP 47: lowercase language, title-case script, uppercase region
    // (matches LocaleStore.normalizeCode)
    const locale = normalizeBcp47(rawLocale);

    const localeState: LocaleState = {
      locale,
      version: (doc.version as string) ?? '0.1.0',
      targetDefinition: (doc.targetDefinition as LocaleState['targetDefinition']) ?? { url: '' },
      strings: (doc.strings as Record<string, string>) ?? {},
    };

    // Copy optional metadata fields
    if (doc.fallback !== undefined) localeState.fallback = doc.fallback as string;
    if (doc.name !== undefined) localeState.name = doc.name as string;
    if (doc.title !== undefined) localeState.title = doc.title as string;
    if (doc.description !== undefined) localeState.description = doc.description as string;
    if (doc.url !== undefined) localeState.url = doc.url as string;

    state.locales[locale] = localeState;
    return { rebuildComponentTree: false };
  },

  'locale.remove': (state, payload) => {
    const { localeId } = payload as { localeId: string };
    delete state.locales[localeId];
    if (state.selectedLocaleId === localeId) {
      state.selectedLocaleId = undefined;
    }
    return { rebuildComponentTree: false };
  },

  'locale.select': (state, payload) => {
    const { localeId } = payload as { localeId: string };
    if (!state.locales[localeId]) {
      throw new Error(`Locale not found: ${localeId}`);
    }
    state.selectedLocaleId = localeId;
    return { rebuildComponentTree: false };
  },

  'locale.setString': (state, payload) => {
    const { localeId, key, value } = payload as { localeId?: string; key: string; value: string | null };
    const locale = getLocale(state, localeId);
    if (value === null) {
      delete locale.strings[key];
    } else {
      locale.strings[key] = value;
    }
    return { rebuildComponentTree: false };
  },

  'locale.setStrings': (state, payload) => {
    const { localeId, strings } = payload as { localeId?: string; strings: Record<string, string> };
    const locale = getLocale(state, localeId);
    Object.assign(locale.strings, strings);
    return { rebuildComponentTree: false };
  },

  'locale.removeString': (state, payload) => {
    const { localeId, key } = payload as { localeId?: string; key: string };
    const locale = getLocale(state, localeId);
    delete locale.strings[key];
    return { rebuildComponentTree: false };
  },

  'locale.setMetadata': (state, payload) => {
    const { localeId, property, value } = payload as { localeId?: string; property: string; value: unknown };
    if (!METADATA_PROPERTIES.has(property)) {
      throw new Error(`Invalid locale metadata property: ${property}`);
    }
    const locale = getLocale(state, localeId);
    (locale as any)[property] = value;
    return { rebuildComponentTree: false };
  },

  'locale.setFallback': (state, payload) => {
    const { localeId, fallback } = payload as { localeId?: string; fallback: string | null };
    const locale = getLocale(state, localeId);
    if (fallback === null) {
      delete locale.fallback;
    } else {
      locale.fallback = fallback;
    }
    return { rebuildComponentTree: false };
  },
};
