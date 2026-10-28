/** Cells and tray figures stay large. Extra rows scroll instead of shrinking. */

export const POSITIONS_CELL_MIN = 72;
export const POSITIONS_CELL_MAX = 168;
export const POSITIONS_CELL_GAP = 12;
export const POSITIONS_TRAY_GAP = 10;

export function positionsCellSize(input: {
  columns: number;
  rows: number;
  availableWidth: number;
  availableHeight: number;
  contentScale: number;
}): number {
  const scale =
    Number.isFinite(input.contentScale) && input.contentScale > 0
      ? input.contentScale
      : 1;
  const min = Math.round(POSITIONS_CELL_MIN * scale);
  const max = Math.round(POSITIONS_CELL_MAX * scale);
  if (input.columns < 1 || input.rows < 1) return min;
  const byWidth =
    (input.availableWidth - POSITIONS_CELL_GAP * (input.columns - 1)) / input.columns;
  const byHeight =
    (input.availableHeight - POSITIONS_CELL_GAP * (input.rows - 1)) / input.rows;
  const fitted = Math.min(byWidth, byHeight);
  if (!Number.isFinite(fitted) || fitted < min) return min;
  return Math.min(max, Math.floor(fitted));
}

export function positionsTraySize(
  count: number,
  width: number,
  contentScale: number,
): { size: number; columns: number; rows: number; height: number } {
  const scale = Number.isFinite(contentScale) && contentScale > 0 ? contentScale : 1;
  const min = Math.round(POSITIONS_CELL_MIN * scale);
  const max = Math.round(120 * scale);
  const gap = POSITIONS_TRAY_GAP;
  const target = Math.round(104 * scale);
  const safeWidth = Math.max(width, min);
  const safeCount = Math.max(1, count);
  let bestSize = min;
  let bestColumns = Math.min(safeCount, 4);
  let bestScore = Number.POSITIVE_INFINITY;
  for (let columns = 1; columns <= safeCount; columns += 1) {
    const raw = Math.floor((safeWidth - gap * (columns - 1)) / columns);
    if (raw < min) continue;
    const size = Math.min(max, raw);
    const used = columns * size + gap * (columns - 1);
    if (used > safeWidth + 1) continue;
    const score = Math.abs(size - target) * 10 + Math.ceil(safeCount / columns);
    if (score < bestScore) {
      bestScore = score;
      bestSize = size;
      bestColumns = columns;
    }
  }
  const rows = Math.max(1, Math.ceil(safeCount / bestColumns));
  return {
    size: bestSize,
    columns: bestColumns,
    rows,
    height: rows * bestSize + gap * Math.max(0, rows - 1),
  };
}
