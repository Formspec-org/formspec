/** Story pane that renders the real USWDS component markup in an isolated shadow root. */
import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import uswdsCssUrl from '@uswds/uswds/css/uswds.css?url';

type USWDSBehavior = {
    on?: (root?: ParentNode) => void;
    off?: (root?: ParentNode) => void;
};

type FormspecItem = {
    key: string;
    type?: string;
    dataType?: string;
    label?: string;
    hint?: string;
    required?: boolean;
    repeatable?: boolean;
    minRepeat?: number;
    maxRepeat?: number;
    relevant?: string;
    constraint?: string;
    constraintMessage?: string;
    options?: Array<{ value: string; label: string }>;
    presentation?: Record<string, any>;
    children?: FormspecItem[];
};

type RenderPreset = {
    errors: Record<string, string>;
    values: Record<string, any>;
    repeats: Record<string, number>;
};

export interface RealUSWDSStoryProps {
    definition: any;
    componentDocument?: any;
    showSubmit?: boolean;
    maxWidth?: number;
}

const paneStyle: React.CSSProperties = {
    maxWidth: 640,
    margin: '0 auto',
};

const groupCardStyle: React.CSSProperties = {
    border: '1px solid #dfe1e2',
    borderRadius: 4,
    padding: '1rem',
    marginTop: '1rem',
};

function requiredMark(required?: boolean) {
    if (!required) return null;
    return (
        <span className="usa-label--required" aria-hidden="true">
            {' *'}
        </span>
    );
}

function renderHint(item: FormspecItem, id: string, fallback?: string) {
    const text = item.hint ?? fallback;
    if (!text) return null;
    return (
        <div className="usa-hint" id={`${id}-hint`}>
            {text}
        </div>
    );
}

function normalizeWidgetHint(item: FormspecItem) {
    return String(item.presentation?.widgetHint ?? '').trim().toLowerCase();
}

function toId(path: string) {
    return `real-uswds-${path.replace(/[^a-zA-Z0-9_-]+/g, '-')}`;
}

function getPreset(definition: any): RenderPreset {
    if (definition?.title === 'Conditional Fields') {
        return {
            errors: {},
            values: { hasOther: true },
            repeats: {},
        };
    }

    if (definition?.title === 'Validation Demo') {
        return {
            errors: {
                username: 'Username must be 3-20 characters',
                password: 'Password must be at least 8 characters',
            },
            values: {
                username: 'ab',
                password: 'short',
            },
            repeats: {},
        };
    }

    if (definition?.title === 'Repeat Group') {
        return {
            errors: {},
            values: {
                'members[0].memberName': 'Avery Chen',
                'members[0].memberRole': 'Project Lead',
                'members[1].memberName': 'Jordan Patel',
                'members[1].memberRole': 'Technical Writer',
            },
            repeats: {
                members: 2,
            },
        };
    }

    return {
        errors: {},
        values: {},
        repeats: {},
    };
}

function renderAlert(text: string, severity: 'info' | 'warning' | 'error' | 'success' = 'info', heading?: string) {
    const className = severity === 'error'
        ? 'usa-alert usa-alert--error'
        : severity === 'warning'
            ? 'usa-alert usa-alert--warning'
            : severity === 'success'
                ? 'usa-alert usa-alert--success'
                : 'usa-alert usa-alert--info';

    return (
        <div className={className} role={severity === 'error' ? 'alert' : undefined}>
            <div className="usa-alert__body">
                {heading ? <h3 className="usa-alert__heading">{heading}</h3> : null}
                <p className="usa-alert__text">{text}</p>
            </div>
        </div>
    );
}

function renderDisplayItem(item: FormspecItem, path: string) {
    const widgetHint = normalizeWidgetHint(item);
    const key = path;

    if (widgetHint === 'heading') return <h2 key={key}>{item.label}</h2>;
    if (widgetHint === 'paragraph') return <p key={key}>{item.label}</p>;
    if (widgetHint === 'banner') return <div key={key}>{renderAlert(item.label ?? '', 'info')}</div>;
    if (widgetHint === 'divider') return <hr key={key} style={{ margin: '1.5rem 0' }} />;

    return null;
}

