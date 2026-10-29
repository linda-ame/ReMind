import { useEffect, useState, type ReactNode } from 'react';
import { Button } from '../components/Button';
import { Layout } from '../components/Layout';
import { useApp } from '../context/AppContext';
import { getTaskById } from '../data/loadTasks';
import {
  pairsResultSummary,
  patternSummary,
  positionsSummary,
} from '../games/summary';
import { listMemoryPairsResults } from '../memoryPairs/repository';
import { listMemoryPatternGames } from '../memoryPattern/repository';
import { listMemoryPositionsGames } from '../memoryPositions/repository';
import { getAllMemorySessions } from '../repositories/IndexedDBProgressRepository';
import {
  presentGameSummary,
  presentMemorySession,
  presentTaskAttempt,
  type PresentedRecord,
  type RecordLine,
} from '../tasks/presentRecord';
import type { Screen } from '../navigation/types';
import {
  menuSectionLabel,
  menuSectionType,
  menuSections,
  type MenuSection,
} from '../utils/sectionPractice';

interface ListProps {
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

interface DetailProps {
  section: MenuSection;
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

function RecordText({ line }: { line: RecordLine }) {
  const marks = [...(line.highlights ?? [])].sort((a, b) => a.start - b.start);
  if (marks.length === 0) return <>{line.text}</>;
  const parts: ReactNode[] = [];
  let cursor = 0;
  marks.forEach((mark, index) => {
    const start = Math.max(cursor, Math.min(mark.start, line.text.length));
    const end = Math.max(start, Math.min(mark.end, line.text.length));
    if (start > cursor) parts.push(line.text.slice(cursor, start));
    if (end > start) {
      parts.push(
        <mark key={`${index}-${start}`} className="record-mark">
          {line.text.slice(start, end)}
        </mark>,
      );
    }
    cursor = end;
  });
  if (cursor < line.text.length) parts.push(line.text.slice(cursor));
  return <>{parts}</>;
}

function RecordCard({
  title,
  records,
}: {
  title: string;
  records: PresentedRecord[];
}) {
  const single = records.length === 1 && records[0]?.group == null;
  return (
    <article className="record-card">
      <h2 className="record-card-title">{title}</h2>
      {records.map((record) => (
        <div key={record.id} className="record-visit">
          {single ? null : <p className="record-when">{record.when}</p>}
          <dl className="record-lines">
            {record.lines.map((item, index) => (
              <div key={`${record.id}-${index}`} className="record-line">
                <dt>{item.label}</dt>
                <dd>
                  <RecordText line={item} />
                </dd>
              </div>
            ))}
          </dl>
        </div>
      ))}
    </article>
  );
}

function arrange(records: PresentedRecord[]): { title: string; records: PresentedRecord[] }[] {
  const grouped = records.some((record) => record.group);
  if (!grouped) {
    return [...records]
      .sort((a, b) => b.at.localeCompare(a.at))
      .map((record) => ({ title: record.when, records: [record] }));
  }
  const byGroup = new Map<string, PresentedRecord[]>();
  for (const record of records) {
    const key = record.group ?? record.id;
    const list = byGroup.get(key) ?? [];
    list.push(record);
    byGroup.set(key, list);
  }
  return [...byGroup.entries()]
    .map(([title, items]) => ({
      title,
      records: items.sort((a, b) => a.at.localeCompare(b.at)),
      latest: items.reduce((max, item) => (item.at > max ? item.at : max), ''),
    }))
    .sort((a, b) => b.latest.localeCompare(a.latest))
    .map(({ title, records: items }) => ({ title, records: items }));
}

export function ProgressRecordsScreen({ onNavigate, onBack, onHome }: ListProps) {
  const { loadAllAttempts } = useApp();
  const [counts, setCounts] = useState<Map<MenuSection, number> | null>(null);

  useEffect(() => {
    let live = true;
    void (async () => {
      const [attempts, sessions, pairs, patterns, positions] = await Promise.all([
        loadAllAttempts(),
        getAllMemorySessions(),
        listMemoryPairsResults(),
        listMemoryPatternGames(),
        listMemoryPositionsGames(),
      ]);
      if (!live) return;
      const next = new Map<MenuSection, number>();
      for (const attempt of attempts) {
        const task = getTaskById(attempt.taskId);
        if (!task || !presentTaskAttempt(attempt)) continue;
        const section = menuSectionType(task.type);
        next.set(section, (next.get(section) ?? 0) + 1);
      }
      for (const session of sessions) {
        if (!presentMemorySession(session)) continue;
        const section = session.mode === 'delayed' ? 'memory_delayed' : 'memory_immediate';
        next.set(section, (next.get(section) ?? 0) + 1);
      }
      next.set(
        'memory_pairs',
        pairs.filter((result) => pairsResultSummary(result)).length,
      );
      next.set(
        'memory_pattern',
        patterns.filter((game) => patternSummary(game)).length,
      );
      next.set(
        'memory_positions',
        positions.filter((game) => positionsSummary(game)).length,
      );
      setCounts(next);
    })();
    return () => {
      live = false;
    };
  }, [loadAllAttempts]);

  return (
    <Layout onHome={onHome}>
      <div className="account-panel stack">
        <p className="lead account-copy">Progress</p>
        {counts == null ? (
          <p className="muted">Ielādē…</p>
        ) : (
          <div className="record-section-list">
            {menuSections().map((section) => {
              const count = counts.get(section) ?? 0;
              return (
                <button
                  key={section}
                  type="button"
                  className={`record-section-btn home-type-${section}`}
                  onClick={() => onNavigate({ name: 'progress_record', section })}
                >
                  <span>{menuSectionLabel(section)}</span>
                  <span className="record-section-count">{count}</span>
                </button>
              );
            })}
          </div>
        )}
        <Button variant="neutral" onClick={onBack}>
          Atpakaļ uz kontu
        </Button>
      </div>
    </Layout>
  );
}

export function ProgressRecordScreen({
  section,
  onNavigate,
  onBack,
  onHome,
}: DetailProps) {
  const { loadAllAttempts } = useApp();
  const [view, setView] = useState<{
    section: MenuSection;
    records: PresentedRecord[];
  } | null>(null);
  const records = view?.section === section ? view.records : null;

  useEffect(() => {
    let live = true;
    const main = document.querySelector('.app-main');
    if (main instanceof HTMLElement) main.scrollTop = 0;
    void (async () => {
      let next: PresentedRecord[] = [];
      if (section === 'memory_immediate' || section === 'memory_delayed') {
        const sessions = await getAllMemorySessions();
        next = sessions
          .filter((session) =>
            section === 'memory_delayed'
              ? session.mode === 'delayed'
              : session.mode === 'immediate',
          )
          .flatMap((session) => {
            const presented = presentMemorySession(session);
            return presented ? [presented] : [];
          });
      } else if (section === 'memory_pairs') {
        const results = await listMemoryPairsResults();
        next = results.flatMap((result) => {
          const summary = pairsResultSummary(result);
          return summary ? [presentGameSummary(summary)] : [];
        });
      } else if (section === 'memory_pattern') {
        const games = await listMemoryPatternGames();
        next = games.flatMap((game) => {
          const summary = patternSummary(game);
          return summary ? [presentGameSummary(summary)] : [];
        });
      } else if (section === 'memory_positions') {
        const games = await listMemoryPositionsGames();
        next = games.flatMap((game) => {
          const summary = positionsSummary(game);
          return summary ? [presentGameSummary(summary)] : [];
        });
      } else {
        const attempts = await loadAllAttempts();
        next = attempts.flatMap((attempt) => {
          const task = getTaskById(attempt.taskId);
          if (!task || menuSectionType(task.type) !== section) return [];
          const presented = presentTaskAttempt(attempt);
          return presented ? [presented] : [];
        });
      }
      if (live) setView({ section, records: next });
    })();
    return () => {
      live = false;
    };
  }, [loadAllAttempts, section]);

  const cards = records ? arrange(records) : [];

  return (
    <Layout
      onHome={onHome}
      sectionType={section}
      onOpenSection={(next) =>
        onNavigate({ name: 'progress_record', section: next })
      }
    >
      <div className="account-panel stack">
        {records == null ? (
          <p className="muted">Ielādē…</p>
        ) : cards.length === 0 ? (
          <p className="muted">Šajā sadaļā vēl nav saglabātu reižu.</p>
        ) : (
          <div className="record-list">
            {cards.map((card) => (
              <RecordCard
                key={`${card.title}-${card.records[0]?.id ?? ''}`}
                title={card.title}
                records={card.records}
              />
            ))}
          </div>
        )}
        <Button variant="neutral" onClick={onBack}>
          Atpakaļ
        </Button>
      </div>
    </Layout>
  );
}
