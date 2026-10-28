import { useCallback, useEffect, useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext';
import { AppProvider, useApp } from './context/AppContext';
import type { Screen } from './navigation/types';
import { HomeScreen } from './screens/HomeScreen';
import { SettingsScreen } from './screens/SettingsScreen';
import { AuthScreen } from './screens/AuthScreen';
import {
  CreatedWorkListScreen,
  CreatedWorkScreen,
} from './screens/CreatedWorkScreen';
import { ProgressScreen } from './screens/ProgressScreen';
import { ProgressDetailScreen } from './screens/ProgressDetailScreen';
import { TaskListScreen } from './screens/TaskListScreen';
import { BatchListScreen } from './screens/BatchListScreen';
import { TaskScreen } from './screens/TaskScreen';
import { LessonDoneScreen } from './screens/LessonDoneScreen';
import { LessonReviewScreen } from './screens/LessonReviewScreen';
import { LessonSummaryScreen } from './screens/LessonSummaryScreen';
import { SectionCompleteScreen } from './screens/SectionCompleteScreen';
import { CustomizeContentScreen } from './screens/CustomizeContentScreen';
import { MemoryScreen } from './screens/MemoryScreen';
import { MemoryPairsGame } from './screens/memoryPairs/MemoryPairsGame';
import { MemoryPatternGame } from './screens/memoryPattern/MemoryPatternGame';
import { MemoryPatternProgress } from './screens/memoryPattern/MemoryPatternProgress';
import { MemoryPositionsGame } from './screens/memoryPositions/MemoryPositionsGame';
import { MemoryPositionsProgress } from './screens/memoryPositions/MemoryPositionsProgress';
import { useKeyboardViewport } from './hooks/useKeyboardViewport';
import { loadDifficultyLevels } from './utils/difficulty';

/** Home → section practice, including the “all done” screen for that section. */
function isHomeSectionScreen(screen: Screen): boolean {
  if (screen.name === 'section_complete') return true;
  if (
    screen.name === 'memory' ||
    screen.name === 'memory_pairs' ||
    screen.name === 'memory_pattern' ||
    screen.name === 'memory_positions'
  ) {
    return true;
  }
  return (
    screen.name === 'task' &&
    screen.batchType != null &&
    screen.batchIndex == null
  );
}

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
    if (
      next.name === 'progress_detail' &&
      cur.name === 'progress_detail' &&
      cur.type === next.type
    ) {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'settings' && cur.name === 'settings') {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'auth' && cur.name === 'auth') {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'memory_pairs' && cur.name === 'memory_pairs') {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'memory_pattern' && cur.name === 'memory_pattern') {
      return stack.slice(0, i + 1);
    }
    if (
      next.name === 'memory_pattern_progress' &&
      cur.name === 'memory_pattern_progress'
    ) {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'memory_positions' && cur.name === 'memory_positions') {
      return stack.slice(0, i + 1);
    }
    if (
      next.name === 'memory_positions_progress' &&
      cur.name === 'memory_positions_progress'
    ) {
      return stack.slice(0, i + 1);
    }
    if (next.name === 'created_work' && cur.name === 'created_work') {
      return stack.slice(0, i + 1);
    }
    if (
      next.name === 'created_work_list' &&
      cur.name === 'created_work_list' &&
      cur.section === next.section
    ) {
      return stack.slice(0, i + 1);
    }
    if (
      next.name === 'customize_content' &&
      cur.name === 'customize_content'
    ) {
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
    if (
      next.name === 'section_complete' &&
      cur.name === 'section_complete' &&
      cur.type === next.type
    ) {
      return stack.slice(0, i + 1);
    }
  }
  return null;
}