function renderTextInput(item: FormspecItem, id: string, value: any, errorMessage?: string) {
    const multiline = Number(item.presentation?.maxLines ?? 1) > 1 || item.dataType === 'text';
    const describedBy = [
        item.hint ? `${id}-hint` : '',
        errorMessage ? `${id}-error` : '',
    ].filter(Boolean).join(' ') || undefined;
    const rootClass = errorMessage ? 'usa-form-group usa-form-group--error' : 'usa-form-group';
    const labelClass = errorMessage ? 'usa-label usa-label--error' : 'usa-label';
    const controlClass = multiline
        ? errorMessage ? 'usa-textarea usa-input--error' : 'usa-textarea'
        : errorMessage ? 'usa-input usa-input--error' : 'usa-input';

    return (
        <div className={rootClass}>
            <label className={labelClass} htmlFor={id}>
                {item.label}
                {requiredMark(item.required)}
            </label>
            {renderHint(item, id)}
            {errorMessage ? <span className="usa-error-message" id={`${id}-error`} role="alert">{errorMessage}</span> : null}
            {multiline ? (
                <textarea
                    className={controlClass}
                    id={id}
                    name={item.key}
                    rows={Math.max(3, Number(item.presentation?.maxLines ?? 5))}
                    placeholder={item.presentation?.placeholder}
                    aria-describedby={describedBy}
                    defaultValue={value}
                    required={item.required}
                />
            ) : (
                <input
                    className={controlClass}
                    id={id}
                    name={item.key}
                    type={item.presentation?.inputType === 'email' ? 'email' : 'text'}
                    placeholder={item.presentation?.placeholder}
                    aria-describedby={describedBy}
                    defaultValue={value}
                    required={item.required}
                />
            )}
        </div>
    );
}

function renderSelect(item: FormspecItem, id: string, value: any, errorMessage?: string) {
    const describedBy = [
        item.hint ? `${id}-hint` : '',
        errorMessage ? `${id}-error` : '',
    ].filter(Boolean).join(' ') || undefined;
    const rootClass = errorMessage ? 'usa-form-group usa-form-group--error' : 'usa-form-group';
    const labelClass = errorMessage ? 'usa-label usa-label--error' : 'usa-label';
    const selectClass = errorMessage ? 'usa-select usa-input--error' : 'usa-select';

    return (
        <div className={rootClass}>
            <label className={labelClass} htmlFor={id}>
                {item.label}
                {requiredMark(item.required)}
            </label>
            {renderHint(item, id)}
            {errorMessage ? <span className="usa-error-message" id={`${id}-error`} role="alert">{errorMessage}</span> : null}
            <select className={selectClass} id={id} name={item.key} aria-describedby={describedBy} defaultValue={value ?? ''} required={item.required}>
                <option value="" disabled={Boolean(item.required)}>
                    {item.presentation?.placeholder || '- Select -'}
                </option>
                {(item.options ?? []).map((option) => (
                    <option key={option.value} value={option.value}>
                        {option.label}
                    </option>
                ))}
            </select>
        </div>
    );
}

function renderRadioGroup(item: FormspecItem, id: string, value: any, errorMessage?: string) {
    return (
        <fieldset className={errorMessage ? 'usa-fieldset usa-form-group usa-form-group--error' : 'usa-fieldset'}>
            <legend className={errorMessage ? 'usa-legend usa-label--error' : 'usa-legend'}>
                {item.label}
                {requiredMark(item.required)}
            </legend>
            {renderHint(item, id)}
            {errorMessage ? <span className="usa-error-message" id={`${id}-error`} role="alert">{errorMessage}</span> : null}
            {(item.options ?? []).map((option) => {
                const optionId = `${id}-${option.value}`;
                return (
                    <div className="usa-radio" key={option.value}>
                        <input
                            className="usa-radio__input"
                            id={optionId}
                            type="radio"
                            name={item.key}
                            value={option.value}
                            aria-describedby={[
                                item.hint ? `${id}-hint` : '',
                                errorMessage ? `${id}-error` : '',
                            ].filter(Boolean).join(' ') || undefined}
                            defaultChecked={value === option.value}
                        />
                        <label className="usa-radio__label" htmlFor={optionId}>
                            {option.label}
                        </label>
                    </div>
                );
            })}
        </fieldset>
    );
}

