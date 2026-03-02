import { beforeEach, describe, expect, test } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/preact';
import { resetState } from './setup';
import { Topbar } from '../components/topbar';
import { definition, setDefinition, createEmptyDefinition } from '../state/definition';

describe('Topbar', () => {
  beforeEach(() => {
    resetState();
  });

  test('renders form title input', () => {
    render(<Topbar />);
    const input = screen.getByRole('textbox', { name: 'Form title' });
    expect(input).toBeTruthy();
  });

  test('title input reflects definition.value.title', () => {
    const def = createEmptyDefinition();
    def.title = 'My Custom Form';
    setDefinition(def);
    render(<Topbar />);
    const input = screen.getByRole('textbox', { name: 'Form title' }) as HTMLInputElement;
    expect(input.value).toBe('My Custom Form');
  });

  test('title input falls back to Untitled Form when title is missing', () => {
    const def = createEmptyDefinition();
    (def as any).title = undefined;
    setDefinition(def);
    render(<Topbar />);
    const input = screen.getByRole('textbox', { name: 'Form title' }) as HTMLInputElement;
    expect(input.value).toBe('Untitled Form');
  });

  test('changing title input updates definition.title', () => {
    render(<Topbar />);
    const input = screen.getByRole('textbox', { name: 'Form title' }) as HTMLInputElement;
    fireEvent.input(input, { target: { value: 'Updated Title' } });
    expect(definition.value.title).toBe('Updated Title');
  });

  test('renders version in metadata', () => {
    const def = createEmptyDefinition();
    def.version = '1.2.3';
    setDefinition(def);
    render(<Topbar />);
    const metaSpan = document.querySelector('.topbar-meta');
    expect(metaSpan).toBeTruthy();
    expect(metaSpan!.textContent).toContain('1.2.3');
  });

  test('renders status in metadata', () => {
    const def = createEmptyDefinition();
    (def as any).status = 'draft';
    setDefinition(def);
    render(<Topbar />);
    const metaSpan = document.querySelector('.topbar-meta');
    expect(metaSpan).toBeTruthy();
    expect(metaSpan!.textContent).toContain('draft');
  });

  test('renders Import button', () => {
    render(<Topbar />);
    const importBtn = screen.getByRole('button', { name: /Import project/ });
    expect(importBtn).toBeTruthy();
  });

  test('renders Export button', () => {
    render(<Topbar />);
    const exportBtn = screen.getByRole('button', { name: /Export project/ });
    expect(exportBtn).toBeTruthy();
  });
});
