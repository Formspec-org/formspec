import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, vi, afterEach } from 'vitest';
import { LayoutBlock } from '../../../src/workspaces/editor/LayoutBlock';

afterEach(cleanup);

const noop = () => {};

describe('LayoutBlock', () => {
  it('renders the component type label', () => {
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Card"
        layoutId="__node:node_1"
        registerTarget={noop}
        depth={0}
        selected={false}
        onSelect={noop}
      />
    );
    expect(screen.getByText('Card')).toBeTruthy();
  });

  it('sets data-item-path and data-item-type attributes', () => {
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Grid"
        layoutId="__node:node_1"
        registerTarget={noop}
        depth={0}
        selected={false}
        onSelect={noop}
      />
    );
    const el = screen.getByTestId('layout-node_1');
    expect(el.getAttribute('data-item-path')).toBe('__node:node_1');
    expect(el.getAttribute('data-item-type')).toBe('layout');
  });

  it('renders children inside the container', () => {
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Card"
        layoutId="__node:node_1"
        registerTarget={noop}
        depth={0}
        selected={false}
        onSelect={noop}
      >
        <div data-testid="child">Hello</div>
      </LayoutBlock>
    );
    expect(screen.getByTestId('child')).toBeTruthy();
  });

  it('shows selected state with accent styling', () => {
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Card"
        layoutId="__node:node_1"
        registerTarget={noop}
        depth={0}
        selected={true}
        onSelect={noop}
      />
    );
    const el = screen.getByTestId('layout-node_1');
    expect(el.className).toContain('border-accent');
  });

  it('applies depth-based indentation', () => {
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Stack"
        layoutId="__node:node_1"
        registerTarget={noop}
        depth={2}
        selected={false}
        onSelect={noop}
      />
    );
    const el = screen.getByTestId('layout-node_1');
    expect(el.parentElement!.style.marginLeft).toBe('40px');
  });

  it('calls registerTarget with layoutId', () => {
    const register = vi.fn();
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Card"
        layoutId="__node:node_1"
        registerTarget={register}
        depth={0}
        selected={false}
        onSelect={noop}
      />
    );
    expect(register).toHaveBeenCalledWith('__node:node_1', expect.any(HTMLElement));
  });

  it('calls onSelect when clicked', () => {
    const onSelect = vi.fn();
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Collapsible"
        layoutId="__node:node_1"
        registerTarget={noop}
        depth={0}
        selected={false}
        onSelect={onSelect}
      />
    );
    screen.getByTestId('layout-node_1').click();
    expect(onSelect).toHaveBeenCalledTimes(1);
  });

  it('shows isInSelection styling', () => {
    render(
      <LayoutBlock
        nodeId="node_1"
        component="Card"
        layoutId="__node:node_1"
        registerTarget={noop}
        depth={0}
        selected={false}
        isInSelection={true}
        onSelect={noop}
      />
    );
    const el = screen.getByTestId('layout-node_1');
    expect(el.className).toContain('border-accent');
  });
});