function renderCheckbox(item: FormspecItem, id: string, value: any) {
    return (
        <div className="usa-form-group">
            <div className="usa-checkbox">
                <input className="usa-checkbox__input" id={id} type="checkbox" name={item.key} value="true" defaultChecked={Boolean(value)} />
                <label className="usa-checkbox__label" htmlFor={id}>
                    {item.label}
                    {requiredMark(item.required)}
                </label>
            </div>
            {renderHint(item, id)}
        </div>
    );
}

function renderCheckboxGroup(item: FormspecItem, id: string, value: any) {
    const selected = Array.isArray(value) ? new Set(value) : new Set<string>();
    return (
        <fieldset className="usa-fieldset">
            <legend className="usa-legend">
                {item.label}
                {requiredMark(item.required)}
            </legend>
            {renderHint(item, id)}
            {(item.options ?? []).map((option) => {
                const optionId = `${id}-${option.value}`;
                return (
                    <div className="usa-checkbox" key={option.value}>
                        <input
                            className="usa-checkbox__input"
                            id={optionId}
                            type="checkbox"
                            name={item.key}
                            value={option.value}
                            defaultChecked={selected.has(option.value)}
                        />
                        <label className="usa-checkbox__label" htmlFor={optionId}>
                            {option.label}
                        </label>
                    </div>
                );
            })}
        </fieldset>
    );
}

function renderNumberInput(item: FormspecItem, id: string, value: any, errorMessage?: string) {
    const describedBy = [
        item.hint ? `${id}-hint` : '',
        errorMessage ? `${id}-error` : '',
    ].filter(Boolean).join(' ') || undefined;
    return (
        <div className={errorMessage ? 'usa-form-group usa-form-group--error' : 'usa-form-group'}>
            <label className={errorMessage ? 'usa-label usa-label--error' : 'usa-label'} htmlFor={id}>
                {item.label}
                {requiredMark(item.required)}
            </label>
            {renderHint(item, id)}
            {errorMessage ? <span className="usa-error-message" id={`${id}-error`} role="alert">{errorMessage}</span> : null}
            <input
                className={errorMessage ? 'usa-input usa-input--error' : 'usa-input'}
                id={id}
                name={item.key}
                type="number"
                min={item.presentation?.min}
                max={item.presentation?.max}
                step={item.presentation?.step}
                aria-describedby={describedBy}
                defaultValue={value}
                required={item.required}
            />
        </div>
    );
}

function renderMoneyInput(item: FormspecItem, id: string, value: any, errorMessage?: string) {
    const describedBy = [
        item.hint ? `${id}-hint` : '',
        errorMessage ? `${id}-error` : '',
    ].filter(Boolean).join(' ') || undefined;
    return (
        <div className={errorMessage ? 'usa-form-group usa-form-group--error' : 'usa-form-group'}>
            <label className={errorMessage ? 'usa-label usa-label--error' : 'usa-label'} htmlFor={id}>
                {item.label}
                {requiredMark(item.required)}
            </label>
            {renderHint(item, id)}
            {errorMessage ? <span className="usa-error-message" id={`${id}-error`} role="alert">{errorMessage}</span> : null}
            <div className={errorMessage ? 'usa-input-group usa-input--error' : 'usa-input-group'}>
                <div className="usa-input-prefix" aria-hidden="true">$</div>
                <input
                    className="usa-input"
                    id={id}
                    name={item.key}
                    type="number"
                    inputMode="decimal"
                    step="0.01"
                    aria-describedby={describedBy}
                    defaultValue={value}
                    required={item.required}
                />
            </div>
        </div>
    );
}

