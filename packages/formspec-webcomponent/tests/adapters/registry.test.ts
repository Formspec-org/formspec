import { describe, it, expect, vi } from 'vitest';
import { ComponentRegistry } from '../../src/registry';
import type { RenderAdapter } from '../../src/adapters/types';

describe('ComponentRegistry adapter support', () => {
    it('registers and resolves an adapter', () => {
        const reg = new ComponentRegistry();
        const adapter: RenderAdapter = {
            name: 'test',
            components: { TextInput: () => {} },
        };
        reg.registerAdapter(adapter);
        reg.setAdapter('test');
        expect(reg.resolveAdapterFn('TextInput')).toBeDefined();
    });

    it('falls back to default adapter when active adapter lacks component', () => {
        const reg = new ComponentRegistry();
        const defaultAdapter: RenderAdapter = {
            name: 'default',
            components: { TextInput: () => {} },
        };
        const custom: RenderAdapter = {
            name: 'custom',
            components: { Select: () => {} },
        };
        reg.registerAdapter(defaultAdapter);
        reg.registerAdapter(custom);
        reg.setAdapter('custom');
        expect(reg.resolveAdapterFn('TextInput')).toBe(defaultAdapter.components.TextInput);
    });

    it('returns undefined when no adapter has the component', () => {
        const reg = new ComponentRegistry();
        const adapter: RenderAdapter = { name: 'default', components: {} };
        reg.registerAdapter(adapter);
        expect(reg.resolveAdapterFn('Unknown')).toBeUndefined();
    });

    it('warns and keeps current adapter when setting unknown name', () => {
        const reg = new ComponentRegistry();
        const adapter: RenderAdapter = { name: 'default', components: {} };
        reg.registerAdapter(adapter);
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        reg.setAdapter('nonexistent');
        expect(warn).toHaveBeenCalledOnce();
        warn.mockRestore();
    });

    it('default adapter name is "default"', () => {
        const reg = new ComponentRegistry();
        expect(reg.resolveAdapterFn('TextInput')).toBeUndefined();
    });

    it('exposes activeAdapterName', () => {
        const reg = new ComponentRegistry();
        expect(reg.activeAdapterName).toBe('default');
        const adapter: RenderAdapter = { name: 'custom', components: {} };
        reg.registerAdapter(adapter);
        reg.setAdapter('custom');
        expect(reg.activeAdapterName).toBe('custom');
    });
});
