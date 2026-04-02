/** @filedesc USWDS Accordion — `usa-accordion` buttons + regions; repeat-bind mirrors default adapter behavior. */
import { effect } from '@preact/signals-core';
import type { AdapterContext, AccordionLayoutBehavior } from '@formspec-org/webcomponent';

function wireAccordionPanel(
    button: HTMLButtonElement,
    content: HTMLElement,
    panels: { button: HTMLButtonElement; content: HTMLElement }[],
    allowMultiple: boolean | undefined
): void {
    button.addEventListener('click', () => {
        const expanded = button.getAttribute('aria-expanded') === 'true';
        if (expanded) {
            button.setAttribute('aria-expanded', 'false');
            content.hidden = true;
        } else {
            if (!allowMultiple) {
                for (const p of panels) {
                    p.button.setAttribute('aria-expanded', 'false');
                    p.content.hidden = true;
                }
            }
            button.setAttribute('aria-expanded', 'true');
            content.hidden = false;
        }
    });
}

export function renderUSWDSAccordion(
    behavior: AccordionLayoutBehavior,
    parent: HTMLElement,
    actx: AdapterContext
): void {
    const { comp, host, repeatCount, groupLabel, addInstance, removeInstance } = behavior;
    const el = document.createElement('div');
    if (comp.id) el.id = comp.id;
    el.className = 'usa-accordion formspec-accordion';
    actx.applyCssClass(el, comp);
    actx.applyAccessibility(el, comp);
    actx.applyStyle(el, comp.style);
    parent.appendChild(el);

    const bindKey = comp.bind;
    const labels: string[] = comp.labels || [];
    const panels: { button: HTMLButtonElement; content: HTMLElement }[] = [];
    let previousCount = 0;
    const idPrefix = comp.id ? `${comp.id}-` : 'acc-';

    if (bindKey) {
        el.classList.add('formspec-accordion--repeat');
        const fullName = host.prefix ? `${host.prefix}.${bindKey}` : bindKey;
        host.cleanupFns.push(
            effect(() => {
                const count = repeatCount.value;
                const expandedIndex =
                    typeof comp.defaultOpen === 'number'
                        ? comp.defaultOpen
                        : count > 0
                          ? count - 1
                          : -1;
                el.replaceChildren();
                panels.length = 0;

                for (let i = 0; i < count; i++) {
                    const contentId = `${idPrefix}panel-${i}`;
                    const heading = document.createElement('h4');
                    heading.className = 'usa-accordion__heading';

                    const button = document.createElement('button');
                    button.type = 'button';
                    button.className = 'usa-accordion__button formspec-focus-ring';
                    button.setAttribute('aria-controls', contentId);
                    const shouldOpen = i === expandedIndex || (count > previousCount && i === count - 1);
                    button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
                    button.textContent = labels[i] || `Section ${i + 1}`;
                    heading.appendChild(button);

                    const content = document.createElement('div');
                    content.id = contentId;
                    content.className =
                        'usa-accordion__content usa-prose formspec-accordion-content formspec-accordion-content--repeat';
                    content.hidden = !shouldOpen;

                    const instancePrefix = `${fullName}[${i}]`;
                    for (const child of comp.children || []) {
                        host.renderComponent(child, content, instancePrefix);
                    }
                    const removeBtn = document.createElement('button');
                    removeBtn.type = 'button';
                    removeBtn.className = 'usa-button usa-button--unstyled formspec-focus-ring';
                    removeBtn.textContent = `Remove ${groupLabel}`;
                    removeBtn.setAttribute('aria-label', `Remove ${groupLabel} ${i + 1}`);
                    const idx = i;
                    removeBtn.addEventListener('click', () => {
                        removeInstance(idx);
                    });
                    content.appendChild(removeBtn);

                    el.appendChild(heading);
                    el.appendChild(content);
                    panels.push({ button, content });
                    wireAccordionPanel(button, content, panels, comp.allowMultiple);
                }

                previousCount = count;
            })
        );

        const addBtn = document.createElement('button');
        addBtn.type = 'button';
        addBtn.className = 'usa-button usa-button--outline formspec-focus-ring';
        addBtn.textContent = `Add ${groupLabel}`;
        addBtn.addEventListener('click', () => {
            addInstance();
        });
        parent.appendChild(addBtn);
    } else {
        const children: any[] = comp.children || [];
        for (let i = 0; i < children.length; i++) {
            const contentId = `${idPrefix}panel-${i}`;
            const heading = document.createElement('h4');
            heading.className = 'usa-accordion__heading';

            const button = document.createElement('button');
            button.type = 'button';
            button.className = 'usa-accordion__button formspec-focus-ring';
            button.setAttribute('aria-controls', contentId);
            const shouldOpen = comp.defaultOpen === i;
            button.setAttribute('aria-expanded', shouldOpen ? 'true' : 'false');
            button.textContent = labels[i] || `Section ${i + 1}`;
            heading.appendChild(button);

            const content = document.createElement('div');
            content.id = contentId;
            content.className = 'usa-accordion__content usa-prose formspec-accordion-content';
            content.hidden = !shouldOpen;

            host.renderComponent(children[i], content, host.prefix);

            el.appendChild(heading);
            el.appendChild(content);
            panels.push({ button, content });
            wireAccordionPanel(button, content, panels, comp.allowMultiple);
        }
    }
}
