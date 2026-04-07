/** @filedesc Theme tab section for editing typography, spacing scale, and radius design tokens. */
import { useTheme } from '../../state/useTheme';
import { useProject } from '../../state/useProject';

const TYPOGRAPHY_FIELDS = [
  { key: 'font.family', label: 'Font Family', placeholder: 'e.g. Inter, system-ui' },
];

const SPACING_FIELDS = [
  { key: 'spacing.xs', label: 'XS' },
  { key: 'spacing.sm', label: 'SM' },
  { key: 'spacing.md', label: 'MD' },
  { key: 'spacing.lg', label: 'LG' },
  { key: 'spacing.xl', label: 'XL' },
  { key: 'spacing.field', label: 'Field' },
];

const RADIUS_FIELDS = [
  { key: 'radius.sm', label: 'Radius SM', placeholder: 'e.g. 0.5rem' },
  { key: 'radius.md', label: 'Radius MD', placeholder: 'e.g. 1rem' },
];

function TokenInput({
  tokenKey,
  label,
  value,
  placeholder,
  onSave,
}: {
  tokenKey: string;
  label: string;
  value: string;
  placeholder?: string;
  onSave: (key: string, value: string) => void;
}) {
  return (
    <div className="space-y-1">
      <label
        htmlFor={`token-${tokenKey}`}
        className="font-mono text-[10px] text-muted uppercase tracking-wider block"
      >
        {label}
      </label>
      <input
        id={`token-${tokenKey}`}
        key={`${tokenKey}-${value}`}
        type="text"
        defaultValue={value}
        placeholder={placeholder}
        onBlur={(e) => {
          const v = e.target.value.trim();
          if (v !== value) onSave(tokenKey, v);
        }}
        className="w-full px-2 py-1 text-[13px] font-mono border border-border rounded-[4px] bg-surface outline-none focus:border-accent transition-colors"
      />
    </div>
  );
}

export function TypographySpacing() {
  const theme = useTheme();
  const project = useProject();
  const tokens: Record<string, string> = Object.fromEntries(
    Object.entries(theme?.tokens ?? {}).map(([k, v]) => [k, String(v)]),
  );

  const setToken = (key: string, value: string) => {
    project.setToken(key, value || null);
  };

  return (
    <div className="space-y-6">
      {/* Typography */}
      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Typography</h4>
        {TYPOGRAPHY_FIELDS.map((f) => (
          <TokenInput
            key={f.key}
            tokenKey={f.key}
            label={f.label}
            value={tokens[f.key] ?? ''}
            placeholder={f.placeholder}
            onSave={setToken}
          />
        ))}
      </div>

      {/* Spacing */}
      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Spacing</h4>
        <div className="grid grid-cols-3 gap-2">
          {SPACING_FIELDS.map((f) => (
            <TokenInput
              key={f.key}
              tokenKey={f.key}
              label={f.label}
              value={tokens[f.key] ?? ''}
              placeholder="e.g. 8px"
              onSave={setToken}
            />
          ))}
        </div>
      </div>

      {/* Radius */}
      <div className="space-y-3">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Radius</h4>
        <div className="grid grid-cols-2 gap-3">
          {RADIUS_FIELDS.map((f) => (
            <TokenInput
              key={f.key}
              tokenKey={f.key}
              label={f.label}
              value={tokens[f.key] ?? ''}
              placeholder={f.placeholder}
              onSave={setToken}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
