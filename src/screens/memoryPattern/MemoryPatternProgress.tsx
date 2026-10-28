import { useEffect, useState } from 'react';
import { Button } from '../../components/Button';
import { Layout } from '../../components/Layout';
import { listMemoryPatternGames } from '../../memoryPattern/repository';
import './memoryPattern.css';
import { summarizeMemoryPatternGames } from '../../memoryPattern/stats';
import {
  MEMORY_PATTERN_GRIDS,
  MEMORY_PATTERN_LEVELS,
  gridLabel,
  patternStatusLine,
  type MemoryPatternDifficulty,
  type MemoryPatternGame,
  type MemoryPatternGrid,
} from '../../memoryPattern/types';

interface MemoryPatternProgressProps {
  onHome: () => void;
}

export function MemoryPatternProgress({ onHome }: MemoryPatternProgressProps) {
  const [games, setGames] = useState<MemoryPatternGame[] | null>(null);
  const [grid, setGrid] = useState<MemoryPatternGrid | 'all'>('all');
  const [difficulty, setDifficulty] = useState<MemoryPatternDifficulty | 'all'>('all');

  useEffect(() => {
    let live = true;
    void listMemoryPatternGames().then((rows) => {
      if (live) setGames(rows);
    });
    return () => {
      live = false;
    };
  }, []);

  const groups = games ? summarizeMemoryPatternGames(games, { grid, difficulty }) : [];
  const completed = groups.reduce((sum, group) => sum + group.completed, 0);
  const exact = groups.reduce((sum, group) => sum + group.exact, 0);

  return (
    <Layout onHome={onHome}>
      <div className="pattern-screen pattern-stats">
        <h1 className="pattern-title">Atceries rūtiņu rakstu</h1>
        <p className="pattern-note">
          Katrs režģis un līmenis tiek skaitīts atsevišķi.
        </p>

        <div className="pattern-field" role="group" aria-labelledby="pattern-filter-grid">
          <h2 id="pattern-filter-grid" className="pattern-field-title">
            Režģis
          </h2>
          <div className="pattern-filter-row pattern-filter-row-grids">
            <FilterButton
              pressed={grid === 'all'}
              label="Visi režģi"
              onClick={() => setGrid('all')}
            >
              Visi
            </FilterButton>
            {MEMORY_PATTERN_GRIDS.map((item) => (
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

        <div className="pattern-field" role="group" aria-labelledby="pattern-filter-level">
          <h2 id="pattern-filter-level" className="pattern-field-title">
            Grūtības pakāpe
          </h2>
          <div className="pattern-level-row pattern-filter-levels">
            <FilterButton
              pressed={difficulty === 'all'}
              label="Visi līmeņi"
              onClick={() => setDifficulty('all')}
            >
              Visi
            </FilterButton>
            {MEMORY_PATTERN_LEVELS.map((level) => (
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

        {games == null ? <p className="pattern-note">Ielādē…</p> : null}
        {games != null && completed === 0 ? (
          <p className="pattern-note">Vēl nav pabeigtu spēļu.</p>
        ) : null}
        {completed > 0 ? (
          <>
            <p className="pattern-score">Pabeigtas spēles: {completed}</p>
            <p className="pattern-score">Precīzi atjaunoti raksti: {exact}</p>
            {groups.map((group) => (
              <section
                key={`${group.grid}-${group.difficulty}`}
                className="pattern-stat-card"
                aria-label={patternStatusLine(group.grid, group.difficulty)}
              >
                <p>{patternStatusLine(group.grid, group.difficulty)}</p>
                <p>Pabeigtas spēles: {group.completed}</p>
                <p>Precīzi atjaunoti raksti: {group.exact}</p>
                <p>Pareizi atcerētās rūtiņas: {group.correctCells}</p>
                <p>Nepareizi novietotās rūtiņas: {group.extraCells}</p>
                <p>Kur bija jābūt: {group.missedCells}</p>
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
      className="pattern-level-btn"
      variant={pressed ? 'selected' : 'secondary'}
      aria-pressed={pressed}
      aria-label={label}
      onClick={onClick}
    >
      {children}
    </Button>
  );
}
