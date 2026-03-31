/** @filedesc Command handlers for screener presence, items, binds, and routing rules. */
import type { CommandHandler } from '../types.js';
import type { FormDefinition, FormItem } from '@formspec-org/types';

function getEnabledScreener(state: { definition: FormDefinition }) {
  const screener = state.definition.screener;
  if (!screener) {
    throw new Error('Screener is not enabled');
  }
  return screener;
}

const SCREENER_ITEM_ALLOWED_PROPS = new Set(['label', 'helpText', 'dataType', 'options', 'presentation']);
const ROUTE_ALLOWED_PROPS = new Set(['condition', 'target', 'label', 'message']);

export const definitionScreenerHandlers: Record<string, CommandHandler> = {

  'definition.setScreener': (state, payload) => {
    const { enabled } = payload as { enabled: boolean };

    if (enabled) {
      if (!state.definition.screener) {
        state.definition.screener = { items: [], routes: [] };
      }
    } else {
      delete state.definition.screener;
    }

    return { rebuildComponentTree: false };
  },

  'definition.addScreenerItem': (state, payload) => {
    const p = payload as Record<string, unknown>;
    const screener = getEnabledScreener(state);
    type ItemType = FormItem['type'];
    type FieldDataType = NonNullable<FormItem['dataType']>;

    const item: FormItem = {
      type: p.type as ItemType,
      key: p.key as string,
      label: (p.label as string) ?? '',
    };
    if (p.dataType) item.dataType = p.dataType as FieldDataType;

    screener.items.push(item);
    return { rebuildComponentTree: false };
  },

  'definition.deleteScreenerItem': (state, payload) => {
    const { key } = payload as { key: string };
    const screener = getEnabledScreener(state);

    screener.items = screener.items.filter(it => it.key !== key);

    // Clean up screener binds referencing deleted item
    if (screener.binds) {
      screener.binds = screener.binds.filter((b: any) => b.path !== key);
      if (screener.binds.length === 0) delete screener.binds;
    }

    return { rebuildComponentTree: false };
  },

  'definition.setScreenerBind': (state, payload) => {
    const { path, properties } = payload as { path: string; properties: Record<string, unknown> };
    const screener = getEnabledScreener(state);

    if (!screener.binds) screener.binds = [];

    let bind = screener.binds.find((b: any) => b.path === path) as any;
    if (!bind) {
      bind = { path };
      screener.binds.push(bind);
    }

    for (const [key, value] of Object.entries(properties)) {
      if (value === null) {
        delete bind[key];
      } else {
        bind[key] = value;
      }
    }

    return { rebuildComponentTree: false };
  },

  'definition.addRoute': (state, payload) => {
    const p = payload as { condition: string; target: string; label?: string; message?: string; insertIndex?: number };
    const screener = getEnabledScreener(state);

    const route: any = { condition: p.condition, target: p.target };
    if (p.label) route.label = p.label;
    if (p.message) route.message = p.message;

    if (p.insertIndex !== undefined) {
      screener.routes.splice(p.insertIndex, 0, route);
    } else {
      screener.routes.push(route);
    }

    return { rebuildComponentTree: false };
  },

  'definition.setRouteProperty': (state, payload) => {
    const { index, property, value } = payload as { index: number; property: string; value: unknown };
    if (!ROUTE_ALLOWED_PROPS.has(property)) throw new Error(`Cannot set route property: ${property}`);
    const screener = getEnabledScreener(state);

    const route = screener.routes[index];
    if (!route) throw new Error(`Route not found at index: ${index}`);

    if (value === undefined || value === null) {
      delete (route as any)[property];
    } else {
      (route as any)[property] = value;
    }
    return { rebuildComponentTree: false };
  },

  'definition.deleteRoute': (state, payload) => {
    const { index } = payload as { index: number };
    const screener = getEnabledScreener(state);

    if (screener.routes.length <= 1) {
      throw new Error('Cannot delete the last route');
    }

    screener.routes.splice(index, 1);
    return { rebuildComponentTree: false };
  },

  'definition.setScreenerItemProperty': (state, payload) => {
    const { key, property, value } = payload as { key: string; property: string; value: unknown };
    if (!SCREENER_ITEM_ALLOWED_PROPS.has(property)) throw new Error(`Cannot set screener item property: ${property}`);
    const screener = getEnabledScreener(state);
    const item = screener.items.find(it => it.key === key);
    if (!item) throw new Error(`Screener item not found: ${key}`);
    if (value === undefined || value === null) {
      delete (item as any)[property];
    } else {
      (item as any)[property] = value;
    }
    return { rebuildComponentTree: false };
  },

  'definition.reorderScreenerItem': (state, payload) => {
    const { index, direction } = payload as { index: number; direction: 'up' | 'down' };
    const screener = getEnabledScreener(state);
    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= screener.items.length) return { rebuildComponentTree: false };
    [screener.items[index], screener.items[targetIdx]] = [screener.items[targetIdx], screener.items[index]];
    return { rebuildComponentTree: false };
  },

  'definition.reorderRoute': (state, payload) => {
    const { index, direction } = payload as { index: number; direction: 'up' | 'down' };
    const screener = getEnabledScreener(state);

    const targetIdx = direction === 'up' ? index - 1 : index + 1;
    if (targetIdx < 0 || targetIdx >= screener.routes.length) return { rebuildComponentTree: false };

    [screener.routes[index], screener.routes[targetIdx]] = [screener.routes[targetIdx], screener.routes[index]];
    return { rebuildComponentTree: false };
  },
};
