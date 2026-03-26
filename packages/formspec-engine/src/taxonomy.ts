/** @filedesc Data type taxonomy predicates per spec S4.2.3. */

const NUMERIC_TYPES = new Set(['integer', 'decimal', 'money']);
const DATE_TYPES = new Set(['date', 'time', 'dateTime']);
const CHOICE_TYPES = new Set(['select', 'selectMany']);
const TEXT_TYPES = new Set(['string', 'text']);
const BINARY_TYPES = new Set(['file', 'image', 'signature', 'barcode']);

/** True if `dataType` is a numeric type (integer, decimal, money). */
export function isNumericType(dataType: string): boolean {
    return NUMERIC_TYPES.has(dataType);
}

/** True if `dataType` is a date/time type (date, time, dateTime). */
export function isDateType(dataType: string): boolean {
    return DATE_TYPES.has(dataType);
}

/** True if `dataType` is a choice type (select, selectMany). */
export function isChoiceType(dataType: string): boolean {
    return CHOICE_TYPES.has(dataType);
}

/** True if `dataType` is a text type (string, text). */
export function isTextType(dataType: string): boolean {
    return TEXT_TYPES.has(dataType);
}

/** True if `dataType` is a binary/media type (file, image, signature, barcode). */
export function isBinaryType(dataType: string): boolean {
    return BINARY_TYPES.has(dataType);
}

/** True if `dataType` is boolean. */
export function isBooleanType(dataType: string): boolean {
    return dataType === 'boolean';
}
