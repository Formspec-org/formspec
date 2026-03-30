/** @filedesc Blueprint section showing screener enabled state, items, and routing conditions with CRUD. */
import { useDefinition } from '../../state/useDefinition';
import { useProject } from '../../state/useProject';
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

let nextScreenFieldId = 1;

export function ScreenerSection() {
  const definition = useDefinition();
  const project = useProject();
  const screener = definition.screener as Screener | undefined;
  const isEnabled = Boolean(screener) && screener?.enabled !== false;

  const handleAddField = () => {
    const key = `screen_${nextScreenFieldId++}`;
    project.addScreenField(key, key, 'boolean');
  };

  const handleAddRoute = () => {
    project.addScreenRoute('true', 'urn:target');
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <button
          type="button"
          className="cursor-pointer"
          onClick={() => project.setScreener(!isEnabled)}
        >
          <Pill
            text={isEnabled ? 'Enabled' : 'Disabled'}
            color={isEnabled ? 'green' : 'muted'}
            size="sm"
          />
        </button>
      </div>

      {isEnabled && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase">Fields</span>
            <button
              type="button"
              aria-label="Add screening field"
              className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
              onClick={handleAddField}
            >
              + Add field
            </button>
          </div>
          {screener?.items?.map((item) => (
            <div key={item.key} className="flex items-center gap-1.5 px-2 py-1 text-sm">
              {item.dataType && <FieldIcon dataType={item.dataType} />}
              <span>{item.key}</span>
            </div>
          ))}
        </div>
      )}

      {isEnabled && (
        <div className="flex flex-col gap-1">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted uppercase">Routes</span>
            <button
              type="button"
              aria-label="Add screening route"
              className="text-[11px] font-medium text-accent hover:text-accent/80 transition-colors"
              onClick={handleAddRoute}
            >
              + Add route
            </button>
          </div>
          {screener?.routes?.map((route, i) => {
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
  );
}
