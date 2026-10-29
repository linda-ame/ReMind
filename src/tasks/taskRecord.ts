import { getTaskById } from '../data/loadTasks';
import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { parseSpellingAnswer } from '../utils/answers';
import { parseWordGridAnswer } from '../utils/wordGrid';

/** A span inside `text` that a later screen can emphasize. */
export interface TextHighlight {
  start: number;
  end: number;
}

export interface HighlightedText {
  text: string;
  highlights: TextHighlight[];
}

/**
 * Full match: trim, collapse spaces, ignore letter case.
 * Diacritics stay, so "Māja" matches "māja" and not "maja".
 */
export function exactAnswerText(entered: string, offered: string): boolean {
  return exactKey(entered) === exactKey(offered);
}

export function matchesAnyOffered(
  entered: string,
  offered: readonly string[],
): boolean {
  const key = exactKey(entered);
  if (!key) return false;
  return offered.some((item) => exactKey(item) === key);
}

function exactKey(value: string): string {
  return value.normalize('NFC').trim().toLowerCase().replace(/\s+/g, ' ');
}

function exactSentence(entered: string, offered: string): boolean {
  const clean = (value: string) =>
    exactKey(value)
      .replace(/[.!?…]+$/g, '')
      .trim();
  const left = clean(entered);
  return left.length > 0 && left === clean(offered);
}

function activeMs(attempt: TaskAttempt): number {
  return Math.max(0, Math.round(attempt.activeMs ?? 0));
}

function correctTry(attempt: TaskAttempt, solved: boolean): number | null {
  if (!solved) return null;
  return (attempt.wrongTries ?? 0) + 1;
}

function stringList(raw: string | null): string[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (!parsed.every((item) => typeof item === 'string')) return null;
    return parsed;
  } catch {
    return null;
  }
}

function numberList(raw: string | null): number[] | null {
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    if (
      !parsed.every(
        (item) => typeof item === 'number' && Number.isInteger(item),
      )
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

function chosenIndex(raw: string | null, count: number): number | null {
  if (raw == null || raw === '') return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      typeof parsed === 'number' &&
      Number.isInteger(parsed) &&
      parsed >= 0 &&
      parsed < count
    ) {
      return parsed;
    }
  } catch {
    /* plain text */
  }
  return null;
}

/** Replace each `___` and remember where the typed words sit. */
export function fillBlanks(
  template: string,
  words: readonly string[],
): HighlightedText {
  const bits = template.split('___');
  let text = '';
  const highlights: TextHighlight[] = [];
  bits.forEach((bit, index) => {
    text += bit;
    if (index >= bits.length - 1) return;
    const word = words[index] ?? '';
    const start = text.length;
    text += word;
    if (word.trim()) highlights.push({ start, end: text.length });
  });
  return { text, highlights };
}

function joinSlots(
  slots: readonly string[],
  highlightIndex: number | null,
): HighlightedText {
  let text = '';
  const highlights: TextHighlight[] = [];
  slots.forEach((slot, index) => {
    const word = slot.trim();
    if (!word) return;
    if (text) text += ' ';
    const start = text.length;
    text += word;
    if (index === highlightIndex) highlights.push({ start, end: text.length });
  });
  return { text, highlights };
}

function orderSentence(words: readonly string[], order: readonly number[]): string {
  return order
    .map((index) => words[index] ?? '')
    .filter((word) => word.trim() !== '')
    .join(' ');
}

