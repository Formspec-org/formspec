/** @filedesc Step connector line with chevron between wizard page cards. */

export function WizardStepConnector() {
  return (
    <div className="flex h-10 items-center justify-center" aria-hidden="true">
      <div className="relative h-full w-px bg-border">
        <svg
          className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-muted"
          width="8"
          height="8"
          viewBox="0 0 8 8"
          fill="none"
        >
          <path
            d="M1 2.5L4 5.5L7 2.5"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </div>
    </div>
  );
}
