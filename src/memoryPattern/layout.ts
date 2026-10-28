/** Square cells stay large enough to tap. Extra space scrolls instead of shrinking. */

export const PATTERN_CELL_MIN = 64;
export const PATTERN_CELL_MAX = 168;
export const PATTERN_CELL_GAP = 12;

export function patternCellSize(input: {
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
  const min = Math.round(PATTERN_CELL_MIN * scale);
  const max = Math.round(PATTERN_CELL_MAX * scale);
  if (input.columns < 1 || input.rows < 1) return min;
  const byWidth =
    (input.availableWidth - PATTERN_CELL_GAP * (input.columns - 1)) /
    input.columns;
  const byHeight =
    (input.availableHeight - PATTERN_CELL_GAP * (input.rows - 1)) / input.rows;
  const fitted = Math.min(byWidth, byHeight);
  if (!Number.isFinite(fitted) || fitted < min) return min;
  return Math.min(max, Math.floor(fitted));
}
