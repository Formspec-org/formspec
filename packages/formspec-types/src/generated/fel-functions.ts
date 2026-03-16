/**
 * AUTO-GENERATED — DO NOT EDIT
 *
 * Generated from schemas/*.schema.json by scripts/generate-types.mjs.
 * Re-run: npm run types:generate
 */

/* eslint-disable */
/**
 * A FEL type identifier. 'any' means the function accepts or returns multiple types. 'array' means array<T> where T is specified in the description.
 *
 * This interface was referenced by `FELFunctionCatalog`'s JSON-Schema
 * via the `definition` "FELType".
 */
export type FELType =
  | 'string'
  | 'number'
  | 'boolean'
  | 'date'
  | 'dateTime'
  | 'time'
  | 'money'
  | 'array'
  | 'any'
  | 'null';

/**
 * Structured catalog of all built-in functions in the Formspec Expression Language (FEL) v1.0. Each entry defines the function's name, signature, return type, null handling, and usage examples. This catalog is the normative reference for FEL function behavior; implementations in TypeScript (packages/formspec-engine) and Python (src/formspec/fel) must conform to these signatures and semantics.
 */
export interface FELFunctionCatalog {
  version?: '1.0';
  functions?: FunctionEntry[];
}
/**
 * This interface was referenced by `FELFunctionCatalog`'s JSON-Schema
 * via the `definition` "FunctionEntry".
 */
export interface FunctionEntry {
  /**
   * Function name as used in FEL expressions.
   */
  name: string;
  /**
   * Functional category for grouping and documentation.
   */
  category: 'aggregate' | 'string' | 'numeric' | 'date' | 'logical' | 'type' | 'money' | 'mip' | 'repeat';
  /**
   * Ordered parameter list. Variadic parameters must be last.
   */
  parameters: Parameter[];
  /**
   * A FEL type identifier. 'any' means the function accepts or returns multiple types. 'array' means array<T> where T is specified in the description.
   */
  returns: 'string' | 'number' | 'boolean' | 'date' | 'dateTime' | 'time' | 'money' | 'array' | 'any' | 'null';
  /**
   * Clarification of the return value when 'returns' alone is insufficient.
   */
  returnDescription?: string;
  /**
   * What the function does — behavior, edge cases, and constraints.
   */
  description: string;
  /**
   * How the function behaves when one or more arguments are null.
   */
  nullHandling?: string;
  /**
   * False if the function can return different results for the same arguments (e.g., today, now).
   */
  deterministic?: boolean;
  /**
   * True if the function evaluates arguments lazily (e.g., if only evaluates the selected branch).
   */
  shortCircuit?: boolean;
  examples?: {
    expression: string;
    result: unknown;
    note?: string;
  }[];
  sinceVersion?: string;
}
/**
 * This interface was referenced by `FELFunctionCatalog`'s JSON-Schema
 * via the `definition` "Parameter".
 */
export interface Parameter {
  name: string;
  type: FELType;
  description?: string;
  required?: boolean;
  variadic?: boolean;
  /**
   * When present, restricts the parameter to these literal values.
   */
  enum?: string[];
}
