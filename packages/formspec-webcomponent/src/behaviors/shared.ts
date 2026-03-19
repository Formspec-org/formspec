/** @filedesc Shared utilities for behavior hooks: path resolution, ID generation, token stripping, shared bind helpers. */
import { effect, Signal } from '@preact/signals-core';
import type { PresentationBlock } from 'formspec-layout';
import type { ResolvedPresentationBlock, FieldRefs, BehaviorContext } from './types';

/** Build full field path from bind key and prefix. */
export function resolveFieldPath(bind: string, prefix: string): string {
    return prefix ? `${prefix}.${bind}` : bind;
}

/** Convert a dotted field path to a DOM-safe element ID. */
export function toFieldId(fieldPath: string): string {
    return `field-${fieldPath.replace(/[\.\[\]]/g, '-')}`;
}

/**
 * Pre-resolve all $token. references in a PresentationBlock.
 * Adapters receive concrete values only — no token resolution needed.
 */
export function resolveAndStripTokens(
    block: PresentationBlock,
    resolveToken: (v: any) => any
): ResolvedPresentationBlock {
    const resolved: any = { ...block };
    if (resolved.style) {
        resolved.style = Object.fromEntries(
            Object.entries(resolved.style).map(([k, v]) => [k, resolveToken(v)])
        );
    }
    if (resolved.cssClass) {
        resolved.cssClass = Array.isArray(resolved.cssClass)
            ? resolved.cssClass.map((c: any) => resolveToken(c))
            : resolveToken(resolved.cssClass);
    }
    return resolved;
}

/**
 * Wire the shared reactive effects that all field behaviors need:
 * required indicator, validation display, readonly, relevance, touched tracking.
 *
 * Returns an array of dispose functions.
 */
export function bindSharedFieldEffects(
    ctx: BehaviorContext,
    fieldPath: string,
    labelText: string,
    refs: FieldRefs
): Array<() => void> {
    const disposers: Array<() => void> = [];

    // Required indicator
    disposers.push(effect(() => {
        const isRequired = ctx.engine.requiredSignals[fieldPath]?.value ?? false;
        if (isRequired) {
            refs.label.innerHTML = `${labelText} <span class="formspec-required">*</span>`;
        } else {
            refs.label.textContent = labelText;
        }
        refs.control.setAttribute('aria-required', String(isRequired));
    }));

    // Validation display
    disposers.push(effect(() => {
        ctx.touchedVersion.value; // subscribe to touch changes
        const error = ctx.engine.errorSignals[fieldPath]?.value;

        // Shape errors from latest submit (external 1-indexed paths)
        const submitDetail = ctx.latestSubmitDetailSignal?.value;
        const externalPath = fieldPath.replace(/\[(\d+)\]/g, (_, p1) => `[${parseInt(p1) + 1}]`);
        const submitError = submitDetail?.validationReport?.results?.find((r: any) =>
            r.severity === 'error' && (r.path === fieldPath || r.path === externalPath || r.path === `${fieldPath}[*]`)
        )?.message;

        const effectiveError = error || submitError;
        const showError = ctx.touchedFields.has(fieldPath) ? (effectiveError || '') : '';
        if (refs.error) refs.error.textContent = showError;
        refs.control.setAttribute('aria-invalid', String(!!showError));
    }));

    // Readonly
    disposers.push(effect(() => {
        const isReadonly = ctx.engine.readonlySignals[fieldPath]?.value ?? false;
        const target = refs.control.querySelector?.('input') || refs.control.querySelector?.('select') || refs.control.querySelector?.('textarea') || refs.control;
        if (target instanceof HTMLInputElement || target instanceof HTMLTextAreaElement) {
            target.readOnly = isReadonly;
        } else if (target instanceof HTMLSelectElement) {
            target.disabled = isReadonly;
        }
        refs.control.setAttribute('aria-readonly', String(isReadonly));
        refs.root.classList.toggle('formspec-field--readonly', isReadonly);
    }));

    // Relevance
    disposers.push(effect(() => {
        const isRelevant = ctx.engine.relevantSignals[fieldPath]?.value ?? true;
        refs.root.classList.toggle('formspec-hidden', !isRelevant);
        refs.control.setAttribute('aria-hidden', String(!isRelevant));
    }));

    // Touched tracking
    const markTouched = () => {
        if (!ctx.touchedFields.has(fieldPath)) {
            ctx.touchedFields.add(fieldPath);
            ctx.touchedVersion.value += 1;
        }
    };
    refs.root.addEventListener('focusout', markTouched);
    refs.root.addEventListener('change', markTouched);

    return disposers;
}
