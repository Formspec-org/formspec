/** @filedesc Catalog of FEL built-in functions with signatures, descriptions, and category metadata. */
import { getBuiltinFELFunctionCatalog, type FELBuiltinFunctionCatalogEntry } from 'formspec-engine';

export interface FELFunction {
  name: string;
  signature: string;
  description: string;
  category: string;
}

export const CATEGORY_COLORS: Record<string, string> = {
  Aggregate: 'text-accent',
  String: 'text-green',
  Numeric: 'text-amber',
  Date: 'text-logic',
  Logical: 'text-accent',
  Type: 'text-muted',
  Money: 'text-green',
  Repeat: 'text-amber',
  MIP: 'text-logic',
  Instance: 'text-muted',
  Function: 'text-muted',
};

export const CATEGORY_ORDER = ['Aggregate', 'String', 'Numeric', 'Date', 'Logical', 'Type', 'Money', 'Repeat', 'MIP', 'Instance', 'Function'];

export const FUNCTION_DETAILS: Record<string, { signature: string; description: string }> = {
  abs: { signature: '(num) → number', description: 'Absolute value' },
  avg: { signature: '(nodeset) → number', description: 'Average of numeric values' },
  boolean: { signature: '(value) → boolean', description: 'Cast a value to boolean' },
  coalesce: { signature: '(a, b, ...) → any', description: 'Return the first non-null value' },
  concat: { signature: '(a, b, ...) → text', description: 'Concatenate values into a string' },
  contains: { signature: '(haystack, needle) → boolean', description: 'Check whether text contains a value' },
  count: { signature: '(nodeset) → number', description: 'Count matching nodes' },
  countWhere: { signature: '(nodeset, predicate) → number', description: 'Count nodes matching a predicate' },
  ceil: { signature: '(num) → number', description: 'Round up' },
  date: { signature: '(value) → date', description: 'Parse a value as a date' },
  dateAdd: { signature: '(date, amount, unit) → date', description: 'Add time to a date' },
  dateDiff: { signature: '(a, b, unit) → number', description: 'Compute the difference between dates' },
  day: { signature: '(date) → number', description: 'Extract day of month' },
  endsWith: { signature: '(value, suffix) → boolean', description: 'Check whether text ends with a suffix' },
  empty: { signature: '(value) → boolean', description: 'Check whether a value is empty' },
  floor: { signature: '(num) → number', description: 'Round down' },
  format: { signature: '(template, ...) → text', description: 'Format text with positional arguments' },
  hours: { signature: '(time) → number', description: 'Extract hour value from a time' },
  if: { signature: '(condition, then, else) → any', description: 'Conditional expression' },
  instance: { signature: '(name, path?) → any', description: 'Read from an external instance' },
  isDate: { signature: '(value) → boolean', description: 'Check whether a value is a date-like value' },
  isNumber: { signature: '(value) → boolean', description: 'Check whether a value is numeric' },
  isString: { signature: '(value) → boolean', description: 'Check whether a value is text' },
  isNull: { signature: '(value) → boolean', description: 'Check whether a value is nullish' },
  length: { signature: '(value) → number', description: 'Length of a string value' },
  lower: { signature: '(value) → text', description: 'Lowercase a string' },
  max: { signature: '(nodeset) → number', description: 'Maximum numeric value' },
  matches: { signature: '(value, pattern) → boolean', description: 'Check whether text matches a pattern' },
  min: { signature: '(nodeset) → number', description: 'Minimum numeric value' },
  minutes: { signature: '(time) → number', description: 'Extract minute value from a time' },
  money: { signature: '(amount, currency) → money', description: 'Construct a money value' },
  moneyAdd: { signature: '(a, b) → money', description: 'Add two money values' },
  moneyAmount: { signature: '(money) → number', description: 'Extract the numeric amount from money' },
  moneyCurrency: { signature: '(money) → text', description: 'Extract the currency code from money' },
  moneySum: { signature: '(nodeset) → money', description: 'Sum money values' },
  month: { signature: '(date) → number', description: 'Extract month number' },
  next: { signature: '(path) → any', description: 'Read the next repeat sibling value' },
  now: { signature: '() → dateTime', description: 'Current date and time' },
  number: { signature: '(value) → number', description: 'Cast a value to number' },
  parent: { signature: '(path) → any', description: 'Read a parent value' },
  power: { signature: '(base, exponent) → number', description: 'Raise a number to a power' },
  present: { signature: '(value) → boolean', description: 'Check whether a value is present' },
  prev: { signature: '(path) → any', description: 'Read the previous repeat sibling value' },
  relevant: { signature: '(path) → boolean', description: 'Read current relevance state' },
  readonly: { signature: '(path) → boolean', description: 'Read current readonly state' },
  replace: { signature: '(value, pattern, replacement) → text', description: 'Replace text using a pattern' },
  required: { signature: '(path) → boolean', description: 'Read current required state' },
  round: { signature: '(num, digits?) → number', description: 'Round to the nearest value' },
  seconds: { signature: '(time) → number', description: 'Extract second value from a time' },
  selected: { signature: '(value, candidate) → boolean', description: 'Check whether a choice is selected' },
  startsWith: { signature: '(value, prefix) → boolean', description: 'Check whether text starts with a prefix' },
  string: { signature: '(value) → text', description: 'Cast a value to text' },
  substring: { signature: '(value, start, length?) → text', description: 'Extract part of a string' },
  sum: { signature: '(nodeset) → number', description: 'Sum numeric values' },
  time: { signature: '(value) → time', description: 'Parse a value as a time' },
  timeDiff: { signature: '(a, b, unit) → number', description: 'Compute the difference between times' },
  today: { signature: '() → date', description: 'Current date' },
  trim: { signature: '(value) → text', description: 'Trim surrounding whitespace' },
  typeOf: { signature: '(value) → text', description: 'Return the FEL type of a value' },
  upper: { signature: '(value) → text', description: 'Uppercase a string' },
  valid: { signature: '(path) → boolean', description: 'Read current validation state' },
  year: { signature: '(date) → number', description: 'Extract year number' },
};

export function formatCategoryName(category: string): string {
  if (category === 'mip') return 'MIP';
  return category
    .split(/[\s_-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ') || 'Function';
}

export function getFELCatalog(): FELFunction[] {
  return getBuiltinFELFunctionCatalog().map(entry => {
    const details = FUNCTION_DETAILS[entry.name];
    return {
      name: entry.name,
      signature: details?.signature ?? '()',
      description: details?.description ?? 'Built-in FEL function',
      category: formatCategoryName(entry.category),
    };
  });
}
