/** @filedesc Manages provenance links between form elements and their origins. */
import type { SourceTrace } from './types.js';

/**
 * Manages source traces — provenance links between form elements
 * and their origins (chat messages, uploads, or templates).
 */
export class SourceTraceManager {
  private traces: SourceTrace[] = [];

  addTrace(trace: SourceTrace): void {
    this.traces.push(trace);
  }

  addTraces(traces: SourceTrace[]): void {
    for (const t of traces) this.traces.push(t);
  }

  getAllTraces(): SourceTrace[] {
    return [...this.traces];
  }

  getTracesForElement(path: string): SourceTrace[] {
    return this.traces.filter(t => t.elementPath === path);
  }

  getTracesForSource(sourceId: string): SourceTrace[] {
    return this.traces.filter(t => t.sourceId === sourceId);
  }

  removeTracesForElement(path: string): void {
    this.traces = this.traces.filter(t => t.elementPath !== path);
  }

  clear(): void {
    this.traces = [];
  }

  toJSON(): SourceTrace[] {
    return [...this.traces];
  }

  static fromJSON(data: SourceTrace[]): SourceTraceManager {
    const manager = new SourceTraceManager();
    manager.traces = [...data];
    return manager;
  }
}
