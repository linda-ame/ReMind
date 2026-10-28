import { useEffect, useRef, useState } from 'react';
import { Layout } from '../../components/Layout';
import type { Screen } from '../../navigation/types';
import { dealMemoryPairsGame } from '../../memoryPairs/generate';
import { hideMismatch, isCardFaceUp, revealCard } from '../../memoryPairs/gameplay';
import {
  loadMemoryPairs,
  openMemoryPairs,
  persistActiveGame,
  persistNewGame,
  saveMemoryPairsSettings,
} from '../../memoryPairs/repository';
import {
  DEFAULT_MEMORY_PAIRS_SETTINGS,
  EMPTY_MEMORY_PAIRS_MEMORY,
  gridColumns,
  memoryPairsStatusLine,
  type MemoryPairsGame as Game,
  type MemoryPairsSettings as Settings,
} from '../../memoryPairs/types';
import { MemoryPairsCard } from './MemoryPairsCard';
import { MemoryPairsResults } from './MemoryPairsResults';
import { MemoryPairsSettings } from './MemoryPairsSettings';
import './memoryPairs.css';

interface MemoryPairsGameProps {
  onHome: () => void;
  onNavigate: (screen: Screen) => void;
}

function announce(previous: Game, next: Game): string {
  if (next.status === 'complete') return '';
  if (next.openInstanceIds.length === 2) return 'Nav pāris.';
  if (
    previous.openInstanceIds.length === 2 &&
    next.openInstanceIds.length === 0
  ) {
    return 'Kartītes aizvērtas.';
  }
  if (next.matchedInstanceIds.length > previous.matchedInstanceIds.length) {
    const instanceId = next.matchedInstanceIds[next.matchedInstanceIds.length - 1];
    const card = next.cards.find((item) => item.instanceId === instanceId);
    return card ? `Pāris atrasts: ${card.symbol.label}.` : 'Pāris atrasts.';
  }
  const opened = next.openInstanceIds[next.openInstanceIds.length - 1];
  const card = next.cards.find((item) => item.instanceId === opened);
  return card ? `Atvērta kartīte: ${card.symbol.label}.` : 'Kartīte atvērta.';
}

function useLandscape(): boolean {
  const [landscape, setLandscape] = useState(() =>
    window.matchMedia('(orientation: landscape)').matches,
  );
  useEffect(() => {
    const media = window.matchMedia('(orientation: landscape)');
    const onChange = () => setLandscape(media.matches);
    media.addEventListener('change', onChange);
    return () => media.removeEventListener('change', onChange);
  }, []);
  return landscape;
}

