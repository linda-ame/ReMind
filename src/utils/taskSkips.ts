/** Local “Izlaist” deferral: not completed, but excluded from random until tomorrow. */

export interface TaskSkip {
  taskId: string;
  /** Local calendar date YYYY-MM-DD when the user skipped. */
  skippedOn: string;
}

const STORAGE_KEY = 'remind-task-skips-v1';

function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Local calendar day key (not UTC). */
export function localDayKey(date: Date = new Date()): string {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

function readRaw(): TaskSkip[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (x): x is TaskSkip =>
        x != null &&
        typeof x === 'object' &&
        typeof (x as TaskSkip).taskId === 'string' &&
        typeof (x as TaskSkip).skippedOn === 'string',
    );
  } catch {
    return [];
  }
}

function writeRaw(skips: TaskSkip[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(skips));
  } catch {
    /* quota / private mode — ignore */
  }
}

/** Drop entries from other days so storage stays small. */
export function pruneSkipsToToday(
  skips: TaskSkip[],
  today: string = localDayKey(),
): TaskSkip[] {
  return skips.filter((s) => s.skippedOn === today);
}

export function loadTaskSkips(): TaskSkip[] {
  const pruned = pruneSkipsToToday(readRaw());
  writeRaw(pruned);
  return pruned;
}

export function saveTaskSkips(skips: TaskSkip[]): void {
  writeRaw(pruneSkipsToToday(skips));
}

export function isSkippedToday(
  taskId: string,
  skips: TaskSkip[],
  today: string = localDayKey(),
): boolean {
  return skips.some((s) => s.taskId === taskId && s.skippedOn === today);
}

/** Record (or refresh) a skip for today. */
export function withTaskSkippedToday(
  skips: TaskSkip[],
  taskId: string,
  today: string = localDayKey(),
): TaskSkip[] {
  const others = skips.filter((s) => s.taskId !== taskId);
  return pruneSkipsToToday([...others, { taskId, skippedOn: today }], today);
}

export function withoutTaskSkips(
  skips: TaskSkip[],
  taskIds: string[],
): TaskSkip[] {
  const drop = new Set(taskIds);
  return skips.filter((s) => !drop.has(s.taskId));
}

export function skippedTodayTaskIds(
  skips: TaskSkip[],
  today: string = localDayKey(),
): Set<string> {
  return new Set(
    skips.filter((s) => s.skippedOn === today).map((s) => s.taskId),
  );
}
