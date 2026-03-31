/** @filedesc Route list manager with fallback pinning, ordering, and add-rule for screener authoring. */
import { useState } from 'react';
import { useDefinition } from '../../../state/useDefinition';
import { useProject } from '../../../state/useProject';
import { RouteCard } from './RouteCard';
import { FallbackRoute } from './FallbackRoute';
import type { ScreenerRoute } from './types';

export function ScreenerRoutes() {
  const definition = useDefinition();
  const project = useProject();
  const screener = definition?.screener as { routes?: ScreenerRoute[] } | undefined;
  const routes = screener?.routes ?? [];

  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  // Detect fallback: last route where condition === 'true'
  const lastIndex = routes.length - 1;
  const hasFallback = routes.length > 0 && routes[lastIndex].condition === 'true';
  const fallbackRoute = hasFallback ? routes[lastIndex] : null;
  const fallbackIndex = hasFallback ? lastIndex : -1;

  // Non-fallback routes: everything except the fallback
  const nonFallbackRoutes = hasFallback ? routes.slice(0, lastIndex) : routes;
  const canDeleteNonFallback = nonFallbackRoutes.length >= 2;

  const handleAddRule = () => {
    if (routes.length === 0) {
      // No routes at all — create a conditional + fallback
      project.addScreenRoute('false', '');
      project.addScreenRoute('true', '');
      setExpandedIndex(0);
    } else {
      // Insert above fallback
      const insertIndex = hasFallback ? routes.length - 1 : routes.length;
      project.addScreenRoute('false', '', undefined, undefined, insertIndex);
      setExpandedIndex(insertIndex);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-1">
        <h4 className="text-[12px] font-bold text-muted uppercase tracking-wider">Routing Rules</h4>
        <button
          type="button"
          aria-label="Add rule"
          onClick={handleAddRule}
          className="text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors"
        >
          + Add Rule
        </button>
      </div>

      {/* Info bar */}
      <div className="flex items-center gap-2 px-3 py-2 bg-amber/5 border border-amber/15 rounded-lg">
        <span className="text-amber text-[12px] flex-shrink-0">(i)</span>
        <span className="text-[11px] text-muted">
          Routes are checked in order. The first matching rule wins.
        </span>
      </div>

      {/* Empty state (no non-fallback routes) */}
      {nonFallbackRoutes.length === 0 && !fallbackRoute && (
        <div className="py-8 border-2 border-dashed border-border/50 rounded-2xl flex flex-col items-center justify-center text-center px-6">
          <p className="text-sm text-muted font-medium mb-2">No routing rules defined.</p>
          <p className="text-[12px] text-muted/70 leading-relaxed max-w-[400px]">
            Add rules to route respondents to different forms based on their screening answers.
          </p>
        </div>
      )}

      {/* Non-fallback route cards */}
      {nonFallbackRoutes.map((route, i) => (
        <RouteCard
          key={i}
          route={route}
          index={i}
          isExpanded={expandedIndex === i}
          onToggle={() => setExpandedIndex(expandedIndex === i ? null : i)}
          isFirst={i === 0}
          isLast={i === nonFallbackRoutes.length - 1}
          canDelete={canDeleteNonFallback}
        />
      ))}

      {/* Fallback route pinned at bottom */}
      {fallbackRoute && (
        <FallbackRoute route={fallbackRoute} routeIndex={fallbackIndex} />
      )}
    </div>
  );
}
