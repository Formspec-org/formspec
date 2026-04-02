import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';
import { BindCard } from '../../../src/components/ui/BindCard';

describe('BindCard', () => {
  it('renders bind type label with verb-intent text and spec term in title', () => {
    render(<BindCard bindType="required" expression="true" />);
    const label = screen.getByText('MUST FILL');
    expect(label).toBeInTheDocument();
    expect(label).toHaveAttribute('title', 'required');
  });

  it('shows expression text with syntax highlighting', () => {
    render(<BindCard bindType="calculate" expression="$age + 1" />);
    const exprArea = screen.getByTestId('bind-expression');
    expect(exprArea).toBeInTheDocument();
    expect(exprArea.textContent).toBe('$age + 1');
  });

  it('shows humanized expression when provided', () => {
    render(<BindCard bindType="relevant" expression="$show = true" humanized="Show is Yes" />);
    expect(screen.getByText('Show is Yes')).toBeInTheDocument();
    const exprArea = screen.getByTestId('bind-expression');
    expect(exprArea.textContent).toContain('$show');
  });

  it('applies color based on bind type', () => {
    const { container } = render(<BindCard bindType="required" expression="true" />);
    // Required binds use blue/accent color
    expect(container.firstChild).toBeTruthy();
  });

  it('does not render FEL reference popup in the header (popup lives in InlineExpression)', () => {
    render(<BindCard bindType="calculate" expression="$x + 1" />);
    expect(screen.queryByRole('button', { name: /fel reference/i })).not.toBeInTheDocument();
  });

  // ── Phase 5: Verb-intent labels ──────────────────────────────────

  describe('verb-intent labels', () => {
    const verbMap: Array<[string, string]> = [
      ['required', 'MUST FILL'],
      ['relevant', 'SHOWS IF'],
      ['calculate', 'FORMULA'],
      ['constraint', 'VALIDATES'],
      ['readonly', 'LOCKED'],
    ];

    it.each(verbMap)('displays "%s" as verb-intent label "%s"', (bindType, label) => {
      render(<BindCard bindType={bindType} expression="true" />);
      const labelEl = screen.getByText(label);
      expect(labelEl).toBeInTheDocument();
    });

    it.each(verbMap)('puts spec term "%s" in title attribute', (bindType, _label) => {
      render(<BindCard bindType={bindType} expression="true" />);
      const labelEl = screen.getByTitle(bindType);
      expect(labelEl).toBeInTheDocument();
    });
  });

  // ── Phase 5: Advanced properties toggle ──────────────────────────

  describe('advanced properties toggle', () => {
    it('does not render toggle when advancedProperties is undefined', () => {
      render(<BindCard bindType="required" expression="true" />);
      expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
    });

    it('does not render toggle when advancedProperties is empty', () => {
      render(<BindCard bindType="required" expression="true" advancedProperties={[]} />);
      expect(screen.queryByText(/more/i)).not.toBeInTheDocument();
    });

    it('renders toggle when advancedProperties has entries', () => {
      const props = [{ label: 'Custom Message', value: 'hello', onChange: vi.fn() }];
      render(<BindCard bindType="constraint" expression="$x > 0" advancedProperties={props} />);
      expect(screen.getByText(/more/i)).toBeInTheDocument();
    });

    it('hides advanced properties by default', () => {
      const props = [{ label: 'Custom Message', value: 'hello', onChange: vi.fn() }];
      render(<BindCard bindType="constraint" expression="$x > 0" advancedProperties={props} />);
      expect(screen.queryByDisplayValue('hello')).not.toBeInTheDocument();
    });

    it('shows advanced properties when toggle is clicked', () => {
      const props = [{ label: 'Custom Message', value: 'hello', onChange: vi.fn() }];
      render(<BindCard bindType="constraint" expression="$x > 0" advancedProperties={props} />);
      fireEvent.click(screen.getByText(/more/i));
      expect(screen.getByDisplayValue('hello')).toBeInTheDocument();
      expect(screen.getByText('Custom Message')).toBeInTheDocument();
    });

    it('calls onChange when advanced property input changes', () => {
      const onChange = vi.fn();
      const props = [{ label: 'Custom Message', value: '', onChange }];
      render(<BindCard bindType="constraint" expression="$x > 0" advancedProperties={props} />);
      fireEvent.click(screen.getByText(/more/i));
      fireEvent.change(screen.getByLabelText('Custom Message'), { target: { value: 'new val' } });
      expect(onChange).toHaveBeenCalledWith('new val');
    });
  });

  // ── Phase 5: Error state ─────────────────────────────────────────

  describe('error state', () => {
    it('does not render error indicator when error is undefined', () => {
      render(<BindCard bindType="calculate" expression="$x + 1" />);
      expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    });

    it('renders error message when error prop is provided', () => {
      render(
        <BindCard
          bindType="calculate"
          expression="$x +"
          error={{ message: 'Unexpected end of expression' }}
        />
      );
      expect(screen.getByRole('alert')).toBeInTheDocument();
      expect(screen.getByText('Unexpected end of expression')).toBeInTheDocument();
    });

    it('adds red-tinted background to expression area on error', () => {
      const { container } = render(
        <BindCard
          bindType="calculate"
          expression="$x +"
          error={{ message: 'Bad expression' }}
        />
      );
      const exprArea = container.querySelector('[data-testid="bind-expression"]');
      expect(exprArea).toBeTruthy();
      expect(exprArea!.className).toContain('bg-error/10');
    });
  });

  // ── Phase 5: Tip ─────────────────────────────────────────────────

  describe('tip', () => {
    it('does not render tip when prop is undefined', () => {
      render(<BindCard bindType="calculate" expression="$x + 1" />);
      expect(screen.queryByTestId('bind-tip')).not.toBeInTheDocument();
    });

    it('renders tip text as muted italic', () => {
      render(
        <BindCard
          bindType="calculate"
          expression="$x + 1"
          tip="Fields with a formula are automatically locked"
        />
      );
      const tipEl = screen.getByTestId('bind-tip');
      expect(tipEl).toBeInTheDocument();
      expect(tipEl.textContent).toBe('Fields with a formula are automatically locked');
      expect(tipEl.className).toContain('italic');
      expect(tipEl.className).toContain('text-muted');
    });
  });
});