/** Snapshot stored with the attempt. Presentation comes later. */
export function buildTaskRecord(task: Task, attempt: TaskAttempt): unknown {
  const ms = activeMs(attempt);

  switch (task.type) {
    case 'word_reading':
      return { kind: task.type, activeMs: ms, word: task.word };

    case 'image_word': {
      const entered = attempt.enteredAnswer ?? '';
      return {
        kind: task.type,
        activeMs: ms,
        sentence: fillBlanks(task.sentence, [entered]),
        entered,
        exact: matchesAnyOffered(entered, task.answers),
        offered: task.answers,
      };
    }

    case 'sentence_completion': {
      const entered = attempt.enteredAnswer ?? '';
      return {
        kind: task.type,
        activeMs: ms,
        sentence: fillBlanks(task.sentence, [entered]),
        entered,
        exact: matchesAnyOffered(entered, task.answers),
        offered: task.answers,
      };
    }

    case 'sentence_completion_multi': {
      const entered = stringList(attempt.enteredAnswer) ?? [];
      const exact =
        task.answersByBlank.length > 0 &&
        task.answersByBlank.every((answers, index) =>
          matchesAnyOffered(entered[index] ?? '', answers),
        );
      return {
        kind: task.type,
        activeMs: ms,
        sentence: fillBlanks(task.sentence, entered),
        entered,
        exact,
        offered: task.answersByBlank,
      };
    }

    case 'word_choice': {
      const selected = stringList(attempt.enteredAnswer) ??
        (attempt.enteredAnswer ? [attempt.enteredAnswer] : []);
      const correct = task.correctIndices
        .map((index) => task.options[index])
        .filter((word): word is string => typeof word === 'string');
      const exact =
        selected.length === correct.length &&
        correct.every((word) => selected.includes(word)) &&
        selected.every((word) => correct.includes(word));
      return {
        kind: task.type,
        activeMs: ms,
        question: task.prompt,
        options: task.options,
        correct,
        selected,
        exact,
        correctTry: correctTry(attempt, exact),
      };
    }

    case 'reading_comprehension':
      return {
        kind: task.type,
        activeMs: ms,
        passage: task.passage,
        questions: task.questions.map((question) => {
          const progress = attempt.reading?.questions.find(
            (item) => item.questionId === question.id,
          );
          const entered = progress?.enteredAnswer ?? '';
          return {
            question: question.question,
            entered,
            exact: matchesAnyOffered(entered, question.answers),
            offered: question.answers,
          };
        }),
      };

    case 'sentence_order': {
      const order = numberList(attempt.enteredAnswer) ?? [];
      const built = orderSentence(task.words, order);
      const offered = [
        task.modelSentence,
        ...task.acceptedOrders.map((item) => orderSentence(task.words, item)),
      ];
      return {
        kind: task.type,
        activeMs: ms,
        sentence: built,
        exact: offered.some((item) => exactSentence(built, item)),
        offered: task.modelSentence,
      };
    }

    case 'odd_one_out': {
      const selected = chosenIndex(attempt.enteredAnswer, task.options.length);
      const exact = selected === task.correctIndex;
      return {
        kind: task.type,
        activeMs: ms,
        options: task.options,
        correctIndex: task.correctIndex,
        selectedIndex: selected,
        exact,
        correctTry: correctTry(attempt, exact),
      };
    }

    case 'antonym': {
      if (task.mode === 'context_passage') {
        const entered = stringList(attempt.enteredAnswer) ?? [];
        const blanks = task.blanks ?? [];
        const exact =
          blanks.length > 0 &&
          blanks.every((blank, index) =>
            matchesAnyOffered(entered[index] ?? '', blank.answers),
          );
        return {
          kind: task.type,
          activeMs: ms,
          mode: task.mode,
          passage: fillBlanks(task.passage ?? '', entered),
          entered,
          exact,
          offered: blanks.map((blank) => blank.answers),
        };
      }
      const entered = attempt.enteredAnswer ?? '';
      const sentence =
        task.mode === 'context_sentence' && task.sentence
          ? fillBlanks(task.sentence, [entered])
          : null;
      return {
        kind: task.type,
        activeMs: ms,
        mode: task.mode ?? 'word',
        word: task.word,
        sentence,
        entered,
        exact: matchesAnyOffered(entered, task.answers),
        offered: task.answers,
      };
    }

    case 'definition_guess': {
      const entered = attempt.enteredAnswer ?? '';
      const given =
        task.mode === 'clues'
          ? (task.clues ?? []).join('\n')
          : task.description;
      return {
        kind: task.type,
        activeMs: ms,
        given,
        entered,
        exact: matchesAnyOffered(entered, task.answers),
        offered: task.answers,
      };
    }

    case 'sentence_image_match': {
      const selected = chosenIndex(
        attempt.enteredAnswer,
        task.options.length,
      );
      const exact = selected === task.correctIndex;
      return {
        kind: task.type,
        activeMs: ms,
        text: task.prompt,
        exact,
        correctTry: correctTry(attempt, exact),
      };
    }

    case 'sentence_creation': {
      if (task.mode === 'fixed_word_position') {
        const fixedPosition = task.fixedPosition ?? 0;
        const fixedWord = task.fixedWord ?? '';
        const parsed = stringList(attempt.enteredAnswer);
        const slots = [0, 1, 2, 3].map((index) => {
          if (index === fixedPosition) return fixedWord;
          return parsed?.[index] ?? '';
        });
        return {
          kind: task.type,
          activeMs: ms,
          mode: task.mode,
          sentence: joinSlots(slots, fixedPosition),
        };
      }
      return {
        kind: task.type,
        activeMs: ms,
        mode: task.mode,
        sentence: {
          text: attempt.enteredAnswer ?? '',
          highlights: [],
        },
      };
    }

    case 'spelling_check': {
      const stored = parseSpellingAnswer(attempt.enteredAnswer);
      const judged =
        stored.choice == null
          ? null
          : (stored.choice === 'pareizi') === task.isCorrect;
      const wordWasWrong = !task.isCorrect;
      const correction = wordWasWrong ? stored.correction.trim() : '';
      return {
        kind: task.type,
        activeMs: ms,
        shownWord: task.shownWord,
        judgment: stored.choice,
        judgmentCorrect: judged,
        correction: wordWasWrong ? correction : null,
        correctionExact: wordWasWrong
          ? correction
            ? exactAnswerText(correction, task.correctWord)
            : null
          : null,
      };
    }

    case 'brand_association': {
      const entered = attempt.enteredAnswer ?? '';
      return {
        kind: task.type,
        activeMs: ms,
        brand: task.brand,
        entered,
        exact: matchesAnyOffered(entered, task.exampleAssociations),
        offered: task.exampleAssociations,
      };
    }

    case 'word_grid': {
      const data = parseWordGridAnswer(attempt.enteredAnswer);
      return {
        kind: task.type,
        activeMs: ms,
        word: task.targetWord,
        usedHint: attempt.usedHint,
        revealed: data?.solutionViewed ?? false,
      };
    }
  }
}

/** Detail to store. Falls back to an existing snapshot if the task is gone. */
export function detailForAttempt(attempt: TaskAttempt): unknown {
  const task = getTaskById(attempt.taskId);
  if (!task) return attempt.detail ?? null;
  return buildTaskRecord(task, attempt);
}
