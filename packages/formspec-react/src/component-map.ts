/** @filedesc Component map types for the auto-renderer. */
import type React from 'react';
import type { LayoutNode } from 'formspec-layout';
import type { UseFieldResult } from './use-field';

/** Props passed to field components by the renderer. */
export interface FieldComponentProps {
    /** Full reactive field state from useField. */
    field: UseFieldResult;
    /** The LayoutNode for this field (contains presentation, cssClasses, etc.). */
    node: LayoutNode;
}

/** Props passed to layout components by the renderer. */
export interface LayoutComponentProps {
    /** The LayoutNode for this layout element. */
    node: LayoutNode;
    /** Rendered children. */
    children: React.ReactNode;
}

/** User-provided component overrides. */
export interface ComponentMap {
    /** Field component overrides (TextInput, Select, RadioGroup, etc.). */
    fields?: Partial<Record<string, React.ComponentType<FieldComponentProps>>>;
    /** Layout component overrides (Stack, Card, Grid, Columns, etc.). */
    layout?: Partial<Record<string, React.ComponentType<LayoutComponentProps>>>;
}