function AppRouter() {
  useKeyboardViewport();
  const { ready: authReady, passwordRecovery } = useAuth();
  const { ready } = useApp();
  const [stack, setStack] = useState<Screen[]>([{ name: 'home' }]);
  const screen = stack[stack.length - 1] ?? { name: 'home' };

  // Open auth when the user arrives via the password-reset email link.
  useEffect(() => {
    if (!passwordRecovery) return;
    setStack((s) => {
      const top = s[s.length - 1];
      if (top?.name === 'auth') return s;
      return [...s, { name: 'auth' }];
    });
  }, [passwordRecovery]);

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
      // Done / section-complete screens replace the finished task.
      if (
        (next.name === 'lesson_done' || next.name === 'section_complete') &&
        top?.name === 'task'
      ) {
        return [...s.slice(0, -1), next];
      }
      // Starting practice from the complete screen replaces it
      // so Back does not return to “all done”.
      if (
        next.name === 'task' &&
        top?.name === 'section_complete' &&
        next.batchType === top.type
      ) {
        return [...s.slice(0, -1), next];
      }
      // Customize content from section_complete replaces that screen.
      if (
        next.name === 'customize_content' &&
        top?.name === 'section_complete'
      ) {
        return [...s.slice(0, -1), next];
      }
      // ←/→ between sections replaces the current one instead of stacking.
      if (top && isHomeSectionScreen(top) && isHomeSectionScreen(next)) {
        let i = s.length;
        while (i > 0 && isHomeSectionScreen(s[i - 1]!)) i -= 1;
        return [...s.slice(0, i), next];
      }
      const popped = popToMatching(s, next);
      if (popped) return popped;
      return [...s, next];
    });
  }, []);

  if (!authReady || !ready) {
    return (
      <div className="app-shell loading-shell">
        <p className="lead">Ielādē…</p>
      </div>
    );
  }

  switch (screen.name) {
    case 'home':
      return <HomeScreen onNavigate={navigate} />;
    case 'auth':
      return (
        <AuthScreen onNavigate={navigate} onHome={goHome} />
      );
    case 'created_work':
      return (
        <CreatedWorkScreen
          onNavigate={navigate}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'created_work_list':
      return (
        <CreatedWorkListScreen
          section={screen.section}
          onBack={goBack}
          onHome={goHome}
        />
      );
    case 'settings':
      return (
        <SettingsScreen onNavigate={navigate} onHome={goHome} />
      );
    case 'customize_content':
      return (
        <CustomizeContentScreen
          focusType={screen.focusType}
          focusMemory={screen.focusMemory}
          onNavigate={navigate}
          onHome={goHome}
        />
      );
    case 'progress':
      return (
        <ProgressScreen onNavigate={navigate} onHome={goHome} />
      );
    case 'progress_detail':
      return (
        <ProgressDetailScreen
          type={screen.type}
          onNavigate={navigate}
          onHome={goHome}
        />
      );
    case 'task_list':
      return (
        <TaskListScreen
          filter={screen.filter ?? 'all'}
          type={screen.type}
          onNavigate={navigate}
          onHome={goHome}
        />
      );
    case 'batch_list':
      return (
        <BatchListScreen
          type={screen.type}
          onNavigate={navigate}
          onHome={goHome}
        />
      );
    case 'lesson_review':
      return (
        <LessonReviewScreen
          type={screen.type}
          batchIndex={screen.batchIndex}
          onNavigate={navigate}
          onHome={goHome}
        />
      );
    case 'lesson_summary':
      return (
        <LessonSummaryScreen
          type={screen.type}
          batchIndex={screen.batchIndex}
          onNavigate={navigate}
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
          onHome={goHome}
        />
      );
    case 'section_complete':
      return (
        <SectionCompleteScreen
          type={screen.type}
          difficultyLevels={
            screen.difficultyLevels ?? loadDifficultyLevels(screen.type)
          }
          onNavigate={navigate}
          onHome={goHome}
        />
      );
    case 'memory':
      return (
        <MemoryScreen
          key={screen.mode}
          mode={screen.mode}
          onNavigate={navigate}
          onHome={goHome}
        />
      );
    case 'memory_pairs':
      return <MemoryPairsGame onNavigate={navigate} onHome={goHome} />;
    case 'memory_pattern':
      return <MemoryPatternGame onNavigate={navigate} onHome={goHome} />;
    case 'memory_pattern_progress':
      return <MemoryPatternProgress onHome={goHome} />;
    case 'memory_positions':
      return <MemoryPositionsGame onNavigate={navigate} onHome={goHome} />;
    case 'memory_positions_progress':
      return <MemoryPositionsProgress onHome={goHome} />;
  }
}

export default function App() {
  return (
    <AuthProvider>
      <AppProvider>
        <AppRouter />
      </AppProvider>
    </AuthProvider>
  );
}
