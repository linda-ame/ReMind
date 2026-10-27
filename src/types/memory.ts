import type { DifficultyLevel } from './task';

/** Local session records. Not part of the static task pack. */
export const MEMORY_SESSION_SCHEMA = 1;

export type MemoryMode = 'immediate' | 'delayed';

export type MemoryCategory =
  | 'digits'
  | 'numbers'
  | 'words'
  | 'shopping'
  | 'appointment';

export type MemoryPhase =
  | 'study'
  | 'immediate_response'
  | 'distractor_1'
  | 'distractor_2'
  | 'extra_offer'
  | 'extra_distractor'
  | 'delayed_response'
  | 'result'
  | 'complete';

export interface MemoryStimulus {
  visualText: string;
  ttsSegments: string[];
  locale: 'lv-LV';
}

export interface MemorySingleChoice {
  type: 'single_select';
  options: string[];
  correctIndex: number;
}

export interface MemoryMultiChoice {
  type: 'multi_select';
  options: string[];
  correctIndices: number[];
}

export interface MemoryOrderedDigits {
  kind: 'ordered_digits';
  correctTokens: string[];
  freeInput: 'digit_keypad';
  recognition: MemorySingleChoice;
}

export interface MemoryUnorderedList {
  kind: 'unordered_list';
  correctTokens: string[];
  freeInput: 'numeric_list' | 'word_list';
  recognition: MemoryMultiChoice;
}

export interface MemoryFactField {
  key: string;
  prompt: string;
  acceptedAnswers: string[];
  recognition: MemorySingleChoice;
}

export interface MemoryFacts {
  kind: 'facts';
  freeInput: 'fact_fields';
  fields: MemoryFactField[];
}

export type MemoryAnswerKey =
  | MemoryOrderedDigits
  | MemoryUnorderedList
  | MemoryFacts;

export interface MemoryRecallTask {
  id: string;
  type: 'memory_recall';
  contentVersion: number;
  difficulty: DifficultyLevel;
  category: MemoryCategory;
  instruction: string;
  stimulus: MemoryStimulus;
  answer: MemoryAnswerKey;
}

export interface MemoryScore {
  correct: number;
  total: number;
  exact: boolean;
}

export type MemoryNotScorableReason =
  | 'spoken_untranscribed'
  | 'incomplete'
  | 'ambiguous'
  | 'technical_error';

export interface MemoryAnswer {
  freeResponseRaw?: string | string[] | Record<string, string>;
  recognitionOpened: boolean;
  recognitionSelection?: string | string[] | Record<string, string>;
  freeScore?: MemoryScore | null;
  recognitionScore?: MemoryScore | null;
  notScorableReason?: MemoryNotScorableReason;
  answeredAt: string;
}

/** In-progress response. Kept separate from the scored answer. */
export interface MemoryDraft {
  digits: string[];
  items: string[];
  /** Text not yet added to `items`. */
  pendingItem: string;
  facts: Record<string, string>;
  factIndex: number;
  recognitionOpen: boolean;
  singleIndex: number | null;
  multiIndices: number[];
  factIndices: Record<string, number | null>;
}

export interface DistractorSnapshot {
  taskId: string;
  enteredAnswer: string | null;
  viewedAnswers: boolean;
  status: 'viewed' | 'attempted' | 'completed';
  usedHint: boolean;
}

export interface MemorySession {
  schemaVersion: number;
  sessionId: string;
  taskId: string;
  taskContentVersion: number;
  category: MemoryCategory;
  mode: MemoryMode;
  phase: MemoryPhase;
  startedAt: string;
  updatedAt: string;
  stimulusHiddenAt?: string;
  delayedStartedAt?: string;
  actualDelaySeconds?: number;
  ttsPlayCount: number;
  visualHelpShown: boolean;
  visualHelpViews: number;
  /** Text is currently uncovered during study. */
  visualOpen: boolean;
  immediate?: MemoryAnswer;
  delayed?: MemoryAnswer;
  firstResponseCued: boolean;
  distractorTaskIds: string[];
  distractors: DistractorSnapshot[];
  interrupted: boolean;
  completedAt?: string;
  draft: MemoryDraft;
}

export function emptyMemoryDraft(): MemoryDraft {
  return {
    digits: [],
    items: [],
    pendingItem: '',
    facts: {},
    factIndex: 0,
    recognitionOpen: false,
    singleIndex: null,
    multiIndices: [],
    factIndices: {},
  };
}
