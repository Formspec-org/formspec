interface WizardNavProps {
  pageCount: number;
  currentPage: number;
  onNavigate: (page: number) => void;
}

export function WizardNav({ pageCount, currentPage, onNavigate }: WizardNavProps) {
  const isFirst = currentPage === 0;
  const isLast = currentPage === pageCount - 1;

  return (
    <div className="flex items-center justify-between border-t border-border p-3">
      <div className="flex gap-2">
        {Array.from({ length: pageCount }, (_, i) => (
          <button
            key={i}
            type="button"
            className={`w-7 h-7 rounded-full text-sm ${
              i === currentPage
                ? 'bg-accent text-white'
                : 'bg-subtle text-muted'
            }`}
            onClick={() => onNavigate(i)}
          >
            {i + 1}
          </button>
        ))}
      </div>

      <div className="flex gap-2">
        {!isFirst && (
          <button
            type="button"
            className="px-3 py-1 text-sm border border-border rounded hover:bg-subtle"
            onClick={() => onNavigate(currentPage - 1)}
          >
            Back
          </button>
        )}
        {isLast ? (
          <button
            type="button"
            className="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent/90"
            onClick={() => onNavigate(currentPage)}
          >
            Submit
          </button>
        ) : (
          <button
            type="button"
            className="px-3 py-1 text-sm bg-accent text-white rounded hover:bg-accent/90"
            onClick={() => onNavigate(currentPage + 1)}
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
