/** @filedesc useScreener — React hook for the Formspec screener gate. */
import { useState, useCallback } from 'react';
import type { IFormEngine } from '@formspec-org/engine';
import { evalFEL } from '@formspec-org/engine';
import type { UseScreenerOptions, UseScreenerResult, ScreenerRoute, ScreenerRouteType } from './types';

/**
 * Read the item's data type, supporting both the canonical schema field
 * (`dataType`) and the simplified alias (`type`) from the user-facing API.
 */
function itemDataType(item: any): string {
    return item.dataType ?? item.type ?? 'text';
}

/**
 * Read the item's option list, supporting both the canonical schema field
 * (`options`) and the simplified alias (`choices`).
 */
function itemOptions(item: any): any[] {
    return item.options ?? item.choices ?? [];
}

/**
 * Determine whether a screener item is required.
 * Checks the item's own `required` flag first, then falls back to
 * `screener.binds` (the canonical location in the definition schema).
 * FEL expressions in the `required` bind are evaluated against the
 * current answers using the engine's FEL evaluator.
 */
export function isItemRequired(
    item: any,
    screener: any,
    engine: IFormEngine | null,
    answers: Record<string, any>,
): boolean {
    if (item.required === true) return true;
    const binds: any[] = screener?.binds ?? [];
    const bind = binds.find((b: any) => b.path === item.key);
    if (!bind || bind.required == null) return false;

    // Literal boolean or string "true"
    if (bind.required === true || bind.required === 'true') return true;
    if (bind.required === false || bind.required === 'false') return false;

    // FEL expression — evaluate with current answers as field context
    if (typeof bind.required === 'string' && engine) {
        try {
            const result = evalFEL(bind.required, answers);
            return result === true;
        } catch {
            // If evaluation fails, treat as not required (graceful degradation)
            return false;
        }
    }

    return false;
}

function buildSeedAnswers(items: any[], seed: Record<string, any> | undefined): Record<string, any> {
    const out: Record<string, any> = {};
    if (!seed) return out;
    for (const item of items) {
        if (seed[item.key] !== undefined) {
            out[item.key] = seed[item.key];
        }
    }
    return out;
}

export function useScreener(
    engine: IFormEngine,
    definition: any,
    options: UseScreenerOptions = {},
): UseScreenerResult {
    const screener = definition?.screener;
    const items: any[] = screener?.items ?? [];
    const routes: any[] = screener?.routes ?? [];

    const [answers, setAnswers] = useState<Record<string, any>>(() =>
        buildSeedAnswers(items, options.seedAnswers),
    );

    const [state, setState] = useState<'idle' | 'answering' | 'routed'>('idle');
    const [routeResult, setRouteResult] = useState<{
        route: ScreenerRoute;
        routeType: ScreenerRouteType;
    } | null>(null);
    const [skipped, setSkipped] = useState(false);
    const [errors, setErrors] = useState<Record<string, string>>({});

    const setAnswer = useCallback((key: string, value: any) => {
        setAnswers(prev => ({ ...prev, [key]: value }));
        // Clear error for this field when the user changes it
        setErrors(prev => {
            if (!prev[key]) return prev;
            const next = { ...prev };
            delete next[key];
            return next;
        });
        setState(s => (s === 'idle' ? 'answering' : s));
    }, []);

    const submit = useCallback(() => {
        // Validate required fields
        const newErrors: Record<string, string> = {};
        const hasExplicitRequired = items.some(i => isItemRequired(i, screener, engine, answers));

        if (hasExplicitRequired) {
            for (const item of items) {
                if (isItemRequired(item, screener, engine, answers)) {
                    const val = answers[item.key];
                    if (val === undefined || val === null || val === '') {
                        newErrors[item.key] = `${item.label || item.key} is required`;
                    }
                }
            }
        } else {
            // No explicit required binds — require at least one non-empty answer
            const hasAny = items.some(i => {
                const v = answers[i.key];
                return v !== undefined && v !== null && v !== '';
            });
            if (!hasAny) {
                // Mark the first item as needing a value
                if (items.length > 0) {
                    newErrors[items[0].key] = 'Please answer at least one question';
                }
            }
        }

        if (Object.keys(newErrors).length > 0) {
            setErrors(newErrors);
            return;
        }
        setErrors({});

        const result = engine.evaluateScreener(answers);
        if (!result) {
            setRouteResult({ route: { target: '' }, routeType: 'none' });
            setState('routed');
            options.onRoute?.({ target: '' }, 'none', answers);
            return;
        }

        // Determine route type: prefer explicit `routeType` on the matched
        // route definition, then fall back to URL-based heuristics.
        const matchedRoute = routes.find(
            (r: any) => r.target === result.target || r.label === result.target,
        );

        let routeType: ScreenerRouteType = 'internal';
        if (matchedRoute?.routeType === 'internal' || matchedRoute?.routeType === 'external' || matchedRoute?.routeType === 'none') {
            // Explicit routeType takes precedence over heuristics
            routeType = matchedRoute.routeType;
        } else {
            const defUrl = definition?.url;
            if (defUrl && result.target === defUrl) {
                routeType = 'internal';
            } else if (matchedRoute?.type === 'external' || matchedRoute?.externalUrl) {
                routeType = 'external';
            } else if (defUrl && result.target !== defUrl) {
                routeType = 'external';
            }
        }

        const route: ScreenerRoute = {
            target: result.target,
            label: result.label,
            extensions: result.extensions,
        };

        setRouteResult({ route, routeType });
        setState('routed');
        options.onRoute?.(route, routeType, answers);
    }, [engine, answers, items, routes, screener, definition, options]);

    const restart = useCallback(() => {
        setAnswers(buildSeedAnswers(items, options.seedAnswers));
        setRouteResult(null);
        setErrors({});
        setState('idle');
        setSkipped(false);
    }, [items, options.seedAnswers]);

    const skip = useCallback(() => {
        setSkipped(true);
    }, []);

    return { state, answers, setAnswer, submit, restart, skip, routeResult, skipped, errors };
}

// Re-export helpers for use outside the hook (e.g. FormspecScreener field rendering)
export { itemDataType, itemOptions };
