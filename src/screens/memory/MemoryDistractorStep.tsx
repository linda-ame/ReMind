import { useState } from 'react';
import { Button } from '../../components/Button';
import { getTaskById } from '../../data/loadTasks';
import { createAttempt } from '../../utils/attempts';
import { taskHasAdvanceReady } from '../../utils/taskAdvance';
import type { DistractorSnapshot } from '../../types/memory';
import type { TaskAttempt } from '../../types/progress';
import type { Task } from '../../types/task';
import { AntonymTaskView } from '../task/AntonymTaskView';
import { DefinitionGuessTaskView } from '../task/DefinitionGuessTaskView';
import { OddOneOutTaskView } from '../task/OddOneOutTaskView';
import { SentenceCompletionTaskView } from '../task/SentenceCompletionTaskView';

interface Props {
  taskId: string;
  snapshot: DistractorSnapshot | undefined;
  onSnapshot: (snapshot: DistractorSnapshot) => void;
  onDone: () => void;
}

function withSnapshot(task: Task, snapshot: DistractorSnapshot | undefined): TaskAttempt {
  const base = createAttempt(task);
  if (!snapshot) return base;
  return {
    ...base,
    enteredAnswer: snapshot.enteredAnswer,
    viewedAnswers: snapshot.viewedAnswers,
    status: snapshot.status,
    usedHint: snapshot.usedHint,
  };
}

export function MemoryDistractorStep({
  taskId,
  snapshot,
  onSnapshot,
  onDone,
}: Props) {
  const task = getTaskById(taskId);
  const [attempt, setAttempt] = useState<TaskAttempt | null>(() =>
    task ? withSnapshot(task, snapshot) : null,
  );

  if (!task || !attempt) {
    return (
      <div className="memory-flow">
        <p className="memory-instruction">Īsais uzdevums nav pieejams.</p>
        <Button variant="primary" onClick={onDone}>
          Tālāk
        </Button>
      </div>
    );
  }

  const onUpdate = (next: TaskAttempt) => {
    setAttempt(next);
    onSnapshot({
      taskId: task.id,
      enteredAnswer: next.enteredAnswer,
      viewedAnswers: next.viewedAnswers,
      status: next.status,
      usedHint: next.usedHint,
    });
  };

  const ready = taskHasAdvanceReady(task, attempt);

  return (
    <div className="memory-flow">
      <h1 className="memory-heading">Īss uzdevums</h1>
      <div className="task-view">
        {task.type === 'odd_one_out' ? (
          <OddOneOutTaskView task={task} attempt={attempt} onUpdate={onUpdate} />
        ) : null}
        {task.type === 'antonym' ? (
          <AntonymTaskView task={task} attempt={attempt} onUpdate={onUpdate} />
        ) : null}
        {task.type === 'definition_guess' ? (
          <DefinitionGuessTaskView
            task={task}
            attempt={attempt}
            onUpdate={onUpdate}
          />
        ) : null}
        {task.type === 'sentence_completion' ? (
          <SentenceCompletionTaskView
            task={task}
            attempt={attempt}
            onUpdate={onUpdate}
          />
        ) : null}
      </div>
      {ready ? (
        <div className="memory-actions">
          <Button variant="primary" onClick={onDone}>
            Tālāk
          </Button>
        </div>
      ) : null}
    </div>
  );
}
