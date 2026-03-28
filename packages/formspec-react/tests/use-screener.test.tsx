/** @filedesc Tests for the useScreener hook — FEL required evaluation and explicit routeType. */
import { describe, it, expect, beforeAll } from 'vitest';
import React from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { createFormEngine, initFormspecEngine } from '@formspec-org/engine';
import { useScreener, isItemRequired } from '../src/screener/use-screener';
import type { UseScreenerResult } from '../src/screener/types';

beforeAll(async () => {
    await initFormspecEngine();
});

// ── Helpers ──────────────────────────────────────────────────────

function renderHook<T>(hookFn: () => T): { result: { current: T }; container: HTMLElement } {
    const result = { current: null as T };
    const container = document.createElement('div');
    document.body.appendChild(container);
    const root = createRoot(container);

    function HookConsumer() {
        result.current = hookFn();
        return null;
    }
    flushSync(() => root.render(<HookConsumer />));
    return { result, container };
}

// ── isItemRequired tests ──────────────────────────────────────────

describe('isItemRequired', () => {
    it('treats literal true as required', () => {
        expect(isItemRequired(
            { key: 'name' },
            { binds: [{ path: 'name', required: true }] },
            null,
            {},
        )).toBe(true);
    });

    it('treats literal string "true" as required', () => {
        expect(isItemRequired(
            { key: 'name' },
            { binds: [{ path: 'name', required: 'true' }] },
            null,
            {},
        )).toBe(true);
    });

    it('treats item.required = true as required regardless of binds', () => {
        expect(isItemRequired(
            { key: 'name', required: true },
            {},
            null,
            {},
        )).toBe(true);
    });

    it('evaluates FEL expression in required bind using the engine', () => {
        const definition = {
            $formspec: '1.0',
            url: 'urn:screener-test',
            version: '1.0.0',
            items: [
                { key: 'awardType', type: 'field', dataType: 'choice' },
                { key: 'details', type: 'field', dataType: 'string' },
            ],
            screener: {
                items: [
                    { key: 'awardType', label: 'Award Type' },
                    { key: 'details', label: 'Details' },
                ],
                binds: [
                    { path: 'details', required: "$awardType = 'grant'" },
                ],
                routes: [],
            },
        };

        const engine = createFormEngine(definition as any);

        // When awardType is not 'grant', details should NOT be required
        expect(isItemRequired(
            { key: 'details' },
            definition.screener,
            engine,
            { awardType: 'loan' },
        )).toBe(false);

        // When awardType IS 'grant', details SHOULD be required
        expect(isItemRequired(
            { key: 'details' },
            definition.screener,
            engine,
            { awardType: 'grant' },
        )).toBe(true);
    });

    it('treats non-evaluable FEL as not-required (graceful fallback)', () => {
        // If engine is null, FEL expressions cannot be evaluated — fall back to false
        expect(isItemRequired(
            { key: 'name' },
            { binds: [{ path: 'name', required: "$foo = 'bar'" }] },
            null,
            {},
        )).toBe(false);
    });
});

// ── routeType tests ──────────────────────────────────────────────

describe('useScreener routeType', () => {
    it('uses explicit routeType from the matched route definition', () => {
        const definition = {
            $formspec: '1.0',
            url: 'urn:screener-test',
            version: '1.0.0',
            items: [],
            screener: {
                items: [
                    { key: 'eligible', label: 'Are you eligible?', dataType: 'choice', options: [{ value: 'yes' }, { value: 'no' }] },
                ],
                routes: [
                    { condition: "$eligible = 'yes'", target: 'urn:screener-test', routeType: 'internal' },
                    { condition: "$eligible = 'no'", target: 'https://example.com/denied', routeType: 'external' },
                ],
            },
        };

        const engine = createFormEngine(definition as any);

        let capturedResult: UseScreenerResult['routeResult'] = null;
        const { result } = renderHook(() =>
            useScreener(engine, definition, {
                onRoute: (route, routeType) => {
                    capturedResult = { route, routeType };
                },
            }),
        );

        // Set answer and submit
        flushSync(() => result.current.setAnswer('eligible', 'no'));
        flushSync(() => result.current.submit());

        expect(capturedResult).not.toBeNull();
        expect(capturedResult!.routeType).toBe('external');
    });
});
