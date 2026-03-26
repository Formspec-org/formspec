/** @filedesc Default field component — semantic HTML with ARIA, touch-gated errors, and CSS class structure. */
import React, { useRef, useEffect, useState } from 'react';
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
        const onLabel = node.props?.onLabel as string | undefined;
        const offLabel = node.props?.offLabel as string | undefined;
        const hasToggleLabels = node.component === 'Toggle' && (onLabel || offLabel);

        return (
            <div
                className={`formspec-field formspec-field--inline ${isProtected ? 'formspec-protected' : ''} ${themeClass}`.trim()}
                style={node.style as React.CSSProperties | undefined}
                data-name={field.path}
            >
                {hasToggleLabels && (
                    <span className="formspec-toggle-label formspec-toggle-off" aria-hidden="true">
                        {offLabel}
                    </span>
                )}
                <input
                    id={field.id}
                    type="checkbox"
                    // Item 17: Toggle gets role="switch", plain Checkbox does not
                    role={node.component === 'Toggle' ? 'switch' : undefined}
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
                {hasToggleLabels && (
                    <span className="formspec-toggle-label formspec-toggle-on" aria-hidden="true">
                        {onLabel}
                    </span>
                )}
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
                {/* Item 4: pass isReadonly so individual inputs get disabled */}
                {renderGroupControl(field, node, isReadonly)}
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
    // Item 4: isReadonly propagated to each input
    isReadonly: boolean,
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
                            disabled={isReadonly}
                            onChange={isReadonly ? undefined : () => { field.setValue(opt.value); field.touch(); }}
                        />
                        {opt.label}
                    </label>
                ))}
            </div>
        );
    }

    // CheckboxGroup
    const current = Array.isArray(field.value) ? field.value : [];
    const columns = node.props?.columns as number | undefined;
    const selectAll = node.props?.selectAll as boolean | undefined;
    const allValues = field.options.map(o => o.value);
    const allSelected = allValues.length > 0 && allValues.every(v => current.includes(v));

    const groupStyle: React.CSSProperties | undefined = columns
        ? { display: 'grid', gridTemplateColumns: `repeat(${columns}, 1fr)` }
        : undefined;

    return (
        <div className="formspec-checkbox-group" style={groupStyle}>
            {selectAll && (
                <label className="formspec-select-all" data-select-all>
                    <input
                        type="checkbox"
                        aria-label="Select all"
                        checked={allSelected}
                        disabled={isReadonly}
                        onChange={isReadonly ? undefined : (e) => {
                            field.setValue(e.target.checked ? [...allValues] : []);
                            field.touch();
                        }}
                    />
                    Select all
                </label>
            )}
            {field.options.map((opt) => (
                <label key={opt.value}>
                    <input
                        type="checkbox"
                        name={field.path}
                        value={opt.value}
                        checked={current.includes(opt.value)}
                        disabled={isReadonly}
                        onChange={isReadonly ? undefined : (e) => {
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
        case 'Select': {
            const clearable = node.props?.clearable as boolean | undefined;
            const searchable = node.props?.searchable as boolean | undefined;

            // Item 18: searchable path — custom listbox with text filter
            if (searchable) {
                return (
                    <SearchableSelect
                        field={field}
                        common={common}
                        isReadonly={isReadonly}
                    />
                );
            }

            return (
                <div className="formspec-select-wrapper">
                    <select
                        {...common}
                        value={value ?? ''}
                        onChange={isReadonly ? undefined : (e) => field.setValue(e.target.value)}
                        disabled={isReadonly}
                    >
                        {/* Item 5: hidden prevents placeholder appearing in iOS picker dropdown */}
                        <option value="" disabled hidden>- Select -</option>
                        {field.options.map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                        ))}
                    </select>
                    {clearable && value && !isReadonly && (
                        <button
                            type="button"
                            className="formspec-select-clear"
                            aria-label="Clear selection"
                            onClick={() => { field.setValue(null); field.touch(); }}
                        >
                            {/* Item 28: hide decorative × from screen readers */}
                            <span aria-hidden="true">×</span>
                        </button>
                    )}
                </div>
            );
        }

        case 'DatePicker': {
            const variant = node.props?.variant as string | undefined;
            // Item 20: minDate/maxDate → native min/max attributes
            const minDate = node.props?.minDate as string | undefined;
            const maxDate = node.props?.maxDate as string | undefined;
            let inputType = 'date';
            if (variant === 'dateTime' || dataType === 'datetime') inputType = 'datetime-local';
            else if (variant === 'time' || dataType === 'time') inputType = 'time';
            return (
                <input
                    {...common}
                    type={inputType}
                    value={value ?? ''}
                    readOnly={isReadonly}
                    min={minDate}
                    max={maxDate}
                    onChange={(e) => field.setValue(e.target.value)}
                />
            );
        }

        case 'NumberInput': {
            const min = node.props?.min != null ? Number(node.props.min) : undefined;
            const max = node.props?.max != null ? Number(node.props.max) : undefined;
            const step = node.props?.step != null ? Number(node.props.step) : undefined;
            const showStepper = node.props?.showStepper as boolean | undefined;

            const numberInput = (
                <input
                    {...common}
                    type="number"
                    value={value ?? ''}
                    readOnly={isReadonly}
                    min={min != null ? String(min) : undefined}
                    max={max != null ? String(max) : undefined}
                    step={step != null ? String(step) : undefined}
                    onChange={(e) => field.setValue(e.target.value === '' ? null : Number(e.target.value))}
                />
            );

            if (showStepper) {
                const stepVal = step ?? 1;
                const numVal = typeof value === 'number' ? value : 0;
                return (
                    <div className="formspec-stepper">
                        <button
                            type="button"
                            className="formspec-stepper-decrement"
                            // Item 26: include field label for screen reader context
                            aria-label={`Decrease ${field.label}`}
                            disabled={isReadonly || (min != null && numVal - stepVal < min)}
                            onClick={() => { field.setValue(numVal - stepVal); field.touch(); }}
                        >
                            −
                        </button>
                        {numberInput}
                        <button
                            type="button"
                            className="formspec-stepper-increment"
                            // Item 26: include field label for screen reader context
                            aria-label={`Increase ${field.label}`}
                            disabled={isReadonly || (max != null && numVal + stepVal > max)}
                            onClick={() => { field.setValue(numVal + stepVal); field.touch(); }}
                        >
                            +
                        </button>
                    </div>
                );
            }

            return numberInput;
        }

        case 'FileUpload':
            return <FileUploadControl field={field} node={node} common={common} isReadonly={isReadonly} />;

        case 'MoneyInput':
            return <MoneyInputControl field={field} node={node} common={common} isReadonly={isReadonly} />;

        case 'Slider':
            return <SliderControl field={field} node={node} common={common} isReadonly={isReadonly} />;

        case 'Rating':
            return <RatingControl field={field} node={node} isReadonly={isReadonly} />;

        case 'Signature':
            return <SignatureControl field={field} node={node} />;

        case 'TextInput':
        default: {
            const maxLines = node.props?.maxLines as number | undefined;
            const prefix = node.props?.prefix as string | undefined;
            const suffix = node.props?.suffix as string | undefined;
            const placeholder = node.props?.placeholder as string | undefined;
            const inputMode = node.props?.inputMode as string | undefined;
            const isTextarea = dataType === 'text' || maxLines != null;

            // Item 15: build aria-describedby chain that includes prefix/suffix ids
            const adornmentIds = [
                prefix ? `${id}-prefix` : '',
                suffix ? `${id}-suffix` : '',
            ].filter(Boolean);
            const adornedDescribedBy = adornmentIds.length
                ? [...(describedBy ? [describedBy] : []), ...adornmentIds].join(' ')
                : describedBy;

            const controlProps = {
                ...common,
                'aria-describedby': adornedDescribedBy || undefined,
            };

            const control = isTextarea ? (
                <textarea
                    {...controlProps}
                    rows={maxLines}
                    placeholder={placeholder}
                    value={value ?? ''}
                    readOnly={isReadonly}
                    onChange={(e) => field.setValue(e.target.value)}
                />
            ) : (
                <input
                    {...controlProps}
                    type="text"
                    value={value ?? ''}
                    readOnly={isReadonly}
                    placeholder={placeholder}
                    inputMode={inputMode as React.HTMLAttributes<HTMLInputElement>['inputMode']}
                    onChange={(e) => field.setValue(e.target.value)}
                />
            );

            if (prefix || suffix) {
                return (
                    <div className="formspec-input-adornment">
                        {/* Item 15: id on prefix/suffix spans for aria-describedby linkage */}
                        {prefix && <span id={`${id}-prefix`} className="formspec-input-prefix">{prefix}</span>}
                        {control}
                        {suffix && <span id={`${id}-suffix`} className="formspec-input-suffix">{suffix}</span>}
                    </div>
                );
            }
            return control;
        }
    }
}

// ── Compound input components ─────────────────────────────────────

interface CommonInputProps {
    field: FieldComponentProps['field'];
    node: FieldComponentProps['node'];
    common: Record<string, any>;
    isReadonly: boolean;
}

/** Item 18: Searchable select — custom listbox with text filter input. */
function SearchableSelect({ field, common, isReadonly }: Omit<CommonInputProps, 'node'>) {
    const [filter, setFilter] = useState('');
    const filtered = field.options.filter(
        opt => opt.label.toLowerCase().includes(filter.toLowerCase())
    );

    return (
        <div className="formspec-select-searchable">
            <input
                type="text"
                placeholder="Search…"
                value={filter}
                disabled={isReadonly}
                aria-label="Filter options"
                onInput={(e) => setFilter((e.target as HTMLInputElement).value)}
                onChange={(e) => setFilter(e.target.value)}
            />
            <ul
                role="listbox"
                id={common.id ? `${common.id}-listbox` : undefined}
            >
                {filtered.map((opt) => (
                    <li
                        key={opt.value}
                        role="option"
                        aria-selected={field.value === opt.value}
                        className={field.value === opt.value ? 'formspec-option--selected' : undefined}
                        onClick={isReadonly ? undefined : () => { field.setValue(opt.value); field.touch(); }}
                    >
                        {opt.label}
                    </li>
                ))}
            </ul>
        </div>
    );
}

function MoneyInputControl({ field, node, common, isReadonly }: CommonInputProps) {
    const currency = (node.props?.currency as string) || 'USD';
    const min = node.props?.min != null ? String(node.props.min) : undefined;
    const max = node.props?.max != null ? String(node.props.max) : undefined;
    const step = node.props?.step as string | undefined;

    // Item 13: give currency span a stable id for aria-describedby linkage
    const currencyId = `${field.id}-currency`;

    // Value is either a number (amount only) or { amount, currency }
    const rawValue = field.value;
    const amount = rawValue != null
        ? (typeof rawValue === 'object' ? (rawValue as any).amount ?? '' : rawValue)
        : '';

    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const raw = e.target.value;
        const num = raw === '' ? null : Number(raw);
        field.setValue(num);
    };

    // Item 13: append currency id to existing aria-describedby chain
    const moneyDescribedBy = [common['aria-describedby'], currencyId]
        .filter(Boolean)
        .join(' ') || undefined;

    return (
        <div className="formspec-money-field">
            <span id={currencyId} className="formspec-money-currency">{currency}</span>
            <input
                {...common}
                type="text"
                inputMode="decimal"
                aria-describedby={moneyDescribedBy}
                value={amount === null || amount === undefined ? '' : String(amount)}
                readOnly={isReadonly}
                min={min}
                max={max}
                step={step}
                onChange={isReadonly ? undefined : handleChange}
            />
        </div>
    );
}

function SliderControl({ field, node, common, isReadonly }: CommonInputProps) {
    const min = node.props?.min != null ? String(node.props.min) : undefined;
    const max = node.props?.max != null ? String(node.props.max) : undefined;
    const step = node.props?.step != null ? String(node.props.step) : undefined;
    const displayValue = field.value != null ? String(field.value) : (min ?? '0');

    return (
        <div className="formspec-slider">
            <input
                {...common}
                type="range"
                value={field.value ?? (min ?? 0)}
                readOnly={isReadonly}
                min={min}
                max={max}
                step={step}
                // Item 14: announce formatted value to screen readers
                aria-valuetext={displayValue}
                onChange={isReadonly ? undefined : (e) => field.setValue(Number(e.target.value))}
            />
            <span className="formspec-slider-value">{displayValue}</span>
        </div>
    );
}

function RatingControl({ field, node, isReadonly }: { field: FieldComponentProps['field']; node: FieldComponentProps['node']; isReadonly: boolean }) {
    const maxRating = (node.props?.maxRating as number) || 5;
    const allowHalf = node.props?.allowHalf === true;
    const currentValue = typeof field.value === 'number' ? field.value : 0;

    return (
        <div
            className="formspec-rating"
            role="group"
            aria-label={field.label}
        >
            {Array.from({ length: maxRating }, (_, i) => {
                const starValue = i + 1;
                const halfValue = i + 0.5;
                const isSelected = starValue <= currentValue;
                const isHalf = allowHalf && !isSelected && halfValue <= currentValue;

                return (
                    <button
                        key={starValue}
                        type="button"
                        className={[
                            'formspec-rating-star',
                            isSelected ? 'formspec-rating-star--selected' : '',
                            isHalf ? 'formspec-rating-star--half' : '',
                        ].filter(Boolean).join(' ')}
                        onClick={isReadonly ? undefined : () => { field.setValue(starValue); field.touch(); }}
                        aria-label={`${starValue} star${starValue !== 1 ? 's' : ''}`}
                        // Item 27: communicate selected state to screen readers
                        aria-pressed={isSelected}
                        disabled={isReadonly}
                    >
                        {isSelected || isHalf ? '\u2605' : '\u2606'}
                    </button>
                );
            })}
        </div>
    );
}

function SignatureControl({ field, node }: { field: FieldComponentProps['field']; node: FieldComponentProps['node'] }) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const isDrawingRef = useRef(false);
    const height = (node.props?.height as number) || 200;
    const penColor = (node.props?.penColor as string) || '#000000';

    // Stable refs — field.setValue and field.touch don't change identity across renders,
    // but the `field` object itself is recreated by useField on every render.
    const { setValue, touch } = field;

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        ctx.strokeStyle = penColor;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';

        const getPos = (e: MouseEvent | TouchEvent) => {
            const rect = canvas.getBoundingClientRect();
            if ('touches' in e) {
                return { x: e.touches[0].clientX - rect.left, y: e.touches[0].clientY - rect.top };
            }
            return { x: e.clientX - rect.left, y: e.clientY - rect.top };
        };

        const onStart = (e: MouseEvent | TouchEvent) => {
            e.preventDefault();
            isDrawingRef.current = true;
            const { x, y } = getPos(e);
            ctx.beginPath();
            ctx.moveTo(x, y);
        };

        const onMove = (e: MouseEvent | TouchEvent) => {
            if (!isDrawingRef.current) return;
            e.preventDefault();
            const { x, y } = getPos(e);
            ctx.lineTo(x, y);
            ctx.stroke();
        };

        const onEnd = () => {
            if (!isDrawingRef.current) return;
            isDrawingRef.current = false;
            setValue(canvas.toDataURL());
            touch();
        };

        canvas.addEventListener('mousedown', onStart);
        canvas.addEventListener('mousemove', onMove);
        canvas.addEventListener('mouseup', onEnd);
        canvas.addEventListener('touchstart', onStart, { passive: false });
        canvas.addEventListener('touchmove', onMove, { passive: false });
        canvas.addEventListener('touchend', onEnd);

        return () => {
            canvas.removeEventListener('mousedown', onStart);
            canvas.removeEventListener('mousemove', onMove);
            canvas.removeEventListener('mouseup', onEnd);
            canvas.removeEventListener('touchstart', onStart);
            canvas.removeEventListener('touchmove', onMove);
            canvas.removeEventListener('touchend', onEnd);
        };
    }, [penColor, setValue, touch]);

    const handleClear = () => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        ctx?.clearRect(0, 0, canvas.width, canvas.height);
        field.setValue(null);
        field.touch();
    };

    return (
        <div className="formspec-signature">
            <canvas
                ref={canvasRef}
                id={field.id}
                width={400}
                height={height}
                // Item 1: WCAG 2.1.1 / 4.1.2 — canvas needs role, label, and keyboard focus
                role="img"
                aria-label={`Signature pad for ${field.label}`}
                tabIndex={0}
                style={{ border: '1px solid #ccc', touchAction: 'none', cursor: 'crosshair' }}
            />
            <button
                type="button"
                className="formspec-signature-clear"
                // Item 1: include field label so clear button has context for screen readers
                aria-label={`Clear ${field.label}`}
                onClick={handleClear}
            >
                Clear
            </button>
        </div>
    );
}

