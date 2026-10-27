const KEY = 'remind.memoryVisualFirst';

/** Prefer showing the memory text instead of hiding it behind audio. */
export function loadMemoryVisualFirst(): boolean {
  try {
    return localStorage.getItem(KEY) === '1';
  } catch {
    return false;
  }
}

export function saveMemoryVisualFirst(value: boolean): void {
  try {
    localStorage.setItem(KEY, value ? '1' : '0');
  } catch {
    /* ignore */
  }
}
