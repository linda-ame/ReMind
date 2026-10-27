import type {
  DifficultyLevel,
  ReadingComprehensionTask,
  Task,
  TaskPack,
} from '../types/task';
import rawV1 from './tasks.json';
import rawRc from './reading_comprehension.json';
import rawP03 from './p03_visi_3_tipi.json';
import rawSentenceOrder from './sentence_order_P01_50.json';
import rawOddOneOut from './odd_one_out_P01_50.json';
import rawAntonym from './antonym_P01_60.json';
import rawDefinitionGuess from './definition_guess_P01_50.json';
import rawSentenceCompletionP02 from './sentence_completion_P02.json';
import rawWordChoiceP02 from './word_choice_P02.json';
import rawReadingP02 from './reading_comprehension_P02.json';
import rawSentenceOrderP02 from './sentence_order_P02.json';
import rawOddOneOutP02 from './odd_one_out_P02.json';
import rawAntonymP02 from './antonym_P02.json';
import rawDefinitionGuessP02 from './definition_guess_P02.json';
import rawSentenceImageMatch from './sentence_image_match_P01_10.json';
import rawLogopedaP03 from './logopeda_P03_130.json';
import rawDefinitionGuessP04 from './definition_guess_P04_50.json';
import rawP05 from './p05_visi.json';
import rawP06 from './p06_asociacijas.json';
import difficultyByIdRaw from './metadata/remind_difficulty_by_id.json';
import questionDifficultyByIdRaw from './metadata/remind_reading_question_difficulty_by_id.json';

const v1 = rawV1 as TaskPack;
const rc = rawRc as TaskPack;
const p03 = rawP03 as TaskPack;
const sentenceOrder = rawSentenceOrder as TaskPack;
const oddOneOut = rawOddOneOut as TaskPack;
const antonym = rawAntonym as TaskPack;
const definitionGuess = rawDefinitionGuess as TaskPack;
const sentenceCompletionP02 = rawSentenceCompletionP02 as TaskPack;
const wordChoiceP02 = rawWordChoiceP02 as TaskPack;
const readingP02 = rawReadingP02 as TaskPack;
const sentenceOrderP02 = rawSentenceOrderP02 as TaskPack;
const oddOneOutP02 = rawOddOneOutP02 as TaskPack;
const antonymP02 = rawAntonymP02 as TaskPack;
const definitionGuessP02 = rawDefinitionGuessP02 as TaskPack;
const sentenceImageMatch = rawSentenceImageMatch as TaskPack;
const logopedaP03 = rawLogopedaP03 as TaskPack;
const definitionGuessP04 = rawDefinitionGuessP04 as TaskPack;
const p05 = rawP05 as TaskPack;
const p06 = rawP06 as TaskPack;

const difficultyById = difficultyByIdRaw as Record<string, number>;
const questionDifficultyById = questionDifficultyByIdRaw as Record<
  string,
  number
>;

function asDifficulty(value: number | undefined): DifficultyLevel | null {
  if (value === 1 || value === 2 || value === 3 || value === 4 || value === 5) {
    return value;
  }
  return null;
}

function withDifficulty(task: Task): Task {
  const difficulty = asDifficulty(difficultyById[task.id]);
  if (task.type !== 'reading_comprehension') {
    return { ...task, difficulty };
  }
  const enriched: ReadingComprehensionTask = {
    ...task,
    difficulty,
    questions: task.questions.map((q) => ({
      ...q,
      difficulty: asDifficulty(questionDifficultyById[q.id]),
    })),
  };
  return enriched;
}

const rawTasks: Task[] = [
  ...v1.tasks,
  ...rc.tasks,
  ...p03.tasks,
  ...sentenceOrder.tasks,
  ...oddOneOut.tasks,
  ...antonym.tasks,
  ...definitionGuess.tasks,
  ...sentenceCompletionP02.tasks,
  ...wordChoiceP02.tasks,
  ...readingP02.tasks,
  ...sentenceOrderP02.tasks,
  ...oddOneOutP02.tasks,
  ...antonymP02.tasks,
  ...definitionGuessP02.tasks,
  ...sentenceImageMatch.tasks,
  ...logopedaP03.tasks,
  ...definitionGuessP04.tasks,
  ...p05.tasks,
  ...p06.tasks,
];

const tasksWithDifficulty = rawTasks.map(withDifficulty);

if (import.meta.env.DEV) {
  const missing = tasksWithDifficulty.filter((t) => t.difficulty == null);
  if (missing.length > 0) {
    console.warn(
      `[ReMind] ${missing.length} task(s) without difficulty metadata:`,
      missing.map((t) => t.id),
    );
  }
}

