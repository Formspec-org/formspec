import { useDispatch } from '../../state/useDispatch';
import { useTheme } from '../../state/useTheme';

export function TokenEditor() {
  const theme = useTheme();
  const dispatch = useDispatch();
  const tokens = theme?.tokens;

  const handleAddToken = () => {
    const key = window.prompt('Token key');
    if (!key?.trim()) return;
    const value = window.prompt('Token value');
    if (value === null) return;
    dispatch({
      type: 'theme.setToken',
      payload: { key: key.trim(), value },
    });
  };

  if (!tokens || Object.keys(tokens).length === 0) {
    return (
      <div className="p-4 text-sm text-muted space-y-3">
        <button
          type="button"
          className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border text-ink hover:bg-subtle transition-colors"
          onClick={handleAddToken}
        >
          + Add Token
        </button>
        <p>No tokens defined</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      <div>
        <button
          type="button"
          className="px-3 py-1.5 text-[12.5px] font-medium rounded-[4px] border border-border text-ink hover:bg-subtle transition-colors"
          onClick={handleAddToken}
        >
          + Add Token
        </button>
      </div>
      {Object.entries(tokens).map(([key, value]) => (
        <div key={key} className="flex items-center justify-between px-2 py-1 text-sm rounded hover:bg-subtle">
          <span className="font-medium text-ink">{key}</span>
          <span className="text-muted">{String(value)}</span>
        </div>
      ))}
    </div>
  );
}
