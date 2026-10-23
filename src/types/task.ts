/** Content schema version — bump when task JSON shape changes. */
export const CONTENT_SCHEMA_VERSION = 1;

export type TaskType =
  | 'word_reading'
  | 'sentence_completion'
  | 'image_word'
  | 'word_choice';

export interface BaseTask {
  /** Stable, immutable ID — never reuse or change. */
  id: string;
  type: TaskType;
  /** Content version for this task; bump if wording/options change. */
  contentVersion: number;
  instruction: string;
}

export interface WordReadingTask extends BaseTask {
  type: 'word_reading';
  word: string;
  hint?: string;
}

export interface SentenceCompletionTask extends BaseTask {
  type: 'sentence_completion';
  /** Sentence with `___` marking the blank. */
  sentence: string;
  /** Accepted answers (shown when user requests them). */
  answers: string[];
  hint?: string;
}

export interface ImageWordTask extends BaseTask {
  type: 'image_word';
  /** Path under /public or imported asset URL. */
  imageSrc: string;
  imageAlt: string;
  /** Sentence with `___` marking the blank. */
  sentence: string;
  answers: string[];
  hint?: string;
}

export interface WordChoiceTask extends BaseTask {
  type: 'word_choice';
  prompt: string;
  options: string[];
  /** Indices of correct options (can be more than one). */
  correctIndices: number[];
  hint?: string;
}

export type Task =
  | WordReadingTask
  | SentenceCompletionTask
  | ImageWordTask
  | WordChoiceTask;

export interface TaskPack {
  schemaVersion: number;
  title: string;
  tasks: Task[];
}
