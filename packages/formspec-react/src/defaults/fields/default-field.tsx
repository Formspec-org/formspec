/** @filedesc Default field component — semantic HTML with theme cascade. */
import React from 'react';
import type { FieldComponentProps } from '../../component-map';

/**
 * Default field renderer — works for any field type.
 * Renders semantic HTML with ARIA attributes and theme-resolved classes.
 * Override per component type via the `components.fields` map.
 */
export function DefaultField({ field, node }: FieldComponentProps) {
    const isProtected = !field.visible && field.disabledDisplay === 'protected';
    const cssClass = [node.cssClasses?.join(' '), isProtected ? 'formspec-protected' : ''].filter(Boolean).join(' ');
    const describedBy = [
        field.hint ? `${field.id}-hint` : '',
        field.error ? `${field.id}-error` : '',
    ].filter(Boolean).join(' ');

    return (
        <div
            className={cssClass || undefined}
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
                {field.required && <span aria-hidden="true"> *</span>}
            </label>

            {field.hint && (
                <p id={`${field.id}-hint`} className="formspec-hint">
                    {field.hint}
                </p>
            )}

            {renderControl(field, node, describedBy, isProtected)}

            {field.error && (
                <p
                    id={`${field.id}-error`}
                    role="alert"
                    aria-live="polite"
                    className="formspec-error"
                >
                    {field.error}
                </p>
            )}
        </div>
    );
}

function renderControl(
    field: FieldComponentProps['field'],
    node: FieldComponentProps['node'],
    describedBy: string,
    isProtected = false,
) {
    const { dataType, id, path, value, options } = field;
    const common = {
        id,
        name: path,
        'aria-describedby': describedBy,
        'aria-invalid': !!field.error,
        'aria-required': field.required,
        readOnly: field.readonly || isProtected,
        'aria-disabled': isProtected || undefined,
    };

    switch (node.component) {
        case 'Select':
            return (
                <select
                    {...common}
                    value={value ?? ''}
                    onChange={(e) => field.setValue(e.target.value)}
                >
                    <option value="" disabled>- Select -</option>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            );

        case 'CheckboxGroup':
            return (
                <fieldset>
                    {options.map((opt) => (
                        <label key={opt.value}>
                            <input
                                type="checkbox"
                                name={path}
                                value={opt.value}
                                checked={Array.isArray(value) && value.includes(opt.value)}
                                onChange={(e) => {
                                    const current = Array.isArray(value) ? [...value] : [];
                                    if (e.target.checked) {
                                        current.push(opt.value);
                                    } else {
                                        const idx = current.indexOf(opt.value);
                                        if (idx >= 0) current.splice(idx, 1);
                                    }
                                    field.setValue(current);
                                }}
                            />
                            {opt.label}
                        </label>
                    ))}
                </fieldset>
            );

        case 'RadioGroup':
            return (
                <fieldset>
                    {options.map((opt) => (
                        <label key={opt.value}>
                            <input
                                type="radio"
                                name={path}
                                value={opt.value}
                                checked={value === opt.value}
                                onChange={() => field.setValue(opt.value)}
                            />
                            {opt.label}
                        </label>
                    ))}
                </fieldset>
            );

        case 'Toggle':
        case 'Checkbox':
            return (
                <input
                    {...common}
                    type="checkbox"
                    checked={!!value}
                    onChange={(e) => field.setValue(e.target.checked)}
                />
            );

        case 'DatePicker':
            return (
                <input
                    {...common}
                    type="date"
                    value={value ?? ''}
                    onChange={(e) => field.setValue(e.target.value)}
                />
            );

        case 'NumberInput':
            return (
                <input
                    {...common}
                    type="number"
                    value={value ?? ''}
                    onChange={(e) => field.setValue(e.target.value === '' ? null : Number(e.target.value))}
                />
            );

        case 'FileUpload':
            return (
                <input
                    {...common}
                    type="file"
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
                        onChange={(e) => field.setValue(e.target.value)}
                    />
                );
            }
            return (
                <input
                    {...common}
                    type="text"
                    value={value ?? ''}
                    onChange={(e) => field.setValue(e.target.value)}
                />
            );
        }
    }
}
