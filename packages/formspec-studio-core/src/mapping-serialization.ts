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
}

export function serializeMappedData(data: any, options: AdapterOptions = {}): string {
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
  } catch (err: any) {
    return `Serialization Error: ${err.message}`;
  }
}

function stripNulls(obj: any): any {
  if (Array.isArray(obj)) return obj.map(stripNulls);
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, any> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (value !== null) out[key] = stripNulls(value);
  }
  return out;
}

function sortKeysDeep(obj: any): any {
  if (Array.isArray(obj)) return obj.map(sortKeysDeep);
  if (typeof obj !== 'object' || obj === null) return obj;
  const out: Record<string, any> = {};
  for (const key of Object.keys(obj).sort()) {
    out[key] = sortKeysDeep(obj[key]);
  }
  return out;
}

function toJSON(data: any, options: AdapterOptions): string {
  let output = data;
  if (options.nullHandling === 'omit') output = stripNulls(output);
  if (options.sortKeys) output = sortKeysDeep(output);
  const indent = options.pretty ? 2 : undefined;
  return JSON.stringify(output, null, indent);
}

function toXML(data: any, options: AdapterOptions): string {
  const root = options.rootElement || 'root';
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
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function serializeXmlNode(
  data: any,
  depth: number,
  indentSize: number,
  cdataPaths: Set<string>,
  currentPath: string,
): string {
  if (data === null || data === undefined) return '';
  const indent = indentSize > 0 ? ' '.repeat(indentSize).repeat(depth) : '';
  const nl = indentSize > 0 ? '\n' : '';

  if (typeof data !== 'object') {
    return String(data);
  }

  if (Array.isArray(data)) {
    return data
      .map((item) => serializeXmlNode(item, depth, indentSize, cdataPaths, currentPath))
      .join(nl);
  }

  const children = Object.entries(data)
    .filter(([key]) => !key.startsWith('@'))
    .map(([key, value]) => {
      const childPath = currentPath ? `${currentPath}.${key}` : key;
      if (typeof value === 'object' && value !== null) {
        const childAttrs = Object.entries(value)
          .filter(([childKey]) => childKey.startsWith('@'))
          .map(([childKey, childValue]) => ` ${childKey.slice(1)}="${escapeXml(String(childValue))}"`)
          .join('');
        return `${indent}<${key}${childAttrs}>${nl}${serializeXmlNode(value, depth + 1, indentSize, cdataPaths, childPath)}${nl}${indent}</${key}>`;
      }
      const text = String(value ?? '');
      const content = cdataPaths.has(childPath) ? `<![CDATA[${text}]]>` : escapeXml(text);
      return `${indent}<${key}>${content}</${key}>`;
    })
    .join(nl);

  return children;
}

function toCSV(data: any, options: AdapterOptions): string {
  if (!Array.isArray(data)) {
    if (typeof data === 'object' && data !== null) data = [data];
    else return '';
  }

  if (data.length === 0) return '';

  const delimiter = options.delimiter || ',';
  const quoteChar = options.quote || '"';
  const includeHeader = options.header !== false;
  const eol = options.lineEnding === 'lf' ? '\n' : '\r\n';

  const headers = Object.keys(data[0]);
  const rows: string[] = [];

  if (includeHeader) {
    rows.push(headers.map((header) => csvField(header, delimiter, quoteChar)).join(delimiter));
  }

  for (const item of data) {
    const values = headers.map((header) => {
      const value = item[header];
      const stringValue = value === null || value === undefined ? '' : String(value);
      return csvField(stringValue, delimiter, quoteChar);
    });
    rows.push(values.join(delimiter));
  }

  return rows.join(eol);
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
