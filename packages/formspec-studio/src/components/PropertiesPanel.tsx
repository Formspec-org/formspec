/** @filedesc Sidebar panel that displays key and type for the currently selected item. */
import { useSelection } from '../state/useSelection';

export function PropertiesPanel() {
  const { selectedKey, selectedType } = useSelection();

  if (!selectedKey) {
    return (
      <div className="p-4 text-sm text-muted">
        Select an item to inspect
      </div>
    );
  }

  return (
    <div className="p-4">
      <h2 className="text-sm font-medium mb-2">Properties</h2>
      <dl className="text-sm space-y-2">
        <div>
          <dt className="text-muted text-xs">Key</dt>
          <dd>{selectedKey}</dd>
        </div>
        <div>
          <dt className="text-muted text-xs">Type</dt>
          <dd>{selectedType}</dd>
        </div>
      </dl>
    </div>
  );
}
