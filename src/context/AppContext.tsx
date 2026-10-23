import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { progressRepository } from '../repositories/IndexedDBProgressRepository';
import {
  DEFAULT_UI_SETTINGS,
  normalizeUiSettings,
  type ProgressSnapshot,
  type TaskAttempt,
  type UiSettings,
} from '../types/progress';

interface AppContextValue {
  ready: boolean;
  settings: UiSettings;
  attempts: TaskAttempt[];
  updateSettings: (partial: Partial<UiSettings>) => Promise<void>;
  saveAttempt: (attempt: TaskAttempt) => Promise<void>;
  refreshAttempts: () => Promise<void>;
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
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);
  /** Last intended snapshot per attempt id (so queued writes always flush newest). */
  const latestByIdRef = useRef(new Map<string, TaskAttempt>());
  /** Serialize IDB writes per attempt id. */
  const chainByIdRef = useRef(new Map<string, Promise<void>>());

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const [s, a] = await Promise.all([
        progressRepository.getSettings(),
        progressRepository.getAllAttempts(),
      ]);
      if (!cancelled) {
        setSettings(s);
        setAttempts(a);
        setReady(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const updateSettings = useCallback(async (partial: Partial<UiSettings>) => {
    let next: UiSettings = DEFAULT_UI_SETTINGS;
    setSettings((prev) => {
      next = normalizeUiSettings({ ...prev, ...partial });
      return next;
    });
    await progressRepository.saveSettings(next);
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
          await progressRepository.replaceAttemptsForTaskVersion(toWrite);
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
          await progressRepository.saveAttempt(toWrite);
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
    setAttempts(await progressRepository.getAllAttempts());
  }, []);

  const clearProgressForTasks = useCallback(async (taskIds: string[]) => {
    await progressRepository.deleteAttemptsForTasks(taskIds);
    for (const id of [...latestByIdRef.current.keys()]) {
      const a = latestByIdRef.current.get(id);
      if (a && taskIds.includes(a.taskId)) {
        latestByIdRef.current.delete(id);
        chainByIdRef.current.delete(id);
      }
    }
    setAttempts(await progressRepository.getAllAttempts());
  }, []);

  const exportProgress = useCallback(() => progressRepository.exportProgress(), []);

  const importProgress = useCallback(
    async (snapshot: ProgressSnapshot, mode: 'merge' | 'replace') => {
      await progressRepository.importProgress(snapshot, mode);
      const [s, a] = await Promise.all([
        progressRepository.getSettings(),
        progressRepository.getAllAttempts(),
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
        updateSettings,
        saveAttempt,
        refreshAttempts,
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
