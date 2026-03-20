/* @ts-self-types="./formspec_wasm.d.ts" */

import * as wasm from "./formspec_wasm_bg.wasm";
import { __wbg_set_wasm } from "./formspec_wasm_bg.js";
__wbg_set_wasm(wasm);

export {
    analyzeFEL, assembleDefinition, collectFELRewriteTargets, detectDocumentType, evalFEL, evalFELWithContext, evaluateDefinition, executeMapping, executeMappingDoc, extractDependencies, findRegistryEntry, generateChangelog, getFELDependencies, itemAtPath, itemLocationAtPath, jsonPointerToJsonPath, lintDocument, lintDocumentWithRegistries, listBuiltinFunctions, normalizeIndexedPath, parseFEL, parseRegistry, planSchemaValidation, printFEL, rewriteFELReferences, rewriteMessageTemplate, validateExtensionUsage, validateLifecycleTransition, wellKnownRegistryUrl
} from "./formspec_wasm_bg.js";
