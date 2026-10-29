import type { GameSummary } from '../games/summary';
import { getSupabase, isSupabaseConfigured } from '../lib/supabase';

function rowFromSummary(userId: string, summary: GameSummary) {
  return {
    id: summary.id,
    user_id: userId,
    game: summary.game,
    grid: summary.grid,
    difficulty: summary.difficulty,
    category: summary.category,
    started_at: summary.startedAt,
    studied_at: summary.studiedAt,
    completed_at: summary.completedAt,
    summary: summary.summary,
  };
}

/** Best-effort copy for a signed-in person. Local save already happened. */
export async function uploadGameSummaries(summaries: readonly GameSummary[]): Promise<void> {
  if (import.meta.env.MODE === 'test') return;
  if (summaries.length === 0 || !isSupabaseConfigured()) return;
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const { error } = await supabase
      .from('game_summaries')
      .upsert(summaries.map((summary) => rowFromSummary(userId, summary)));
    if (error) console.error('[game-summary]', error.message);
  } catch (err) {
    console.error('[game-summary]', err);
  }
}

export function uploadGameSummary(summary: GameSummary | null): void {
  if (!summary) return;
  void uploadGameSummaries([summary]);
}
