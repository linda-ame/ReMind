import { Button } from '../../components/Button';
import type {
  MemoryAnswer,
  MemoryMode,
  MemoryRecallTask,
  MemoryScore,
  MemorySession,
} from '../../types/memory';
import { formatDelay, formatScoreLine } from '../../utils/memoryScore';

interface Props {
  task: MemoryRecallTask;
  session: MemorySession;
  onNext: () => void;
}

function playLabel(count: number): string {
  const word =
    count % 10 === 1 && count % 100 !== 11 ? 'reizi' : 'reižu';
  return `Noklausījās ${count} ${word}`;
}

function scoreText(
  label: string,
  answer: MemoryAnswer | undefined,
  recognitionLabel = 'Atpazina',
): string[] {
  if (!answer) return [];
  const lines: string[] = [];
  if (answer.freeScore) {
    lines.push(formatScoreLine(label, answer.freeScore));
  } else if (answer.notScorableReason === 'spoken_untranscribed') {
    lines.push(`${label}: teikts skaļi, nav automātiski vērtēts`);
  }
  if (answer.recognitionScore) {
    lines.push(formatScoreLine(recognitionLabel, answer.recognitionScore));
  }
  if (answer.notScorableReason === 'ambiguous') {
    lines.push('Daļa atbilžu nav automātiski salīdzināta.');
  }
  return lines;
}

function freeText(answer: MemoryAnswer | undefined): string {
  if (!answer) return '';
  const raw = answer.freeResponseRaw;
  if (typeof raw === 'string') {
    if (!raw) return answer.freeScore ? 'Neatceros' : '';
    return raw.split('').join('  ·  ');
  }
  if (Array.isArray(raw)) return raw.join(', ');
  if (raw && typeof raw === 'object') {
    return Object.entries(raw)
      .map(([key, value]) => `${key}: ${value || '—'}`)
      .join('\n');
  }
  return '';
}

function factLines(task: MemoryRecallTask, answer: MemoryAnswer | undefined): string[] {
  if (!answer || task.answer.kind !== 'facts') return [];
  const raw = answer.freeResponseRaw;
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return [];
  return task.answer.fields.map((field) => {
    const value = raw[field.key]?.trim();
    return `${field.prompt} ${value || '—'}`;
  });
}

export function MemoryResultStep({ task, session, onNext }: Props) {
  const mode: MemoryMode = session.mode;
  const lines =
    mode === 'immediate'
      ? scoreText('Atcerējies', session.immediate)
      : [
          ...scoreText('Uzreiz', session.immediate, 'Uzreiz atpazina'),
          ...scoreText('Pēc brīža', session.delayed, 'Pēc brīža atpazina'),
        ];

  return (
    <div className="memory-flow">
      <h1 className="memory-heading">Rezultāts</h1>
      {lines.map((line, index) => (
        <p key={`${index}-${line}`} className="memory-score">
          {line}
        </p>
      ))}

      {mode === 'delayed' && session.actualDelaySeconds != null ? (
        <p className="memory-score">{formatDelay(session.actualDelaySeconds)}</p>
      ) : null}
      {session.interrupted ? (
        <p className="memory-note">
          Sesija bija pārtraukta. Šis laiks nav īss atcerēšanās intervāls.
        </p>
      ) : null}
      {session.firstResponseCued ? (
        <p className="memory-note">
          Pirmajā reizē bija redzami atbilžu varianti. Tas var palīdzēt vēlākai
          atcerēšanai.
        </p>
      ) : null}

      <ul className="memory-meta">
        {session.visualHelpShown ? (
          <li>Iegaumēšanā apskatīja tekstu</li>
        ) : null}
        {session.ttsPlayCount > 0 ? <li>{playLabel(session.ttsPlayCount)}</li> : null}
        {session.immediate?.recognitionOpened ||
        session.delayed?.recognitionOpened ? (
          <li>Atbilžu izvēle izmantota</li>
        ) : null}
      </ul>

      <h2 className="memory-subhead">Iegaumētais</h2>
      <p className="memory-stimulus">{task.stimulus.visualText}</p>

      <UserEcho label="Tava atbilde uzreiz" task={task} answer={session.immediate} />
      {mode === 'delayed' ? (
        <UserEcho
          label="Tava atbilde pēc brīža"
          task={task}
          answer={session.delayed}
        />
      ) : null}

      <div className="memory-actions">
        <Button variant="primary" onClick={onNext}>
          Nākamais
        </Button>
      </div>
    </div>
  );
}

function UserEcho({
  label,
  task,
  answer,
}: {
  label: string;
  task: MemoryRecallTask;
  answer: MemoryAnswer | undefined;
}) {
  const facts = factLines(task, answer);
  const text = facts.length > 0 ? facts.join('\n') : freeText(answer);
  if (!text) return null;
  return (
    <div className="memory-echo">
      <h2 className="memory-subhead">{label}</h2>
      <p className="memory-stimulus memory-stimulus-entry">{text}</p>
      {answer?.recognitionScore ? (
        <p className="memory-note">
          No variantiem:{' '}
          {formatRecognition(answer.recognitionSelection, answer.recognitionScore)}
        </p>
      ) : null}
    </div>
  );
}

function formatRecognition(
  selection: MemoryAnswer['recognitionSelection'],
  score: MemoryScore,
): string {
  if (typeof selection === 'string') return selection;
  if (Array.isArray(selection)) return selection.join(', ');
  if (selection && typeof selection === 'object') {
    return Object.values(selection).join(', ');
  }
  return `${score.correct} no ${score.total}`;
}
