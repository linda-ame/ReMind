/** Content schema version — bump when task JSON shape changes. */
export const CONTENT_SCHEMA_VERSION = 3;

export type TaskType =
  | 'word_reading'
  | 'sentence_completion'
  | 'image_word'
  | 'word_choice'
  | 'reading_comprehension'
  | 'sentence_order'
  | 'odd_one_out'
  | 'antonym'
  | 'definition_guess';

/** Content complexity 1 (easiest) … 5 (hardest). Null if metadata missing. */
export type DifficultyLevel = 1 | 2 | 3 | 4 | 5;

export interface BaseTask {
  /** Stable, immutable ID — never reuse or change. */
  id: string;
  type: TaskType;
  /** Content version for this task; bump if wording/options change. */
  contentVersion: number;
  instruction: string;
  /**
   * Content difficulty from metadata (not clinical).
   * Attached at load time; null when ID has no rating yet.
   */
  difficulty?: DifficultyLevel | null;
}

export interface ReadingComprehensionQuestion {
  id: string;
  question: string;
  answers: string[];
  /** Per-question difficulty (optional metadata). */
  difficulty?: DifficultyLevel | null;
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

/** Short text + comprehension questions (schemaVersion 2). */
export interface ReadingComprehensionTask extends BaseTask {
  type: 'reading_comprehension';
  passage: string;
  questions: ReadingComprehensionQuestion[];
}

/**
 * Tap words in order to build a sentence.
 * `acceptedOrders` lists every grammatically acceptable index sequence
 * (Latvian often allows more than one word order).
 */
export interface SentenceOrderTask extends BaseTask {
  type: 'sentence_order';
  /** Words in stable positions; indices refer into this array. */
  words: string[];
  /** Accepted orderings of word indices (0-based). */
  acceptedOrders: number[][];
  /** Model / example sentence shown when the user asks to reveal. */
  modelSentence: string;
  hint?: string;
}

/** Four options; one clearly does not belong. */
export interface OddOneOutTask extends BaseTask {
  type: 'odd_one_out';
  options: string[];
  /** Index of the odd word (0-based). */
  correctIndex: number;
  /** Short explanation why that word does not belong. */
  explanation: string;
  hint?: string;
}

/** Given a word, find an acceptable antonym (not synonyms). */
export interface AntonymTask extends BaseTask {
  type: 'antonym';
  word: string;
  /** Acceptable antonyms. */
  answers: string[];
}

/** Guess the word from a short description. */
export interface DefinitionGuessTask extends BaseTask {
  type: 'definition_guess';
  description: string;
  /** Acceptable answers (examples; other fitting words may also be fine). */
  answers: string[];
}

export type Task =
  | WordReadingTask
  | SentenceCompletionTask
  | ImageWordTask
  | WordChoiceTask
  | ReadingComprehensionTask
  | SentenceOrderTask
  | OddOneOutTask
  | AntonymTask
  | DefinitionGuessTask;

export interface TaskPack {
  schemaVersion: number;
  title: string;
  tasks: Task[];
}