function renderDatePicker(item: FormspecItem, id: string, value: any, errorMessage?: string) {
    const hint = item.hint ?? 'MM/DD/YYYY';
    return (
        <div className={errorMessage ? 'usa-form-group usa-form-group--error' : 'usa-form-group'}>
            <label className={errorMessage ? 'usa-label usa-label--error' : 'usa-label'} id={`${id}-label`} htmlFor={id}>
                {item.label}
                {requiredMark(item.required)}
            </label>
            {renderHint(item, id, hint)}
            {errorMessage ? <span className="usa-error-message" id={`${id}-error`} role="alert">{errorMessage}</span> : null}
            <div className="usa-date-picker">
                <input
                    className={errorMessage ? 'usa-input usa-input--error' : 'usa-input'}
                    id={id}
                    name={item.key}
                    type="text"
                    aria-labelledby={`${id}-label`}
                    aria-describedby={[
                        `${id}-hint`,
                        errorMessage ? `${id}-error` : '',
                    ].filter(Boolean).join(' ')}
                    defaultValue={value}
                    required={item.required}
                />
            </div>
        </div>
    );
}

function renderSlider(item: FormspecItem, id: string, value: any) {
    return (
        <div className="usa-form-group">
            <label className="usa-label" htmlFor={id}>
                {item.label}
            </label>
            {renderHint(item, id)}
            <input
                id={id}
                className="usa-range"
                type="range"
                min={item.presentation?.min ?? 0}
                max={item.presentation?.max ?? 100}
                step={item.presentation?.step ?? 1}
                defaultValue={value ?? item.presentation?.min ?? 0}
            />
        </div>
    );
}

function renderFileUpload(item: FormspecItem, id: string) {
    const hasHint = Boolean(item.hint || item.presentation?.accept);
    return (
        <div className="usa-form-group">
            <label className="usa-label" htmlFor={id}>
                {item.label}
                {requiredMark(item.required)}
            </label>
            {renderHint(item, id, item.presentation?.accept ? `Accepted files: ${item.presentation.accept}` : undefined)}
            <input
                id={id}
                className="usa-file-input"
                type="file"
                name={item.key}
                accept={item.presentation?.accept}
                aria-describedby={hasHint ? `${id}-hint` : undefined}
            />
        </div>
    );
}

function renderField(item: FormspecItem, path: string, preset: RenderPreset) {
    const id = toId(path);
    const widgetHint = normalizeWidgetHint(item);
    const value = preset.values[path];
    const errorMessage = preset.errors[path];

    if (widgetHint === 'select') return renderSelect(item, id, value, errorMessage);
    if (widgetHint === 'radiogroup') return renderRadioGroup(item, id, value, errorMessage);
    if (widgetHint === 'checkbox' || widgetHint === 'toggle') return renderCheckbox(item, id, value);
    if (widgetHint === 'checkboxgroup') return renderCheckboxGroup(item, id, value);
    if (widgetHint === 'numberinput') return renderNumberInput(item, id, value, errorMessage);
    if (widgetHint === 'moneyinput') return renderMoneyInput(item, id, value, errorMessage);
    if (widgetHint === 'datepicker') return renderDatePicker(item, id, value, errorMessage);
    if (widgetHint === 'slider') return renderSlider(item, id, value);
    if (widgetHint === 'fileupload') return renderFileUpload(item, id);
    if (widgetHint === 'autocomplete') return renderSelect(item, id, value, errorMessage);

    return renderTextInput(item, id, value, errorMessage);
}

function renderRepeatableGroup(item: FormspecItem, path: string, preset: RenderPreset) {
    const repeatCount = preset.repeats[path] ?? Math.max(1, item.minRepeat ?? 1);
    return (
        <fieldset className="usa-fieldset" key={path}>
            <legend className="usa-legend">{item.label}</legend>
            {Array.from({ length: repeatCount }).map((_, index) => {
                const instancePath = `${path}[${index}]`;
                return (
                    <div key={instancePath} style={groupCardStyle}>
                        <h3 style={{ marginTop: 0 }}>Member {index + 1}</h3>
                        {renderItems(item.children ?? [], instancePath, preset)}
                        {index > 0 ? (
                            <button className="usa-button usa-button--unstyled" type="button">
                                Remove member
                            </button>
                        ) : null}
                    </div>
                );
            })}
            <button className="usa-button usa-button--outline" type="button" style={{ marginTop: '1rem' }}>
                Add another member
            </button>
        </fieldset>
    );
}

