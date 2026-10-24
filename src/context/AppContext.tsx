import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useAuth } from './AuthContext';
import { indexedDBProgressRepository } from '../repositories/IndexedDBProgressRepository';
import type { ProgressRepository } from '../repositories/ProgressRepository';
import { SupabaseProgressRepository } from '../repositories/SupabaseProgressRepository';
import { syncLocalToCloud } from '../repositories/syncLocalToCloud';
import {
  DEFAULT_UI_SETTINGS,
  normalizeUiSettings,
  type ProgressSnapshot,
  type TaskAttempt,
  type UiSettings,
} from '../types/progress';
import {
  loadTaskSkips,
  saveTaskSkips,
  withoutTaskSkips,
  withTaskSkippedToday,
  type TaskSkip,
} from '../utils/taskSkips';

interface AppContextValue {
  ready: boolean;
  settings: UiSettings;
  attempts: TaskAttempt[];
  /** Tasks skipped today (not completed; excluded from random until tomorrow). */
  taskSkips: TaskSkip[];
  /** True when progress is stored in Supabase for the signed-in user. */
  cloudSync: boolean;
  syncError: string | null;
  updateSettings: (partial: Partial<UiSettings>) => Promise<void>;
  saveAttempt: (attempt: TaskAttempt) => Promise<void>;
  refreshAttempts: () => Promise<void>;
  /** Mark task skipped for today — does not complete the attempt. */
  skipTaskToday: (taskId: string) => void;
  /** Clear progress for specific tasks (e.g. one lesson). */
  clearProgressForTasks: (taskIds: string[]) => Promise<void>;
  exportProgress: () => Promise<ProgressSnapshot>;
  importProgress: (snapshot: ProgressSnapshot, mode: 'merge' | 'replace') => Promise<void>;
}

const AppContext = createContext<AppContextValue | null>(null);

function applyAttemptToList(
  list: TaskAttempt[],
  attempt: TaskAttempt,
): TaskAttempt[] {
  const idx = list.findIndex((a) => a.id === attempt.id);
  if (idx >= 0) {
    const copy = [...list];
    copy[idx] = attempt;
    return copy;
  }
  return [...list, attempt];
}

