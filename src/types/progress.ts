import type { MemorySession } from './memory';

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
  /**
   * Set when the learner starts this task over. The row stays in storage
   * for later review and is ignored by current progress.
   */
  archivedAt?: string | null;
  /**
   * Milliseconds the task was on screen while the tab was visible.
   * Not shown in the UI.
   */
  activeMs?: number;
  /** Wrong picks before the correct one, for tasks that allow another try. */
  wrongTries?: number;
  /** Present for reading_comprehension tasks. */
  reading?: ReadingComprehensionProgress;
  /** Cloud snapshot of what was shown and answered. Built when the attempt is saved. */
  detail?: unknown;
}

export type TextAlign = 'left' | 'center' | 'right';
export type TextPosition = 'top' | 'middle' | 'bottom';

/**
 * Multiplier on a viewport-width “fit” base size.
 * 1 = standard. Presets are quick jumps; slider allows fine values in between.
 */
export type ContentScale = number;

/** Slider / storage bounds (presets sit inside this range). */
export const CONTENT_SCALE_MIN = 0.7;
export const CONTENT_SCALE_MAX = 2;
export const CONTENT_SCALE_STEP = 0.05;

/** Home screen: icons first, unless the person has chosen the text list. */
export type HomeView = 'text' | 'icons';

export interface UiSettings {
  contentScale: ContentScale;
  textAlign: TextAlign;
  textPosition: TextPosition;
  highContrast: boolean;
  homeView: HomeView;
  /** @deprecated Migrated to contentScale on load. */
  fontSizePx?: number;
}

export const DEFAULT_UI_SETTINGS: UiSettings = {
  contentScale: 1,
  textAlign: 'center',
  textPosition: 'middle',
  highContrast: false,
  homeView: 'icons',
};

export const CONTENT_SCALE_OPTIONS: {
  value: number;
  label: string;
  note: string;
}[] = [
  { value: 0.75, label: 'Mazāks', note: 'Kompaktāks' },
  { value: 1, label: 'Standarts', note: 'Pielāgots ekrānam' },
  { value: 1.35, label: 'Lielāks', note: 'Skaidri lielāki burti' },
  { value: 1.7, label: 'Ļoti liels', note: 'Var vajadzēt ritināt' },
];

/** Clamp + round to slider step so stored values stay tidy. */
export function clampContentScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  const clamped = Math.min(
    CONTENT_SCALE_MAX,
    Math.max(CONTENT_SCALE_MIN, value),
  );
  const steps = Math.round(clamped / CONTENT_SCALE_STEP);
  return Math.round(steps * CONTENT_SCALE_STEP * 100) / 100;
}

/** True when current scale matches a preset button (within half a step). */
export function isContentScalePreset(
  current: number,
  preset: number,
): boolean {
  return Math.abs(current - preset) < CONTENT_SCALE_STEP / 2 + 0.001;
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
    contentScale: clampContentScale(scale),
    textAlign: merged.textAlign,
    textPosition: merged.textPosition,
    highContrast: merged.highContrast,
    homeView: stored?.homeView === 'text' ? 'text' : 'icons',
  };
}

export interface ProgressSnapshot {
  schemaVersion: number;
  exportedAt: string;
  attempts: TaskAttempt[];
  settings: UiSettings;
  /**
   * Memory-training sessions. Kept on the device export only —
   * not uploaded with cloud task attempts.
   */
  memorySessions?: MemorySession[];
}
