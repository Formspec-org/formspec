/**
 * URLs for formspec CSS files so they can be injected into document.head for preview.
 * Vite resolves these via alias; in tests the module may be mocked.
 */
import layoutUrl from '@formspec-org/webcomponent/formspec-layout.css?url';
import defaultUrl from '@formspec-org/webcomponent/formspec-default.css?url';

export const formspecLayoutCssHref: string = layoutUrl ?? '';
export const formspecDefaultCssHref: string = defaultUrl ?? '';
