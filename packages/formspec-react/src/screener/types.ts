/** @filedesc Screener types for formspec-react. */

export type ScreenerRouteType = 'internal' | 'external' | 'none';

export interface ScreenerRoute {
    target: string;
    label?: string;
    extensions?: Record<string, any>;
}

export interface ScreenerStateSnapshot {
    hasScreener: boolean;
    completed: boolean;
    routeType: ScreenerRouteType | null;
    route: ScreenerRoute | null;
    answers: Record<string, any>;
}

export interface UseScreenerOptions {
    /** Pre-fill answers. */
    seedAnswers?: Record<string, any>;
    /** Standalone Screener Document. */
    screenerDocument?: any;
    /** Callback when a route is determined. */
    onRoute?: (route: ScreenerRoute, routeType: ScreenerRouteType, answers: Record<string, any>) => void;
}

export interface UseScreenerResult {
    /** Current screener state. */
    state: 'idle' | 'answering' | 'routed';
    /** Current answers. */
    answers: Record<string, any>;
    /** Set a single answer. */
    setAnswer: (key: string, value: any) => void;
    /** Submit answers for evaluation. */
    submit: () => void;
    /** Restart the screener (clear answers and route). */
    restart: () => void;
    /** Skip the screener entirely. */
    skip: () => void;
    /** The route result, if routed. */
    routeResult: { route: ScreenerRoute; routeType: ScreenerRouteType } | null;
    /** Whether the screener is skipped. */
    skipped: boolean;
    /** Validation errors for screener fields (key -> error message). */
    errors: Record<string, string>;
}
