/** @filedesc Unit tests for useResizeHandle snap math and clamping logic. */
import React from 'react';
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { snapAndClamp, useResizeHandle } from '../../../src/workspaces/layout/useResizeHandle';

describe('snapAndClamp', () => {
  it('rounds delta of 1.6 with snap=1 to 2', () => {
    expect(snapAndClamp(1.6, 1, 12, 1)).toBe(2);
  });

  it('rounds delta of 2.4 with snap=1 to 2', () => {
    expect(snapAndClamp(2.4, 1, 12, 1)).toBe(2);
  });

  it('clamps value above max to max', () => {
    expect(snapAndClamp(4, 1, 3, 1)).toBe(3);
  });

  it('clamps value below min to min', () => {
    expect(snapAndClamp(0, 1, 12, 1)).toBe(1);
  });

  it('passes through value within range with no snap', () => {
    expect(snapAndClamp(5, 1, 12)).toBe(5);
  });

  it('snaps to nearest multiple of snap value', () => {
    // snap=2: 3 rounds to 4 (nearest even)
    expect(snapAndClamp(3, 1, 12, 2)).toBe(4);
    // snap=2: 2.9 rounds to 2
    expect(snapAndClamp(2.9, 1, 12, 2)).toBe(2);
  });

  it('negative values clamp to min', () => {
    expect(snapAndClamp(-5, 1, 12, 1)).toBe(1);
  });

  it('exact max value is retained', () => {
    expect(snapAndClamp(12, 1, 12, 1)).toBe(12);
  });

  it('exact min value is retained', () => {
    expect(snapAndClamp(1, 1, 12, 1)).toBe(1);
  });
});

describe('useResizeHandle — initialValue', () => {
  it('drags from initialValue, not from min', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() =>
      useResizeHandle({ axis: 'x', min: 1, max: 12, snap: 1, initialValue: 3, onResize }),
    );

    const element = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as EventTarget;

    // Simulate pointerdown at x=100 with initialValue=3
    act(() => {
      result.current.handleProps.onPointerDown({
        clientX: 100,
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    // Simulate pointermove 2px to the right — should produce 3+2=5
    act(() => {
      result.current.handleProps.onPointerMove({
        clientX: 102,
        clientY: 0,
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    expect(onResize).toHaveBeenCalledWith(5);
  });

  it('pixelsPerUnit=200: 180px drag from initialValue=1 produces span delta ~0.9 → snaps to 2', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() =>
      useResizeHandle({ axis: 'x', min: 1, max: 4, snap: 1, initialValue: 1, pixelsPerUnit: 200, onResize }),
    );

    const element = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as EventTarget;

    act(() => {
      result.current.handleProps.onPointerDown({
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    // 180px drag / 200 pixelsPerUnit = 0.9 unit delta → 1 + 0.9 = 1.9 → snaps to 2
    act(() => {
      result.current.handleProps.onPointerMove({
        clientX: 180,
        clientY: 0,
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    expect(onResize).toHaveBeenCalledWith(2);
  });

  it('pixelsPerUnit=200: 50px drag from initialValue=2 stays at 2 (delta 0.25 rounds down)', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() =>
      useResizeHandle({ axis: 'x', min: 1, max: 4, snap: 1, initialValue: 2, pixelsPerUnit: 200, onResize }),
    );

    const element = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as EventTarget;

    act(() => {
      result.current.handleProps.onPointerDown({
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    // 50px / 200 = 0.25 unit delta → 2.25 → snaps to 2 (no change)
    act(() => {
      result.current.handleProps.onPointerMove({
        clientX: 50,
        clientY: 0,
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    expect(onResize).toHaveBeenCalledWith(2);
  });

  it('without pixelsPerUnit: raw pixel delta used (backward compat)', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() =>
      useResizeHandle({ axis: 'x', min: 1, max: 12, snap: 1, initialValue: 1, onResize }),
    );

    const element = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as EventTarget;

    act(() => {
      result.current.handleProps.onPointerDown({
        clientX: 0,
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    // Without pixelsPerUnit: 3px drag → 1+3=4
    act(() => {
      result.current.handleProps.onPointerMove({
        clientX: 3,
        clientY: 0,
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    expect(onResize).toHaveBeenCalledWith(4);
  });

  it('drag from initialValue=3 with negative delta clamps to min', () => {
    const onResize = vi.fn();
    const { result } = renderHook(() =>
      useResizeHandle({ axis: 'x', min: 1, max: 12, snap: 1, initialValue: 3, onResize }),
    );

    const element = {
      setPointerCapture: vi.fn(),
      releasePointerCapture: vi.fn(),
    } as unknown as EventTarget;

    act(() => {
      result.current.handleProps.onPointerDown({
        clientX: 100,
        clientY: 0,
        pointerId: 1,
        stopPropagation: vi.fn(),
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    // Move -10px from 3 → 3-10 = -7, clamped to min=1
    act(() => {
      result.current.handleProps.onPointerMove({
        clientX: 90,
        clientY: 0,
        currentTarget: element,
      } as unknown as React.PointerEvent);
    });

    expect(onResize).toHaveBeenCalledWith(1);
  });
});
