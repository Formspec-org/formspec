/**
 * URL for formspec-base.css so it can be injected into the preview shadow root.
 * Vite resolves this via alias; in tests the module may be mocked.
 */
import url from 'formspec-webcomponent/formspec-base.css?url';
export const formspecBaseCssHref: string = url ?? '';
