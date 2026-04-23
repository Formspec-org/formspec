import { describe, expect, it } from 'vitest';
import {
  layoutCanvasContainerShellClassName,
  layoutCanvasDragOverlayPositionStyle,
  layoutCanvasDropNodeRefMatches,
  LAYOUT_CANVAS_DRAG_OVERLAY_POINTER_OFFSET_PX,
} from '../../../src/workspaces/layout/dnd/layout-dnd-styles';

describe('layoutCanvasDropNodeRefMatches', () => {
  it('matches by nodeId when both set', () => {
    expect(layoutCanvasDropNodeRefMatches({ nodeId: 'a' }, { nodeId: 'a' })).toBe(true);
    expect(layoutCanvasDropNodeRefMatches({ nodeId: 'a' }, { nodeId: 'b' })).toBe(false);
  });

  it('matches by bind when nodeId absent on self', () => {
    expect(layoutCanvasDropNodeRefMatches({ bind: 'x.y' }, { bind: 'x.y' })).toBe(true);
    expect(layoutCanvasDropNodeRefMatches({ bind: 'x.y' }, { bind: 'other' })).toBe(false);
  });

  it('prefers nodeId on self when both self fields set', () => {
    expect(layoutCanvasDropNodeRefMatches({ nodeId: 'n', bind: 'ignored' }, { nodeId: 'n', bind: 'other' })).toBe(true);
  });

  it('returns false when self has no identifying field', () => {
    expect(layoutCanvasDropNodeRefMatches({}, { nodeId: 'n' })).toBe(false);
  });
});

describe('layoutCanvasDragOverlayPositionStyle', () => {
  it('returns undefined without pointer', () => {
    expect(layoutCanvasDragOverlayPositionStyle(null)).toBeUndefined();
    expect(layoutCanvasDragOverlayPositionStyle(undefined)).toBeUndefined();
  });

  it('offsets client coordinates', () => {
    const o = LAYOUT_CANVAS_DRAG_OVERLAY_POINTER_OFFSET_PX;
    expect(layoutCanvasDragOverlayPositionStyle({ clientX: 10, clientY: 20 })).toEqual({
      left: 10 + o,
      top: 20 + o,
    });
  });
});

describe('layoutCanvasContainerShellClassName', () => {
  it('includes positioning root and selection shell', () => {
    const c = layoutCanvasContainerShellClassName({
      selectionShell: 'rounded border',
      isDragSource: false,
      containerDropActive: false,
    });
    expect(c).toContain('relative');
    expect(c).toContain('rounded border');
  });

  it('adds drag source and drop-active tokens when requested', () => {
    const c = layoutCanvasContainerShellClassName({
      selectionShell: 'shell',
      isDragSource: true,
      containerDropActive: true,
    });
    expect(c).toContain('opacity-55');
    expect(c).toContain('ring-2');
  });
});
