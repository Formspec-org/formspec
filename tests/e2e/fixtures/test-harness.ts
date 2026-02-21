import { FormspecRender } from '../../../packages/formspec-webcomponent/src/index';

customElements.define('formspec-render', FormspecRender);

const renderer = document.createElement('formspec-render');
document.getElementById('app')?.appendChild(renderer);
window.renderer = renderer;
