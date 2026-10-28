import type { MemoryPairsGame } from './types';

function cardSymbol(game: MemoryPairsGame, instanceId: string): string | null {
  return game.cards.find((card) => card.instanceId === instanceId)?.symbol.id ?? null;
}

/**
 * Turn a card. A mismatch stays open until the person taps again:
 * another covered card replaces it, any other tap just closes the pair.
 */
export function revealCard(game: MemoryPairsGame, instanceId: string): MemoryPairsGame {
  if (game.status !== 'in_progress') return game;
  if (!game.cards.some((card) => card.instanceId === instanceId)) return game;

  if (game.openInstanceIds.length >= 2) {
    const matched = game.matchedInstanceIds.includes(instanceId);
    const alreadyOpen = game.openInstanceIds.includes(instanceId);
    if (!matched && !alreadyOpen) {
      return { ...game, openInstanceIds: [instanceId] };
    }
    return { ...game, openInstanceIds: [] };
  }

  if (game.openInstanceIds.includes(instanceId)) return game;
  if (game.matchedInstanceIds.includes(instanceId)) return game;

  const openInstanceIds = [...game.openInstanceIds, instanceId];
  if (openInstanceIds.length < 2) {
    return { ...game, openInstanceIds };
  }

  const [first, second] = openInstanceIds;
  const same = cardSymbol(game, first!) === cardSymbol(game, second!);
  const attempts = game.attempts + 1;
  if (!same) {
    return {
      ...game,
      openInstanceIds,
      attempts,
      mismatches: game.mismatches + 1,
    };
  }

  const matchedInstanceIds = [...game.matchedInstanceIds, first!, second!];
  const complete = matchedInstanceIds.length === game.cards.length;
  return {
    ...game,
    openInstanceIds: [],
    matchedInstanceIds,
    attempts,
    mismatches: game.mismatches,
    status: complete ? 'complete' : 'in_progress',
    completedAt: complete ? new Date().toISOString() : null,
  };
}

/** Hide the two open cards that did not match. */
export function hideMismatch(game: MemoryPairsGame): MemoryPairsGame {
  if (game.status !== 'in_progress') return game;
  if (game.openInstanceIds.length < 2) return game;
  return { ...game, openInstanceIds: [] };
}

export function isCardFaceUp(game: MemoryPairsGame, instanceId: string): boolean {
  return (
    game.matchedInstanceIds.includes(instanceId) ||
    game.openInstanceIds.includes(instanceId)
  );
}
