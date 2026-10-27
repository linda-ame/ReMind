import type { TaskAttempt } from '../types/progress';

/** Prefer completed > attempted > viewed; then newer timestamp. */
export function attemptFreshness(a: TaskAttempt): number {
  const statusRank =
    a.status === 'completed' ? 3 : a.status === 'attempted' ? 2 : 1;
  const time = Date.parse(a.completedAt ?? a.startedAt) || 0;
  return statusRank * 1e15 + time;
}

function earlierArchive(
  a: string | null | undefined,
  b: string | null | undefined,
): string | null {
  if (a && b) return a < b ? a : b;
  return a ?? b ?? null;
}

/**
 * Pick the better of two attempts with the same id.
 * Once either copy is archived, the row stays archived.
 * On-screen time keeps the larger value.
 */
export function pickRicherAttempt(a: TaskAttempt, b: TaskAttempt): TaskAttempt {
  const winner: TaskAttempt =
    attemptFreshness(a) >= attemptFreshness(b) ? { ...a } : { ...b };
  const archivedAt = earlierArchive(a.archivedAt, b.archivedAt);
  if (archivedAt) winner.archivedAt = archivedAt;
  const activeMs = Math.max(a.activeMs ?? 0, b.activeMs ?? 0);
  if (activeMs > 0) winner.activeMs = activeMs;
  return winner;
}

/**
 * Merge local guest attempts into cloud by id.
 * Returns the list that should be written to cloud (winners only).
 */
export function mergeAttemptsForSync(
  local: TaskAttempt[],
  cloud: TaskAttempt[],
): TaskAttempt[] {
  const byId = new Map<string, TaskAttempt>();

  for (const a of cloud) {
    byId.set(a.id, a);
  }
  for (const a of local) {
    const existing = byId.get(a.id);
    byId.set(a.id, existing ? pickRicherAttempt(existing, a) : a);
  }

  return [...byId.values()];
}
