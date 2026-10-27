import { useEffect, useRef, useState } from 'react';
import { useApp } from '../context/AppContext';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { getMemoryTaskById } from '../data/loadMemory';
import {
  deleteMemorySession,
  getAllMemorySessions,
  saveMemorySession,
} from '../repositories/IndexedDBProgressRepository';
import { uploadMemorySession } from '../repositories/memoryCloud';
import {
  emptyMemoryDraft,
  type MemoryMode,
  type MemorySession,
} from '../types/memory';
import { pickDistractorIds } from '../utils/memoryDistractors';
import {
  createMemorySession,
  MEMORY_INTERRUPT_MS,
  MEMORY_TARGET_DELAY_SECONDS,
  touchSession,
} from '../utils/memoryQueue';
import { scoreMemoryDraft, type MemorySubmitKind } from '../utils/memoryScore';
import { loadMemoryVisualFirst } from '../utils/memoryVisual';
import type { Screen } from '../navigation/types';
import type { MenuSection } from '../utils/sectionPractice';
import { MemoryAnswerStep } from './memory/MemoryAnswerStep';
import { MemoryDistractorStep } from './memory/MemoryDistractorStep';
import { MemoryStudyStep } from './memory/MemoryStudyStep';

interface Props {
  mode: MemoryMode;
  onNavigate: (screen: Screen) => void;
  onHome: () => void;
}

const MODE_LABEL: Record<MemoryMode, string> = {
  immediate: 'Atceries uzreiz',
  delayed: 'Atceries pēc brīža',
};

async function persistNext(
  mode: MemoryMode,
  visualFirst: boolean,
  finished: MemorySession,
): Promise<MemorySession | null> {
  await saveMemorySession(finished);
  void uploadMemorySession(finished);
  const history = await getAllMemorySessions();
  const created = createMemorySession(mode, history);
  if (!created) return null;
  if (visualFirst) {
    created.visualOpen = true;
    created.visualHelpShown = true;
    created.visualHelpViews = 1;
  }
  await saveMemorySession(created);
  return created;
}

function beginDelayed(session: MemorySession): MemorySession {
  const delayedStartedAt = new Date().toISOString();
  const hidden = session.stimulusHiddenAt ?? delayedStartedAt;
  const actualDelaySeconds = Math.max(
    0,
    Math.round(
      (new Date(delayedStartedAt).getTime() - new Date(hidden).getTime()) /
        1000,
    ),
  );
  return touchSession({
    ...session,
    phase: 'delayed_response',
    delayedStartedAt,
    actualDelaySeconds,
    draft: emptyMemoryDraft(),
  });
}