export function AppProvider({ children }: { children: ReactNode }) {
  const { ready: authReady, user } = useAuth();
  const [ready, setReady] = useState(false);
  const [cloudSync, setCloudSync] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  const [taskSkips, setTaskSkips] = useState<TaskSkip[]>(() => loadTaskSkips());
  /** Last intended snapshot per attempt id (so queued writes always flush newest). */
  const latestByIdRef = useRef(new Map<string, TaskAttempt>());
  /** Serialize IDB writes per attempt id. */
  const chainByIdRef = useRef(new Map<string, Promise<void>>());
  const repoRef = useRef<ProgressRepository>(indexedDBProgressRepository);

  useEffect(() => {
    if (!authReady) return;

    let cancelled = false;

    (async () => {
      setReady(false);
      setSyncError(null);
      latestByIdRef.current.clear();
      chainByIdRef.current.clear();
      setTaskSkips(loadTaskSkips());

      try {
        if (user) {
          const cloud = new SupabaseProgressRepository(user.id);
          await syncLocalToCloud(indexedDBProgressRepository, cloud);
          if (cancelled) return;
          repoRef.current = cloud;
          setCloudSync(true);
        } else {
          repoRef.current = indexedDBProgressRepository;
          setCloudSync(false);
        }

        const [s, a] = await Promise.all([
          repoRef.current.getSettings(),
          repoRef.current.getAllAttempts(),
        ]);
        if (cancelled) return;
        setSettings(s);
        setAttempts(a);
      } catch (err) {
        if (cancelled) return;
        console.error(err);
        setSyncError(
          err instanceof Error
            ? err.message
            : 'Neizdevās sinhronizēt progresu',
        );
        // Fall back to local so the app remains usable.
        repoRef.current = indexedDBProgressRepository;
        setCloudSync(false);
        const [s, a] = await Promise.all([
          indexedDBProgressRepository.getSettings(),
          indexedDBProgressRepository.getAllAttempts(),
        ]);
        if (cancelled) return;
        setSettings(s);
        setAttempts(a);
      } finally {
        if (!cancelled) setReady(true);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [authReady, user]);

  const updateSettings = useCallback(async (partial: Partial<UiSettings>) => {
    let next: UiSettings = DEFAULT_UI_SETTINGS;
    setSettings((prev) => {
      next = normalizeUiSettings({ ...prev, ...partial });
      return next;
    });
    await repoRef.current.saveSettings(next);
  }, []);

  const saveAttempt = useCallback((attempt: TaskAttempt) => {
    const prevLatest = latestByIdRef.current.get(attempt.id);
    // Never let a late keystroke/patch downgrade a completed attempt.
    if (prevLatest?.status === 'completed' && attempt.status !== 'completed') {
      return Promise.resolve();
    }
    latestByIdRef.current.set(attempt.id, attempt);

    const prevChain =
      chainByIdRef.current.get(attempt.id) ?? Promise.resolve();
    const nextChain = prevChain
      .catch(() => undefined)
      .then(async () => {
        const toWrite = latestByIdRef.current.get(attempt.id);
        if (!toWrite) return;
        if (toWrite.status === 'completed') {
          // One completed row per task version — drop empty ghost attempts.
          await repoRef.current.replaceAttemptsForTaskVersion(toWrite);
          setAttempts((list) => {
            const withoutGhosts = list.filter(
              (a) =>
                !(
                  a.taskId === toWrite.taskId &&
                  a.contentVersion === toWrite.contentVersion &&
                  a.id !== toWrite.id
                ),
            );
            return applyAttemptToList(withoutGhosts, toWrite);
          });
        } else {
          await repoRef.current.saveAttempt(toWrite);
          setAttempts((list) => applyAttemptToList(list, toWrite));
        }
      });

    chainByIdRef.current.set(
      attempt.id,
      nextChain.then(
        () => undefined,
        () => undefined,
      ),
    );
    return nextChain;
  }, []);

  const refreshAttempts = useCallback(async () => {
    setAttempts(await repoRef.current.getAllAttempts());
  }, []);

  const skipTaskToday = useCallback((taskId: string) => {
    setTaskSkips((prev) => {
      const next = withTaskSkippedToday(prev, taskId);
      saveTaskSkips(next);
      return next;
    });
  }, []);

  const clearProgressForTasks = useCallback(async (taskIds: string[]) => {
    await repoRef.current.deleteAttemptsForTasks(taskIds);
    for (const id of [...latestByIdRef.current.keys()]) {
      const a = latestByIdRef.current.get(id);
      if (a && taskIds.includes(a.taskId)) {
        latestByIdRef.current.delete(id);
        chainByIdRef.current.delete(id);
      }
    }
    setTaskSkips((prev) => {
      const next = withoutTaskSkips(prev, taskIds);
      saveTaskSkips(next);
      return next;
    });
    setAttempts(await repoRef.current.getAllAttempts());
  }, []);

  const exportProgress = useCallback(
    () => repoRef.current.exportProgress(),
    [],
  );

  const importProgress = useCallback(
    async (snapshot: ProgressSnapshot, mode: 'merge' | 'replace') => {
      await repoRef.current.importProgress(snapshot, mode);
      const [s, a] = await Promise.all([
        repoRef.current.getSettings(),
        repoRef.current.getAllAttempts(),
      ]);
      setSettings(s);
      setAttempts(a);
      latestByIdRef.current.clear();
      chainByIdRef.current.clear();
    },
    [],
  );

  return (
    <AppContext.Provider
      value={{
        ready,
        settings,
        attempts,
        taskSkips,
        cloudSync,
        syncError,
        updateSettings,
        saveAttempt,
        refreshAttempts,
        skipTaskToday,
        clearProgressForTasks,
        exportProgress,
        importProgress,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error('useApp must be used within AppProvider');
  return ctx;
}
