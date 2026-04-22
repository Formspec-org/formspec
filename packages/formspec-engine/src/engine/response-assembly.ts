/** @filedesc Response envelope, validation report, changelog migration, and pinned-definition resolution. */

import type { FormDefinition } from '@formspec-org/types';
import type { ValidationReport, ValidationResult } from '@formspec-org/types';
import type { EvalResult } from '../diff.js';
import type {
    AuthoredSignatureIdentityBinding,
    AuthoredSignatureInput,
    PinnedResponseReference,
} from '../interfaces.js';
import { wasmApplyMigrationsToResponseData } from '../wasm-bridge-runtime.js';
import { toValidationResult } from './helpers.js';
import type { EvalShapeTiming } from './wasm-fel.js';

function resolveResponseId(
    explicitId: string | undefined,
    authoredSignatures: AuthoredSignatureInput[] | undefined,
): string | undefined {
    if (explicitId) {
        return explicitId;
    }
    if (!authoredSignatures || authoredSignatures.length === 0) {
        return undefined;
    }
    const responseIds = new Set(
        authoredSignatures
            .map((signature) => signature.responseId)
            .filter((value): value is string => typeof value === 'string' && value.trim().length > 0),
    );
    if (responseIds.size === 0) {
        throw new Error(
            'authoredSignatures require meta.id on getResponse(), or a single agreed non-empty responseId among signature records',
        );
    }
    if (responseIds.size > 1) {
        throw new Error('authoredSignatures must agree on a single responseId');
    }
    return [...responseIds][0];
}

function pickIdentityBinding(
    binding: AuthoredSignatureIdentityBinding | undefined,
): Record<string, unknown> | undefined {
    if (!binding) {
        return undefined;
    }
    const out: Record<string, unknown> = {
        method: binding.method,
        assuranceLevel: binding.assuranceLevel,
    };
    if (binding.providerRef !== undefined) {
        out.providerRef = binding.providerRef;
    }
    if (binding.externalAttestationRef !== undefined) {
        out.externalAttestationRef = binding.externalAttestationRef;
    }
    return out;
}

/** Emit only JSON-Schema–declared AuthoredSignature properties (additionalProperties: false). */
function toNormalizedAuthoredSignatureRecord(
    signature: AuthoredSignatureInput,
    index: number,
    responseId: string,
    meta: { author?: { id: string; name?: string } } | undefined,
): Record<string, unknown> {
    const signerName = signature.signerName ?? meta?.author?.name;
    if (!signerName || !signerName.trim()) {
        throw new Error(`authoredSignatures[${index}] requires signerName or meta.author.name`);
    }
    const signatureResponseId = signature.responseId ?? responseId;
    if (signatureResponseId !== responseId) {
        throw new Error(`authoredSignatures[${index}].responseId must match the Response id`);
    }
    const signerId = signature.signerId ?? meta?.author?.id;

    const record: Record<string, unknown> = {
        documentId: signature.documentId,
        signatureValue: signature.signatureValue,
        signatureMethod: signature.signatureMethod,
        signerName: signerName.trim(),
        signedAt: signature.signedAt,
        consentAccepted: signature.consentAccepted,
        consentTextRef: signature.consentTextRef,
        consentVersion: signature.consentVersion,
        affirmationText: signature.affirmationText,
        documentHash: signature.documentHash,
        documentHashAlgorithm: signature.documentHashAlgorithm,
        responseId,
        signatureProvider: signature.signatureProvider,
        ceremonyId: signature.ceremonyId,
    };
    if (signerId !== undefined) {
        record.signerId = signerId;
    }
    if (signature.identityProofRef !== undefined) {
        record.identityProofRef = signature.identityProofRef;
    }
    const identityBinding = pickIdentityBinding(signature.identityBinding);
    if (identityBinding) {
        record.identityBinding = identityBinding;
    }
    return record;
}

