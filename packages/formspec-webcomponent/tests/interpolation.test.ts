import { describe, it, expect } from 'vitest';
import { interpolateParams, resolveResponsiveProps } from '../src/index';

describe('interpolateParams', () => {
    it('replaces {param} placeholders with values', () => {
        const node = { text: 'Hello {name}' };
        interpolateParams(node, { name: 'World' });
        expect(node.text).toBe('Hello World');
    });

    it('preserves unreplaced placeholders', () => {
        const node = { text: '{missing} stays' };
        interpolateParams(node, {});
        expect(node.text).toBe('{missing} stays');
    });

    it('recurses into nested objects', () => {
        const node = { child: { label: '{title}' } };
        interpolateParams(node, { title: 'My Title' });
        expect(node.child.label).toBe('My Title');
    });

    it('recurses into arrays of objects', () => {
        const node = { items: [{ text: '{a}' }, { text: '{b}' }] };
        interpolateParams(node, { a: '1', b: '2' });
        expect(node.items[0].text).toBe('1');
        expect(node.items[1].text).toBe('2');
    });

    it('skips non-string/object/array values', () => {
        const node = { count: 42, flag: true, label: '{x}' };
        interpolateParams(node, { x: 'val' });
        expect(node.count).toBe(42);
        expect(node.flag).toBe(true);
        expect(node.label).toBe('val');
    });

    it('replaces multiple placeholders in one string', () => {
        const node = { text: '{first} and {second}' };
        interpolateParams(node, { first: 'A', second: 'B' });
        expect(node.text).toBe('A and B');
    });
});

describe('resolveResponsiveProps', () => {
    it('returns comp unchanged when no responsive property', () => {
        const comp = { component: 'TextInput', bind: 'f1' };
        expect(resolveResponsiveProps(comp, 'md')).toBe(comp);
    });

    it('returns comp unchanged when no activeBreakpoint', () => {
        const comp = { component: 'TextInput', responsive: { md: { columns: 2 } } };
        expect(resolveResponsiveProps(comp, null)).toBe(comp);
    });

    it('merges active breakpoint overrides onto comp', () => {
        const comp = { component: 'Grid', columns: 1, responsive: { md: { columns: 3 } } };
        const result = resolveResponsiveProps(comp, 'md');
        expect(result.columns).toBe(3);
        expect(result.component).toBe('Grid');
    });

    it('ignores non-matching breakpoints', () => {
        const comp = { component: 'Grid', columns: 1, responsive: { lg: { columns: 4 } } };
        const result = resolveResponsiveProps(comp, 'md');
        expect(result).toBe(comp); // no overrides for 'md'
    });
});
