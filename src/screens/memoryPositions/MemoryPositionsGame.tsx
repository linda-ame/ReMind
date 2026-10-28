import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import {
  allPlaced,
  beginRecall,
  finishWithHelp,
  gridCells,
  remainingCount,
  selectSymbol,
  submitAnswer,
  swapSymbols,
  tapCell,
} from '../../memoryPositions/gameplay';
import { positionsCellSize, positionsTraySize } from '../../memoryPositions/layout';
import {
  beginMemoryPositionsGame,
  markPositionsInstructionSeen,
  openMemoryPositionsSession,
  saveMemoryPositionsGame,
} from '../../memoryPositions/repository';
import {
  DEFAULT_MEMORY_POSITIONS_SETTINGS,
  positionsStatusLine,
  type MemoryPositionsGame as Game,
  type MemoryPositionsSettings as Settings,
} from '../../memoryPositions/types';
import type { Screen } from '../../navigation/types';
import { MemoryPositionsGrid } from './MemoryPositionsGrid';
import { MemoryPositionsResults } from './MemoryPositionsResults';
import { MemoryPositionsSettings } from './MemoryPositionsSettings';
import { MemoryPositionsSymbolPicker } from './MemoryPositionsSymbolPicker';
import './memoryPositions.css';

interface MemoryPositionsGameProps {
  onHome: () => void;
  onNavigate: (screen: Screen) => void;
}

function symbolLabel(game: Game, symbolId: string | null): string {
  return game.symbols.find((symbol) => symbol.id === symbolId)?.label ?? 'figūra';
}

