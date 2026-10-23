import {
  createContext,
  useCallback,
  useContext,
  useEffect,
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

export function AppProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false);
  const [settings, setSettings] = useState<UiSettings>(DEFAULT_UI_SETTINGS);
  const [attempts, setAttempts] = useState<TaskAttempt[]>([]);

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

  const saveAttempt = useCallback(async (attempt: TaskAttempt) => {
    await progressRepository.saveAttempt(attempt);
    setAttempts((prev) => {
      const idx = prev.findIndex((a) => a.id === attempt.id);
      if (idx >= 0) {
        const copy = [...prev];
        copy[idx] = attempt;
        return copy;
      }
      return [...prev, attempt];
    });
  }, []);

  const refreshAttempts = useCallback(async () => {
    setAttempts(await progressRepository.getAllAttempts());
  }, []);

  const clearProgressForTasks = useCallback(async (taskIds: string[]) => {
    await progressRepository.deleteAttemptsForTasks(taskIds);
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
