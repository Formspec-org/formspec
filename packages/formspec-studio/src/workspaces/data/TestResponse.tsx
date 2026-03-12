export function TestResponse() {
  return (
    <div className="p-4">
      <div className="max-w-xl rounded border border-border bg-surface p-4">
        <h2 className="text-sm font-semibold text-ink">Test Response</h2>
        <p className="mt-2 text-sm text-muted">
          Run the current form definition against sample inputs and inspect the generated response payload.
        </p>
        <button
          type="button"
          className="mt-4 rounded border border-border bg-subtle px-3 py-2 text-xs font-medium text-ink hover:bg-border"
        >
          Run Test Response
        </button>
      </div>
    </div>
  );
}