export function MemoryPositionsGame({ onHome, onNavigate }: MemoryPositionsGameProps) {
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_MEMORY_POSITIONS_SETTINGS);
  const [configured, setConfigured] = useState(false);
  const [game, setGame] = useState<Game | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [showInstruction, setShowInstruction] = useState(false);
  const [showResultKey, setShowResultKey] = useState(false);
  const [swapCell, setSwapCell] = useState<number | null>(null);
  const [confirmHelp, setConfirmHelp] = useState(false);
  const [live, setLive] = useState('');
  const [cellSize, setCellSize] = useState(96);
  const [tray, setTray] = useState({ size: 96, height: 96, columns: 2, rows: 1 });
  const wrapRef = useRef<HTMLDivElement>(null);
  const playRef = useRef<HTMLDivElement>(null);
  const sizedFor = useRef<{ id: string; width: number } | null>(null);
  const starting = useRef(false);
  const gameRef = useRef<Game | null>(null);

  useEffect(() => {
    let liveLoad = true;
    setReady(false);
    setFailed(false);
    void openMemoryPositionsSession()
      .then((session) => {
        if (!liveLoad) return;
        setSettings(session.settings);
        setConfigured(!session.showSettings);
        gameRef.current = session.game;
        setGame(session.game);
        setShowSettings(session.showSettings);
        const firstResult = session.game?.phase === 'result' && session.showInstruction;
        setShowInstruction(session.showInstruction && !firstResult);
        setShowResultKey(firstResult);
        if (firstResult) void markPositionsInstructionSeen();
        setSwapCell(null);
        setConfirmHelp(false);
        setLive('');
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
  const figureCount = game?.symbols.length ?? 2;

  useLayoutEffect(() => {
    if (!playing) return;
    const measure = () => {
      const wrap = wrapRef.current;
      const play = playRef.current;
      if (!wrap?.isConnected || !play) return;
      const scale =
        Number(
          getComputedStyle(document.documentElement).getPropertyValue('--content-scale'),
        ) || 1;
      const width = play.clientWidth || window.innerWidth - 32;
      const gameId = game?.id ?? '';
      if (
        sizedFor.current?.id === gameId &&
        Math.abs(sizedFor.current.width - width) < 12
      ) {
        return;
      }
      const footer = wrap.closest('.app-shell')?.querySelector('.app-footer');
      const footerTop =
        footer instanceof HTMLElement ? footer.getBoundingClientRect().top : window.innerHeight;
      if (footerTop < wrap.getBoundingClientRect().top + 120) return;
      const nextTray = positionsTraySize(figureCount, width, scale);
      setTray((current) =>
        current.size === nextTray.size &&
        current.height === nextTray.height &&
        current.columns === nextTray.columns &&
        current.rows === nextTray.rows
          ? current
          : nextTray,
      );
      const room = footerTop - wrap.getBoundingClientRect().top - nextTray.height - 16;
      const nextCell = positionsCellSize({
        columns,
        rows,
        availableWidth: wrap.clientWidth || play.clientWidth || window.innerWidth - 32,
        availableHeight: Math.max(64, room),
        contentScale: scale,
      });
      setCellSize((current) => (current === nextCell ? current : nextCell));
      if (width > 80) sizedFor.current = { id: gameId, width };
    };
    measure();
    const observer = new ResizeObserver(measure);
    if (playRef.current) observer.observe(playRef.current);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [playing, columns, rows, figureCount, game?.id]);

  const commit = (next: Game, message: string) => {
    if (next === gameRef.current) return;
    gameRef.current = next;
    setGame(next);
    void saveMemoryPositionsGame(next);
    setLive(message);
  };

  const revealResult = (next: Game, message: string) => {
    const first = showInstruction;
    if (first) {
      setShowInstruction(false);
      setShowResultKey(true);
      void markPositionsInstructionSeen();
    }
    setSwapCell(null);
    setConfirmHelp(false);
    commit(next, message);
  };

  const startNew = (draft: Settings) => {
    if (starting.current) return;
    starting.current = true;
    void beginMemoryPositionsGame(draft)
      .then((created) => {
        setSettings(draft);
        setConfigured(true);
        gameRef.current = created;
        setGame(created);
        setShowSettings(false);
        setShowResultKey(false);
        setSwapCell(null);
        setConfirmHelp(false);
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
    setSwapCell(null);
    commit(next, '');
  };

  const chooseSymbol = (symbolId: string) => {
    const current = gameRef.current;
    if (!current) return;
    const next = selectSymbol(current, symbolId);
    if (next === current) return;
    setSwapCell(null);
    setConfirmHelp(false);
    const label = symbolLabel(next, symbolId);
    commit(next, next.selectedSymbolId ? `Izvēlēta: ${label}.` : 'Figūra vairs nav izvēlēta.');
  };

  const chooseCell = (index: number) => {
    const current = gameRef.current;
    if (!current) return;
    const result = tapCell(current, index);
    if (result.occupied) {
      setConfirmHelp(false);
      setSwapCell(index);
      const occupantId = current.placements.find((item) => item.cell === index)?.symbolId ?? null;
      setLive(`Šeit jau ir ${symbolLabel(current, occupantId)}.`);
      return;
    }
    if (result.game === current) return;
    setSwapCell(null);
    const before = current.placements.find((item) => item.cell === index);
    const after = result.game.placements.find((item) => item.cell === index);
    const row = Math.floor(index / current.cols) + 1;
    const column = (index % current.cols) + 1;
    const message = !after && before
      ? `Noņemta: ${symbolLabel(current, before.symbolId)}.`
      : after
        ? `Novietota: ${symbolLabel(result.game, after.symbolId)}, ${row}. rinda, ${column}. kolonna.`
        : '';
    commit(result.game, message);
  };

  const confirmSwap = () => {
    const current = gameRef.current;
    if (!current || swapCell == null || !current.selectedSymbolId) return;
    const next = swapSymbols(current, current.selectedSymbolId, swapCell);
    setSwapCell(null);
    commit(next, 'Figūras apmainītas.');
  };

  const check = () => {
    const current = gameRef.current;
    if (!current) return;
    const next = submitAnswer(current);
    if (next === current) return;
    const correct = next.correctCount ?? 0;
    revealResult(next, `Pareizi novietotas: ${correct} no ${next.totalCount}.`);
  };

  const showSolution = () => {
    const current = gameRef.current;
    if (!current) return;
    const next = finishWithHelp(current);
    if (next === current) return;
    const correct = next.correctCount ?? 0;
    revealResult(
      next,
      `Pareizi novietotas: ${correct} no ${next.totalCount}. Izmantota palīdzība.`,
    );
  };

  if (!ready) {
    return (
      <Layout onHome={onHome} onNavigate={onNavigate} sectionType="memory_positions">
        <p className="lead">Ielādē…</p>
      </Layout>
    );
  }

  if (failed) {
    return (
      <Layout onHome={onHome} onNavigate={onNavigate} sectionType="memory_positions">
        <div className="positions-screen">
          <p className="positions-note" role="alert">
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
      <MemoryPositionsSettings
        initial={settings}
        configured={configured}
        unfinished={game?.status === 'in_progress'}
        onHome={onHome}
        onNavigate={onNavigate}
        onStart={startNew}
        onContinue={() => {
          setShowSettings(false);
          setSwapCell(null);
          setConfirmHelp(false);
        }}
      />
    );
  }

  const instruction =
    game.phase === 'memorize'
      ? 'Iegaumē figūras un to vietas.'
      : 'Novieto figūras tur, kur tās atradās.';

  const occupantId =
    swapCell == null ? null : game.placements.find((item) => item.cell === swapCell)?.symbolId ?? null;

  const footer = confirmHelp ? (
    <div className="footer-nav">
      <p className="positions-confirm-text">
        Parādīt pareizās vietas? Šī spēle netiks skaitīta kā pareizi atrisināta.
      </p>
      <Button variant="primary" onClick={showSolution}>
        Jā, parādīt
      </Button>
      <Button variant="secondary" onClick={() => setConfirmHelp(false)}>
        Atpakaļ
      </Button>
    </div>
  ) : swapCell != null && game.selectedSymbolId ? (
    <div className="footer-nav">
      <p className="positions-confirm-text">
        Šeit jau ir {symbolLabel(game, occupantId)}. Apmainīt ar{' '}
        {symbolLabel(game, game.selectedSymbolId)}?
      </p>
      <Button variant="primary" onClick={confirmSwap}>
        Apmainīt
      </Button>
      <Button variant="secondary" onClick={() => setSwapCell(null)}>
        Atcelt
      </Button>
    </div>
  ) : game.phase === 'memorize' ? (
    <Button variant="primary" onClick={remember}>
      Esmu iegaumējis
    </Button>
  ) : game.phase === 'recall' ? (
    <div className="footer-nav">
      {remainingCount(game) > 0 ? (
        <p className="positions-confirm-text">Vēl jānovieto: {remainingCount(game)}</p>
      ) : null}
      <Button variant="primary" disabled={!allPlaced(game)} onClick={check}>
        Pārbaudīt
      </Button>
      <Button variant="secondary" onClick={() => setConfirmHelp(true)}>
        Parādīt pareizās vietas
      </Button>
    </div>
  ) : (
    <Button variant="primary" onClick={() => startNew(settings)}>
      Nākamā spēle
    </Button>
  );

  return (
    <Layout
      onHome={onHome}
      onNavigate={onNavigate}
      sectionType="memory_positions"
      footer={footer}
    >
      <div className="positions-screen positions-play" ref={playRef}>
        <div className="positions-head">
          <p className="positions-meta">{positionsStatusLine(game)}</p>
          <button
            type="button"
            className="positions-settings-link"
            aria-label="Mainīt iestatījumus"
            onClick={() => {
              setSwapCell(null);
              setConfirmHelp(false);
              setShowSettings(true);
            }}
          >
            Mainīt
          </button>
        </div>
        {showInstruction && game.phase !== 'result' ? (
          <p className="positions-instruction">{instruction}</p>
        ) : null}
        <div className="positions-grid-wrap" ref={wrapRef}>
          <MemoryPositionsGrid
            cells={gridCells(game)}
            columns={game.cols}
            cellSize={cellSize}
            onCell={game.phase === 'recall' ? chooseCell : undefined}
          />
        </div>
        <div className="positions-tray-slot" style={{ minHeight: tray.height }}>
          {game.phase === 'recall' ? (
            <MemoryPositionsSymbolPicker
              game={game}
              symbolSize={tray.size}
              onSelect={chooseSymbol}
            />
          ) : null}
          {game.phase === 'result' ? (
            <MemoryPositionsResults game={game} showKey={showResultKey} />
          ) : null}
        </div>
        <p className="positions-live" aria-live="polite">
          {live}
        </p>
      </div>
    </Layout>
  );
}
