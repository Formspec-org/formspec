import { render, screen, cleanup } from '@testing-library/react';
import { describe, it, expect, afterEach } from 'vitest';
import { DisplayBlock } from '../../../src/workspaces/editor/DisplayBlock';

afterEach(cleanup);

const noop = () => {};

describe('DisplayBlock sub-types', () => {
  it('renders "Heading" label and H icon when widgetHint is Heading', () => {
    render(
      <DisplayBlock
        itemKey="h1"
        itemPath="h1"
        registerTarget={noop}
        label="Welcome"
        depth={0}
        selected={false}
        onSelect={noop}
        widgetHint="Heading"
      />
    );
    expect(screen.getByText('Heading')).toBeTruthy();
    expect(screen.getByText('H')).toBeTruthy();
  });

  it('renders "Divider" label and line icon when widgetHint is Divider', () => {
    render(
      <DisplayBlock
        itemKey="div1"
        itemPath="div1"
        registerTarget={noop}
        depth={0}
        selected={false}
        onSelect={noop}
        widgetHint="Divider"
      />
    );
    expect(screen.getByText('Divider')).toBeTruthy();
    expect(screen.getByText('—')).toBeTruthy();
  });

  it('renders "Spacer" label when widgetHint is Spacer', () => {
    render(
      <DisplayBlock
        itemKey="sp1"
        itemPath="sp1"
        registerTarget={noop}
        depth={0}
        selected={false}
        onSelect={noop}
        widgetHint="Spacer"
      />
    );
    expect(screen.getByText('Spacer')).toBeTruthy();
    expect(screen.getByText('↕')).toBeTruthy();
  });

  it('falls back to "Display" for unknown/missing widgetHint', () => {
    render(
      <DisplayBlock
        itemKey="d1"
        itemPath="d1"
        registerTarget={noop}
        label="Some text"
        depth={0}
        selected={false}
        onSelect={noop}
      />
    );
    expect(screen.getByText('Display')).toBeTruthy();
  });

  it('falls back to "Display" for Text component type', () => {
    render(
      <DisplayBlock
        itemKey="d1"
        itemPath="d1"
        registerTarget={noop}
        label="Info"
        depth={0}
        selected={false}
        onSelect={noop}
        widgetHint="Text"
      />
    );
    expect(screen.getByText('Display')).toBeTruthy();
    expect(screen.getByText('ℹ')).toBeTruthy();
  });
});
