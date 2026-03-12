import { useDefinition } from '../../state/useDefinition';
import { useDispatch } from '../../state/useDispatch';
import { Section } from '../ui/Section';
import { Pill } from '../ui/Pill';
import { FieldIcon } from '../ui/FieldIcon';

interface ScreenerItem {
  key: string;
  type: string;
  dataType?: string;
  [k: string]: unknown;
}

interface Route {
  condition: string;
  destination: string;
}

interface Screener {
  enabled?: boolean;
  items?: ScreenerItem[];
  routes?: Route[];
}

export function ScreenerSection() {
  const definition = useDefinition();
  const dispatch = useDispatch();
  const screener = (definition as Record<string, unknown>).screener as Screener | undefined;
  const isEnabled = Boolean(screener);

  return (
    <Section title="Screener">
      <div className="flex flex-col gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            className="cursor-pointer"
            onClick={() => dispatch({ type: 'definition.setScreener', payload: { enabled: !isEnabled } })}
          >
            <Pill
              text={isEnabled ? 'Enabled' : 'Disabled'}
              color={isEnabled ? 'green' : 'muted'}
              size="sm"
            />
          </button>
        </div>

        {isEnabled && screener?.items && screener.items.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted uppercase">Fields</span>
            {screener.items.map((item) => (
              <div key={item.key} className="flex items-center gap-1.5 px-2 py-1 text-sm">
                {item.dataType && <FieldIcon dataType={item.dataType} />}
                <span>{item.key}</span>
              </div>
            ))}
          </div>
        )}

        {isEnabled && screener?.routes && screener.routes.length > 0 && (
          <div className="flex flex-col gap-1">
            <span className="text-xs font-medium text-muted uppercase">Routes</span>
            {screener.routes.map((route, i) => {
              const isDefault = route.condition === 'true';
              return (
                <div key={i} className="flex items-start gap-1.5 px-2 py-1 text-sm border-l-2 border-border">
                  <div className="flex flex-col gap-0.5 min-w-0">
                    <div className="flex items-center gap-1.5">
                      {isDefault ? (
                        <Pill text="Default" color="amber" size="sm" />
                      ) : (
                        <code className="text-xs text-logic bg-subtle px-1 rounded-sm">{route.condition}</code>
                      )}
                    </div>
                    <span className="text-xs text-muted">
                      {'\u2192'} <span className="text-ink">{route.destination}</span>
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Section>
  );
}
