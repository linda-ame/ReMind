/** Progress export/import schema version. */
export const PROGRESS_SCHEMA_VERSION = 1;

export type SelfAssessment = 'independent' | 'with_help' | 'difficult' | 'skipped';

export type TaskAttemptStatus = 'viewed' | 'attempted' | 'completed';

/** Per-question progress inside a reading_comprehension attempt. */
export interface ReadingQuestionProgress {
  questionId: string;
  enteredAnswer: string | null;
  viewedAnswers: boolean;
  /** How many times the passage was reopened on this question. */
  rereadCount: number;
  selfAssessment: SelfAssessment | null;
  status: TaskAttemptStatus;
  completedAt: string | null;
}

export interface ReadingComprehensionProgress {
  phase: 'passage' | 'questions';
  questionIndex: number;
  questions: ReadingQuestionProgress[];
}

export interface TaskAttempt {
  id: string;
  taskId: string;
  contentVersion: number;
  startedAt: string;
  completedAt: string | null;
  status: TaskAttemptStatus;
  enteredAnswer: string | null;
  usedHint: boolean;
  viewedAnswers: boolean;
  selfAssessment: SelfAssessment | null;
  /** Present for reading_comprehension tasks. */
  reading?: ReadingComprehensionProgress;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextPosition = 'top' | 'middle' | 'bottom';

/**
 * Multiplier on a viewport-based “fit the screen” base size.
 * 1 = standard (designed to fit a tablet without scrolling chrome).
 * Steps are wide so the change is obvious on a tablet.
 */
export type ContentScale = 0.75 | 1 | 1.35 | 1.7;

export interface UiSettings {
  contentScale: ContentScale;
  textAlign: TextAlign;
  textPosition: TextPosition;
  highContrast: boolean;
  /** @deprecated Migrated to contentScale on load. */
  fontSizePx?: number;
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  contentScale: 1,
  textAlign: 'center',
  textPosition: 'middle',
  highContrast: false,
};

export const CONTENT_SCALE_OPTIONS: {
  value: ContentScale;
  label: string;
  note: string;
}[] = [
  { value: 0.75, label: 'Mazāks', note: 'Kompaktāks' },
  { value: 1, label: 'Standarts', note: 'Pielāgots ekrānam' },
  { value: 1.35, label: 'Lielāks', note: 'Skaidri lielāki burti' },
  { value: 1.7, label: 'Ļoti liels', note: 'Var vajadzēt ritināt' },
];

const ALLOWED_SCALES: ContentScale[] = [0.75, 1, 1.35, 1.7];

/** Snap legacy / unknown scales to the nearest allowed step. */
function snapContentScale(value: number): ContentScale {
  let best: ContentScale = 1;
  let bestDist = Infinity;
  for (const s of ALLOWED_SCALES) {
    const d = Math.abs(s - value);
    if (d < bestDist) {
      bestDist = d;
      best = s;
    }
  }
  return best;
}

/** Normalize stored/imported settings (incl. old fontSizePx). */
export function normalizeUiSettings(
  stored: Partial<UiSettings> | null | undefined,
): UiSettings {
  const merged = { ...DEFAULT_UI_SETTINGS, ...stored };
  let scale: number = Number(merged.contentScale);

  if (
    (stored?.contentScale == null || Number.isNaN(scale)) &&
    typeof stored?.fontSizePx === 'number'
  ) {
    const px = stored.fontSizePx;
    if (px <= 28) scale = 0.75;
    else if (px <= 36) scale = 1;
    else if (px <= 42) scale = 1.35;
    else scale = 1.7;
  }

  if (Number.isNaN(scale)) scale = 1;

  return {
    contentScale: snapContentScale(scale),
    textAlign: merged.textAlign,
    textPosition: merged.textPosition,
    highContrast: merged.highContrast,
  };
}

export interface ProgressSnapshot {
  schemaVersion: number;
  exportedAt: string;
  attempts: TaskAttempt[];
  settings: UiSettings;
}
