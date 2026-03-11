import { useTheme } from '../../state/useTheme';

interface Region {
  span: number;
  [key: string]: unknown;
}

interface PageLayout {
  regions?: Region[];
  [key: string]: unknown;
}

export function PageLayouts() {
  const theme = useTheme();
  const pages = (theme?.pages ?? []) as PageLayout[];

  if (pages.length === 0) {
    return <div className="p-4 text-sm text-muted">No page layouts defined</div>;
  }

  return (
    <div className="flex flex-col gap-3 p-2">
      {pages.map((page, index) => (
        <div key={index} className="border border-border rounded p-2 text-sm">
          <div className="font-medium text-ink mb-2">Page {index + 1}</div>
          {page.regions && (
            <div className="grid grid-cols-12 gap-1">
              {page.regions.map((region, ri) => (
                <div
                  key={ri}
                  className="bg-subtle rounded p-1 text-center text-xs text-muted"
                  style={{ gridColumn: `span ${region.span}` }}
                >
                  {region.span}
                </div>
              ))}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