function renderGroup(item: FormspecItem, path: string, preset: RenderPreset) {
    if (item.repeatable) return renderRepeatableGroup(item, path, preset);
    return (
        <fieldset className="usa-fieldset" key={path}>
            <legend className="usa-legend">{item.label}</legend>
            {renderItems(item.children ?? [], path, preset)}
        </fieldset>
    );
}

function renderItems(items: FormspecItem[], parentPath: string, preset: RenderPreset): React.ReactNode[] {
    return items.flatMap((item) => {
        const path = parentPath ? `${parentPath}.${item.key}` : item.key;

        if (item.relevant && preset.values.hasOther !== true && item.key === 'otherDetail') {
            return [];
        }

        if (item.type === 'display') {
            const node = renderDisplayItem(item, path);
            return node ? [node] : [];
        }

        if (item.type === 'group') return [renderGroup(item, path, preset)];
        if (item.type === 'field') return [<React.Fragment key={path}>{renderField(item, path, preset)}</React.Fragment>];

        return [];
    });
}

function renderValidationSummary(preset: RenderPreset) {
    const entries = Object.entries(preset.errors);
    if (entries.length === 0) return null;

    return (
        <div style={{ marginBottom: '1rem' }}>
            {renderAlert(
                `There ${entries.length === 1 ? 'is 1 error' : `are ${entries.length} errors`} on this form.`,
                'error',
                'Please correct the following',
            )}
            <ul className="usa-list" style={{ marginTop: '0.75rem' }}>
                {entries.map(([path, message]) => (
                    <li key={path}>{message}</li>
                ))}
            </ul>
        </div>
    );
}

function findItemByPath(items: FormspecItem[], path: string): FormspecItem | null {
    const parts = path.split('.');
    let currentItems = items;
    let found: FormspecItem | null = null;

    for (const part of parts) {
        found = currentItems.find((item) => item.key === part) ?? null;
        if (!found) return null;
        currentItems = found.children ?? [];
    }

    return found;
}

function renderBoundField(definition: any, bind: string, preset: RenderPreset, widgetHintOverride?: string) {
    const item = findItemByPath(Array.isArray(definition?.items) ? definition.items : [], bind);
    if (!item) return null;
    const patchedItem = widgetHintOverride
        ? {
            ...item,
            presentation: {
                ...(item.presentation ?? {}),
                widgetHint: widgetHintOverride,
            },
        }
        : item;
    return (
        <React.Fragment key={bind}>
            {renderField(patchedItem, bind, preset)}
        </React.Fragment>
    );
}

function renderCard(title: string, body: React.ReactNode) {
    return (
        <li className="usa-card" style={{ listStyle: 'none' }}>
            <div className="usa-card__container">
                <div className="usa-card__header">
                    <h2 className="usa-card__heading">{title}</h2>
                </div>
                <div className="usa-card__body">{body}</div>
            </div>
        </li>
    );
}

function renderGrid(children: React.ReactNode, columns = 2) {
    return (
        <div
            style={{
                display: 'grid',
                gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                gap: '1rem',
                alignItems: 'start',
            }}
        >
            {children}
        </div>
    );
}

function renderAccordion(items: Array<{ title: string; content: React.ReactNode }>, allowMultiple = false, idBase = 'accordion') {
    return (
        <div className="usa-accordion" {...(allowMultiple ? { 'data-allow-multiple': '' } : {})}>
            {items.map((item, index) => {
                const contentId = `${idBase}-${index}`;
                return (
                    <React.Fragment key={contentId}>
                        <h4 className="usa-accordion__heading">
                            <button
                                type="button"
                                className="usa-accordion__button"
                                aria-expanded={index === 0 ? 'true' : 'false'}
                                aria-controls={contentId}
                            >
                                {item.title}
                            </button>
                        </h4>
                        <div id={contentId} className="usa-accordion__content usa-prose">
                            {item.content}
                        </div>
                    </React.Fragment>
                );
            })}
        </div>
    );
}

