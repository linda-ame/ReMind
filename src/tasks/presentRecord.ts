import { MEMORY_PAIRS_CATEGORY_LABEL } from '../memoryPairs/types';
import type { MemoryPairsCategorySetting } from '../memoryPairs/types';
import type { GameSummary } from '../games/summary';
import { detailForAttempt } from './taskRecord';
import { buildMemoryRecord, type MemoryRecallRecord } from './memoryRecord';
import type { MemorySession } from '../types/memory';
import type { TaskAttempt } from '../types/progress';

export interface TextMark {
  start: number;
  end: number;
}

export interface RecordLine {
  label: string;
  text: string;
  highlights?: TextMark[];
}

export interface PresentedRecord {
  id: string;
  at: string;
  when: string;
  /** Same word or item, so repeated visits can sit together. */
  group: string | null;
  lines: RecordLine[];
}

export function formatDuration(ms: number | null | undefined): string {
  if (ms == null || !Number.isFinite(ms) || ms < 0) return '—';
  const total = Math.round(ms / 1000);
  const min = Math.floor(total / 60);
  const sec = total % 60;
  if (min === 0) return `${sec} s`;
  if (sec === 0) return `${min} min`;
  return `${min} min ${sec} s`;
}

export function formatRecordWhen(iso: string | null | undefined): string {
  if (!iso) return '—';
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('lv-LV', {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function yesNo(value: unknown): string {
  if (value === true) return 'Jā';
  if (value === false) return 'Nē';
  return '—';
}

function asText(value: unknown): string {
  if (typeof value === 'string') return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  if (Array.isArray(value)) {
    return value
      .map((item) => asText(item))
      .filter((item) => item !== '')
      .join(', ');
  }
  if (value && typeof value === 'object') {
    return Object.entries(value as Record<string, unknown>)
      .map(([key, item]) => {
        const text = asText(item);
        return text ? `${key}: ${text}` : '';
      })
      .filter(Boolean)
      .join('; ');
  }
  return '';
}

function line(label: string, value: unknown): RecordLine | null {
  const text = asText(value);
  if (!text) return null;
  return { label, text };
}

function marked(
  label: string,
  value: unknown,
): RecordLine | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return line(label, value);
  }
  const row = value as { text?: unknown; highlights?: unknown };
  if (typeof row.text !== 'string' || row.text.trim() === '') return null;
  const highlights = Array.isArray(row.highlights)
    ? row.highlights.flatMap((item) => {
        if (!item || typeof item !== 'object') return [];
        const mark = item as { start?: unknown; end?: unknown };
        if (typeof mark.start !== 'number' || typeof mark.end !== 'number') {
          return [];
        }
        return [{ start: mark.start, end: mark.end }];
      })
    : [];
  return { label, text: row.text, highlights };
}

function keep(items: Array<RecordLine | null>): RecordLine[] {
  return items.filter((item): item is RecordLine => item != null);
}

function markWords(words: string[], markedWords: ReadonlySet<string>): RecordLine {
  let text = '';
  const highlights: TextMark[] = [];
  words.forEach((word, index) => {
    if (index > 0) text += ', ';
    const start = text.length;
    text += word;
    if (markedWords.has(word)) highlights.push({ start, end: text.length });
  });
  return { label: 'Vārdi', text, highlights };
}

function recordOf(detail: unknown): Record<string, unknown> | null {
  if (!detail || typeof detail !== 'object' || Array.isArray(detail)) return null;
  return detail as Record<string, unknown>;
}

function presentBody(detail: Record<string, unknown>): {
  group: string | null;
  lines: RecordLine[];
} | null {
  const kind = detail.kind;
  const duration = line('Laiks', formatDuration(detail.activeMs as number));

  switch (kind) {
    case 'word_reading':
      return {
        group: asText(detail.word) || null,
        lines: keep([duration]),
      };
    case 'image_word':
    case 'sentence_completion':
      return {
        group: null,
        lines: keep([
          duration,
          marked('Teikums', detail.sentence),
          line('Sakrita', yesNo(detail.exact)),
          line('Piedāvāts', detail.offered),
        ]),
      };
    case 'sentence_completion_multi':
      return {
        group: null,
        lines: keep([
          duration,
          marked('Teikums', detail.sentence),
          line('Sakrita', yesNo(detail.exact)),
          line(
            'Piedāvāts',
            Array.isArray(detail.offered)
              ? detail.offered.map((answers, index) => `${index + 1}: ${asText(answers)}`).join(' · ')
              : detail.offered,
          ),
        ]),
      };
    case 'word_choice': {
      const options = Array.isArray(detail.options)
        ? detail.options.filter((item): item is string => typeof item === 'string')
        : [];
      const correct = new Set(
        Array.isArray(detail.correct)
          ? detail.correct.filter((item): item is string => typeof item === 'string')
          : [],
      );
      return {
        group: null,
        lines: keep([
          duration,
          line('Jautājums', detail.question),
          options.length > 0 ? markWords(options, correct) : null,
          line('Izvēle', detail.selected),
          line('Pareizi', yesNo(detail.exact)),
          typeof detail.correctTry === 'number'
            ? line('Izdevās', `${detail.correctTry}. reizē`)
            : null,
        ]),
      };
    }
    case 'reading_comprehension': {
      const questions = Array.isArray(detail.questions) ? detail.questions : [];
      const lines: RecordLine[] = keep([duration]);
      questions.forEach((item, index) => {
        if (!item || typeof item !== 'object') return;
        const question = item as Record<string, unknown>;
        const n = questions.length > 1 ? ` ${index + 1}` : '';
        lines.push(
          ...keep([
            line(`Jautājums${n}`, question.question),
            line('Atbilde', question.entered),
            line('Sakrita', yesNo(question.exact)),
            line('Pareizā', question.offered),
          ]),
        );
      });
      return { group: null, lines };
    }
    case 'sentence_order':
      return {
        group: null,
        lines: keep([
          duration,
          line('Teikums', detail.sentence),
          line('Sakrita', yesNo(detail.exact)),
          line('Piedāvāts', detail.offered),
        ]),
      };
    case 'odd_one_out': {
      const options = Array.isArray(detail.options)
        ? detail.options.filter((item): item is string => typeof item === 'string')
        : [];
      const correctIndex =
        typeof detail.correctIndex === 'number' ? detail.correctIndex : -1;
      const words = markWords(
        options,
        new Set(correctIndex >= 0 && options[correctIndex] ? [options[correctIndex]] : []),
      );
      const selected =
        typeof detail.selectedIndex === 'number'
          ? options[detail.selectedIndex] ?? ''
          : '';
      return {
        group: null,
        lines: keep([
          duration,
          words.text ? words : null,
          line('Izvēle', selected),
          line('Pareizi', yesNo(detail.exact)),
          typeof detail.correctTry === 'number'
            ? line('Izdevās', `${detail.correctTry}. reizē`)
            : null,
        ]),
      };
    }
    case 'antonym':
      return {
        group: asText(detail.word) || null,
        lines: keep([
          duration,
          detail.sentence ? marked('Teikums', detail.sentence) : line('Vārds', detail.word),
          line('Ierakstīts', detail.entered),
          line('Sakrita', yesNo(detail.exact)),
          line('Piedāvāts', detail.offered),
        ]),
      };
    case 'definition_guess':
      return {
        group: null,
        lines: keep([
          duration,
          line('Teksts', detail.given),
          line('Atbilde', detail.entered),
          line('Sakrita', yesNo(detail.exact)),
          line('Piedāvāts', detail.offered),
        ]),
      };
    case 'sentence_image_match':
      return {
        group: null,
        lines: keep([
          duration,
          line('Teksts', detail.text),
          line('Pareizi', yesNo(detail.exact)),
          typeof detail.correctTry === 'number'
            ? line('Izdevās', `${detail.correctTry}. reizē`)
            : null,
        ]),
      };
    case 'sentence_creation':
      return {
        group: null,
        lines: keep([duration, marked('Teikums', detail.sentence)]),
      };
    case 'spelling_check':
      return {
        group: asText(detail.shownWord) || null,
        lines: keep([
          duration,
          line('Vārds', detail.shownWord),
          line('Novērtēja', detail.judgment),
          line('Novērtējums pareizs', yesNo(detail.judgmentCorrect)),
          line('Labojums', detail.correction),
          detail.correctionExact == null
            ? null
            : line('Labojums pareizs', yesNo(detail.correctionExact)),
        ]),
      };
    case 'brand_association':
      return {
        group: asText(detail.brand) || null,
        lines: keep([
          duration,
          line('Zīmols', detail.brand),
          line('Atbilde', detail.entered),
          line('Sakrita', yesNo(detail.exact)),
          line('Piedāvāts', detail.offered),
        ]),
      };
    case 'word_grid':
      return {
        group: asText(detail.word) || null,
        lines: keep([
          duration,
          line('Vārds', detail.word),
          line('Mājiens', yesNo(detail.usedHint)),
          line('Atklāja vārdu', yesNo(detail.revealed)),
        ]),
      };
    default:
      return null;
  }
}

export function presentTaskAttempt(attempt: TaskAttempt): PresentedRecord | null {
  if (attempt.status === 'viewed') return null;
  const detail = recordOf(detailForAttempt(attempt));
  if (!detail) return null;
  const body = presentBody(detail);
  if (!body) return null;
  const at = attempt.completedAt ?? attempt.startedAt;
  return {
    id: attempt.id,
    at,
    when: formatRecordWhen(at),
    group: body.group,
    lines: body.lines,
  };
}

function recallLines(title: string, recall: MemoryRecallRecord | null): RecordLine[] {
  if (!recall) return keep([line(title, 'Nav atbildes')]);
  const free = asText(recall.freeResponse);
  return keep([
    line(title, free || (recall.usedOptions ? 'Izvēlējās variantus' : '—')),
    free ? line('Sakrita', yesNo(recall.exact)) : null,
    line('Pareizā', recall.correctAnswer),
    line('Varianti', recall.usedOptions ? 'Jā' : 'Nē'),
    recall.usedOptions ? line('Varianti pareizi', yesNo(recall.optionExact)) : null,
    recall.usedOptions ? line('Kļūdas variantos', String(recall.optionMisses)) : null,
  ]);
}

export function presentMemorySession(session: MemorySession): PresentedRecord | null {
  if (!session.completedAt && !session.immediate && !session.delayed) return null;
  const record = buildMemoryRecord(session);
  const at = session.completedAt ?? session.startedAt;
  const lines = keep([
    line('Kopā', formatDuration(record.totalMs)),
    line('Iegaumēšana', formatDuration(record.studyMs)),
    line('Klausījās', String(record.listenCount)),
    line('Bilde', String(record.pictureViews)),
    line('Jāiegaumē', record.stimulus),
    ...recallLines(session.mode === 'delayed' ? '1. reize' : 'Atbilde', record.immediate),
  ]);
  if (session.mode === 'delayed') {
    lines.push(
      ...keep([
        line('Starp reizēm', formatDuration(record.gapMs)),
        ...recallLines('2. reize', record.delayed),
      ]),
    );
  }
  return {
    id: session.sessionId,
    at,
    when: formatRecordWhen(at),
    group: null,
    lines,
  };
}

function categoryLabel(category: string | null): string | null {
  if (!category) return null;
  if (category in MEMORY_PAIRS_CATEGORY_LABEL) {
    return MEMORY_PAIRS_CATEGORY_LABEL[category as MemoryPairsCategorySetting];
  }
  return category;
}

export function presentGameSummary(summary: GameSummary): PresentedRecord {
  const grid = summary.grid.replace(/x/g, '×');
  const setting = [grid, `${summary.difficulty}. līmenis`, categoryLabel(summary.category)]
    .filter((item): item is string => Boolean(item))
    .join(' · ');
  const studyMs =
    summary.studiedAt == null
      ? null
      : new Date(summary.studiedAt).getTime() - new Date(summary.startedAt).getTime();
  const totalMs =
    new Date(summary.completedAt).getTime() - new Date(summary.startedAt).getTime();
  const measures = summary.summary;
  const lines: RecordLine[] = keep([
    line('Iestatījums', setting),
    line('Kopā', formatDuration(totalMs)),
    summary.studiedAt ? line('Iegaumēšana', formatDuration(studyMs)) : null,
  ]);

  if ('pairsFound' in measures) {
    lines.push(
      ...keep([
        line('Mēģinājumi', String(measures.attempts)),
        line('Kļūdas', measures.mismatches == null ? '—' : String(measures.mismatches)),
        line('Atrastie pāri', String(measures.pairsFound)),
      ]),
    );
  } else if ('missedCount' in measures) {
    lines.push(
      ...keep([
        line('Pareizās', String(measures.correctCount)),
        line('Izlaistās', String(measures.missedCount)),
        line('Lieka', String(measures.extraCount)),
        line('Pilnīgi pareizi', yesNo(measures.exact)),
      ]),
    );
  } else {
    lines.push(
      ...keep([
        line('Pareizās', `${measures.correctCount} no ${measures.totalCount}`),
        line('Pilnīgi pareizi', yesNo(measures.exact)),
        line('Palīdzība', yesNo(measures.usedHelp)),
        line('Pārvietošanas', String(measures.placementChanges)),
      ]),
    );
  }

  return {
    id: summary.id,
    at: summary.completedAt,
    when: formatRecordWhen(summary.completedAt),
    group: null,
    lines,
  };
}