export function MemoryScreen({ mode, onNavigate, onHome }: Props) {
  const { skipTaskToday } = useApp();
  const sectionType: MenuSection =
    mode === 'immediate' ? 'memory_immediate' : 'memory_delayed';
  const skipping = useRef(false);
  const [session, setSession] = useState<MemorySession | null>(null);
  const [resume, setResume] = useState<MemorySession | null>(null);
  const [ready, setReady] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sessionRef = useRef<MemorySession | null>(null);
  const timer = useRef<number | null>(null);
  const visualFirst = loadMemoryVisualFirst();

  const commit = (next: MemorySession, immediate = false) => {
    sessionRef.current = next;
    setSession(next);
    if (timer.current != null) window.clearTimeout(timer.current);
    const write = () => {
      void saveMemorySession(next);
    };
    if (immediate) write();
    else timer.current = window.setTimeout(write, 160);
  };

  useEffect(() => {
    let cancel = false;
    void (async () => {
      let all: MemorySession[];
      try {
        all = await getAllMemorySessions();
      } catch (err) {
        if (cancel) return;
        setLoadError(
          err instanceof Error ? err.message : 'Neizdevās atvērt saglabātās sesijas.',
        );
        setReady(true);
        return;
      }
      if (cancel) return;
      const opens = all
        .filter((item) => item.mode === mode && item.phase !== 'complete')
        .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
      for (const extra of opens.slice(1)) {
        await deleteMemorySession(extra.sessionId);
      }
      const open = opens[0];
      if (!open) {
        const created = createMemorySession(mode, all);
        if (!created) {
          setEmpty(true);
          setReady(true);
          return;
        }
        if (visualFirst) {
          created.visualOpen = true;
          created.visualHelpShown = true;
          created.visualHelpViews = 1;
        }
        await saveMemorySession(created);
        if (cancel) return;
        sessionRef.current = created;
        setSession(created);
        setReady(true);
        return;
      }
      if (open.phase === 'result') {
        const finished = touchSession({
          ...open,
          phase: 'complete',
          completedAt: open.completedAt ?? new Date().toISOString(),
          draft: emptyMemoryDraft(),
        });
        const created = await persistNext(mode, visualFirst, finished);
        if (cancel) return;
        if (!created) {
          setEmpty(true);
          setReady(true);
          return;
        }
        sessionRef.current = created;
        setSession(created);
        setReady(true);
        return;
      }
      const gap = Date.now() - new Date(open.updatedAt).getTime();
      if (gap > MEMORY_INTERRUPT_MS) {
        setResume(open);
        setReady(true);
        return;
      }
      sessionRef.current = open;
      setSession(open);
      setReady(true);
    })();
    return () => {
      cancel = true;
      if (timer.current != null) window.clearTimeout(timer.current);
      if (sessionRef.current) void saveMemorySession(sessionRef.current);
    };
  }, [mode, visualFirst]);

  const startFresh = async (drop?: MemorySession) => {
    if (drop) await deleteMemorySession(drop.sessionId);
    const history = await getAllMemorySessions();
    const created = createMemorySession(mode, history);
    if (!created) {
      setEmpty(true);
      setSession(null);
      setResume(null);
      return;
    }
    if (visualFirst) {
      created.visualOpen = true;
      created.visualHelpShown = true;
      created.visualHelpViews = 1;
    }
    await saveMemorySession(created);
    sessionRef.current = created;
    setResume(null);
    setEmpty(false);
    setSession(created);
  };

  if (loadError) {
    return (
      <Layout onHome={onHome} sectionType={sectionType} onNavigate={onNavigate}>
        <div className="memory-flow">
          <h1 className="memory-heading">{MODE_LABEL[mode]}</h1>
          <p className="memory-note" role="alert">
            {loadError}
          </p>
          <Button variant="primary" onClick={onHome}>
            Uz sākumu
          </Button>
        </div>
      </Layout>
    );
  }

  if (!ready) {
    return (
      <Layout onHome={onHome} sectionType={sectionType} onNavigate={onNavigate}>
        <p className="lead">Ielādē…</p>
      </Layout>
    );
  }

  if (resume) {
    return (
      <Layout onHome={onHome} sectionType={sectionType} onNavigate={onNavigate}>
        <div className="memory-flow">
          <h1 className="memory-heading">{MODE_LABEL[mode]}</h1>
          <p className="memory-instruction">
            Iepriekšējā reize bija pārtraukta. Varat turpināt vai sākt no jauna.
          </p>
          <div className="memory-actions">
            <Button
              variant="primary"
              onClick={() => {
                const next = touchSession({ ...resume, interrupted: true });
                setResume(null);
                commit(next, true);
              }}
            >
              Turpināt
            </Button>
            <Button variant="secondary" onClick={() => void startFresh(resume)}>
              Sākt no jauna
            </Button>
          </div>
        </div>
      </Layout>
    );
  }

  if (empty || !session) {
    return (
      <Layout onHome={onHome} sectionType={sectionType} onNavigate={onNavigate}>
        <div className="memory-flow">
          <h1 className="memory-heading">{MODE_LABEL[mode]}</h1>
          <p className="memory-instruction">
            Šiem grūtības līmeņiem nav uzdevumu. Nomainiet līmeni sadaļā
            Pielāgot saturu.
          </p>
          <Button variant="primary" onClick={onHome}>
            Uz sākumu
          </Button>
        </div>
      </Layout>
    );
  }

  const task = getMemoryTaskById(session.taskId);
  if (!task || task.contentVersion !== session.taskContentVersion) {
    return (
      <Layout onHome={onHome} sectionType={sectionType} onNavigate={onNavigate}>
        <div className="memory-flow">
          <p className="memory-instruction">Šis uzdevums vairs nav pieejams.</p>
          <Button variant="primary" onClick={() => void startFresh(session)}>
            Nākamais
          </Button>
        </div>
      </Layout>
    );
  }

  const distractorIndex =
    session.phase === 'distractor_1'
      ? 0
      : session.phase === 'distractor_2'
        ? 1
        : session.phase === 'extra_distractor'
          ? 2
          : -1;

  const afterDistractor = () => {
    const current = sessionRef.current;
    if (!current) return;
    if (
      current.phase === 'distractor_1' &&
      current.distractorTaskIds[1]
    ) {
      commit(touchSession({ ...current, phase: 'distractor_2' }), true);
      return;
    }
    if (
      (current.phase === 'distractor_1' || current.phase === 'distractor_2') &&
      current.distractorTaskIds[2]
    ) {
      const hidden = current.stimulusHiddenAt
        ? new Date(current.stimulusHiddenAt).getTime()
        : Date.now();
      const elapsed = (Date.now() - hidden) / 1000;
      if (elapsed < MEMORY_TARGET_DELAY_SECONDS) {
        commit(touchSession({ ...current, phase: 'extra_offer' }), true);
        return;
      }
    }
    commit(beginDelayed(current), true);
  };

  const submitAnswer = (kind: MemorySubmitKind) => {
    const current = sessionRef.current ?? session;
    const scored = scoreMemoryDraft(task, current.draft, kind);
    if (current.phase === 'immediate_response') {
      const cued =
        current.mode === 'delayed' &&
        (current.firstResponseCued || scored.recognitionOpened);
      if (current.mode === 'immediate') {
        const finished = touchSession({
          ...current,
          phase: 'complete',
          completedAt: new Date().toISOString(),
          immediate: scored,
          firstResponseCued: cued,
          draft: emptyMemoryDraft(),
        });
        sessionRef.current = finished;
        setSession(finished);
        void persistNext(mode, visualFirst, finished).then((created) => {
          if (!created) {
            sessionRef.current = finished;
            setSession(null);
            setEmpty(true);
            return;
          }
          sessionRef.current = created;
          setSession(created);
        });
        return;
      }
      const distractorTaskIds = pickDistractorIds(task, 3);
      const nextPhase =
        distractorTaskIds.length > 0 ? 'distractor_1' : 'delayed_response';
      const base = touchSession({
        ...current,
        phase: nextPhase,
        immediate: scored,
        firstResponseCued: cued,
        distractorTaskIds,
        draft: emptyMemoryDraft(),
      });
      commit(nextPhase === 'delayed_response' ? beginDelayed(base) : base, true);
      return;
    }
    const finished = touchSession({
      ...current,
      phase: 'complete',
      completedAt: new Date().toISOString(),
      delayed: scored,
      draft: emptyMemoryDraft(),
    });
    sessionRef.current = finished;
    setSession(finished);
    void persistNext(mode, visualFirst, finished).then((created) => {
      if (!created) {
        sessionRef.current = finished;
        setSession(null);
        setEmpty(true);
        return;
      }
      sessionRef.current = created;
      setSession(created);
    });
  };

  const skipCurrent = () => {
    if (skipping.current) return;
    const current = sessionRef.current;
    if (!current) return;
    if (
      current.phase !== 'study' &&
      current.phase !== 'immediate_response' &&
      current.phase !== 'delayed_response'
    ) {
      return;
    }
    skipping.current = true;
    if (timer.current != null) {
      window.clearTimeout(timer.current);
      timer.current = null;
    }
    sessionRef.current = null;
    skipTaskToday(current.taskId);
    void (async () => {
      try {
        await deleteMemorySession(current.sessionId);
        const history = await getAllMemorySessions();
        const created = createMemorySession(mode, history);
        if (!created) {
          setSession(null);
          setEmpty(true);
          return;
        }
        if (visualFirst) {
          created.visualOpen = true;
          created.visualHelpShown = true;
          created.visualHelpViews = 1;
        }
        await saveMemorySession(created);
        sessionRef.current = created;
        setResume(null);
        setEmpty(false);
        setSession(created);
      } finally {
        skipping.current = false;
      }
    })();
  };

  return (
    <Layout onHome={onHome} sectionType={sectionType} onNavigate={onNavigate}>
      {session.phase === 'study' ? (
        <MemoryStudyStep
          task={task}
          visualOpen={session.visualOpen}
          onPlayed={() => {
            const current = sessionRef.current;
            if (!current) return;
            commit(
              touchSession({
                ...current,
                ttsPlayCount: current.ttsPlayCount + 1,
              }),
            );
          }}
          onVisual={(open) => {
            const current = sessionRef.current;
            if (!current) return;
            const opening = open && !current.visualOpen;
            commit(
              touchSession({
                ...current,
                visualOpen: open,
                visualHelpShown: current.visualHelpShown || open,
                visualHelpViews: current.visualHelpViews + (opening ? 1 : 0),
              }),
            );
          }}
          onReady={() => {
            const current = sessionRef.current;
            if (!current) return;
            commit(
              touchSession({
                ...current,
                phase: 'immediate_response',
                visualOpen: false,
                stimulusHiddenAt: new Date().toISOString(),
                draft: emptyMemoryDraft(),
              }),
              true,
            );
          }}
          onSkip={skipCurrent}
        />
      ) : null}

      {session.phase === 'immediate_response' ||
      session.phase === 'delayed_response' ? (
        <MemoryAnswerStep
          key={`${session.sessionId}-${session.phase}`}
          task={task}
          draft={session.draft}
          allowReveal={
            !(session.mode === 'delayed' && session.phase === 'immediate_response')
          }
          recallCue={session.phase === 'delayed_response'}
          onDraft={(recipe) => {
            const current = sessionRef.current;
            if (!current) return;
            const draft = recipe(current.draft);
            const cued =
              current.mode === 'delayed' &&
              current.phase === 'immediate_response' &&
              draft.recognitionOpen;
            commit(
              touchSession({
                ...current,
                draft,
                firstResponseCued: current.firstResponseCued || cued,
              }),
            );
          }}
          onSubmit={submitAnswer}
          onSkip={skipCurrent}
        />
      ) : null}

      {distractorIndex >= 0 ? (
        <MemoryDistractorStep
          key={session.distractorTaskIds[distractorIndex] ?? distractorIndex}
          taskId={session.distractorTaskIds[distractorIndex] ?? ''}
          snapshot={session.distractors.find(
            (item) =>
              item.taskId === session.distractorTaskIds[distractorIndex],
          )}
          onSnapshot={(snapshot) => {
            const current = sessionRef.current;
            if (!current) return;
            const others = current.distractors.filter(
              (item) => item.taskId !== snapshot.taskId,
            );
            commit(
              touchSession({
                ...current,
                distractors: [...others, snapshot],
              }),
            );
          }}
          onDone={afterDistractor}
        />
      ) : null}

      {session.phase === 'extra_offer' ? (
        <div className="memory-flow">
          <h1 className="memory-heading">Vēl īss uzdevums</h1>
          <p className="memory-instruction">
            Pēc tā varēsiet atcerēties vēlreiz. Varat arī atcerēties tagad.
          </p>
          <div className="memory-actions">
            <Button
              variant="primary"
              onClick={() =>
                commit(
                  touchSession({ ...session, phase: 'extra_distractor' }),
                  true,
                )
              }
            >
              Tālāk
            </Button>
            <Button
              variant="secondary"
              onClick={() => commit(beginDelayed(session), true)}
            >
              Atcerēties tagad
            </Button>
          </div>
        </div>
      ) : null}

      {session.phase === 'complete' ? <p className="lead">Ielādē…</p> : null}
    </Layout>
  );
}
