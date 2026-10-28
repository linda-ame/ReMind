import { useEffect, useId, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import type { Screen } from '../../navigation/types';
import {
  beginRecall,
  patternCells,
  submitAnswer,
  toggleCell,
} from '../../memoryPattern/gameplay';
import { patternCellSize } from '../../memoryPattern/layout';
import {
  beginMemoryPatternGame,
  markPatternResultHintSeen,
  openMemoryPatternSession,
  saveMemoryPatternGame,
} from '../../memoryPattern/repository';
import {
  DEFAULT_MEMORY_PATTERN_SETTINGS,
  patternStatusLine,
  type MemoryPatternGame as Game,
  type MemoryPatternSettings as Settings,
} from '../../memoryPattern/types';
import { MemoryPatternGrid } from './MemoryPatternGrid';
import { MemoryPatternResults } from './MemoryPatternResults';
import { MemoryPatternSettings } from './MemoryPatternSettings';
import './memoryPattern.css';

interface MemoryPatternGameProps {
  onHome: () => void;
  onNavigate: (screen: Screen) => void;
}

export function MemoryPatternGame({ onHome, onNavigate }: MemoryPatternGameProps) {
  const instructionId = useId();
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_MEMORY_PATTERN_SETTINGS);
  const [configured, setConfigured] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [confirmEmpty, setConfirmEmpty] = useState(false);
  const [live, setLive] = useState('');
  const [showResultHint, setShowResultHint] = useState(false);
  const hintSeen = useRef(false);
  const [cellSize, setCellSize] = useState(96);
  const wrapRef = useRef<HTMLDivElement>(null);
  const starting = useRef(false);
  const gameRef = useRef<Game | null>(null);
  gameRef.current = game;

  useEffect(() => {
    let liveLoad = true;
    setReady(false);
    setFailed(false);
    void openMemoryPatternSession()
      .then((session) => {
        if (!liveLoad) return;
        setSettings(session.settings);
        setConfigured(!session.showSettings);
        setGame(session.game);
        setShowSettings(session.showSettings);
        hintSeen.current = session.resultHintSeen;
        setShowResultHint(
          session.game?.phase === 'result' && !session.resultHintSeen,
        );
        if (session.game?.phase === 'result' && !session.resultHintSeen) {
          hintSeen.current = true;
          void markPatternResultHintSeen();
        }
        setReady(true);
      })
      .catch((error: unknown) => {
        console.error(error);
        if (!liveLoad) return;
        setFailed(true);
        setReady(true);
      });
    return () => {
      liveLoad = false;
    };
  }, [attempt]);

  const columns = game?.cols ?? 3;
  const rows = game?.rows ?? 2;
  const playing = ready && !showSettings && !failed && game != null;

  useLayoutEffect(() => {
    if (!playing) return;
    const measure = () => {
      const wrap = wrapRef.current;
      if (!wrap?.isConnected) return;
      const scale =
        Number(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--content-scale',
          ),
        ) || 1;
      const main = wrap.closest('.app-main');
      const footer = wrap.closest('.app-shell')?.querySelector('.app-footer');
      const scrolled = main?.scrollTop ?? 0;
      const footerTop =
        footer instanceof HTMLElement
          ? footer.getBoundingClientRect().top
          : window.innerHeight;
      const room = footerTop - (wrap.getBoundingClientRect().top + scrolled);
      setCellSize(
        patternCellSize({
          columns,
          rows,
          availableWidth: wrap.clientWidth || window.innerWidth - 32,
          availableHeight: Math.max(64, room - 8),
          contentScale: scale,
        }),
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (wrapRef.current) observer.observe(wrapRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [playing, columns, rows, game?.id, game?.phase]);

  const startNew = (draft: Settings) => {
    if (starting.current) return;
    starting.current = true;
    void beginMemoryPatternGame(draft)
      .then((created) => {
        setSettings(draft);
        setConfigured(true);
        setGame(created);
        setShowSettings(false);
        setConfirmEmpty(false);
        setShowResultHint(false);
        setLive('');
      })
      .catch(() => setFailed(true))
      .finally(() => {
        starting.current = false;
      });
  };

  const remember = () => {
    const current = gameRef.current;
    if (!current) return;
    const next = beginRecall(current);
    if (next === current) return;
    gameRef.current = next;
    setGame(next);
    void saveMemoryPatternGame(next);
    setLive('Režģis ir tukšs. Atzīmē iekrāsotās rūtiņas.');
    setConfirmEmpty(false);
  };

  const mark = (index: number) => {
    const current = gameRef.current;
    if (!current) return;
    const next = toggleCell(current, index);
    if (next === current) return;
    gameRef.current = next;
    setGame(next);
    void saveMemoryPatternGame(next);
    const cell = patternCells(next).find((item) => item.index === index);
    setLive(cell?.label ?? '');
    setConfirmEmpty(false);
  };

  const check = (allowEmpty: boolean) => {
    const current = gameRef.current;
    if (!current) return;
    if (!allowEmpty && current.selected.length === 0) {
      setConfirmEmpty(true);
      return;
    }
    const next = submitAnswer(current);
    if (next === current) return;
    gameRef.current = next;
    setGame(next);
    void saveMemoryPatternGame(next);
    setConfirmEmpty(false);
    const firstResult = !hintSeen.current;
    if (firstResult) {
      hintSeen.current = true;
      setShowResultHint(true);
      void markPatternResultHintSeen();
    }
    setLive(firstResult ? 'Zaļa — pareizi. Sarkana — nepareizi novietota.' : '');
  };

  if (!ready) {
    return (
      <Layout onHome={onHome} onNavigate={onNavigate} sectionType="memory_pattern">
        <p className="lead">Ielādē…</p>
      </Layout>
    );
  }

  if (failed) {
    return (
      <Layout onHome={onHome} onNavigate={onNavigate} sectionType="memory_pattern">
        <div className="pattern-screen">
          <p className="pattern-note" role="alert">
            Neizdevās atvērt spēli.
          </p>
          <Button variant="primary" onClick={() => setAttempt((value) => value + 1)}>
            Mēģināt vēlreiz
          </Button>
        </div>
      </Layout>
    );
  }

  if (showSettings || !game) {
    return (
      <MemoryPatternSettings
        initial={settings}
        configured={configured}
        unfinished={game?.status === 'in_progress'}
        onHome={onHome}
        onNavigate={onNavigate}
        onStart={startNew}
        onContinue={() => {
          setShowSettings(false);
          setConfirmEmpty(false);
        }}
      />
    );
  }

  const instruction =
    game.phase === 'memorize'
      ? 'Iegaumē iekrāsotās rūtiņas.'
      : 'Atzīmē rūtiņas, kuras bija iekrāsotas.';

  const footer = confirmEmpty ? (
    <div className="pattern-confirm">
      <p>Nav atzīmēta neviena rūtiņa.</p>
      <Button variant="primary" onClick={() => check(true)}>
        Jā, pārbaudīt
      </Button>
      <Button variant="secondary" onClick={() => setConfirmEmpty(false)}>
        Atpakaļ
      </Button>
    </div>
  ) : game.phase === 'memorize' ? (
    <Button variant="primary" onClick={remember}>
      Esmu iegaumējis
    </Button>
  ) : game.phase === 'recall' ? (
    <Button variant="primary" onClick={() => check(false)}>
      Pārbaudīt
    </Button>
  ) : (
    <Button variant="primary" onClick={() => startNew(settings)}>
      Nākamā spēle
    </Button>
  );

  return (
    <Layout
      onHome={onHome}
      onNavigate={onNavigate}
      sectionType="memory_pattern"
      footer={footer}
    >
      <div className="pattern-screen pattern-play">
        <div className="pattern-head">
          <p className="pattern-meta">{patternStatusLine(game.grid, game.difficulty)}</p>
          <button
            type="button"
            className="pattern-settings-link"
            aria-label="Mainīt iestatījumus"
            onClick={() => setShowSettings(true)}
          >
            Mainīt
          </button>
        </div>
        {game.phase === 'result' ? (
          <MemoryPatternResults
            game={game}
            cellSize={cellSize}
            showHint={showResultHint}
            wrapRef={wrapRef}
          />
        ) : (
          <>
            <p id={instructionId} className="pattern-instruction">
              {instruction}
            </p>
            <div className="pattern-grid-wrap" ref={wrapRef}>
              <MemoryPatternGrid
                cells={patternCells(game)}
                columns={game.cols}
                cellSize={cellSize}
                onToggle={game.phase === 'recall' ? mark : undefined}
              />
            </div>
          </>
        )}
        <p className="pattern-live" aria-live="polite">
          {live}
        </p>
      </div>
    </Layout>
  );
}
