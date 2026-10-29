import { getSupabase, isSupabaseConfigured } from '../lib/supabase';
import { buildMemoryRecord } from '../tasks/memoryRecord';
import type { MemorySession } from '../types/memory';

/** Best-effort copy for a signed-in person. Local save already happened. */
export async function uploadMemorySession(session: MemorySession): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const supabase = getSupabase();
    const { data } = await supabase.auth.getSession();
    const userId = data.session?.user.id;
    if (!userId) return;
    const { error } = await supabase.from('memory_sessions').upsert({
      id: session.sessionId,
      user_id: userId,
      mode: session.mode,
      task_id: session.taskId,
      completed_at: session.completedAt ?? null,
      payload: { ...session, record: buildMemoryRecord(session) },
    });
    if (error) console.error('[memory]', error.message);
  } catch (err) {
    console.error('[memory]', err);
  }
}