function prepareAuthoredSignaturesSection(meta: {
    id?: string;
    author?: { id: string; name?: string };
    subject?: { id: string; type?: string };
    authoredSignatures?: AuthoredSignatureInput[];
} | undefined): {
    authoredSignatures: Record<string, unknown>[] | undefined;
    envelopeResponseId: string | undefined;
} {
    const signatures = meta?.authoredSignatures;
    if (!signatures || signatures.length === 0) {
        return { authoredSignatures: undefined, envelopeResponseId: meta?.id };
    }
    const responseId = resolveResponseId(meta?.id, signatures);
    if (!responseId) {
        throw new Error('authoredSignatures require a stable response id');
    }
    const normalized = signatures.map((sig, i) =>
        toNormalizedAuthoredSignatureRecord(sig, i, responseId, meta),
    );
    return { authoredSignatures: normalized, envelopeResponseId: responseId };
}

export function buildFormspecResponseEnvelope(options: {
    definition: FormDefinition;
    data: Record<string, unknown>;
    report: ValidationReport;
    timestamp: string;
    meta?: {
        id?: string;
        author?: { id: string; name?: string };
        subject?: { id: string; type?: string };
        authoredSignatures?: AuthoredSignatureInput[];
    };
}): Record<string, unknown> {
    const { authoredSignatures, envelopeResponseId } = prepareAuthoredSignaturesSection(options.meta);
    const response: Record<string, unknown> = {
        $formspecResponse: '1.0',
        definitionUrl: options.definition.url ?? 'http://example.org/form',
        definitionVersion: options.definition.version ?? '1.0.0',
        status: options.report.valid ? 'completed' : 'in-progress',
        data: options.data,
        validationResults: options.report.results,
        authored: options.timestamp,
    };

    if (envelopeResponseId) {
        response.id = envelopeResponseId;
    }
    if (options.meta?.author) {
        response.author = options.meta.author;
    }
    if (options.meta?.subject) {
        response.subject = options.meta.subject;
    }
    if (authoredSignatures) {
        response.authoredSignatures = authoredSignatures;
    }

    return response;
}

/** Shape validations that only run on submit, from a WASM eval with `trigger: 'submit'`. */
export function collectSubmitModeShapeValidationResults(
    submitEval: EvalResult,
    shapeTiming: Map<string, EvalShapeTiming>,
): ValidationResult[] {
    const results: ValidationResult[] = [];
    for (const validation of submitEval.validations) {
        if (!validation.shapeId) {
            continue;
        }
        if ((shapeTiming.get(validation.shapeId) ?? 'continuous') === 'submit') {
            results.push(toValidationResult(validation));
        }
    }
    return results;
}

/** Strip optional cardinality `source`, compute counts, and wrap the spec envelope. */
export function buildValidationReportEnvelope(
    results: ValidationResult[],
    timestamp: string,
): ValidationReport {
    const finalResults = results.map((result) => {
        if (result.constraintKind === 'cardinality') {
            const { source: _source, ...rest } = result as ValidationResult & { source?: string };
            return rest as ValidationResult;
        }
        return result;
    });

    const counts = { error: 0, warning: 0, info: 0 };
    for (const result of finalResults) {
        counts[result.severity as keyof typeof counts] += 1;
    }

    return {
        $formspecValidationReport: '1.0',
        valid: counts.error === 0,
        results: finalResults,
        counts,
        timestamp,
    };
}

export function migrateResponseData(
    definition: FormDefinition,
    responseData: Record<string, any>,
    fromVersion: string,
    options: { nowIso: string },
): Record<string, any> {
    if (!Array.isArray(definition.migrations)) {
        return responseData;
    }
    return JSON.parse(
        wasmApplyMigrationsToResponseData(
            JSON.stringify(definition),
            JSON.stringify(responseData),
            fromVersion,
            options.nowIso,
        ),
    ) as Record<string, any>;
}

export function resolvePinnedDefinition<T extends { url?: string; version?: string }>(
    response: PinnedResponseReference,
    definitions: T[],
): T {
    const exact = definitions.find(
        (definition) =>
            definition.url === response.definitionUrl
            && definition.version === response.definitionVersion,
    );
    if (exact) {
        return exact;
    }

    const availableVersions = definitions
        .filter((definition) => definition.url === response.definitionUrl)
        .map((definition) => definition.version)
        .filter((version): version is string => typeof version === 'string')
        .sort();

    let message = `No definition found for pinned response ${response.definitionUrl}@${response.definitionVersion}`;
    if (availableVersions.length > 0) {
        message += `; available versions: ${availableVersions.join(', ')}`;
    }
    throw new Error(message);
}