function renderModalDemo() {
    return (
        <div>
            <a href="#real-uswds-modal" className="usa-button" aria-controls="real-uswds-modal" data-open-modal>
                Add More Details
            </a>
            <div className="usa-modal" id="real-uswds-modal" aria-labelledby="real-uswds-modal-heading" aria-describedby="real-uswds-modal-description">
                <div className="usa-modal__content">
                    <div className="usa-modal__main">
                        <h2 className="usa-modal__heading" id="real-uswds-modal-heading">Additional Details</h2>
                        <div className="usa-prose">
                            <p id="real-uswds-modal-description">Provide the contact details that do not fit in the main form.</p>
                        </div>
                        <div className="usa-modal__footer">
                            <ul className="usa-button-group">
                                <li className="usa-button-group__item">
                                    <button type="button" className="usa-button" data-close-modal>Done</button>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <button type="button" className="usa-button usa-modal__close" aria-label="Close this window" data-close-modal>
                        Close
                    </button>
                </div>
            </div>
        </div>
    );
}

function renderWizardDemo(definition: any, preset: RenderPreset) {
    return (
        <div className="formspec-wizard">
            <div className="usa-step-indicator" aria-label="progress">
                <ol className="usa-step-indicator__segments">
                    <li className="usa-step-indicator__segment usa-step-indicator__segment--current">
                        <span className="usa-step-indicator__segment-label">Personal Info</span>
                    </li>
                    <li className="usa-step-indicator__segment">
                        <span className="usa-step-indicator__segment-label">Contact</span>
                    </li>
                </ol>
                <div className="usa-step-indicator__header">
                    <h4 className="usa-step-indicator__heading">
                        <span className="usa-step-indicator__heading-counter">
                            <span className="usa-sr-only">Step</span>
                            <span className="usa-step-indicator__current-step">1</span>
                            <span className="usa-step-indicator__total-steps"> of 2</span>
                        </span>
                        <span className="usa-step-indicator__heading-text">Personal Info</span>
                    </h4>
                </div>
            </div>
            <div style={groupCardStyle}>
                {renderBoundField(definition, 'firstName', preset)}
                {renderBoundField(definition, 'lastName', preset)}
            </div>
            <div style={{ marginTop: '1rem', display: 'flex', gap: '0.75rem' }}>
                <button className="usa-button usa-button--outline" type="button">Previous</button>
                <button className="usa-button" type="button">Next</button>
            </div>
        </div>
    );
}

function renderTabsDemo(definition: any, preset: RenderPreset) {
    return (
        <div className="formspec-tabs">
            <ul className="usa-button-group usa-button-group--segmented" role="tablist">
                <li className="usa-button-group__item">
                    <button type="button" className="usa-button" role="tab" aria-selected="true">Personal</button>
                </li>
                <li className="usa-button-group__item">
                    <button type="button" className="usa-button usa-button--outline" role="tab" aria-selected="false">Contact</button>
                </li>
            </ul>
            <div style={{ marginTop: '1rem' }}>
                {renderBoundField(definition, 'firstName', preset)}
                {renderBoundField(definition, 'lastName', preset)}
            </div>
        </div>
    );
}

