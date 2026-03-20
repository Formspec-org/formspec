/** @filedesc WASM-backed runtime mapping adapter preserving the RuntimeMappingEngine interface. */
import type { IRuntimeMappingEngine, MappingDirection, MappingDiagnostic, RuntimeMappingResult } from './interfaces.js';
import { wasmExecuteMappingDoc } from './wasm-bridge.js';

function inferErrorCode(message: string): MappingDiagnostic['errorCode'] {
    if (message.startsWith('FEL parse error:')) return 'INVALID_FEL';
    if (message.startsWith('No value map entry')) return 'UNMAPPED_VALUE';
    if (message.startsWith('FEL runtime error:')) return 'FEL_RUNTIME';
    if (message.startsWith('Path not found:')) return 'PATH_NOT_FOUND';
    if (message.startsWith('Cannot coerce')) return 'COERCE_FAILURE';
    return 'FEL_RUNTIME';
}

function normalizeResult(result: {
    direction: string;
    output: any;
    rulesApplied: number;
    diagnostics: Array<{
        ruleIndex: number;
        sourcePath?: string;
        targetPath?: string;
        message: string;
        errorCode?: MappingDiagnostic['errorCode'];
    }>;
}): RuntimeMappingResult {
    return {
        direction: result.direction as MappingDirection,
        output: result.output,
        appliedRules: result.rulesApplied,
        diagnostics: result.diagnostics.map((diagnostic) => ({
            ruleIndex: diagnostic.ruleIndex,
            sourcePath: diagnostic.sourcePath,
            targetPath: diagnostic.targetPath,
            message: diagnostic.message,
            errorCode: diagnostic.errorCode ?? inferErrorCode(diagnostic.message),
        })),
    };
}

export class WasmRuntimeMappingEngine implements IRuntimeMappingEngine {
    constructor(private readonly mappingDocument: any) {}

    forward(source: any): RuntimeMappingResult {
        return normalizeResult(wasmExecuteMappingDoc(this.mappingDocument, source, 'forward'));
    }

    reverse(source: any): RuntimeMappingResult {
        return normalizeResult(wasmExecuteMappingDoc(this.mappingDocument, source, 'reverse'));
    }
}
