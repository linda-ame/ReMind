import {
  getTasksByType,
  TASK_TYPE_LABELS,
  TASK_TYPE_ORDER,
} from '../data/loadTasks';
import type { Screen } from '../navigation/types';
import type { TaskAttempt } from '../types/progress';
import type { Task } from '../types/task';
import { filterSectionTasks } from './difficulty';
import { buildRandomPracticeQueue } from './randomQueue';
import type { TaskSkip } from './taskSkips';

/** Home section in menu order, including memory practice and generated games. */
export type MenuSection =
  | Task['type']
  | 'memory_immediate'
  | 'memory_delayed'
  | 'memory_pairs';

const MEMORY_MENU: { id: MenuSection; label: string }[] = [
  { id: 'memory_immediate', label: 'Atceries uzreiz' },
  { id: 'memory_delayed', label: 'Atceries pēc brīža' },
];

/** Generated games. Later games join this list so the header arrows stay in order. */
const GAME_MENU: { id: MenuSection; label: string }[] = [
  { id: 'memory_pairs', label: 'Atrodi pārus' },
];

/** Home menu type. Multi-blank completion shares Teikumu papildināšana. */
export function menuSectionType(type: Task['type']): Task['type'] {
  return type === 'sentence_completion_multi' ? 'sentence_completion' : type;
}

/** Sections that appear on the home screen, in menu order. */
export function menuSections(): MenuSection[] {
  const tasks = TASK_TYPE_ORDER.filter((type) => getTasksByType(type).length > 0);
  return [
    ...tasks,
    ...MEMORY_MENU.map((item) => item.id),
    ...GAME_MENU.map((item) => item.id),
  ];
}

const EXTRA_MENU = [...MEMORY_MENU, ...GAME_MENU];

function isExtraSection(
  section: MenuSection,
): section is 'memory_immediate' | 'memory_delayed' | 'memory_pairs' {
  return EXTRA_MENU.some((item) => item.id === section);
}

function menuSectionName(section: MenuSection): string {
  if (isExtraSection(section)) {
    return EXTRA_MENU.find((item) => item.id === section)?.label ?? section;
  }
  return TASK_TYPE_LABELS[menuSectionType(section)];
}

/** “1. Vārdu lasīšana” — name only, no done/total count. */
export function menuSectionLabel(section: MenuSection): string {
  const key = isExtraSection(section) ? section : menuSectionType(section);
  const sections = menuSections();
  const index = sections.indexOf(key);
  const name = menuSectionName(key);
  return index < 0 ? name : `${index + 1}. ${name}`;
}

export function adjacentMenuSection(
  section: MenuSection,
  dir: -1 | 1,
): MenuSection | null {
  const sections = menuSections();
  const key = isExtraSection(section) ? section : menuSectionType(section);
  const index = sections.indexOf(key);
  if (index < 0) return null;
  return sections[index + dir] ?? null;
}

/** Open a home section from the header arrows. */
export function menuSectionScreen(
  section: MenuSection,
  attempts: TaskAttempt[],
  taskSkips: TaskSkip[],
): Screen {
  if (section === 'memory_immediate') return { name: 'memory', mode: 'immediate' };
  if (section === 'memory_delayed') return { name: 'memory', mode: 'delayed' };
  if (section === 'memory_pairs') return { name: 'memory_pairs' };
  return sectionPracticeScreen(section, attempts, taskSkips);
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
  const pool = filterSectionTasks(ofType, key);
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
