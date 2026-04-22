/** @filedesc Shared FEL value quoting/unquoting utilities. */

export function unquoteFELValue(value: string): string {
  return value.replace(/^'(.*)'$/, '$1').replace(/^"(.*)"$/, '$1');
}

export function quoteFELValue(raw: string): string {
  const isNumeric = /^\d+(\.\d+)?$/.test(raw);
  const isKeyword = raw === 'true' || raw === 'false' || raw === 'null';
  const needsQuotes = raw.length > 0 && !isNumeric && !isKeyword;
  return needsQuotes ? "'" + raw + "'" : raw;
}
