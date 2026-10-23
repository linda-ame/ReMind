import { useCallback, useState } from 'react';
import { AppProvider, useApp } from './context/AppContext';
import type { Screen } from './navigation/types';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { TaskListScreen } from './screens/TaskListScreen';
import { BatchListScreen } from './screens/BatchListScreen';
import { TaskScreen } from './screens/TaskScreen';
import { LessonDoneScreen } from './screens/LessonDoneScreen';
import { LessonReviewScreen } from './screens/LessonReviewScreen';
import { LessonSummaryScreen } from './screens/LessonSummaryScreen';

function sameTaskSession(a: Screen, b: Screen): boolean {
  if (a.name !== 'task' || b.name !== 'task') return false;
  if (a.batchIndex !== b.batchIndex || a.batchType !== b.batchType) return false;
  if ((a.mode ?? 'practice') !== (b.mode ?? 'practice')) return false;
  if (Boolean(a.fresh) !== Boolean(b.fresh)) return false;
  if (a.queue.length !== b.queue.length) return false;
  return a.queue.every((id, i) => id === b.queue[i]);
}

/** If `next` is already earlier in the stack, pop back to it instead of pushing a duplicate. */
function popToMatching(stack: Screen[], next: Screen): Screen[] | null {
  for (let i = stack.length - 1; i >= 0; i--) {
    const cur = stack[i]!;
    if (next.name === 'batch_list' && cur.name === 'batch_list' && cur.type === next.type) {
      return stack.slice(0, i + 1);
    }
    if (
      next.name === 'task_list' &&
      cur.name === 'task_list' &&
      cur.filter === next.filter &&
      cur.type === next.type
    ) {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'progress' && cur.name === 'progress') {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'settings' && cur.name === 'settings') {
      return stack.slice(0, i + 1);
    }
    if (
      next.name === 'lesson_review' &&
      cur.name === 'lesson_review' &&
      cur.type === next.type &&
      cur.batchIndex === next.batchIndex
    ) {
      return stack.slice(0, i + 1);
    }
    if (
      next.name === 'lesson_summary' &&
      cur.name === 'lesson_summary' &&
      cur.type === next.type &&
      cur.batchIndex === next.batchIndex
    ) {
      return stack.slice(0, i + 1);
    }
  }
  return null;
}

function AppRouter() {
  const { ready } = useApp();
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);
  const screen = stack[stack.length - 1] ?? { name: 'home' };

  const goHome = useCallback(() => {
    setStack([{ name: 'home' }]);
  }, []);

  const goBack = useCallback(() => {
    setStack((s) => (s.length > 1 ? s.slice(0, -1) : s));
  }, []);

  const navigate = useCallback((next: Screen) => {
    if (next.name === 'home') {
      setStack([{ name: 'home' }]);
      return;
    }
    setStack((s) => {
      const top = s[s.length - 1];
      // Moving within the same lesson/queue replaces the top entry
      // so “Atpakaļ” leaves the lesson, not every prior word.
      if (top && sameTaskSession(top, next)) {
        return [...s.slice(0, -1), next];
      }
      // Done screen replaces the finished task.
      if (next.name === 'lesson_done' && top?.name === 'task') {
        return [...s.slice(0, -1), next];
      }
      const popped = popToMatching(s, next);
      if (popped) return popped;
      return [...s, next];
    });
  }, []);

  if (!ready) {
    return (
      <div className="app-shell loading-shell">
        <p className="lead">Ielādē…</p>
      </div>
    );
  }

  switch (screen.name) {
    case 'home':
      return <HomeScreen onNavigate={navigate} />;
    case 'settings':
      return (
        <SettingsScreen
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'progress':
      return (
        <ProgressScreen
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'task_list':
      return (
        <TaskListScreen
          filter={screen.filter ?? 'all'}
          type={screen.type}
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'batch_list':
      return (
        <BatchListScreen
          type={screen.type}
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'lesson_review':
      return (
        <LessonReviewScreen
          type={screen.type}
          batchIndex={screen.batchIndex}
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'lesson_summary':
      return (
        <LessonSummaryScreen
          type={screen.type}
          batchIndex={screen.batchIndex}
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'task':
      return (
        <TaskScreen
          key={`${screen.taskId}-${screen.mode ?? 'practice'}-${screen.fresh ? 'fresh' : 'resume'}`}
          taskId={screen.taskId}
          queue={screen.queue}
          batchIndex={screen.batchIndex}
          batchType={screen.batchType}
          mode={screen.mode}
          fresh={screen.fresh}
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'lesson_done':
      return (
        <LessonDoneScreen
          queue={screen.queue}
          batchIndex={screen.batchIndex}
          batchType={screen.batchType}
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
  }
}

export default function App() {
  return (
    <AppProvider>
      <AppRouter />
    </AppProvider>
  );
}
