/** @filedesc Expand/collapse card for a single evaluation phase with strategy badge and route list. */
import { useState } from 'react';
import { useProject } from '../../../state/useProject';
import { RouteCard } from './RouteCard';
import { FallbackRoute } from './FallbackRoute';
import type { Phase, Route } from '@formspec-org/types';

const STRATEGY_LABELS: Record<string, string> = {
  'first-match': 'First Match',
  'fan-out': 'Fan Out',
  'score-threshold': 'Score',
};

interface PhaseCardProps {
  phase: Phase;
  isExpanded: boolean;
  onToggle: () => void;
  isFirst: boolean;
  isLast: boolean;
}

export function PhaseCard({ phase, isExpanded, onToggle, isFirst, isLast }: PhaseCardProps) {
  const project = useProject();
  const routes = phase.routes ?? [];
  const [expandedRouteIdx, setExpandedRouteIdx] = useState<number | null>(null);

  const strategyLabel = STRATEGY_LABELS[phase.strategy] ?? phase.strategy;
  const routeCount = routes.length;

  // Fallback detection: last route with condition==='true' in first-match phases
  const isFirstMatch = phase.strategy === 'first-match';
  const lastIndex = routes.length - 1;
  const hasFallback = isFirstMatch && routes.length > 0 && routes[lastIndex].condition === 'true';
  const nonFallbackRoutes = hasFallback ? routes.slice(0, lastIndex) : routes;
  const fallbackRoute = hasFallback ? routes[lastIndex] : null;

  const handleAddRoute = () => {
    if (phase.strategy === 'score-threshold') {
      project.addScreenRoute(phase.id, { target: '', score: '0', threshold: 0 });
    } else {
      // first-match / fan-out
      const insertIndex = hasFallback ? routes.length - 1 : undefined;
      project.addScreenRoute(phase.id, { condition: 'false', target: '' }, insertIndex);
    }
    setExpandedRouteIdx(hasFallback ? routes.length - 1 : routes.length);
  };

  const handleRemovePhase = () => {
    if (window.confirm(`Remove phase "${phase.id}" and all its routes?`)) {
      project.removeEvaluationPhase(phase.id);
    }
  };

  // Collapsed view
  if (!isExpanded) {
    return (
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left rounded-xl border border-border/60 px-4 py-3 hover:border-accent/40 transition-colors"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded">
              {strategyLabel}
            </span>
            <span className="text-sm font-medium text-ink">{phase.label || phase.id}</span>
          </div>
          <span className="text-[11px] text-muted">
            {routeCount} route{routeCount !== 1 ? 's' : ''}
          </span>
        </div>
      </button>
    );
  }

  // Expanded view
  return (
    <div className="rounded-xl border border-accent shadow-md ring-1 ring-accent/10 bg-surface">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30">
        <button type="button" onClick={onToggle} className="flex items-center gap-2">
          <span className="text-[10px] font-bold uppercase tracking-wider text-accent bg-accent/10 px-2 py-0.5 rounded">
            {strategyLabel}
          </span>
          <span className="text-sm font-medium text-ink">{phase.label || phase.id}</span>
        </button>
        <div className="flex items-center gap-2">
          {!isFirst && (
            <button type="button" aria-label="Move up" onClick={() => project.reorderPhase(phase.id, 'up')}
              className="text-[10px] text-muted hover:text-ink transition-colors">up</button>
          )}
          {!isLast && (
            <button type="button" aria-label="Move down" onClick={() => project.reorderPhase(phase.id, 'down')}
              className="text-[10px] text-muted hover:text-ink transition-colors">dn</button>
          )}
          <button type="button" aria-label="Remove phase" onClick={handleRemovePhase}
            className="text-[10px] text-muted hover:text-error transition-colors font-bold uppercase">del</button>
        </div>
      </div>

      {/* Route list */}
      <div className="px-4 py-3 space-y-3">
        {/* Info bar */}
        <div className="flex items-center gap-2 px-3 py-2 bg-amber/5 border border-amber/15 rounded-lg">
          <span className="text-amber text-[12px] flex-shrink-0">(i)</span>
          <span className="text-[11px] text-muted">
            {isFirstMatch
              ? 'Routes are checked in order. The first matching rule wins.'
              : phase.strategy === 'fan-out'
                ? 'All matching routes are returned.'
                : 'Routes are scored and ranked. Highest score wins.'}
          </span>
        </div>

        {/* Non-fallback routes */}
        {nonFallbackRoutes.map((route: Route, i: number) => (
          <RouteCard
            key={i}
            route={route}
            index={i}
            phaseId={phase.id}
            strategy={phase.strategy}
            isExpanded={expandedRouteIdx === i}
            onToggle={() => setExpandedRouteIdx(expandedRouteIdx === i ? null : i)}
            isFirst={i === 0}
            isLast={i === nonFallbackRoutes.length - 1}
            canDelete={nonFallbackRoutes.length >= 2 || hasFallback}
          />
        ))}

        {/* Fallback */}
        {fallbackRoute && (
          <FallbackRoute route={fallbackRoute} routeIndex={lastIndex} phaseId={phase.id} />
        )}

        {/* Add route */}
        <button
          type="button"
          onClick={handleAddRoute}
          className="w-full text-center text-[11px] text-accent hover:text-accent-hover font-bold uppercase tracking-wider transition-colors py-2"
        >
          + Add Route
        </button>
      </div>
    </div>
  );
}
