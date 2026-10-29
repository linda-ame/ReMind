import { describe, expect, it } from 'vitest';
import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import {
  buildTaskRecord,
  exactAnswerText,
  fillBlanks,
  matchesAnyOffered,
} from './taskRecord';

function attempt(partial: Partial<TaskAttempt> = {}): TaskAttempt {
  return {
    id: 'a1',
    taskId: 't1',
    contentVersion: 1,
    startedAt: '2026-01-01T00:00:00.000Z',
    completedAt: null,
    status: 'attempted',
    enteredAnswer: null,
    usedHint: false,
    viewedAnswers: false,
    selfAssessment: null,
    activeMs: 1200,
    ...partial,
  };
}

describe('exactAnswerText', () => {
  it('matches case and keeps diacritics', () => {
    expect(exactAnswerText('  Māja ', 'māja')).toBe(true);
    expect(exactAnswerText('Māja', 'maja')).toBe(false);
    expect(matchesAnyOffered('skola', ['Skola', 'nams'])).toBe(true);
  });
});

describe('buildTaskRecord', () => {
  it('stores each word-reading visit as the word and its time', () => {
    const task = {
      type: 'word_reading',
      word: 'saule',
    } as Task;
    expect(buildTaskRecord(task, attempt())).toEqual({
      kind: 'word_reading',
      activeMs: 1200,
      word: 'saule',
    });
  });

  it('highlights the typed word and requires a full match', () => {
    const task = {
      type: 'image_word',
      sentence: 'Šī ir ___ .',
      answers: ['māja'],
    } as Task;
    const record = buildTaskRecord(
      task,
      attempt({ enteredAnswer: 'Māja' }),
    ) as { exact: boolean; sentence: { text: string; highlights: { start: number }[] } };
    expect(record.exact).toBe(true);
    expect(record.sentence.text).toBe('Šī ir Māja .');
    expect(record.sentence.highlights[0]?.start).toBe('Šī ir '.length);
    expect(
      (buildTaskRecord(task, attempt({ enteredAnswer: 'maja' })) as { exact: boolean })
        .exact,
    ).toBe(false);
  });

  it('counts the try that first got the odd word', () => {
    const task = {
      type: 'odd_one_out',
      options: ['ābols', 'bumbieris', 'galds', 'plūme'],
      correctIndex: 2,
    } as Task;
    const record = buildTaskRecord(
      task,
      attempt({ enteredAnswer: '2', wrongTries: 2 }),
    ) as { exact: boolean; correctTry: number };
    expect(record.exact).toBe(true);
    expect(record.correctTry).toBe(3);
  });

  it('marks a spelling judgment and the offered correction', () => {
    const task = {
      type: 'spelling_check',
      shownWord: 'skolaa',
      isCorrect: false,
      correctWord: 'skola',
    } as Task;
    const record = buildTaskRecord(
      task,
      attempt({
        enteredAnswer: JSON.stringify({
          choice: 'nepareizi',
          correction: 'Skola',
        }),
      }),
    ) as { judgmentCorrect: boolean; correctionExact: boolean };
    expect(record.judgmentCorrect).toBe(true);
    expect(record.correctionExact).toBe(true);
  });

  it('leaves a free sentence without highlights', () => {
    const task = {
      type: 'sentence_creation',
      mode: 'include_keywords',
    } as Task;
    const record = buildTaskRecord(
      task,
      attempt({ enteredAnswer: 'Saule spīd.' }),
    ) as { sentence: { highlights: unknown[] } };
    expect(record.sentence.highlights).toEqual([]);
  });
});

describe('fillBlanks', () => {
  it('records both typed words', () => {
    const filled = fillBlanks('Viņš ___ un ___.', ['iet', 'skatās']);
    expect(filled.text).toBe('Viņš iet un skatās.');
    expect(filled.highlights).toEqual([
      { start: 'Viņš '.length, end: 'Viņš iet'.length },
      { start: 'Viņš iet un '.length, end: 'Viņš iet un skatās'.length },
    ]);
  });
});
