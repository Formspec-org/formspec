import { effect } from '@preact/signals-core';
import { Fragment, type VNode } from './preact-jsx-runtime';

type ParentNodeLike = Element | DocumentFragment;

declare global {
  namespace JSX {
    interface HTMLAttributes {
      [key: string]: any;
      onClick?: (event: any) => void;
      onInput?: (event: any) => void;
      onChange?: (event: any) => void;
      onKeyDown?: (event: any) => void;
      onMouseDown?: (event: any) => void;
      onMouseUp?: (event: any) => void;
      onMouseMove?: (event: any) => void;
      onMouseEnter?: (event: any) => void;
      onMouseLeave?: (event: any) => void;
      onDblClick?: (event: any) => void;
      onDragStart?: (event: any) => void;
      onDragEnd?: (event: any) => void;
      onDragOver?: (event: any) => void;
      onDrop?: (event: any) => void;
    }
    interface IntrinsicElements {
      [elemName: string]: HTMLAttributes;
    }
  }
}

export type ComponentChildren = any;

function isEventProp(name: string): boolean {
  return name.startsWith('on') && name.length > 2;
}

function appendChildren(parent: ParentNodeLike, children: unknown) {
  if (Array.isArray(children)) {
    for (const child of children) {
      appendChildren(parent, child);
    }
    return;
  }

  if (children === null || children === undefined || children === false || children === true) {
    return;
  }

  if (
    typeof children === 'string' ||
    typeof children === 'number' ||
    typeof children === 'bigint'
  ) {
    parent.appendChild(document.createTextNode(String(children)));
    return;
  }

  parent.appendChild(toDom(children as VNode));
}

function setProp(el: HTMLElement, name: string, value: unknown) {
  if (name === 'children' || value === undefined || value === null) {
    return;
  }

  if (name === 'className' || name === 'class') {
    el.setAttribute('class', String(value));
    return;
  }

  if (name === 'style' && typeof value === 'object') {
    const style = value as Record<string, string | number>;
    for (const [k, v] of Object.entries(style)) {
      (el.style as any)[k] = String(v);
    }
    return;
  }

  if (name === 'value' && 'value' in el) {
    (el as HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement).value = String(value);
    return;
  }

  if (name === 'checked' && 'checked' in el) {
    (el as HTMLInputElement).checked = Boolean(value);
    return;
  }

  if (isEventProp(name) && typeof value === 'function') {
    const eventName = name.slice(2).toLowerCase();
    el.addEventListener(eventName, value as EventListener);
    return;
  }

  if (typeof value === 'boolean') {
    if (value) {
      el.setAttribute(name, '');
    }
    return;
  }

  el.setAttribute(name, String(value));
}

function toDom(node: VNode | string | number | null | undefined | boolean): Node {
  if (node === null || node === undefined || node === false || node === true) {
    return document.createComment('');
  }

  if (typeof node === 'string' || typeof node === 'number') {
    return document.createTextNode(String(node));
  }

  if (typeof node.type === 'function') {
    const rendered = node.type(node.props || {});
    return toDom(rendered as VNode);
  }

  if (node.type === Fragment) {
    const frag = document.createDocumentFragment();
    appendChildren(frag, node.props?.children);
    return frag;
  }

  const el = document.createElement(node.type);
  const props = node.props || {};
  for (const [name, value] of Object.entries(props)) {
    setProp(el, name, value);
  }
  appendChildren(el, props.children);
  return el;
}

let disposeRender: (() => void) | null = null;

export function render(vnode: VNode, container: Element | null) {
  if (!container) {
    return;
  }

  if (disposeRender) {
    disposeRender();
    disposeRender = null;
  }

  disposeRender = effect(() => {
    const dom = toDom(vnode);
    container.replaceChildren(dom);
  });
}
