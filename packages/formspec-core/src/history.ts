/** @filedesc Generic undo/redo stack and command log manager. */
import type { LogEntry } from './types.js';

/**
 * Manages undo/redo stacks and command log.
 * Pure data structure — no knowledge of commands or state shape.
 */
export class HistoryManager<T> {
  private _undoStack: T[] = [];
  private _redoStack: T[] = [];
  private _log: LogEntry[] = [];
  private _maxDepth: number;

  constructor(maxDepth = 50) {
    this._maxDepth = maxDepth;
  }

  get canUndo(): boolean { return this._undoStack.length > 0; }
  get canRedo(): boolean { return this._redoStack.length > 0; }
  get log(): readonly LogEntry[] { return this._log; }

  push(snapshot: T): void {
    this._undoStack.push(snapshot);
    if (this._undoStack.length > this._maxDepth) {
      this._undoStack.shift();
    }
    this._redoStack.length = 0;
  }

  popUndo(current: T): T | null {
    if (!this.canUndo) return null;
    this._redoStack.push(current);
    return this._undoStack.pop()!;
  }

  popRedo(current: T): T | null {
    if (!this.canRedo) return null;
    this._undoStack.push(current);
    return this._redoStack.pop()!;
  }

  clear(): void {
    this._undoStack.length = 0;
    this._redoStack.length = 0;
  }

  clearRedo(): void {
    this._redoStack.length = 0;
  }

  appendLog(entry: LogEntry): void {
    this._log.push(entry);
  }

  clearLog(): void {
    this._log.length = 0;
  }
}
