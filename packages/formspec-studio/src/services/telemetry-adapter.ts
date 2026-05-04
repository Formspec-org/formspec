/** @filedesc Single telemetry provider emitting all studio_* events (PRD §9). */
import { addStudioEventListener, STUDIO_EVENTS, type StudioModeLiteral } from '../studio-events';

/** Studio telemetry event types — closed taxonomy. */
export type StudioEventType =
  | 'studio_mode_changed'
  | 'studio_field_selected'
  | 'studio_tool_called'
  | 'studio_changeset_accepted'
  | 'studio_changeset_rejected'
  | 'studio_scaffold_generated'
  | 'studio_publish_completed'
  | 'studio_design_change'
  | 'studio_preview_viewport_changed'
  | 'studio_ask_ai_invoked';

export interface StudioEvent {
  type: StudioEventType;
  timestamp: number;
  payload: Record<string, unknown>;
}

/** Pluggable backend — console in dev, analytics endpoint in prod. */
export interface TelemetryBackend {
  emit(event: StudioEvent): void;
}

class ConsoleTelemetryBackend implements TelemetryBackend {
  emit(event: StudioEvent): void {
    if (typeof window !== 'undefined' && (window as unknown as Record<string, unknown>).__FORMSPEC_TELEMETRY_DEBUG__) {
      console.debug('[telemetry]', event.type, event.payload);
    }
  }
}

class TelemetryAdapter {
  private backend: TelemetryBackend;
  private listeners: Set<(event: StudioEvent) => void> = new Set();

  constructor(backend?: TelemetryBackend) {
    this.backend = backend ?? new ConsoleTelemetryBackend();
  }

  /** Replace the backend (e.g. switch from console to analytics). */
  setBackend(backend: TelemetryBackend): void {
    this.backend = backend;
  }

  /** Emit a telemetry event. */
  emit(type: StudioEventType, payload: Record<string, unknown> = {}): void {
    const event: StudioEvent = { type, timestamp: Date.now(), payload };
    this.backend.emit(event);
    for (const listener of this.listeners) {
      listener(event);
    }
  }

  /** Subscribe to telemetry events (for testing / debug UI). */
  subscribe(listener: (event: StudioEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Wire up DOM event listeners that auto-emit telemetry. */
  attachDOMListeners(): () => void {
    const handlers: Array<{ event: string; handler: EventListener }> = [];

    const addHandler = (eventName: string, handler: EventListener) => {
      window.addEventListener(eventName, handler);
      handlers.push({ event: eventName, handler });
    };

    // Mode changes
    addHandler(STUDIO_EVENTS.MODE_CHANGED, ((e: CustomEvent<{ from: StudioModeLiteral; to: StudioModeLiteral }>) => {
      this.emit('studio_mode_changed', { from: e.detail.from, to: e.detail.to });
    }) as EventListener);

    return () => {
      for (const { event, handler } of handlers) {
        window.removeEventListener(event, handler);
      }
    };
  }
}

/** Singleton telemetry adapter instance. */
export const telemetry = new TelemetryAdapter();

export { TelemetryAdapter };