export function MemoryPairsGame({ onHome, onNavigate }: MemoryPairsGameProps) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState(DEFAULT_MEMORY_PAIRS_SETTINGS);
  const [game, setGame] = useState<Game | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [live, setLive] = useState('');
  const gameRef = useRef<Game | null>(null);
  const busy = useRef(false);
  const cardRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const landscape = useLandscape();

  const unfinished = game?.status === 'in_progress';
  const columns = game ? gridColumns(game.grid, landscape) : 2;
  const rows = game ? Math.ceil(game.cards.length / columns) : 1;
  const gridRef = useRef<HTMLDivElement>(null);
  const [cardSize, setCardSize] = useState<number | null>(null);

  useEffect(() => {
    let cancelled = false;
    openMemoryPairs()
      .then((stored) => {
        if (cancelled) return;
        setSettings(stored.settings ?? DEFAULT_MEMORY_PAIRS_SETTINGS);
        setGame(stored.activeGame);
        gameRef.current = stored.activeGame;
        setShowSettings(stored.settings == null);
        setReady(true);
      })
      .catch(() => {
        if (cancelled) return;
        setShowSettings(true);
        setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    const grid = gridRef.current;
    if (!grid || showSettings) return;

    const measure = () => {
      const top = grid.getBoundingClientRect().top;
      const footer = grid.closest('.app-shell')?.querySelector('.app-footer');
      const limit = footer
        ? footer.getBoundingClientRect().top
        : window.innerHeight;
      const availableH = Math.max(0, limit - top - 8);
      const availableW = grid.clientWidth;
      const gap = 10;
      const byWidth = (availableW - gap * (columns - 1)) / columns;
      const byHeight = (availableH - gap * (rows - 1)) / rows;
      const scale =
        Number(
          getComputedStyle(document.documentElement).getPropertyValue(
            '--content-scale',
          ),
        ) || 1;
      const minReadable = 84 * scale;
      const fitted = Math.min(byWidth, Math.max(byHeight, 0));
      const size = Math.min(280, fitted >= minReadable ? fitted : byWidth);
      setCardSize(Math.max(72, Math.floor(size)));
    };

    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(grid);
    window.addEventListener('resize', measure);
    return () => {
      observer.disconnect();
      window.removeEventListener('resize', measure);
    };
  }, [columns, rows, game?.id, game?.status, showSettings]);

  const startNew = (draft: Settings) => {
    if (busy.current) return;
    busy.current = true;
    void (async () => {
      let previous = EMPTY_MEMORY_PAIRS_MEMORY;
      try {
        await saveMemoryPairsSettings(draft);
        previous = await loadMemoryPairs();
      } catch {
        previous = EMPTY_MEMORY_PAIRS_MEMORY;
      }
      const next = dealMemoryPairsGame(draft, previous);
      try {
        await persistNewGame(next);
      } catch {
        // The board still opens if storage is unavailable.
      }
      gameRef.current = next;
      setSettings(draft);
      setGame(next);
      setLive('');
      setShowSettings(false);
      busy.current = false;
    })();
  };

  const continueExisting = (draft: Settings) => {
    void saveMemoryPairsSettings(draft);
    setSettings(draft);
    setShowSettings(false);
  };

  const openCard = (instanceId: string) => {
    const current = gameRef.current;
    if (!current) return;
    const next = revealCard(current, instanceId);
    if (next === current) return;
    gameRef.current = next;
    void persistActiveGame(next);
    setGame(next);
    setLive(announce(current, next));
  };

  const closeMismatch = () => {
    const current = gameRef.current;
    if (!current) return;
    const next = hideMismatch(current);
    if (next === current) return;
    gameRef.current = next;
    void persistActiveGame(next);
    setGame(next);
    setLive('Kartītes aizvērtas.');
  };

  if (!ready) {
    return (
      <Layout onHome={onHome} onNavigate={onNavigate} sectionType="memory_pairs">
        <p className="pairs-note">Ielādē…</p>
      </Layout>
    );
  }

  if (showSettings) {
    return (
      <MemoryPairsSettings
        initial={settings}
        unfinished={unfinished}
        onHome={onHome}
        onNavigate={onNavigate}
        onStartNew={startNew}
        onContinue={continueExisting}
      />
    );
  }

  if (!game) return null;

  const moveFocus = (index: number, key: string) => {
    let next = index;
    if (key === 'ArrowRight') next = index + 1;
    else if (key === 'ArrowLeft') next = index - 1;
    else if (key === 'ArrowDown') next = index + columns;
    else if (key === 'ArrowUp') next = index - columns;
    if (next < 0 || next >= game.cards.length || next === index) return;
    cardRefs.current[next]?.focus();
  };

  const footer =
    game.status === 'complete' ? (
      <MemoryPairsResults
        pairs={game.cards.length / 2}
        attempts={game.attempts}
        onNext={() => startNew(settings)}
      />
    ) : (
      <button
        type="button"
        className="pairs-new-game"
        onClick={() => startNew(settings)}
      >
        Sākt jaunu spēli
      </button>
    );

  return (
    <Layout
      onHome={onHome}
      onNavigate={onNavigate}
      sectionType="memory_pairs"
      footer={footer}
    >
      <div
        className="pairs-screen"
        onClick={(event) => {
          const target = event.target;
          if (!(target instanceof Element)) return;
          if (target.closest('.pairs-card, .pairs-settings-link')) return;
          closeMismatch();
        }}
      >
        <div className="pairs-head">
          <p className="pairs-meta">{memoryPairsStatusLine(game)}</p>
          <button
            type="button"
            className="pairs-settings-link"
            aria-label="Mainīt iestatījumus"
            onClick={() => setShowSettings(true)}
          >
            Mainīt
          </button>
        </div>
        <div
          ref={gridRef}
          className="pairs-grid"
          role="group"
          aria-label="Kartītes"
          style={{
            gridTemplateColumns: cardSize
              ? `repeat(${columns}, ${cardSize}px)`
              : `repeat(${columns}, minmax(0, 1fr))`,
            gridTemplateRows: cardSize
              ? `repeat(${rows}, ${cardSize}px)`
              : undefined,
          }}
        >
          {game.cards.map((card, index) => {
            const faceUp = isCardFaceUp(game, card.instanceId);
            return (
              <MemoryPairsCard
                key={card.instanceId}
                card={card}
                faceUp={faceUp}
                matched={game.matchedInstanceIds.includes(card.instanceId)}
                row={Math.floor(index / columns) + 1}
                column={(index % columns) + 1}
                onOpen={openCard}
                onArrow={(key) => moveFocus(index, key)}
                buttonRef={(element) => {
                  cardRefs.current[index] = element;
                }}
              />
            );
          })}
        </div>
        <p className="pairs-live" aria-live="polite">
          {live}
        </p>
      </div>
    </Layout>
  );
}
