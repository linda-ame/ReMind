import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import { listMemoryPositionsGames } from '../../memoryPositions/repository';
import { summarizeMemoryPositionsGames } from '../../memoryPositions/stats';
import {
  CATEGORY_SHORT,
  MEMORY_POSITIONS_CATEGORIES,
  MEMORY_POSITIONS_GRIDS,
  MEMORY_POSITIONS_LEVELS,
  gridLabel,
  positionsStatusLine,
  type MemoryPositionsCategory,
  type MemoryPositionsDifficulty,
  type MemoryPositionsGame,
  type MemoryPositionsGrid,
} from '../../memoryPositions/types';
import './memoryPositions.css';

interface MemoryPositionsProgressProps {
  onHome: () => void;
}

export function MemoryPositionsProgress({ onHome }: MemoryPositionsProgressProps) {
  const [games, setGames] = useState<MemoryPositionsGame[] | null>(null);
  const [grid, setGrid] = useState<MemoryPositionsGrid | 'all'>('all');
  const [difficulty, setDifficulty] = useState<MemoryPositionsDifficulty | 'all'>('all');
  const [category, setCategory] = useState<MemoryPositionsCategory | 'all'>('all');

  useEffect(() => {
    let live = true;
    void listMemoryPositionsGames().then((rows) => {
      if (live) setGames(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const groups = games
    ? summarizeMemoryPositionsGames(games, { grid, difficulty, category })
    : [];
  const completed = groups.reduce((sum, group) => sum + group.completed, 0);
  const exact = groups.reduce((sum, group) => sum + group.exact, 0);

  return (
    <Layout onHome={onHome}>
      <div className="positions-screen positions-stats">
        <h1 className="positions-title">Atceries figūru vietas</h1>
        <p className="positions-note">
          Katrs režģis, līmenis un figūru veids tiek skaitīts atsevišķi.
        </p>

        <div className="positions-field" role="group" aria-labelledby="positions-filter-grid">
          <h2 id="positions-filter-grid" className="positions-field-title">
            Režģis
          </h2>
          <div className="positions-filter-row positions-filter-row-grids">
            <FilterButton pressed={grid === 'all'} label="Visi režģi" onClick={() => setGrid('all')}>
              Visi
            </FilterButton>
            {MEMORY_POSITIONS_GRIDS.map((item) => (
              <FilterButton
                key={item}
                pressed={grid === item}
                label={gridLabel(item)}
                onClick={() => setGrid(item)}
              >
                {gridLabel(item)}
              </FilterButton>
            ))}
          </div>
        </div>

        <div className="positions-field" role="group" aria-labelledby="positions-filter-level">
          <h2 id="positions-filter-level" className="positions-field-title">
            Grūtības pakāpe
          </h2>
          <div className="positions-level-row positions-filter-levels">
            <FilterButton
              pressed={difficulty === 'all'}
              label="Visi līmeņi"
              onClick={() => setDifficulty('all')}
            >
              Visi
            </FilterButton>
            {MEMORY_POSITIONS_LEVELS.map((level) => (
              <FilterButton
                key={level}
                pressed={difficulty === level}
                label={`${level}. līmenis`}
                onClick={() => setDifficulty(level)}
              >
                {level}
              </FilterButton>
            ))}
          </div>
        </div>

        <div className="positions-field" role="group" aria-labelledby="positions-filter-kind">
          <h2 id="positions-filter-kind" className="positions-field-title">
            Figūru veids
          </h2>
          <div className="positions-filter-row positions-filter-row-kinds">
            <FilterButton
              pressed={category === 'all'}
              label="Visi veidi"
              onClick={() => setCategory('all')}
            >
              Visi
            </FilterButton>
            {MEMORY_POSITIONS_CATEGORIES.map((item) => (
              <FilterButton
                key={item}
                pressed={category === item}
                label={CATEGORY_SHORT[item]}
                onClick={() => setCategory(item)}
              >
                {CATEGORY_SHORT[item]}
              </FilterButton>
            ))}
          </div>
        </div>

        {games == null ? <p className="positions-note">Ielādē…</p> : null}
        {games != null && completed === 0 ? (
          <p className="positions-note">Vēl nav pabeigtu spēļu.</p>
        ) : null}
        {completed > 0 ? (
          <>
            <p className="positions-score">Pabeigtas spēles: {completed}</p>
            <p className="positions-score">Pilnīgi pareizi: {exact}</p>
            {groups.map((group) => (
              <section
                key={`${group.grid}-${group.difficulty}-${group.category}`}
                className="positions-stat-card"
                aria-label={positionsStatusLine(group)}
              >
                <p>{positionsStatusLine(group)}</p>
                <p>Pabeigtas spēles: {group.completed}</p>
                <p>Pilnīgi pareizi: {group.exact}</p>
                <p>Ar palīdzību: {group.helped}</p>
                <p>
                  Pareizi novietotas figūras: {group.correctFigures} no {group.figureTotal}
                </p>
              </section>
            ))}
          </>
        ) : null}
      </div>
    </Layout>
  );
}

function FilterButton({
  pressed,
  label,
  onClick,
  children,
}: {
  pressed: boolean;
  label: string;
  onClick: () => void;
  children: string | number;
}) {
  return (
    <Button
      fullWidth={false}
      className="positions-level-btn"
      variant={pressed ? 'selected' : 'secondary'}
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
