/** @filedesc AuthoringOverlay — document-first canvas editing layer over formspec-render. */
import { useState, useCallback, useRef, useEffect, type ReactElement, type ReactNode, type MouseEvent } from 'react';
import { useSelection } from '../state/useSelection';
import { useProject } from '../state/useProject';
import type { StudioMode } from '../studio-app/ModeProvider';
import { draggable, dropTargetForElements } from '@atlaskit/pragmatic-drag-and-drop/element/adapter';
import { attachClosestEdge, extractClosestEdge, type Edge } from '@atlaskit/pragmatic-drag-and-drop-hitbox/closest-edge';
import { 
  createProject,
  buildDefLookup,
  type Project,
  type CompNode,
  findComponentNodeByRef,
  findParentOfNodeRef,
  findParentRefOfNodeRef,
  isCircularComponentMove 
} from '@formspec-org/studio-core';
import { isInteractiveTarget } from '../workspaces/preview/FormspecPreviewHost';
import { telemetry } from '../services/telemetry-adapter';
import { WidgetPopover } from './WidgetPopover';
import { dispatchStudioEvent, STUDIO_EVENTS } from '../studio-events';

export interface AuthoringOverlayProps {
  /** Current studio mode — gates which affordances render. */
  mode: StudioMode;
  /** The rendered form content to overlay. */
  children: ReactNode;
  /** Called when the user invokes Ask AI on a field. */
  onAskAI?: (prompt: string, fieldPath: string) => void;
}

interface CanvasRect {
  left: number;
  top: number;
  width: number;
  height: number;
  bottom: number;
  right: number;
}

interface NodeRef { nodeId?: string; bind?: string; }

interface FieldOverlayState {
  /** Currently hovered field path. */
  hoveredPath: string | null;
  /** Field being inline-edited. */
  editingPath: string | null;
  /** Active context menu position. */
  contextMenu: { x: number; y: number; path: string } | null;
  /** Whether the slash command menu is open. */
  slashMenuOpen: boolean;
  /** Active drag operation state. */
  dragState: { source: string; target: string | null; edge: Edge | null } | null;
  /** Active insertion point index and parent. */
  activeInsertion: { parentRef: NodeRef, index: number, y: number, x: number, width: number } | null;
  /** Resizing state. */
  resizing: { path: string; initialWidth: number; initialX: number } | null;
}

/**
 * AuthoringOverlay — renders over `<formspec-render>` in Edit and Design modes.
 *
 * Same component, mode prop gates affordances:
 * - Edit: structure skeleton — drag handles for sibling reorder, + insertion lines,
 *   inline label edit, slash commands, logic badges (•?=!🔒)
 * - Design: dressed form — click-to-style selection rings, drag handles for
 *   page-region placement, breakpoint handles, widget-swap popover
 *
 * Selection model is shared (SelectionProvider).
 */
