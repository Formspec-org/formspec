/** @filedesc E2E test harness entry point: registers formspec-render and exposes engine globals. */
import { FormspecRender } from '../../../packages/formspec-webcomponent/src/index';
import { FormEngine, assembleDefinitionSync } from '../../../packages/formspec-engine/src/index';

customElements.define('formspec-render', FormspecRender);

const renderer = document.createElement('formspec-render');
document.getElementById('app')?.appendChild(renderer);
window.renderer = renderer;

// Expose engine utilities for E2E tests
(window as any).FormEngine = FormEngine;
(window as any).assembleDefinitionSync = assembleDefinitionSync;
