/** @filedesc Mapping preview serializers for JSON, XML, and CSV output formats. */

export interface AdapterOptions {
  format?: 'json' | 'xml' | 'csv';
  rootElement?: string;
  namespaces?: Record<string, string>;
  pretty?: boolean;
  sortKeys?: boolean;
  nullHandling?: 'include' | 'omit';
  declaration?: boolean;
  indent?: number;
  cdata?: string[];
  delimiter?: string;
  quote?: string;
  header?: boolean;
  lineEnding?: 'crlf' | 'lf';
  encoding?: string;
}

export function serializeMappedData(data: unknown, options: AdapterOptions = {}): string {
  const format = options.format || 'json';

  try {
    switch (format) {
      case 'xml':
        return toXML(data, options);
      case 'csv':
        return toCSV(data, options);
      case 'json':
      default:
        return toJSON(data, options);
    }
  } catch (err: unknown) {
    return `Serialization Error: ${err instanceof Error ? err.message : String(err)}`;
  }
}

function stripNulls(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) out[key] = stripNulls(value);
  }
  return out;
}

function sortKeysDeep(obj: unknown): unknown {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeysDeep((obj as Record<string, unknown>)[key]);
  }
  return out;
}

function toJSON(data: unknown, options: AdapterOptions): string {
  let output = data;
  if (options.nullHandling === 'omit') output = stripNulls(output);
  if (options.sortKeys) output = sortKeysDeep(output);
  const indent = options.pretty ? 2 : undefined;
  return JSON.stringify(output, null, indent);
}

/**
 * Sanitize a string for use as an XML tag name.
 * Replaces invalid characters with underscores and ensures it doesn't start with a digit.
 */
function sanitizeXmlTagName(name: string): string {
  // Replace invalid characters with underscores. 
  // Valid: letters, digits, hyphens, underscores, dots.
  let sanitized = name.replace(/[^a-zA-Z0-9\-_.]/g, '_');
  
  // Cannot start with a digit, hyphen, or dot.
  if (/^[0-9\-.]/.test(sanitized)) {
    sanitized = '_' + sanitized;
  }
  
  // Cannot start with 'xml' (case-insensitive)
  if (/^xml/i.test(sanitized)) {
    sanitized = '_' + sanitized;
  }

  // Cannot be empty
  return sanitized || 'element';
}

function toXML(data: unknown, options: AdapterOptions): string {
  const root = sanitizeXmlTagName(options.rootElement || 'root');
  const namespaces = options.namespaces || {};
  const indentSize = options.indent ?? 2;
  const cdataPaths = new Set(options.cdata ?? []);

  let xml = '';
  if (options.declaration !== false) {
    xml += '<?xml version="1.0" encoding="UTF-8"?>';
    xml += indentSize > 0 ? '\n' : '';
  }

  const nsAttrs = Object.entries(namespaces)
    .map(([prefix, uri]) => ` xmlns${prefix ? `:${prefix}` : ''}="${uri}"`)
    .join('');

  xml += `<${root}${nsAttrs}>`;
  xml += indentSize > 0 ? '\n' : '';
  xml += serializeXmlNode(data, 1, indentSize, cdataPaths, '');
  xml += `</${root}>`;

  return xml;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function serializeXmlNode(
  data: unknown,
  depth: number,
  indentSize: number,
  cdataPaths: Set<string>,
  currentPath: string,
): string {
  if (data === null || data === undefined) return '';
  const indent = indentSize > 0 ? ' '.repeat(indentSize).repeat(depth) : '';
  const nl = indentSize > 0 ? '\n' : '';

  if (typeof data !== 'object') {
    return escapeXml(String(data));
  }

  if (Array.isArray(data)) {
    return data
      .map((item) => serializeXmlNode(item, depth, indentSize, cdataPaths, currentPath))
      .join(nl);
  }

  const dataRecord = data as Record<string, unknown>;
  const children = Object.entries(dataRecord)
    .filter(([key]) => !key.startsWith('@'))
    .map(([key, value]) => {
      const sanitizedKey = sanitizeXmlTagName(key);
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        const childAttrs = Object.entries(value as Record<string, unknown>)
          .filter(([childKey]) => childKey.startsWith('@'))
          .map(([childKey, childValue]) => ` ${childKey.slice(1)}="${escapeXml(String(childValue))}"`)
          .join('');
        return `${indent}<${sanitizedKey}${childAttrs}>${nl}${serializeXmlNode(value, depth + 1, indentSize, cdataPaths, childPath)}${nl}${indent}</${sanitizedKey}>`;
      }
      const text = String(value ?? '');
      const content = cdataPaths.has(childPath) ? `<![CDATA[${text}]]>` : escapeXml(text);
      return `${indent}<${sanitizedKey}>${content}</${sanitizedKey}>`;
    })
    .join(nl);

  return children;
}

function toCSV(data: unknown, options: AdapterOptions): string {
  let rows: unknown[];
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) rows = [data];
    else return '';
  } else {
    rows = data;
  }

  if (rows.length === 0) return '';

  const delimiter = options.delimiter || ',';
  const quoteChar = options.quote || '"';
  const includeHeader = options.header !== false;
  const eol = options.lineEnding === 'lf' ? '\n' : '\r\n';

  const headerSet = new Set<string>();
  for (const row of rows) {
    if (typeof row === 'object' && row !== null) {
      for (const key of Object.keys(row as Record<string, unknown>)) {
        headerSet.add(key);
      }
    }
  }
  const headers = [...headerSet];
  const lines: string[] = [];

  if (includeHeader) {
    lines.push(headers.map((h) => csvField(h, delimiter, quoteChar)).join(delimiter));
  }

  for (const item of rows) {
    const record = (typeof item === 'object' && item !== null) ? item as Record<string, unknown> : {};
    const values = headers.map((header) => {
      const value = record[header];
      const stringValue = value === null || value === undefined ? '' : String(value);
      return csvField(stringValue, delimiter, quoteChar);
    });
    lines.push(values.join(delimiter));
  }

  return lines.join(eol);
}

function csvField(str: string, delimiter: string, quoteChar: string): string {
  if (str.includes(delimiter) || str.includes(quoteChar) || str.includes('\n') || str.includes('\r')) {
    const escaped = str.replace(new RegExp(escapeRegExp(quoteChar), 'g'), quoteChar + quoteChar);
    return `${quoteChar}${escaped}${quoteChar}`;
  }
  return str;
}

function escapeRegExp(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