/** Item 22: FileUpload with drag-drop zone and maxSize validation. */
function FileUploadControl({ field, node, common, isReadonly }: CommonInputProps) {
    const accept = node.props?.accept as string | undefined;
    const multiple = node.props?.multiple as boolean | undefined;
    const maxSize = node.props?.maxSize as number | undefined;
    // Item 22: dragDrop defaults to true
    const dragDrop = node.props?.dragDrop !== false;
    const [sizeError, setSizeError] = useState<string | null>(null);
    const [isDragOver, setIsDragOver] = useState(false);

    const handleFiles = (files: FileList | null) => {
        if (!files || files.length === 0) return;
        // Item 19: reject files that exceed maxSize before calling setValue
        if (maxSize != null) {
            const oversized = Array.from(files).find(f => f.size > maxSize);
            if (oversized) {
                setSizeError(`File "${oversized.name}" exceeds the maximum size limit.`);
                return;
            }
        }
        setSizeError(null);
        field.setValue(files);
    };

    const inputEl = (
        <input
            {...common}
            type="file"
            disabled={isReadonly}
            accept={accept}
            multiple={multiple}
            onChange={(e) => handleFiles(e.target.files)}
        />
    );

    if (!dragDrop) {
        return (
            <>
                {inputEl}
                {sizeError && (
                    <p className="formspec-file-size-error formspec-error" aria-live="polite">
                        {sizeError}
                    </p>
                )}
            </>
        );
    }

    return (
        <div
            className={`formspec-file-drop-zone${isDragOver ? ' formspec-file-drop-zone--active' : ''}`}
            onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
            onDragLeave={() => setIsDragOver(false)}
            onDrop={(e) => {
                e.preventDefault();
                setIsDragOver(false);
                handleFiles(e.dataTransfer.files);
            }}
        >
            {inputEl}
            <span className="formspec-file-drop-label">Drop files here</span>
            {sizeError && (
                <p className="formspec-file-size-error formspec-error" aria-live="polite">
                    {sizeError}
                </p>
            )}
        </div>
    );
}
