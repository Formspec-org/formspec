/** @filedesc Re-export canonical widget vocabulary from formspec-types. This file exists so that existing consumers importing from formspec-layout continue to work without changing their import paths. */
export {
    KNOWN_COMPONENT_TYPES,
    SPEC_WIDGET_TO_COMPONENT,
    COMPONENT_TO_HINT,
    COMPATIBILITY_MATRIX,
    widgetTokenToComponent,
} from 'formspec-types';
