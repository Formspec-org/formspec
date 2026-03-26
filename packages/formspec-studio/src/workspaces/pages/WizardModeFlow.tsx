/** @filedesc Wizard-mode renderer — vertical step cards connected by chevron lines. */
import React from 'react';
import { DragDropProvider } from '@dnd-kit/react';
import {
  KeyboardSensor,
  PointerActivationConstraints,
  PointerSensor,
  type Draggable,
} from '@dnd-kit/dom';
import { isInteractiveElement } from '@dnd-kit/dom/utilities';
import { SortablePageCard } from './PageCard';
import { WizardStepConnector } from './WizardStepConnector';
import { UnassignedItemsTray } from './UnassignedItemsTray';
import { buildPageActions, type ModeRendererProps } from './mode-renderer-props';

function preventActivation(event: PointerEvent, source: Draggable): boolean {
  const target = event.target;
  if (target instanceof Element && target.closest('[data-resize-handle]')) return true;
  if (target === source.element) return false;
  if (target === source.handle) return false;
  if (!(target instanceof Element)) return false;
  if (source.handle?.contains(target)) return false;
  return isInteractiveElement(target);
}

export function WizardModeFlow(props: ModeRendererProps) {
  const { structure, project, activeGroupCtx } = props;
  const { pages, unassigned } = structure;

  if (pages.length === 0) return null;

  const allPageSummaries = pages.map((p) => ({ id: p.id, title: p.title || p.id }));

  return (
    <DragDropProvider
      onDragEnd={(event: any) => {
        if (event.canceled) return;
        const sourceData = event.operation?.source?.data ?? {};
        const targetData = event.operation?.target?.data ?? {};

        if (sourceData.type === 'item' && targetData.type === 'page-drop') {
          project.placeOnPage(sourceData.key, targetData.pageId);
          activeGroupCtx?.setActiveGroupKey(sourceData.key);
          return;
        }

        const sourceId = String(event.operation?.source?.id ?? '');
        const targetId = String(event.operation?.target?.id ?? '');
        if (!sourceId || !targetId || sourceId === targetId) return;
        const targetIndex = pages.findIndex((page) => page.id === targetId);
        if (targetIndex === -1) return;
        project.movePageToIndex(sourceId, targetIndex);
      }}
      sensors={() => [
        PointerSensor.configure({
          activationConstraints: [
            new PointerActivationConstraints.Distance({ value: 5 }),
          ],
          preventActivation,
        }),
        KeyboardSensor,
      ]}
    >
      <div className="space-y-0" data-testid="wizard-mode-flow">
        {pages.map((page, index) => (
          <React.Fragment key={page.id}>
            {index > 0 && <WizardStepConnector />}
            <SortablePageCard
              page={page}
              index={index}
              totalPages={pages.length}
              allPages={allPageSummaries}
              unassigned={unassigned}
              stepNumber={index + 1}
              actions={buildPageActions(
                { id: page.id, title: page.title || page.id },
                props,
              )}
            />
          </React.Fragment>
        ))}
      </div>

      {/* Dashed "add step" terminus */}
      <button
        type="button"
        onClick={props.handleAddPage}
        className="mt-2 flex w-full items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border/60 px-6 py-5 text-[13px] font-semibold text-muted transition-colors hover:border-accent/40 hover:text-ink"
      >
        + Add step
      </button>

      <UnassignedItemsTray items={unassigned} />
    </DragDropProvider>
  );
}
