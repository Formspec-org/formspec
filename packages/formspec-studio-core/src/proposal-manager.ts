/** @filedesc ProposalManager: changeset lifecycle, actor-tagged recording, and snapshot-and-replay. */
import type { AnyCommand, CommandResult, ProjectState, IProjectCore } from 'formspec-core';
import { computeDependencyGroups as wasmComputeDependencyGroups } from 'formspec-engine/fel-runtime';
import type { Diagnostics } from './types.js';

// ── Core types ──────────────────────────────────────────────────────

/**
 * A single recorded entry within a changeset.
 *
 * Stores the actual pipeline commands (not MCP tool arguments) for
 * deterministic replay. The MCP layer sets toolName/summary via
 * beginEntry/endEntry; user overlay entries have them auto-generated.
 */
export interface ChangeEntry {
  /** The actual commands dispatched through the pipeline (captured by middleware). */
  commands: AnyCommand[][];
  /** Which MCP tool triggered this entry (set by MCP layer, absent for user overlay). */
  toolName?: string;
  /** Human-readable summary (set by MCP layer, auto-generated for user overlay). */
  summary?: string;
  /** Paths affected by this entry (extracted from CommandResult). */
  affectedPaths: string[];
  /** Warnings produced during execution. */
  warnings: string[];
  /** Captured evaluated values for one-time expressions (initialValue with = prefix). */
  capturedValues?: Record<string, unknown>;
}

/**
 * A dependency group computed from intra-changeset analysis.
 * Entries within a group must be accepted or rejected together.
 */
export interface DependencyGroup {
  /** Indices into changeset.aiEntries. */
  entries: number[];
  /** Human-readable explanation of why these entries are grouped. */
  reason: string;
}

/** Status of a changeset through its lifecycle. */
export type ChangesetStatus = 'open' | 'pending' | 'merged' | 'rejected';

/**
 * A changeset tracking AI-proposed mutations with git merge semantics.
 *
 * The user is never locked out — AI changes and user changes coexist
 * as two recording tracks, and conflicts are detected at merge time.
 */
export interface Changeset {
  /** Unique changeset identifier. */
  id: string;
  /** Human-readable label (e.g. "Added 3 fields, set validation on email"). */
  label: string;
  /** AI's work (recorded during MCP tool brackets). */
  aiEntries: ChangeEntry[];
  /** User edits made while changeset exists. */
  userOverlay: ChangeEntry[];
  /** Computed from aiEntries on close. */
  dependencyGroups: DependencyGroup[];
  /** Current lifecycle status. */
  status: ChangesetStatus;
  /** Full state snapshot captured when changeset was opened. */
  snapshotBefore: ProjectState;
}

/** Failure result when command replay fails. */
export interface ReplayFailure {
  /** Which phase failed: 'ai' for AI group replay, 'user' for user overlay replay. */
  phase: 'ai' | 'user';
  /** The entry that failed to replay. */
  entryIndex: number;
  /** The error that occurred during replay. */
  error: Error;
}

/** Result of a merge operation. */
export type MergeResult =
  | { ok: true; diagnostics: Diagnostics }
  | { ok: false; replayFailure: ReplayFailure }
  | { ok: false; diagnostics: Diagnostics };

// ── ProposalManager ─────────────────────────────────────────────────

