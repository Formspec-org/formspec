/** @filedesc Default field component — semantic HTML with ARIA, touch-gated errors, and CSS class structure. */
import React from 'react';
import type { FieldComponentProps } from '../../component-map';

/**
 * Default field renderer — works for any field type.
 * Renders semantic HTML with ARIA attributes, theme-resolved classes,
 * onBlur touch behavior, and touch-gated error display.
 * Override per component type via the `components.fields` map.
 */
export function DefaultField({ field, node }: FieldComponentProps) {
    const isProtected = !field.visible && field.disabledDisplay === 'protected';
    const isReadonly = field.readonly || isProtected;
    const showError = !!(field.error && field.touched);
    const themeClass = node.cssClasses?.join(' ') || '';

    const describedBy = [
        field.hint ? `${field.id}-hint` : '',
        showError ? `${field.id}-error` : '',
    ].filter(Boolean).join(' ') || undefined;

    // Checkbox / Toggle: inline layout
    if (node.component === 'Checkbox' || node.component === 'Toggle') {
        return (
            <div
                className={`formspec-field formspec-field--inline ${isProtected ? 'formspec-protected' : ''} ${themeClass}`.trim()}
                style={node.style as React.CSSProperties | undefined}
                data-name={field.path}
            >
                <input
                    id={field.id}
                    type="checkbox"
                    checked={!!field.value}
                    onChange={isReadonly ? undefined : (e) => field.setValue(e.target.checked)}
                    onBlur={() => field.touch()}
                    disabled={isReadonly}
                    aria-invalid={showError}
                    aria-required={field.required || undefined}
                    aria-describedby={describedBy}
                />
                <label htmlFor={field.id}>
                    {field.label}
                    {field.required && <span className="formspec-required" aria-hidden="true">*</span>}
                </label>
                <p id={`${field.id}-error`} className="formspec-error" aria-live="polite">
                    {showError ? field.error : ''}
                </p>
            </div>
        );
    }

    // RadioGroup / CheckboxGroup: fieldset + legend
    if (node.component === 'RadioGroup' || node.component === 'CheckboxGroup') {
        return (
            <fieldset
                className={`formspec-field ${isProtected ? 'formspec-protected' : ''} ${themeClass}`.trim()}
                style={node.style as React.CSSProperties | undefined}
                data-name={field.path}
                aria-describedby={describedBy}
                aria-required={field.required || undefined}
            >
                <legend>
                    {field.label}
                    {field.required && <span className="formspec-required" aria-hidden="true">*</span>}
                </legend>
                {field.hint && (
                    <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>
                )}
                {renderGroupControl(field, node)}
                <p id={`${field.id}-error`} className="formspec-error" aria-live="polite">
                    {showError ? field.error : ''}
                </p>
            </fieldset>
        );
    }

    // Standard field: div + label + control
    return (
        <div
            className={`formspec-field ${isProtected ? 'formspec-protected' : ''} ${themeClass}`.trim()}
            style={node.style as React.CSSProperties | undefined}
            data-name={field.path}
            {...(node.accessibility?.role ? { role: node.accessibility.role } : {})}
            {...(node.accessibility?.description ? { 'aria-description': node.accessibility.description } : {})}
        >
            <label
                htmlFor={field.id}
                className={node.labelPosition === 'hidden' ? 'sr-only' : undefined}
            >
                {field.label}
                {field.required && <span className="formspec-required" aria-hidden="true">*</span>}
            </label>

            {field.hint && (
                <p id={`${field.id}-hint`} className="formspec-hint">{field.hint}</p>
            )}

            {renderControl(field, node, describedBy, isProtected)}

            <p id={`${field.id}-error`} className="formspec-error" aria-live="polite">
                {showError ? field.error : ''}
            </p>
        </div>
    );
}

/** Renders radio/checkbox group options. */
function renderGroupControl(
    field: FieldComponentProps['field'],
    node: FieldComponentProps['node'],
) {
    if (node.component === 'RadioGroup') {
        return (
            <div className="formspec-radio-group">
                {field.options.map((opt) => (
                    <label key={opt.value}>
                        <input
                            type="radio"
                            name={field.path}
                            value={opt.value}
                            checked={field.value === opt.value}
                            onChange={() => { field.setValue(opt.value); field.touch(); }}
                        />
                        {opt.label}
                    </label>
                ))}
            </div>
        );
    }

    // CheckboxGroup
    const current = Array.isArray(field.value) ? field.value : [];
    return (
        <div className="formspec-checkbox-group">
            {field.options.map((opt) => (
                <label key={opt.value}>
                    <input
                        type="checkbox"
                        name={field.path}
                        value={opt.value}
                        checked={current.includes(opt.value)}
                        onChange={(e) => {
                            const next = e.target.checked
                                ? [...current, opt.value]
                                : current.filter((v: string) => v !== opt.value);
                            field.setValue(next);
                            field.touch();
                        }}
                    />
                    {opt.label}
                </label>
            ))}
        </div>
    );
}

/** Renders the form control for standard (non-group) field types. */
function renderControl(
    field: FieldComponentProps['field'],
    node: FieldComponentProps['node'],
    describedBy: string | undefined,
    isProtected = false,
) {
    const { dataType, id, path, value } = field;
    const isReadonly = field.readonly || isProtected;
    const showError = !!(field.error && field.touched);
    const autoComplete = (node.props?.autoComplete as string) || undefined;
    const common = {
        id,
        name: path,
        'aria-describedby': describedBy,
        'aria-invalid': showError,
        'aria-required': field.required,
        required: field.required,
        'aria-disabled': isProtected || undefined,
        onBlur: () => field.touch(),
        autoComplete,
    };

    switch (node.component) {
        case 'Select':
            return (
                <select
                    {...common}
                    value={value ?? ''}
                    onChange={isReadonly ? undefined : (e) => field.setValue(e.target.value)}
                    disabled={isReadonly}
                >
                    <option value="" disabled>- Select -</option>
                    {field.options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );

        case 'DatePicker':
            return (
                <input
                    {...common}
                    type="date"
                    value={value ?? ''}
                    readOnly={isReadonly}
                    onChange={(e) => field.setValue(e.target.value)}
                />
            );

        case 'NumberInput':
            return (
                <input
                    {...common}
                    type="number"
                    value={value ?? ''}
                    readOnly={isReadonly}
                    onChange={(e) => field.setValue(e.target.value === '' ? null : Number(e.target.value))}
                />
            );

        case 'FileUpload':
            return (
                <input
                    {...common}
                    type="file"
                    disabled={isReadonly}
                    onChange={(e) => field.setValue(e.target.files)}
                />
            );

        case 'TextInput':
        default: {
            const isTextarea = dataType === 'text';
            if (isTextarea) {
                return (
                    <textarea
                        {...common}
                        value={value ?? ''}
                        readOnly={isReadonly}
                        onChange={(e) => field.setValue(e.target.value)}
                    />
                );
            }
            return (
                <input
                    {...common}
                    type="text"
                    value={value ?? ''}
                    readOnly={isReadonly}
                    onChange={(e) => field.setValue(e.target.value)}
                />
            );
        }
    }
}
