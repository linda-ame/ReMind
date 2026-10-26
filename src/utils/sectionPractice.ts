import {
  getTasksByType,
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
} from '../data/loadTasks';
import type { Screen } from '../navigation/types';
import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { filterTasksByDifficulty, loadDifficultyLevels } from './difficulty';
import { buildRandomPracticeQueue } from './randomQueue';
import type { TaskSkip } from './taskSkips';

/** Home menu type. Multi-blank completion shares Teikumu papildināšana. */
export function menuSectionType(type: Task['type']): Task['type'] {
  return type === 'sentence_completion_multi' ? 'sentence_completion' : type;
}

/** Sections that appear on the home screen, in menu order. */
export function menuSections(): Task['type'][] {
  return TASK_TYPE_ORDER.filter((type) => getTasksByType(type).length > 0);
}

/** “1. Vārdu lasīšana” — name only, no done/total count. */
export function menuSectionLabel(type: Task['type']): string {
  const key = menuSectionType(type);
  const sections = menuSections();
  const index = sections.indexOf(key);
  const name = TASK_TYPE_LABELS[key];
  return index < 0 ? name : `${index + 1}. ${name}`;
}

export function adjacentMenuSection(
  type: Task['type'],
  dir: -1 | 1,
): Task['type'] | null {
  const sections = menuSections();
  const index = sections.indexOf(menuSectionType(type));
  if (index < 0) return null;
  return sections[index + dir] ?? null;
}

/** Same entry as tapping a section on the home screen. */
export function sectionPracticeScreen(
  type: Task['type'],
  attempts: TaskAttempt[],
  taskSkips: TaskSkip[],
): Screen {
  const key = menuSectionType(type);
  const ofType = getTasksByType(key);
  if (ofType.length === 0) return { name: 'home' };
  const levels = loadDifficultyLevels(key);
  const pool = filterTasksByDifficulty(ofType, levels);
  const queue = buildRandomPracticeQueue(pool, attempts, taskSkips);
  if (queue.length === 0) {
    return { name: 'section_complete', type: key };
  }
  return {
    name: 'task',
    taskId: queue[0]!,
    queue,
    batchType: key,
  };
}