let nextId = 1;
function generateChangesetId(): string {
  return `cs-${nextId++}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Manages changeset lifecycle, actor-tagged recording, and snapshot-and-replay.
 *
 * The ProposalManager controls the ChangesetRecorderControl (from formspec-core's
 * changeset middleware) and orchestrates the full changeset lifecycle:
 *
 * 1. Open → snapshot state, start recording
 * 2. AI mutations (via MCP beginEntry/endEntry brackets)
 * 3. User edits (canvas, recorded to user overlay)
 * 4. Close → compute dependency groups, status → pending
 * 5. Merge/reject → snapshot-and-replay or discard
 */
export class ProposalManager {
  private _changeset: Changeset | null = null;
  private _pendingEntryToolName: string | null = null;
  private _pendingEntryWarnings: string[] = [];
  /** Accumulates commands within a single beginEntry/endEntry bracket. */
  private _pendingAiEntry: ChangeEntry | null = null;

  /**
   * @param core - The IProjectCore instance to manage.
   * @param setRecording - Callback to toggle the middleware's recording flag.
   * @param setActor - Callback to set the middleware's currentActor.
   */
  constructor(
    private readonly core: IProjectCore,
    private readonly setRecording: (on: boolean) => void,
    private readonly setActor: (actor: 'ai' | 'user') => void,
  ) {}

  // ── Queries ──────────────────────────────────────────────────

  /** Returns the active changeset, or null if none. */
  get changeset(): Readonly<Changeset> | null {
    return this._changeset;
  }

  /** Whether a changeset is currently open or pending review. */
  get hasActiveChangeset(): boolean {
    return this._changeset != null && (this._changeset.status === 'open' || this._changeset.status === 'pending');
  }

  // ── Changeset lifecycle ──────────────────────────────────────

  /**
   * Open a new changeset. Captures a state snapshot and starts recording.
   *
   * @throws If a changeset is already open or pending.
   * @throws If the definition is not in draft status.
   */
  openChangeset(): string {
    if (this._changeset && (this._changeset.status === 'open' || this._changeset.status === 'pending')) {
      throw new Error(`Cannot open changeset: changeset "${this._changeset.id}" is already ${this._changeset.status}`);
    }

    // VP-02 defense-in-depth: refuse on non-draft definitions
    const status = (this.core.definition as any).status;
    if (status && status !== 'draft') {
      throw new Error(`Cannot open changeset on ${status} definition (VP-02: active/retired definitions are immutable)`);
    }

    const id = generateChangesetId();
    this._changeset = {
      id,
      label: '',
      aiEntries: [],
      userOverlay: [],
      dependencyGroups: [],
      status: 'open',
      snapshotBefore: structuredClone(this.core.state),
    };

    this.setRecording(true);
    this.setActor('user'); // default actor is user

    return id;
  }

  /**
   * Begin an AI entry bracket. Sets actor to 'ai'.
   * Called by the MCP layer before executing a tool.
   */
  beginEntry(toolName: string): void {
    if (!this._changeset || this._changeset.status !== 'open') {
      throw new Error('Cannot beginEntry: no open changeset');
    }
    this._pendingEntryToolName = toolName;
    this._pendingEntryWarnings = [];
    this._pendingAiEntry = {
      commands: [],
      toolName,
      affectedPaths: [],
      warnings: [],
    };
    this.setActor('ai');
  }

  /**
   * End an AI entry bracket. Resets actor to 'user'.
   * Called by the MCP layer after a tool completes.
   */
  endEntry(summary: string, warnings: string[] = []): void {
    if (!this._changeset || this._changeset.status !== 'open') {
      throw new Error('Cannot endEntry: no open changeset');
    }

    // Finalize the pending AI entry (accumulated by onCommandsRecorded)
    if (this._pendingAiEntry && this._pendingAiEntry.commands.length > 0) {
      this._pendingAiEntry.summary = summary;
      this._pendingAiEntry.warnings = warnings;
      this._changeset.aiEntries.push(this._pendingAiEntry);
    }

    this._pendingAiEntry = null;
    this._pendingEntryToolName = null;
    this._pendingEntryWarnings = [];
    this.setActor('user');
  }

  /**
   * Called by the changeset middleware when commands are recorded.
   * Routes to AI entries or user overlay based on actor.
   */
  onCommandsRecorded(
    actor: 'ai' | 'user',
    commands: Readonly<AnyCommand[][]>,
    results: Readonly<CommandResult[]>,
    _priorState: Readonly<ProjectState>,
  ): void {
    if (!this._changeset) return;
    if (this._changeset.status !== 'open' && this._changeset.status !== 'pending') return;

    const affectedPaths = extractAffectedPaths(results);
    const clonedCommands = structuredClone(commands as AnyCommand[][]);

    if (actor === 'ai' && this._pendingAiEntry) {
      // Accumulate into the bracket's pending entry
      this._pendingAiEntry.commands.push(...clonedCommands);
      this._pendingAiEntry.affectedPaths.push(...affectedPaths);
      // F3: Capture evaluated values for =-prefix expressions (initialValue, default)
      scanForExpressionValues(clonedCommands, this._pendingAiEntry);
    } else {
      // User overlay entry — auto-generate summary
      const entry: ChangeEntry = {
        commands: clonedCommands,
        affectedPaths,
        warnings: [],
        summary: generateUserSummary(commands),
      };
      this._changeset.userOverlay.push(entry);
    }
  }

  /**
   * Close the changeset. Computes dependency groups and sets status to 'pending'.
   *
   * @param label - Human-readable label for the changeset.
   */
  closeChangeset(label: string): void {
    if (!this._changeset || this._changeset.status !== 'open') {
      throw new Error('Cannot close: no open changeset');
    }

    this._changeset.label = label;
    // Compute dependency groups (stubbed — full implementation uses Rust/WASM)
    this._changeset.dependencyGroups = this._computeDependencyGroups();
    this._changeset.status = 'pending';
    // Keep recording for user overlay during review
  }

  /**
   * Accept (merge) a pending changeset.
   *
   * @param groupIndices - If provided, only accept these dependency groups (partial merge).
   *   If omitted, accepts all groups.
   */
  acceptChangeset(groupIndices?: number[]): MergeResult {
    if (!this._changeset || this._changeset.status !== 'pending') {
      throw new Error('Cannot accept: no pending changeset');
    }

    this.setRecording(false);

    if (!groupIndices) {
      // Merge all — state is already correct, just discard snapshot
      const diagnostics = this.core.diagnose();
      this._changeset.status = 'merged';
      return { ok: true, diagnostics };
    }

    // Partial merge — snapshot-and-replay
    return this._partialMerge(groupIndices);
  }

  /**
   * Reject a pending changeset. Restores to snapshot and replays user overlay.
   *
   * @param groupIndices - If provided, only reject these dependency groups
   *   (the complement groups are accepted via partial merge). If omitted, rejects all.
   */
  rejectChangeset(groupIndices?: number[]): MergeResult {
    if (!this._changeset || this._changeset.status !== 'pending') {
      throw new Error('Cannot reject: no pending changeset');
    }

    // Partial rejection = accept the complement
    if (groupIndices && groupIndices.length > 0) {
      const allIndices = this._changeset.dependencyGroups.map((_, i) => i);
      const rejectSet = new Set(groupIndices);
      const complementIndices = allIndices.filter(i => !rejectSet.has(i));
      if (complementIndices.length === 0) {
        // Rejecting all groups — fall through to full reject
        return this._fullReject();
      }
      this.setRecording(false);
      return this._partialMerge(complementIndices);
    }

    return this._fullReject();
  }

  /** Full rejection — restore to snapshot, replay user overlay only. */
  private _fullReject(): MergeResult {
    const changeset = this._changeset!;
    this.setRecording(false);

    if (changeset.userOverlay.length === 0) {
      // Clean rollback — no user edits to replay
      this.core.restoreState(structuredClone(changeset.snapshotBefore));
      const diagnostics = this.core.diagnose();
      changeset.status = 'rejected';
      return { ok: true, diagnostics };
    }

    // Restore and replay user overlay
    this.core.restoreState(structuredClone(changeset.snapshotBefore));

    const userReplayResult = this._replayEntries(changeset.userOverlay);
    if (!userReplayResult.ok) {
      // User overlay replay failed — restore to clean snapshot
      this.core.restoreState(structuredClone(changeset.snapshotBefore));
      changeset.status = 'rejected';
      return {
        ok: false,
        replayFailure: {
          phase: 'user',
          entryIndex: userReplayResult.failedIndex,
          error: userReplayResult.error,
        },
      };
    }

    const diagnostics = this.core.diagnose();
    changeset.status = 'rejected';
    return { ok: true, diagnostics };
  }

  /**
   * Discard the current changeset without merging or rejecting.
   * Restores to the snapshot before the changeset was opened.
   */
  discardChangeset(): void {
    if (!this._changeset) return;

    this.setRecording(false);

    if (this._changeset.status === 'open' || this._changeset.status === 'pending') {
      this.core.restoreState(structuredClone(this._changeset.snapshotBefore));
    }

    this._changeset = null;
  }

  // ── Undo/redo gate ─────────────────────────────────────────────

  /**
   * Whether undo is currently allowed.
   * Disabled while a changeset is open — the changeset IS the undo mechanism.
   */
  get canUndo(): boolean {
    if (this._changeset && (this._changeset.status === 'open' || this._changeset.status === 'pending')) {
      return false;
    }
    return this.core.canUndo;
  }

  /**
   * Whether redo is currently allowed.
   * Disabled while a changeset is open.
   */
  get canRedo(): boolean {
    if (this._changeset && (this._changeset.status === 'open' || this._changeset.status === 'pending')) {
      return false;
    }
    return this.core.canRedo;
  }

  // ── Internal helpers ───────────────────────────────────────────

  /**
   * Compute dependency groups from AI entries via Rust/WASM.
   *
   * Serializes recorded entries into the format expected by the Rust
   * `formspec-changeset` crate, which performs key extraction, FEL
   * $-reference scanning, and union-find connected component grouping.
   */
  private _computeDependencyGroups(): DependencyGroup[] {
    const aiEntries = this._changeset!.aiEntries;
    if (aiEntries.length === 0) return [];
    if (aiEntries.length === 1) {
      return [{ entries: [0], reason: 'single entry' }];
    }

    // Serialize to the RecordedEntry shape expected by Rust:
    // { commands: Command[][], toolName?: string }
    const recorded = aiEntries.map(entry => ({
      commands: entry.commands,
      toolName: entry.toolName,
    }));

    return wasmComputeDependencyGroups(JSON.stringify(recorded));
  }

  /**
   * Partial merge: restore to snapshot, replay accepted AI groups + user overlay.
   */
  private _partialMerge(groupIndices: number[]): MergeResult {
    const changeset = this._changeset!;

    // Collect accepted entry indices from the specified groups
    const acceptedEntryIndices = new Set<number>();
    for (const gi of groupIndices) {
      if (gi < 0 || gi >= changeset.dependencyGroups.length) {
        throw new Error(`Invalid dependency group index: ${gi}`);
      }
      for (const ei of changeset.dependencyGroups[gi].entries) {
        acceptedEntryIndices.add(ei);
      }
    }

    // Collect accepted entries in chronological order
    const acceptedEntries: ChangeEntry[] = [];
    for (let i = 0; i < changeset.aiEntries.length; i++) {
      if (acceptedEntryIndices.has(i)) {
        acceptedEntries.push(changeset.aiEntries[i]);
      }
    }

    // Phase 1: Restore to snapshot and replay accepted AI entries
    this.core.restoreState(structuredClone(changeset.snapshotBefore));

    const aiReplayResult = this._replayEntries(acceptedEntries);
    if (!aiReplayResult.ok) {
      // AI group replay failed — restore to clean snapshot
      this.core.restoreState(structuredClone(changeset.snapshotBefore));
      changeset.status = 'rejected';
      return {
        ok: false,
        replayFailure: {
          phase: 'ai',
          entryIndex: aiReplayResult.failedIndex,
          error: aiReplayResult.error,
        },
      };
    }

    // Phase 1 savepoint
    const afterAiState = structuredClone(this.core.state);

    // Phase 2: Replay user overlay
    if (changeset.userOverlay.length > 0) {
      const userReplayResult = this._replayEntries(changeset.userOverlay);
      if (!userReplayResult.ok) {
        // User overlay failed — restore to after-AI savepoint, leave as pending for retry
        this.core.restoreState(afterAiState);
        return {
          ok: false,
          replayFailure: {
            phase: 'user',
            entryIndex: userReplayResult.failedIndex,
            error: userReplayResult.error,
          },
        };
      }
    }

    // Phase 3: Structural validation
    const diagnostics = this.core.diagnose();
    if (diagnostics.counts.error > 0) {
      // Validation failed — restore to snapshot and leave as pending for retry
      this.core.restoreState(structuredClone(changeset.snapshotBefore));
      return { ok: false, diagnostics };
    }
    changeset.status = 'merged';
    return { ok: true, diagnostics };
  }

  /**
   * Replay a list of change entries against the current state.
   */
  private _replayEntries(entries: ChangeEntry[]): { ok: true } | { ok: false; failedIndex: number; error: Error } {
    for (let i = 0; i < entries.length; i++) {
      try {
        for (const phase of entries[i].commands) {
          if (phase.length > 0) {
            this.core.batch(phase as AnyCommand[]);
          }
        }
      } catch (err) {
        return { ok: false, failedIndex: i, error: err instanceof Error ? err : new Error(String(err)) };
      }
    }
    return { ok: true };
  }
}

// ── Utilities ─────────────────────────────────────────────────────

/** Extract affected paths from command results. */
function extractAffectedPaths(results: Readonly<CommandResult[]>): string[] {
  const paths: string[] = [];
  for (const r of results) {
    if (r.insertedPath) paths.push(r.insertedPath);
    if (r.newPath) paths.push(r.newPath);
  }
  return paths;
}

/**
 * Scan commands for =-prefix expression values (initialValue, default) and
 * record them in the entry's capturedValues so replay is deterministic.
 */
function scanForExpressionValues(
  commands: AnyCommand[][],
  entry: ChangeEntry,
): void {
  for (const phase of commands) {
    for (const cmd of phase) {
      const p = cmd.payload as Record<string, unknown> | undefined;
      if (!p) continue;
      // definition.setItemProperty with initialValue or default that starts with =
      if (
        cmd.type === 'definition.setItemProperty' &&
        typeof p.property === 'string' &&
        (p.property === 'initialValue' || p.property === 'default') &&
        typeof p.value === 'string' &&
        p.value.startsWith('=')
      ) {
        const path = p.path as string;
        if (path) {
          entry.capturedValues ??= {};
          entry.capturedValues[path] = p.value;
        }
      }
      // definition.setBind with calculate/initialValue/default that starts with =
      if (cmd.type === 'definition.setBind' && p.properties && typeof p.properties === 'object') {
        const props = p.properties as Record<string, unknown>;
        const path = p.path as string;
        for (const key of ['calculate', 'initialValue', 'default'] as const) {
          if (typeof props[key] === 'string' && (props[key] as string).startsWith('=')) {
            if (path) {
              entry.capturedValues ??= {};
              entry.capturedValues[path] = props[key];
            }
          }
        }
      }
    }
  }
}

/** Generate a summary for user overlay entries from command types. */
function generateUserSummary(commands: Readonly<AnyCommand[][]>): string {
  const types = new Set<string>();
  for (const phase of commands) {
    for (const cmd of phase) {
      types.add(cmd.type);
    }
  }
  const typeList = [...types];
  if (typeList.length === 0) return 'User: empty operation';
  if (typeList.length === 1) return `User: ${typeList[0]}`;
  return `User: ${typeList.length} operations (${typeList.slice(0, 3).join(', ')}${typeList.length > 3 ? ', ...' : ''})`;
}
