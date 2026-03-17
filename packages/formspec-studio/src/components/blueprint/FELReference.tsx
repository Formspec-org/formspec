/** @filedesc Blueprint section displaying a categorized catalog of all FEL built-in functions and signatures. */
import { useState } from 'react';
import { Section } from '../ui/Section';

interface FELFunction {
  name: string;
  signature: string;
  description: string;
}

interface FELCategory {
  name: string;
  functions: FELFunction[];
}

const FEL_CATALOG: FELCategory[] = [
  {
    name: 'Aggregate',
    functions: [
      { name: 'sum', signature: '(nodeset) -> number', description: 'Sum of numeric values' },
      { name: 'count', signature: '(nodeset) -> number', description: 'Count of nodes' },
      { name: 'min', signature: '(nodeset) -> number', description: 'Minimum value' },
      { name: 'max', signature: '(nodeset) -> number', description: 'Maximum value' },
      { name: 'avg', signature: '(nodeset) -> number', description: 'Average of numeric values' },
    ],
  },
  {
    name: 'String',
    functions: [
      { name: 'concat', signature: '(a, b, ...) -> text', description: 'Concatenate values' },
      { name: 'contains', signature: '(haystack, needle) -> boolean', description: 'Check presence' },
      { name: 'startsWith', signature: '(val, prefix) -> boolean', description: 'Check prefix' },
      { name: 'endsWith', signature: '(val, suffix) -> boolean', description: 'Check suffix' },
      { name: 'substring', signature: '(val, start, length?) -> text', description: 'Extract portion' },
      { name: 'string-length', signature: '(val) -> number', description: 'Length of value' },
      { name: 'normalize-space', signature: '(val) -> text', description: 'Normalize whitespace' },
      { name: 'translate', signature: '(val, from, to) -> text', description: 'Character translation' },
    ],
  },
  {
    name: 'Numeric',
    functions: [
      { name: 'round', signature: '(num, digits?) -> number', description: 'Round to nearest' },
      { name: 'floor', signature: '(num) -> number', description: 'Round down' },
      { name: 'ceil', signature: '(num) -> number', description: 'Round up' },
      { name: 'abs', signature: '(num) -> number', description: 'Absolute value' },
      { name: 'pow', signature: '(base, exp) -> number', description: 'Exponentiation' },
      { name: 'sqrt', signature: '(num) -> number', description: 'Square root' },
      { name: 'mod', signature: '(a, b) -> number', description: 'Modulo remainder' },
    ],
  },
  {
    name: 'Date',
    functions: [
      { name: 'today', signature: '() -> date', description: 'Current date' },
      { name: 'now', signature: '() -> dateTime', description: 'Current date and time' },
      { name: 'date', signature: '(val) -> date', description: 'Parse date value' },
      { name: 'formatDate', signature: '(date, pattern) -> formatted', description: 'Format date' },
      { name: 'dateDiff', signature: '(a, b, unit) -> number', description: 'Difference between dates' },
    ],
  },
  {
    name: 'Logical',
    functions: [
      { name: 'if', signature: '(cond, then, else) -> any', description: 'Conditional expression' },
      { name: 'coalesce', signature: '(a, b, ...) -> any', description: 'First non-null value' },
      { name: 'boolean', signature: '(value) -> boolean', description: 'Cast to boolean' },
      { name: 'true', signature: '() -> boolean', description: 'Boolean true' },
      { name: 'false', signature: '() -> boolean', description: 'Boolean false' },
      { name: 'not', signature: '(value) -> boolean', description: 'Logical negation' },
      { name: 'and', signature: '(a, b) -> boolean', description: 'Logical AND' },
      { name: 'or', signature: '(a, b) -> boolean', description: 'Logical OR' },
    ],
  },
  {
    name: 'Type',
    functions: [
      { name: 'string', signature: '(value) -> text', description: 'Cast to text' },
      { name: 'number', signature: '(value) -> number', description: 'Cast to number' },
      { name: 'int', signature: '(value) -> integer', description: 'Cast to integer' },
      { name: 'boolean-from-string', signature: '(text) -> boolean', description: 'Parse boolean from text' },
    ],
  },
  {
    name: 'Money',
    functions: [
      { name: 'formatMoney', signature: '(amount, currency?) -> text', description: 'Format monetary value' },
      { name: 'convertCurrency', signature: '(amount, from, to) -> number', description: 'Convert between currencies' },
    ],
  },
  {
    name: 'MIP',
    functions: [
      { name: 'position', signature: '() -> number', description: 'Current repeat position' },
      { name: 'count', signature: '(nodeset) -> number', description: 'Count in repeat context' },
    ],
  },
  {
    name: 'Repeat',
    functions: [
      { name: 'indexed-repeat', signature: '(path, group, index) -> any', description: 'Access indexed repeat value' },
    ],
  },
];

export function FELReference() {
  const [expanded, setExpanded] = useState<string | null>(null);

  return (
    <Section title="FEL Reference">
      <div className="space-y-2">
        {/* Quick reference: key function names with one signature example */}
        <div className="text-xs space-y-0.5">
          <div className="py-0.5">
            <span className="font-mono text-accent">sum</span>
            <span className="font-mono text-muted ml-1">{'(nodeset) -> number'}</span>
          </div>
          <div className="py-0.5 font-mono text-accent">concat</div>
          <div className="py-0.5 font-mono text-accent">if</div>
        </div>

        {/* Category listing */}
        <div className="space-y-0.5">
          {FEL_CATALOG.map((cat) => (
            <div key={cat.name}>
              <button
                type="button"
                className="w-full text-left text-xs font-medium text-muted hover:text-ink py-1"
                onClick={() => setExpanded(expanded === cat.name ? null : cat.name)}
              >
                {cat.name}
              </button>
              {expanded === cat.name && (
                <div className="pl-2 space-y-0.5">
                  {cat.functions.map((fn) => (
                    <div key={fn.name} className="text-xs py-0.5">
                      <span className="font-mono text-accent">{fn.name}</span>
                      <span className="font-mono text-muted ml-1">{fn.signature}</span>
                      <p className="text-muted">{fn.description}</p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}