function renderComponentDocumentUswds(definition: any, componentDocument: any) {
    const items = Array.isArray(definition?.items) ? definition.items as FormspecItem[] : [];
    const preset = getPreset(definition);

    switch (componentDocument?.name) {
    case 'contact-grid':
        return (
            <ul className="usa-card-group" style={{ paddingLeft: 0 }}>
                {renderCard('Contact Information', renderGrid(
                    <>
                        {renderBoundField(definition, 'firstName', preset)}
                        {renderBoundField(definition, 'lastName', preset)}
                        {renderBoundField(definition, 'email', preset)}
                        {renderBoundField(definition, 'phone', preset)}
                    </>,
                ))}
            </ul>
        );
    case 'grouped-cards':
        return (
            <ul className="usa-card-group" style={{ paddingLeft: 0, display: 'grid', gap: '1rem' }}>
                {renderCard('Personal Information', renderGrid(
                    <>
                        {renderBoundField(definition, 'personal.name', preset)}
                        {renderBoundField(definition, 'personal.email', preset)}
                    </>,
                ))}
                {renderCard('Preferences', (
                    <>
                        {renderBoundField(definition, 'preferences.newsletter', preset, 'Toggle')}
                        {renderBoundField(definition, 'preferences.debug', preset, 'Toggle')}
                        {renderBoundField(definition, 'preferences.timeout', preset, 'NumberInput')}
                    </>
                ))}
            </ul>
        );
    case 'collapsible-demo':
        return renderAccordion([
            {
                title: 'Personal Details',
                content: (
                    <>
                        {renderBoundField(definition, 'firstName', preset)}
                        {renderBoundField(definition, 'lastName', preset)}
                    </>
                ),
            },
            {
                title: 'Contact Information',
                content: (
                    <>
                        {renderBoundField(definition, 'email', preset)}
                        {renderBoundField(definition, 'phone', preset)}
                    </>
                ),
            },
        ], true, 'collapsible');
    case 'accordion-demo':
        return renderAccordion([
            {
                title: 'Personal Details',
                content: (
                    <>
                        {renderBoundField(definition, 'firstName', preset)}
                        {renderBoundField(definition, 'lastName', preset)}
                    </>
                ),
            },
            {
                title: 'Contact Information',
                content: (
                    <>
                        {renderBoundField(definition, 'email', preset)}
                        {renderBoundField(definition, 'phone', preset)}
                    </>
                ),
            },
        ], false, 'accordion');
    case 'accordion-multi-demo':
        return renderAccordion([
            {
                title: 'Personal Details',
                content: (
                    <>
                        {renderBoundField(definition, 'firstName', preset)}
                        {renderBoundField(definition, 'lastName', preset)}
                    </>
                ),
            },
            {
                title: 'Contact Information',
                content: (
                    <>
                        {renderBoundField(definition, 'email', preset)}
                        {renderBoundField(definition, 'phone', preset)}
                    </>
                ),
            },
            {
                title: 'Preferences',
                content: renderBoundField(definition, 'newsletter', preset, 'Toggle'),
            },
        ], true, 'accordion-multi');
    case 'panel-demo':
        return (
            <div style={{ display: 'grid', gridTemplateColumns: '220px 1fr', gap: '1.5rem', alignItems: 'start' }}>
                <ul className="usa-card-group" style={{ paddingLeft: 0, margin: 0 }}>
                    {renderCard('Help', <p style={{ margin: 0 }}>Fill in your contact details. All fields are optional unless marked required.</p>)}
                </ul>
                <div>
                    {renderBoundField(definition, 'firstName', preset)}
                    {renderBoundField(definition, 'lastName', preset)}
                    {renderBoundField(definition, 'email', preset)}
                    {renderBoundField(definition, 'phone', preset)}
                </div>
            </div>
        );
    case 'modal-demo':
        return (
            <>
                {renderBoundField(definition, 'firstName', preset)}
                {renderBoundField(definition, 'lastName', preset)}
                {renderModalDemo()}
            </>
        );
    case 'popover-demo':
        return (
            <>
                {renderBoundField(definition, 'firstName', preset)}
                {renderBoundField(definition, 'lastName', preset)}
                <div style={{ marginTop: '1rem' }}>
                    <button type="button" className="usa-button usa-tooltip" data-position="right" title="Enter your legal first and last name as they appear on official documents.">
                        Need help?
                    </button>
                </div>
            </>
        );
    case 'wizard-demo':
        return renderWizardDemo(definition, preset);
    case 'tabs-demo':
        return renderTabsDemo(definition, preset);
    default:
        break;
    }

    return (
        <>
            {definition?.title === 'Display Components' ? <h2>{definition.title}</h2> : null}
            {renderValidationSummary(preset)}
            {renderItems(items, '', preset)}
        </>
    );
}

function renderRealUSWDS(definition: any, componentDocument?: any) {
    if (componentDocument) return renderComponentDocumentUswds(definition, componentDocument);
    return renderComponentDocumentUswds(definition, null);
}

function collectBehaviorNames(items: FormspecItem[], names: Set<string>) {
    items.forEach((item) => {
        const widgetHint = normalizeWidgetHint(item);
        if (widgetHint === 'datepicker') names.add('datePicker');
        if (widgetHint === 'slider') names.add('range');
        if (widgetHint === 'fileupload') names.add('fileInput');
        if (widgetHint === 'autocomplete') names.add('comboBox');
        if (item.children?.length) collectBehaviorNames(item.children, names);
    });
}