export function AuthoringOverlay({
  mode,
  children,
  onAskAI,
}: AuthoringOverlayProps): ReactElement {
  const project = useProject();
  const { primaryKey, select, deselect } = useSelection();
  const [overlayState, setOverlayState] = useState<FieldOverlayState>({
    hoveredPath: null,
    editingPath: null,
    contextMenu: null,
    slashMenuOpen: false,
    dragState: null,
    activeInsertion: null,
    resizing: null,
  });

  const [activeChangeset, setActiveChangeset] = useState<any>(null);
  const proposalManager = project.proposals;

  useEffect(() => {
    if (!proposalManager) return;
    const sync = () => setActiveChangeset(proposalManager.getChangeset());
    sync();
    return proposalManager.subscribe(sync);
  }, [proposalManager]);

  const containerRef = useRef<HTMLDivElement>(null);
  const [fieldRects, setFieldRects] = useState<Record<string, CanvasRect>>({});
  const isEdit = mode === 'edit';
  const isDesign = mode === 'design';

  // Sync loop to track field positions on the canvas
  useEffect(() => {
    if (mode === 'preview' || mode === 'chat') return;

    let cancelled = false;
    const sync = () => {
      if (cancelled || !containerRef.current) return;
      
      const roots = containerRef.current.querySelectorAll('[data-name]');
      const nextRects: Record<string, CanvasRect> = {};
      const containerRect = containerRef.current.getBoundingClientRect();

      roots.forEach((root) => {
        if (!(root instanceof HTMLElement)) return;
        const path = root.getAttribute('data-name');
        if (!path) return;
        
        const r = root.getBoundingClientRect();
        nextRects[path] = {
          left: r.left - containerRect.left,
          top: r.top - containerRect.top,
          width: r.width,
          height: r.height,
          bottom: r.bottom - containerRect.top,
          right: r.right - containerRect.left,
        };
      });

      // Check for changes to avoid infinite re-renders
      setFieldRects(prev => {
        const hasChanged = Object.keys(nextRects).length !== Object.keys(prev).length ||
          Object.keys(nextRects).some(k => 
            !prev[k] || 
            prev[k].left !== nextRects[k].left || 
            prev[k].top !== nextRects[k].top || 
            prev[k].width !== nextRects[k].width || 
            prev[k].height !== nextRects[k].height
          );
        return hasChanged ? nextRects : prev;
      });
      
      requestAnimationFrame(sync);
    };

    requestAnimationFrame(sync);
    return () => { cancelled = true; };
  }, [mode]);

  // Phase 1: DnD Setup
  const dragHandleRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!primaryKey || !dragHandleRef.current) return;

    return draggable({
      element: dragHandleRef.current,
      getInitialData: () => ({ path: primaryKey, type: 'field' }),
      onDragStart: () => {
        setOverlayState(prev => ({ ...prev, dragState: { source: primaryKey, target: null, edge: null } }));
        telemetry.emit('studio_tool_called', { tool: 'drag_reorder', path: primaryKey });
      },
      onDrop: () => {
        setOverlayState(prev => ({ ...prev, dragState: null }));
      },
    });
  }, [primaryKey]);

  useEffect(() => {
    if (!containerRef.current) return;

    return dropTargetForElements({
      element: containerRef.current,
      getData: ({ input, element }) => {
        // Find which field we are hovering over
        const target = document.elementFromPoint(input.clientX, input.clientY);
        const fieldRoot = target?.closest('[data-name]');
        const targetPath = fieldRoot?.getAttribute('data-name');
        
        if (targetPath && fieldRoot instanceof HTMLElement) {
          return attachClosestEdge({ path: targetPath }, {
            input,
            element: fieldRoot,
            allowedEdges: ['top', 'bottom'],
          });
        }
        return {};
      },
      onDrag: ({ self, source }) => {
        const targetPath = self.data.path as string | undefined;
        const edge = extractClosestEdge(self.data);
        if (targetPath && source.data.path !== targetPath) {
          setOverlayState(prev => ({ 
            ...prev, 
            dragState: { 
              source: source.data.path as string, 
              target: targetPath, 
              edge 
            } 
          }));
        }
      },
      onDragLeave: () => {
        setOverlayState(prev => ({ ...prev, dragState: prev.dragState ? { ...prev.dragState, target: null, edge: null } : null }));
      },
      onDrop: ({ self, source }) => {
        const sourcePath = source.data.path as string;
        const targetPath = self.data.path as string | undefined;
        const edge = extractClosestEdge(self.data);

        if (targetPath && sourcePath !== targetPath) {
          const resolved = resolveDropTarget(targetPath, edge);
          if (resolved) {
            const { targetParentRef, finalIndex } = resolved;
            
            // Check for circular move
            const sourceRef = { bind: sourcePath };
            const targetRef = { bind: targetPath };
            const tree = project.component.tree;
            
            if (tree && isCircularComponentMove(tree, sourceRef, targetParentRef)) {
              console.warn('Circular move detected and prevented');
              return;
            }

            project.moveComponentNodeToIndex(sourceRef, targetParentRef, finalIndex);
            
            telemetry.emit('studio_design_change', { 
              property: 'position', 
              path: sourcePath,
              detail: { targetPath, edge, finalIndex }
            });
          }
        }
      },
    });
  }, [project]);

  const handleFieldClick = useCallback((path: string, event: MouseEvent) => {
    event.stopPropagation();
    select(path, 'field', { tab: isEdit ? 'editor' : 'layout' });
  }, [select, isEdit]);

  // Double-click: inline label edit (Edit mode only)
  const handleFieldDoubleClick = useCallback((path: string, event: MouseEvent) => {
    if (!isEdit) return;
    event.stopPropagation();
    setOverlayState((prev) => ({ ...prev, editingPath: path }));
  }, [isEdit]);

  // Click handler: select field via event delegation
  const handleCanvasClick = useCallback((event: MouseEvent) => {
    if (isInteractiveTarget(event.target)) return;

    if (event.target === event.currentTarget) {
      deselect();
      setOverlayState((prev) => ({ ...prev, editingPath: null, contextMenu: null }));
      return;
    }

    const fieldRoot = (event.target as HTMLElement).closest('[data-name]');
    if (fieldRoot instanceof HTMLElement) {
      const path = fieldRoot.getAttribute('data-name');
      if (path) {
        if (event.detail === 2) {
          handleFieldDoubleClick(path, event);
        } else {
          handleFieldClick(path, event);
        }
      }
    }
  }, [deselect, handleFieldClick, handleFieldDoubleClick]);

  // Hover tracking via delegation
  const handleMouseMove = useCallback((event: globalThis.MouseEvent) => {
    const fieldRoot = (event.target as HTMLElement).closest('[data-name]');
    const path = fieldRoot?.getAttribute('data-name') || null;
    if (path !== overlayState.hoveredPath) {
      setOverlayState((prev) => ({ ...prev, hoveredPath: path }));
    }

    // Detect if mouse is near an insertion point
    if (mode === 'edit' && containerRef.current) {
      const containerRect = containerRef.current.getBoundingClientRect();
      const mouseX = event.clientX - containerRect.left;
      const mouseY = event.clientY - containerRect.top;
      
      // We'll calculate the closest insertion point on the fly from the tree
      // to keep it highly reactive.
      const tree = project.state.component.tree as CompNode;
      const result = {
        closest: null as { parentRef: NodeRef, index: number, y: number, x: number, width: number } | null,
        minDist: 20
      };

      const walk = (node: CompNode) => {
        if (node.children && node.children.length > 1) {
          for (let i = 0; i < node.children.length - 1; i++) {
            const prev = node.children[i];
            const next = node.children[i+1];
            const path1 = prev.bind || prev.nodeId;
            const path2 = next.bind || next.nodeId;
            if (!path1 || !path2) continue;
            const r1 = fieldRects[path1];
            const r2 = fieldRects[path2];
            
            if (r1 && r2) {
              const midY = (r1.bottom + r2.top) / 2;
              const dist = Math.abs(mouseY - midY);
              if (dist < result.minDist && mouseX > r1.left && mouseX < r1.right) {
                result.minDist = dist;
                result.closest = {
                  parentRef: node.bind ? { bind: node.bind } : { nodeId: node.nodeId },
                  index: i + 1,
                  y: midY,
                  x: r1.left,
                  width: r1.width,
                };
              }
            }
          }
        }
        if (node.children) node.children.forEach(walk);
      };
      if (tree) walk(tree);
      
      const active = overlayState.activeInsertion;
      const found = result.closest;
      const isSame = found?.index === active?.index && 
                    (found?.parentRef?.bind === active?.parentRef?.bind && found?.parentRef?.nodeId === active?.parentRef?.nodeId);
      
      if (!isSame) {
        setOverlayState(prev => ({ ...prev, activeInsertion: found }));
      }
    }
  }, [overlayState.hoveredPath, overlayState.activeInsertion, fieldRects, mode, project.state.component.tree]);

  const handleMouseLeave = useCallback(() => {
    setOverlayState((prev) => ({ ...prev, hoveredPath: null }));
  }, []);



  const handleInlineEditCommit = useCallback((path: string, value: string) => {
    project.updateItem(path, { label: value });
    setOverlayState((prev) => ({ ...prev, editingPath: null }));
  }, [project]);

  const handleDelete = useCallback((path: string) => {
    project.removeItem(path);
    setOverlayState((prev) => ({ ...prev, contextMenu: null }));
  }, [project]);

  const handleInlineEditCancel = useCallback(() => {
    setOverlayState((prev) => ({ ...prev, editingPath: null }));
  }, []);

  /** 
   * Calculate the correct insertion index and parent for a drop.
   * This ensures we 'do it right' by respecting the structural tree, not just DOM order.
   */
  const resolveDropTarget = useCallback((targetPath: string, edge: Edge | null) => {
    const tree = project.state.component.tree as CompNode;
    if (!tree) return null;

    const targetRef = { bind: targetPath };
    const parent = findParentOfNodeRef(tree, targetRef);
    
    if (!parent) return null; // Root or not found

    const index = parent.children?.findIndex(c => c.bind === targetPath || c.nodeId === targetPath) ?? -1;
    if (index === -1) return null;

    const targetParentRef = parent.bind ? { bind: parent.bind } : { nodeId: parent.nodeId };
    
    // If dropping on bottom edge, increment index
    const finalIndex = edge === 'bottom' ? index + 1 : index;

    return { targetParentRef, finalIndex };
  }, [project]);

  const handleDrop = useCallback((source: string, target: string | null, edge: Edge | null) => {
    setOverlayState((prev) => ({ ...prev, dragState: null }));
    if (!target || source === target) return;

    // Detect if target is a Region or Page
    const targetElement = document.querySelector(`[data-name="${target}"]`) as HTMLElement;
    const isRegion = targetElement?.hasAttribute('data-region-id');
    const isPage = targetElement?.hasAttribute('data-page-id');

    if (isRegion) {
      const regionId = targetElement.getAttribute('data-region-id')!;
      project.moveComponentNodeToContainer({ bind: source }, { nodeId: regionId });
    } else if (isPage) {
      const pageId = targetElement.getAttribute('data-page-id')!;
      project.placeOnPage(source, pageId);
    } else {
      // Standard reorder
      const parentRef = findParentRefOfNodeRef(project.state.component.tree as CompNode, { bind: source });
      if (!parentRef) return;

      const targetRef = { bind: target };
      const targetParent = findParentRefOfNodeRef(project.state.component.tree as CompNode, { bind: target });
      if (!targetParent) return;

      // Find target index based on edge
      const siblings = findComponentNodeByRef(project.state.component.tree as CompNode, targetParent)?.children || [];
      const targetIndex = siblings.findIndex((s: any) => s.bind === target || s.nodeId === target);
      const finalIndex = edge === 'bottom' ? targetIndex + 1 : targetIndex;

      const targetParentId = ('nodeId' in targetParent ? targetParent.nodeId : targetParent.bind) as string;
      project.moveLayoutNode(source, targetParentId, finalIndex);
    }
    
    telemetry.emit('studio_design_change', { property: 'structure', action: 'move' });
  }, [project]);

  const handleWidgetChange = useCallback((path: string, widget: string) => {
    const hasComponentDoc = !!findComponentNodeByRef(project.state.component.tree as CompNode, { bind: path });
    const hasThemeDoc = !!project.state.theme.items?.[path];

    if (hasComponentDoc) {
      project.setNodeType(path, widget);
    } else if (hasThemeDoc) {
      project.setItemWidgetConfig(path, widget);
    } else {
      project.updateItem(path, { presentation: { widgetHint: widget } });
    }
  }, [project]);

  const handleSlashInsert = useCallback((type: 'field' | 'group' | 'heading' | 'paragraph', insertion?: { parentRef: any, index: number }) => {
    const targetParent = insertion?.parentRef || (primaryKey ? (primaryKey.includes('.') ? { bind: primaryKey.split('.').slice(0, -1).join('.') } : undefined) : undefined);
    const parentPath = targetParent?.bind;
    const index = insertion?.index;

    if (type === 'field') {
      project.addField('newField', 'New Field', 'string', { parentPath, insertIndex: index });
    } else if (type === 'group') {
      project.addGroup(parentPath ? `${parentPath}.newGroup` : 'newGroup', 'New Group', { parentPath, insertIndex: index });
    } else {
      project.addContent('newContent', 'New Content', type, { parentPath, insertIndex: index });
    }
    setOverlayState((prev) => ({ ...prev, slashMenuOpen: false, activeInsertion: null }));
  }, [primaryKey, project]);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && primaryKey && !overlayState.editingPath && !overlayState.slashMenuOpen) {
        e.preventDefault();
        setOverlayState((prev) => ({ ...prev, slashMenuOpen: true }));
      }
      if (e.key === 'Escape') {
        setOverlayState((prev) => ({ ...prev, slashMenuOpen: false }));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [primaryKey, overlayState.editingPath, overlayState.slashMenuOpen]);

  // Close context menu
  const closeContextMenu = useCallback(() => {
    setOverlayState((prev) => ({ ...prev, contextMenu: null }));
  }, []);

  // Build logic badges for a field
  const handleResizeStart = (e: React.MouseEvent, path: string) => {
    e.stopPropagation();
    e.preventDefault();
    const rect = fieldRects[path];
    if (!rect) return;
    setOverlayState(prev => ({ 
      ...prev, 
      resizing: { path, initialWidth: rect.width, initialX: e.clientX } 
    }));
    
    const handleMouseMove = (me: globalThis.MouseEvent) => {
      // Grid logic would go here if we wanted live ghost resizing
    };
    
    const handleMouseUp = (ue: globalThis.MouseEvent) => {
      const deltaX = ue.clientX - e.clientX;
      const containerWidth = containerRef.current?.offsetWidth || 800;
      const colWidth = containerWidth / 12;
      const item = project.itemAt(path);
      const currentSpan = (item as { presentation?: { span?: number } })?.presentation?.span || 12;
      const spanDelta = Math.round(deltaX / colWidth);
      const nextSpan = Math.max(1, Math.min(12, currentSpan + spanDelta));
      
      if (nextSpan !== currentSpan) {
        project.updateItem(path, { span: nextSpan });
        telemetry.emit('studio_design_change', { property: 'span', value: nextSpan });
      }
      
      setOverlayState(prev => ({ ...prev, resizing: null }));
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
    
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
  };

  const handleContextMenu = (e: React.MouseEvent, path: string) => {
    e.preventDefault();
    setOverlayState(prev => ({
      ...prev,
      contextMenu: { x: e.clientX, y: e.clientY, path }
    }));
  };

  const handleAskAIAboutField = (path: string) => {
    const item = project.itemAt(path);
    if (!item) return;
    
    const prompt = `Tell me about the logic for the "${item.label || path}" field and suggest any improvements.`;
    dispatchStudioEvent(STUDIO_EVENTS.ASSISTANT_PROMPT, { prompt });
    setOverlayState(prev => ({ ...prev, contextMenu: null }));
  };

  const getLogicBadges = useCallback((path: string): string[] => {
    const badges: string[] = [];
    const definition = project.definition;
    const item = project.itemAt(path);
    if (!item) return badges;

    // Required
    const binds = definition.binds ?? [];
    const hasRequired = binds.some(
      (b: any) => b.constraint === 'required' && b.target === path,
    );
    if (hasRequired) badges.push('•');

    // Conditional (relevant vs when)
    const hasRelevant = binds.some(
      (b: any) => b.constraint === 'relevant' && b.target === path,
    );
    
    const component = findComponentNodeByRef(project.state.component.tree as CompNode, { bind: path });
    const hasWhen = !!component?.when;

    if (hasRelevant) badges.push('?');
    if (hasWhen) badges.push('👁️');

    // Calculated
    const hasCalculate = binds.some(
      (b: any) => b.constraint === 'calculate' && b.target === path,
    );
    if (hasCalculate) badges.push('=');

    // Validated (constraint binds)
    const hasConstraint = binds.some(
      (b: any) => b.constraint === 'constraint' && b.target === path,
    );
    if (hasConstraint) badges.push('!');

    // Readonly
    const hasReadonly = binds.some(
      (b: any) => b.constraint === 'readonly' && b.target === path,
    );
    if (hasReadonly) badges.push('🔒');

    return badges;
  }, [project]);

  return (
    <div
      ref={containerRef}
      className="authoring-overlay relative"
      data-testid="authoring-overlay"
      data-mode={mode}
      onClick={handleCanvasClick}
      onMouseMove={(e) => handleMouseMove(e.nativeEvent)}
      onMouseLeave={handleMouseLeave}
    >
      {/* Rendered form content */}
      <div className={isEdit ? 'opacity-100' : 'opacity-100'}>
        {children}
      </div>

      {/* Selection ring for current selection */}
      {primaryKey && fieldRects[primaryKey] && (
        <div
          className="pointer-events-none absolute border-2 border-accent rounded-sm z-10 transition-all duration-75"
          data-testid="selection-ring"
          style={{
            left: fieldRects[primaryKey].left - 4,
            top: fieldRects[primaryKey].top - 4,
            width: fieldRects[primaryKey].width + 8,
            height: fieldRects[primaryKey].height + 8,
          }}
        >
            <div 
              className="absolute inset-0 cursor-pointer pointer-events-auto" 
              onClick={(e) => { e.stopPropagation(); select(primaryKey, 'field'); }}
              onContextMenu={(e) => handleContextMenu(e, primaryKey)}
            />
            {/* Resize Handles (Design Mode Only) */}
              {!isEdit && (
                <>
                  <div 
                    className="absolute right-[-6px] top-1/2 -translate-y-1/2 w-3 h-8 bg-accent rounded-full border-2 border-white cursor-ew-resize shadow-md z-50 flex items-center justify-center gap-0.5"
                    onMouseDown={(e) => handleResizeStart(e, primaryKey)}
                  >
                    <div className="w-px h-3 bg-white/50" />
                    <div className="w-px h-3 bg-white/50" />
                  </div>
                  <div className="absolute left-[-6px] top-1/2 -translate-y-1/2 w-3 h-8 bg-accent rounded-full border-2 border-white cursor-ew-resize shadow-md z-50 opacity-20 hover:opacity-100 transition-opacity" />
                </>
              )}

            {/* Action handle + Drag handle */}
            <div className="absolute -top-7 left-0 flex items-center gap-1.5 pointer-events-auto">
              <div 
                ref={dragHandleRef}
                className="bg-accent text-white p-1 rounded-md cursor-grab active:cursor-grabbing hover:bg-accent-emphasis shadow-sm"
                title="Drag to reorder"
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                  <circle cx="9" cy="5" r="1"/><circle cx="9" cy="12" r="1"/><circle cx="9" cy="19" r="1"/>
                  <circle cx="15" cy="5" r="1"/><circle cx="15" cy="12" r="1"/><circle cx="15" cy="19" r="1"/>
                </svg>
              </div>
              <div className="bg-accent text-white text-[10px] px-2 py-1 rounded-md font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5">
                <span>{isEdit ? 'Edit' : 'Design'}</span>
                <span className="w-px h-3 bg-white/30" />
                <WidgetPopover 
                  path={primaryKey}
                  project={project}
                  onSelect={(widget) => handleWidgetChange(primaryKey, widget)}
                >
                  {({ ref, onClick }) => (
                    <button 
                      ref={ref}
                      onClick={onClick}
                      className="flex items-center gap-1 hover:bg-white/10 rounded px-0.5"
                    >
                      <span>{project.itemAt(primaryKey)?.presentation?.widgetHint || 'Default'}</span>
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                        <path d="M6 9l6 6 6-6" />
                      </svg>
                    </button>
                  )}
                </WidgetPopover>
              </div>

              {/* Variant Toggle (Design Mode Only) */}
              {!isEdit && (
                <div className="bg-surface border border-accent/20 text-accent text-[9px] px-1.5 py-1 rounded-md font-bold uppercase tracking-wider shadow-sm flex items-center gap-1.5 ml-1">
                  <button 
                    className={`hover:bg-accent/10 px-1 rounded ${project.itemAt(primaryKey)?.presentation?.variant !== 'outline' ? 'bg-accent/10' : ''}`}
                    onClick={() => project.setItemOverride(primaryKey, 'variant', 'filled')}
                  >
                    Filled
                  </button>
                  <button 
                    className={`hover:bg-accent/10 px-1 rounded ${project.itemAt(primaryKey)?.presentation?.variant === 'outline' ? 'bg-accent/10' : ''}`}
                    onClick={() => project.setItemOverride(primaryKey, 'variant', 'outline')}
                  >
                    Outline
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Smart + Insertion Points */}
        {mode === 'edit' && overlayState.activeInsertion && !overlayState.dragState && (
          <div
            className="absolute z-40 flex items-center justify-center animate-in fade-in duration-200"
            style={{
              left: overlayState.activeInsertion.x,
              top: overlayState.activeInsertion.y - 12,
              width: overlayState.activeInsertion.width,
              height: 24,
            }}
          >
            <div className="absolute inset-x-0 h-px bg-accent/40" />
            <button
              className="relative bg-accent text-white h-5 w-5 rounded-full flex items-center justify-center shadow-lg hover:scale-110 transition-transform"
              onClick={() => setOverlayState(prev => ({ ...prev, slashMenuOpen: true }))}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                <path d="M12 5v14M5 12h14" />
              </svg>
            </button>
          </div>
        )}

        {/* Drag Indicator (Insertion Line) */}
        {overlayState.dragState?.target && fieldRects[overlayState.dragState.target] && (
          <div
            className="absolute z-50 border-t-2 border-accent transition-all pointer-events-none"
            style={{
              left: fieldRects[overlayState.dragState.target].left,
              width: fieldRects[overlayState.dragState.target].width,
              top: overlayState.dragState.edge === 'bottom' 
                ? fieldRects[overlayState.dragState.target].top + fieldRects[overlayState.dragState.target].height
                : fieldRects[overlayState.dragState.target].top,
            }}
          >
            <div className="absolute -left-1.5 -top-1.5 h-3 w-3 rounded-full bg-accent" />
          </div>
        )}

      {/* Hover state */}
      {overlayState.hoveredPath && overlayState.hoveredPath !== primaryKey && fieldRects[overlayState.hoveredPath] && (
        <div
          className="pointer-events-none absolute border border-accent/40 bg-accent/5 rounded-sm z-0"
          data-testid="hover-ring"
          style={{
            left: fieldRects[overlayState.hoveredPath].left,
            top: fieldRects[overlayState.hoveredPath].top,
            width: fieldRects[overlayState.hoveredPath].width,
            height: fieldRects[overlayState.hoveredPath].height,
          }}
        />
      )}

      {/* Inline label edit */}
      {overlayState.editingPath && fieldRects[overlayState.editingPath] && (
        <div
          className="absolute z-30 bg-surface shadow-xl rounded-md border border-accent p-1"
          style={{
            left: fieldRects[overlayState.editingPath].left,
            top: fieldRects[overlayState.editingPath].top,
            width: Math.max(200, fieldRects[overlayState.editingPath].width),
          }}
        >
          <input
            autoFocus
            className="w-full bg-transparent border-none outline-none text-[13px] font-medium px-2 py-1"
            defaultValue={project.itemAt(overlayState.editingPath)?.label || overlayState.editingPath.split('.').pop()}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleInlineEditCommit(overlayState.editingPath!, e.currentTarget.value);
              if (e.key === 'Escape') handleInlineEditCancel();
            }}
            onBlur={(e) => handleInlineEditCommit(overlayState.editingPath!, e.currentTarget.value)}
          />
        </div>
      )}

      {/* Slash command menu */}
      {overlayState.slashMenuOpen && primaryKey && fieldRects[primaryKey] && (
        <div
          className="absolute z-40 bg-surface shadow-2xl rounded-lg border border-border overflow-hidden min-w-[180px] animate-in slide-in-from-top-2 duration-150"
          style={{
            left: overlayState.activeInsertion ? overlayState.activeInsertion.x : (primaryKey && fieldRects[primaryKey] ? fieldRects[primaryKey].left : 0),
            top: overlayState.activeInsertion ? overlayState.activeInsertion.y + 8 : (primaryKey && fieldRects[primaryKey] ? fieldRects[primaryKey].top + fieldRects[primaryKey].height + 8 : 0),
          }}
        >
          <div className="px-3 py-2 border-b border-border bg-subtle/30">
            <span className="text-[10px] font-bold uppercase tracking-wider text-muted">
              Insert {overlayState.activeInsertion ? 'here' : 'below'}
            </span>
          </div>
          <div className="flex flex-col p-1">
            <button 
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-accent hover:text-white rounded-md transition-colors flex items-center justify-between group"
              onClick={() => handleSlashInsert('field', overlayState.activeInsertion || undefined)}
            >
              <span>Field</span>
              <span className="text-[10px] opacity-50 group-hover:opacity-100">string, number...</span>
            </button>
            <button 
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-accent hover:text-white rounded-md transition-colors flex items-center justify-between group"
              onClick={() => handleSlashInsert('group')}
            >
              <span>Group</span>
              <span className="text-[10px] opacity-50 group-hover:opacity-100">Fieldset</span>
            </button>
            <button 
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-accent hover:text-white rounded-md transition-colors flex items-center justify-between group"
              onClick={() => handleSlashInsert('heading')}
            >
              <span>Heading</span>
              <span className="text-[10px] opacity-50 group-hover:opacity-100">Section title</span>
            </button>
            <button 
              className="w-full text-left px-3 py-2 text-[12px] hover:bg-accent hover:text-white rounded-md transition-colors flex items-center justify-between group"
              onClick={() => handleSlashInsert('paragraph')}
            >
              <span>Paragraph</span>
              <span className="text-[10px] opacity-50 group-hover:opacity-100">Instructional text</span>
            </button>
          </div>
        </div>
      )}

      {/* Edit mode affordances */}
      {isEdit && (
        <>
          {/* Smart + insertion lines between siblings (Placeholder) */}
          <div data-testid="insertion-lines" className="pointer-events-none absolute inset-0" />

          {/* Logic badges */}
          {primaryKey && fieldRects[primaryKey] && (
            <div
              className="absolute flex gap-0.5 z-20 pointer-events-auto"
              data-testid="logic-badges"
              style={{
                left: fieldRects[primaryKey].left + fieldRects[primaryKey].width - 4,
                top: fieldRects[primaryKey].top - 6,
              }}
            >
              {getLogicBadges(primaryKey).map((badge, i) => (
                <span
                  key={i}
                  className="inline-flex h-4 w-4 items-center justify-center rounded-full bg-surface/90 text-[10px] font-bold text-accent border border-accent/20 shadow-sm"
                  title={badgeTitle(badge)}
                >
                  {badge}
                </span>
              ))}
            </div>
          )}
        </>
      )}

      {/* Design mode affordances */}
      {isDesign && (
        <>
          {/* Style selection rings use accent color + style icon (Placeholder) */}
          <div data-testid="style-controls" className="pointer-events-none absolute inset-0" />
        </>
      )}

      {/* Phase 2: Changeset Review Overlay */}
      {activeChangeset && activeChangeset.status === 'pending' && (
        <>
          {/* Highlight affected fields */}
          {activeChangeset.aiEntries.flatMap((e: any) => e.affectedPaths).map((path: string) => {
            const rect = fieldRects[path];
            if (!rect) return null;
            return (
              <div
                key={`proposed-${path}`}
                className="pointer-events-none absolute border-2 border-dashed border-emerald-500 bg-emerald-500/5 rounded-sm z-20 animate-pulse"
                style={{
                  left: rect.left,
                  top: rect.top,
                  width: rect.width,
                  height: rect.height,
                }}
              >
                <div className="absolute -top-5 left-0 bg-emerald-500 text-white text-[9px] font-bold px-1.5 py-0.5 rounded shadow-sm">
                  PROPOSED
                </div>
              </div>
            );
          })}

          {/* Floating Review Bar */}
          <div className="fixed bottom-12 left-1/2 -translate-x-1/2 z-50 flex items-center gap-4 bg-surface/90 backdrop-blur-md px-6 py-3 rounded-full border border-emerald-500/30 shadow-2xl animate-in slide-in-from-bottom-4 duration-300">
            <div className="flex flex-col">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">AI Proposed Changes</span>
              <span className="text-[13px] font-medium text-ink max-w-[300px] truncate">{activeChangeset.label || 'Modified form structure'}</span>
            </div>
            <div className="w-px h-8 bg-border" />
            <div className="flex items-center gap-2">
              <button
                className="px-4 py-1.5 rounded-full text-[12px] font-semibold text-muted hover:bg-subtle transition-colors"
                onClick={() => proposalManager?.rejectChangeset()}
              >
                Reject
              </button>
              <button
                className="px-5 py-1.5 rounded-full text-[12px] font-bold bg-emerald-500 text-white hover:bg-emerald-600 transition-colors shadow-sm"
                onClick={() => proposalManager?.acceptChangeset()}
              >
                Accept
              </button>
            </div>
          </div>
        </>
      )}

      {/* Context Menu */}
      {overlayState.contextMenu && (
        <div 
          className="fixed z-[100] bg-surface border border-border shadow-xl rounded-lg py-1 min-w-[180px] animate-in fade-in zoom-in-95 duration-100"
          style={{ left: overlayState.contextMenu.x, top: overlayState.contextMenu.y }}
          onMouseLeave={() => setOverlayState(prev => ({ ...prev, contextMenu: null }))}
        >
          <button 
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle flex items-center gap-2 group"
            onClick={() => handleAskAIAboutField(overlayState.contextMenu!.path)}
          >
            <span className="grayscale group-hover:grayscale-0">✨</span>
            Ask AI about this field
          </button>
          <div className="h-px bg-border/50 my-1" />
          <button 
            className="w-full text-left px-3 py-2 text-[13px] hover:bg-subtle text-error"
            onClick={() => {
              project.removeItem(overlayState.contextMenu!.path);
              setOverlayState(prev => ({ ...prev, contextMenu: null }));
            }}
          >
            Delete Field
          </button>
        </div>
      )}
    </div>
  );
}

function badgeTitle(badge: string): string {
  switch (badge) {
    case '•': return 'Required';
    case '?': return 'Logic: Conditional (relevant / data-exclusion)';
    case '👁️': return 'Visual: Conditional (when / show-hide)';
    case '=': return 'Calculated value';
    case '!': return 'Has validation constraint';
    case '🔒': return 'Read-only';
    default: return '';
  }
}
