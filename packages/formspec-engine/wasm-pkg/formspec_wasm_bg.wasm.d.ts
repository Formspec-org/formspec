/* tslint:disable */
/* eslint-disable */
export const memory: WebAssembly.Memory;
export const evalFEL: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const parseFEL: (a: number, b: number) => number;
export const printFEL: (a: number, b: number) => [number, number, number, number];
export const getFELDependencies: (a: number, b: number) => [number, number, number, number];
export const extractDependencies: (a: number, b: number) => [number, number, number, number];
export const analyzeFEL: (a: number, b: number) => [number, number, number, number];
export const normalizeIndexedPath: (a: number, b: number) => [number, number];
export const detectDocumentType: (a: number, b: number) => [number, number, number];
export const lintDocument: (a: number, b: number) => [number, number, number, number];
export const lintDocumentWithRegistries: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const evaluateDefinition: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const assembleDefinition: (a: number, b: number, c: number, d: number) => [number, number, number, number];
export const executeMapping: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const parseRegistry: (a: number, b: number) => [number, number, number, number];
export const findRegistryEntry: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const validateLifecycleTransition: (a: number, b: number, c: number, d: number) => number;
export const wellKnownRegistryUrl: (a: number, b: number) => [number, number];
export const generateChangelog: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const executeMappingDoc: (a: number, b: number, c: number, d: number, e: number, f: number) => [number, number, number, number];
export const __wbindgen_externrefs: WebAssembly.Table;
export const __wbindgen_malloc: (a: number, b: number) => number;
export const __wbindgen_realloc: (a: number, b: number, c: number, d: number) => number;
export const __externref_table_dealloc: (a: number) => void;
export const __wbindgen_free: (a: number, b: number, c: number) => void;
export const __wbindgen_start: () => void;
