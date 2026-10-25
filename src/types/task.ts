/** Content schema version — bump when task JSON shape changes. */
export const CONTENT_SCHEMA_VERSION = 3;

export type TaskType =
  | 'word_reading'
  | 'sentence_completion'
  | 'sentence_completion_multi'
  | 'image_word'
  | 'word_choice'
  | 'reading_comprehension'
  | 'sentence_order'
  | 'odd_one_out'
  | 'antonym'
  | 'definition_guess'
  | 'sentence_image_match';

/** Reading question: answer stated in text vs inferred. */
export type ReadingQuestionType = 'direct' | 'inference';

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
  /** direct = in text; inference = must be deduced. Optional. */
  questionType?: ReadingQuestionType;
  /** Shown after the learner answers — not before. */
  explanation?: string;
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

/**
 * Sentence with two or three `___` blanks.
 * Stored answers: JSON string[] in `enteredAnswer` (one string per blank).
 */
export interface SentenceCompletionMultiTask extends BaseTask {
  type: 'sentence_completion_multi';
  /** Sentence with two or three `___` markers. */
  sentence: string;
  /** Accepted answers per blank, same order as blanks in `sentence`. */
  answersByBlank: string[][];
  /** Full completed sentence for review. */
  modelText: string;
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
  /** Optional short title shown above the passage. */
  title?: string;
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
  /** Optional authoring cue; not shown in the UI. */
  comparisonRule?: string;
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

/** One sentence; pick the matching image among four options. */
export interface SentenceImageMatchTask extends BaseTask {
  type: 'sentence_image_match';
  /** Full prompt / sentence shown above the image choices. */
  prompt: string;
  options: { imageSrc: string; imageAlt: string }[];
  /** Index of the matching image (0-based). */
  correctIndex: number;
  /** Short explanation shown after the learner checks their answer. */
  explanation: string;
  hint?: string;
}

export type Task =
  | WordReadingTask
  | SentenceCompletionTask
  | SentenceCompletionMultiTask
  | ImageWordTask
  | WordChoiceTask
  | ReadingComprehensionTask
  | SentenceOrderTask
  | OddOneOutTask
  | AntonymTask
  | DefinitionGuessTask
  | SentenceImageMatchTask;

export interface TaskPack {
  schemaVersion: number;
  title: string;
  tasks: Task[];
}
