import { describe, expect, it } from 'vitest';
import { getAllTasks } from '../data/loadTasks';
import type { TaskAttempt } from '../types/progress';
import { formatDuration, presentTaskAttempt } from './presentRecord';

function attempt(taskId: string, partial: Partial<TaskAttempt> = {}): TaskAttempt {
  return {
    id: 'a1',
    taskId,
    contentVersion: 1,
    startedAt: '2026-10-29T10:00:00.000Z',
    completedAt: '2026-10-29T10:01:00.000Z',
    status: 'completed',
    enteredAnswer: null,
    usedHint: false,
    viewedAnswers: true,
    selfAssessment: null,
    activeMs: 65000,
    ...partial,
  };
}

describe('presentTaskAttempt', () => {
  it('groups a repeated word with its time', () => {
    const task = getAllTasks().find((item) => item.type === 'word_reading');
    expect(task).toBeTruthy();
    const record = presentTaskAttempt(attempt(task!.id));
    expect(record?.group).toBe(task && task.type === 'word_reading' ? task.word : '');
    expect(record?.lines[0]).toEqual({ label: 'Laiks', text: '1 min 5 s' });
  });

  it('formats short durations in seconds', () => {
    expect(formatDuration(4000)).toBe('4 s');
    expect(formatDuration(0)).toBe('0 s');
  });
});