/** Merged pack: existing packs + P01–P06. Keep old IDs intact. */
const pack: TaskPack = {
  schemaVersion: Math.max(
    v1.schemaVersion,
    rc.schemaVersion,
    p03.schemaVersion,
    sentenceOrder.schemaVersion,
    oddOneOut.schemaVersion,
    antonym.schemaVersion,
    definitionGuess.schemaVersion,
    sentenceCompletionP02.schemaVersion,
    wordChoiceP02.schemaVersion,
    readingP02.schemaVersion,
    sentenceOrderP02.schemaVersion,
    oddOneOutP02.schemaVersion,
    antonymP02.schemaVersion,
    definitionGuessP02.schemaVersion,
    sentenceImageMatch.schemaVersion,
    logopedaP03.schemaVersion,
    definitionGuessP04.schemaVersion,
    p05.schemaVersion,
    p06.schemaVersion,
  ),
  title: v1.title,
  tasks: tasksWithDifficulty,
};

/**
 * Menu sections (home / progress). Multi-blank completion is grouped under
 * Teikumu papildināšana — not a separate home button.
 */
export const TASK_TYPE_ORDER: Task['type'][] = [
  'word_reading',
  'image_word',
  'word_choice',
  'sentence_completion',
  'reading_comprehension',
  'sentence_order',
  'odd_one_out',
  'antonym',
  'definition_guess',
  'sentence_image_match',
  'sentence_creation',
  'spelling_check',
  'brand_association',
];

export const TASK_TYPE_LABELS: Record<Task['type'], string> = {
  word_reading: 'Vārdu lasīšana',
  image_word: 'Vārdu atpazīšana',
  word_choice: 'Vārdu izvēle',
  sentence_completion: 'Teikumu papildināšana',
  sentence_completion_multi: 'Teikumu papildināšana',
  reading_comprehension: 'Izlasi un atbildi',
  sentence_order: 'Sakārto vārdus teikumā',
  odd_one_out: 'Atrodi lieko vārdu',
  antonym: 'Pretstati',
  definition_guess: 'Uzmini vārdu pēc apraksta',
  sentence_image_match: 'Izlasi un atrodi attēlu',
  sentence_creation: 'Veido teikumu',
  spelling_check: 'Pārbaudi pareizrakstību',
  brand_association: 'Asociācijas',
};

/** Lesson vs single-task unit label for list / done / review screens. */
export function unitNoun(type: Task['type']): 'nodarbība' | 'uzdevums' {
  return type === 'reading_comprehension' ? 'uzdevums' : 'nodarbība';
}

export function unitNounPlural(type: Task['type']): string {
  return type === 'reading_comprehension' ? 'uzdevumi' : 'nodarbības';
}

export function unitTitle(type: Task['type'], lessonNumber: number): string {
  return `${lessonNumber}. ${unitNoun(type)}`;
}

function typeRank(type: Task['type']): number {
  if (type === 'sentence_completion_multi') {
    return TASK_TYPE_ORDER.indexOf('sentence_completion');
  }
  const i = TASK_TYPE_ORDER.indexOf(type);
  return i === -1 ? 999 : i;
}

/** True when both belong to the same home / practice section. */
export function sameSectionType(a: Task['type'], b: Task['type']): boolean {
  const norm = (t: Task['type']) =>
    t === 'sentence_completion_multi' ? 'sentence_completion' : t;
  return norm(a) === norm(b);
}

export function getTaskPack(): TaskPack {
  return pack;
}

export function getAllTasks(): Task[] {
  return [...pack.tasks].sort((a, b) => typeRank(a.type) - typeRank(b.type));
}

export function getTaskById(id: string): Task | undefined {
  return pack.tasks.find((t) => t.id === id);
}

/**
 * Tasks for a home section. `sentence_completion` includes multi-blank
 * (sentence_completion_multi) tasks.
 */
export function getTasksByType(type: Task['type']): Task[] {
  if (type === 'sentence_completion') {
    return pack.tasks.filter(
      (t) =>
        t.type === 'sentence_completion' ||
        t.type === 'sentence_completion_multi',
    );
  }
  if (type === 'sentence_completion_multi') {
    return pack.tasks.filter((t) => t.type === 'sentence_completion_multi');
  }
  // Preserve JSON order within a type (important for word-reading pack sequence).
  return pack.tasks.filter((t) => t.type === type);
}

/** Lookup for reading-question difficulty (passage uses task.difficulty). */
export function getQuestionDifficulty(questionId: string): DifficultyLevel | null {
  return asDifficulty(questionDifficultyById[questionId]);
}