async function loadBehaviorsForDefinition(definition: any, componentDocument?: any): Promise<USWDSBehavior[]> {
    const names = new Set<string>();
    collectBehaviorNames(Array.isArray(definition?.items) ? definition.items : [], names);
    if (componentDocument?.name === 'collapsible-demo' || componentDocument?.name === 'accordion-demo' || componentDocument?.name === 'accordion-multi-demo') {
        names.add('accordion');
    }
    if (componentDocument?.name === 'modal-demo') {
        names.add('modal');
    }
    if (componentDocument?.name === 'popover-demo') {
        names.add('tooltip');
    }
    const loaders = Array.from(names).map((name) => {
        if (name === 'datePicker') return import('@uswds/uswds/js/usa-date-picker');
        if (name === 'range') return import('@uswds/uswds/js/usa-range');
        if (name === 'fileInput') return import('@uswds/uswds/js/usa-file-input');
        if (name === 'accordion') return import('@uswds/uswds/js/usa-accordion');
        if (name === 'modal') return import('@uswds/uswds/js/usa-modal');
        if (name === 'tooltip') return import('@uswds/uswds/js/usa-tooltip');
        return import('@uswds/uswds/js/usa-combo-box');
    });
    const modules = await Promise.all(loaders);
    return modules.map((mod) => (mod.default ?? mod) as USWDSBehavior);
}

function useShadowRoot(stylesheets: string[]) {
    const hostRef = useRef<HTMLDivElement>(null);
    const [mountNode, setMountNode] = useState<HTMLDivElement | null>(null);

    useEffect(() => {
        const host = hostRef.current;
        if (!host) return;

        const shadow = host.shadowRoot ?? host.attachShadow({ mode: 'open' });
        shadow.replaceChildren();

        stylesheets.forEach((href) => {
            const link = document.createElement('link');
            link.rel = 'stylesheet';
            link.href = href;
            shadow.appendChild(link);
        });

        const style = document.createElement('style');
        style.textContent = `
            :host {
                display: block;
            }
            .story-root {
                display: block;
                padding: 0;
                color: #1b1b1b;
            }
        `;
        shadow.appendChild(style);

        const mount = document.createElement('div');
        mount.className = 'story-root';
        shadow.appendChild(mount);
        setMountNode(mount);

        return () => {
            setMountNode(null);
            shadow.replaceChildren();
        };
    }, [stylesheets]);

    return { hostRef, mountNode };
}

export function RealUSWDSStory({ definition, componentDocument, showSubmit = true, maxWidth = 640 }: RealUSWDSStoryProps) {
    const rendered = useMemo(() => renderRealUSWDS(definition, componentDocument), [definition, componentDocument]);
    const stylesheets = useMemo(() => [uswdsCssUrl], []);
    const { hostRef, mountNode } = useShadowRoot(stylesheets);
    const enhancedRootRef = useRef<HTMLDivElement | null>(null);

    useEffect(() => {
        if (!enhancedRootRef.current) return;

        let cancelled = false;

        void loadBehaviorsForDefinition(definition, componentDocument).then((behaviors) => {
            if (cancelled || !enhancedRootRef.current) return;
            behaviors.forEach((behavior) => {
                behavior.off?.(enhancedRootRef.current as ParentNode);
                behavior.on?.(enhancedRootRef.current as ParentNode);
            });
        });

        return () => {
            cancelled = true;
        };
    }, [definition, componentDocument, mountNode]);

    return (
        <div style={{ ...paneStyle, maxWidth }}>
            <div ref={hostRef} />
            {mountNode ? createPortal(
                <div ref={enhancedRootRef}>
                    <form className="usa-form">
                        {definition?.title ? <h2 className="usa-sr-only">{definition.title}</h2> : null}
                        {rendered}
                        {showSubmit ? (
                            <button className="usa-button" type="submit" style={{ marginTop: '1.5rem' }}>
                                Submit
                            </button>
                        ) : null}
                    </form>
                </div>,
                mountNode,
            ) : null}
        </div>
    );
}
