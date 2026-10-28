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
  type MemoryDraft,
  type MemoryMode,
  type MemorySession,
} from '../types/memory';
import { pickDistractorIds } from '../utils/memoryDistractors';
import {
  createMemorySession,
  MEMORY_TARGET_DELAY_SECONDS,
  touchSession,
} from '../utils/memoryQueue';
import {
  memoryResponseReady,
  scoreMemoryDraft,
} from '../utils/memoryScore';
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
  const [ready, setReady] = useState(false);
  const [empty, setEmpty] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const sessionRef = useRef<MemorySession | null>(null);
  /** This recall step already has a checked answer. */
  const stepReadyRef = useRef(false);
  /** Saved only when the whole memory task is finished. */
  const savedRef = useRef<MemorySession | null>(null);
  const visualFirst = loadMemoryVisualFirst();

  const commit = (next: MemorySession) => {
    sessionRef.current = next;
    setSession(next);
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
      const unfinished = all.filter(
        (item) =>
          item.mode === mode &&
          item.phase !== 'complete' &&
          item.phase !== 'result',
      );
      for (const item of unfinished) {
        await deleteMemorySession(item.sessionId);
      }
      if (cancel) return;
      const history = all.filter(
        (item) => !unfinished.some((drop) => drop.sessionId === item.sessionId),
      );
      const created = createMemorySession(mode, history);
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
      stepReadyRef.current = false;
      savedRef.current = null;
      sessionRef.current = created;
      setSession(created);
      setEmpty(false);
      setReady(true);
    })();
    return () => {
      cancel = true;
    };
  }, [mode, visualFirst]);

  const showSession = (created: MemorySession | null) => {
    stepReadyRef.current = false;
    savedRef.current = null;
    if (!created) {
      sessionRef.current = null;
      setSession(null);
      setEmpty(true);
      return;
    }
    if (visualFirst) {
      created.visualOpen = true;
      created.visualHelpShown = true;
      created.visualHelpViews = 1;
    }
    sessionRef.current = created;
    setEmpty(false);
    setSession(created);
  };

  const startFresh = async (drop?: MemorySession) => {
    if (drop && savedRef.current?.sessionId !== drop.sessionId) {
      await deleteMemorySession(drop.sessionId);
    }
    const history = await getAllMemorySessions();
    showSession(createMemorySession(mode, history));
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
      commit(touchSession({ ...current, phase: 'distractor_2' }));
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
        commit(touchSession({ ...current, phase: 'extra_offer' }));
        return;
      }
    }
    commit(beginDelayed(current));
  };

  const recordResponse = (draft: MemoryDraft): boolean => {
    if (stepReadyRef.current) return true;
    const current = sessionRef.current;
    if (!current) return false;
    if (
      current.phase !== 'immediate_response' &&
      current.phase !== 'delayed_response'
    ) {
      return false;
    }
    const live = getMemoryTaskById(current.taskId);
    if (!live || live.contentVersion !== current.taskContentVersion) return false;
    if (!memoryResponseReady(live, draft)) return false;
    stepReadyRef.current = true;
    const scored = scoreMemoryDraft(live, draft, 'submit');
    const cued =
      current.mode === 'delayed' &&
      (current.firstResponseCued || scored.recognitionOpened);
    const finishing =
      current.mode === 'immediate' || current.phase === 'delayed_response';
    if (!finishing) {
      const next = touchSession({
        ...current,
        draft,
        immediate: scored,
        firstResponseCued: cued,
      });
      sessionRef.current = next;
      setSession(next);
      return true;
    }
    const finished = touchSession({
      ...current,
      phase: 'complete',
      completedAt: new Date().toISOString(),
      immediate:
        current.phase === 'immediate_response' ? scored : current.immediate,
      delayed: current.phase === 'delayed_response' ? scored : current.delayed,
      firstResponseCued: current.firstResponseCued || cued,
      draft: emptyMemoryDraft(),
    });
    savedRef.current = finished;
    void saveMemorySession(finished);
    void uploadMemorySession(finished);
    const shown = touchSession({
      ...current,
      draft,
      immediate: finished.immediate,
      delayed: finished.delayed,
      firstResponseCued: finished.firstResponseCued,
    });
    sessionRef.current = shown;
    setSession(shown);
    return true;
  };

  const advanceAfterAnswer = () => {
    if (!stepReadyRef.current) return;
    const saved = savedRef.current;
    if (saved) {
      stepReadyRef.current = false;
      savedRef.current = null;
      void (async () => {
        await saveMemorySession(saved);
        const history = await getAllMemorySessions();
        showSession(createMemorySession(mode, history));
      })();
      return;
    }
    const current = sessionRef.current;
    if (!current) return;
    stepReadyRef.current = false;
    const live = getMemoryTaskById(current.taskId);
    const distractorTaskIds =
      current.distractorTaskIds.length > 0
        ? current.distractorTaskIds
        : live
          ? pickDistractorIds(live, 3)
          : [];
    const nextPhase =
      distractorTaskIds.length > 0 ? 'distractor_1' : 'delayed_response';
    const base = touchSession({
      ...current,
      phase: nextPhase,
      distractorTaskIds,
      draft: emptyMemoryDraft(),
    });
    commit(nextPhase === 'delayed_response' ? beginDelayed(base) : base);
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
    if (savedRef.current) {
      advanceAfterAnswer();
      return;
    }
    skipping.current = true;
    sessionRef.current = null;
    stepReadyRef.current = false;
    skipTaskToday(current.taskId);
    void (async () => {
      try {
        await deleteMemorySession(current.sessionId);
        const history = await getAllMemorySessions();
        showSession(createMemorySession(mode, history));
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
          laterRecall={mode === 'delayed'}
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
          onRecord={recordResponse}
          onAdvance={advanceAfterAnswer}
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
                commit(touchSession({ ...session, phase: 'extra_distractor' }))
              }
            >
              Tālāk
            </Button>
            <Button
              variant="secondary"
              onClick={() => commit(beginDelayed(session))}
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
