import { Button } from '../../components/Button';
import { ListenButton } from '../../components/ListenButton';
import type { MemoryRecallTask } from '../../types/memory';

interface Props {
  task: MemoryRecallTask;
  visualOpen: boolean;
  onPlayed: () => void;
  onVisual: (open: boolean) => void;
  onReady: () => void;
  onSkip: () => void;
}

/** Cloud voice, list only — the instruction stays on screen. */
function speakable(task: MemoryRecallTask): string {
  const segments = task.stimulus.ttsSegments
    .map((segment) => segment.trim())
    .filter(Boolean);
  if (segments.length === 0) return task.stimulus.visualText;
  const short = task.category === 'digits' || task.category === 'numbers';
  return segments.join(short ? ', ' : '. ');
}

function EyeIcon({ open }: { open: boolean }) {
  return (
    <svg
      className="listen-btn-icon"
      viewBox="0 0 24 24"
      width="1.35em"
      height="1.35em"
      aria-hidden="true"
      focusable="false"
    >
      {open ? (
        <path
          fill="currentColor"
          d="M12 6.5c4.7 0 8.6 3.1 10 7.5-1.4 4.4-5.3 7.5-10 7.5S3.4 18.4 2 14c1.4-4.4 5.3-7.5 10-7.5zm0 2c-3.5 0-6.5 2.2-7.7 5.5C5.5 17.3 8.5 19.5 12 19.5s6.5-2.2 7.7-5.5C18.5 10.7 15.5 8.5 12 8.5zm0 1.8a3.7 3.7 0 1 1 0 7.4 3.7 3.7 0 0 1 0-7.4z"
        />
      ) : (
        <path
          fill="currentColor"
          d="M3.3 2.5 2 3.8l3.2 3.2C3.4 8.4 2.2 10.1 1.5 12c1.6 4.6 6 8 10.5 8 1.8 0 3.5-.5 5-1.3l3.2 3.2 1.3-1.3L3.3 2.5zM12 18c-3.4 0-6.6-2.3-8-6 .6-1.6 1.6-3 2.8-4.1l2.1 2.1A3.7 3.7 0 0 0 12 16.2c.4 0 .8-.1 1.2-.2l1.6 1.6c-.9.3-1.8.4-2.8.4zm7.2-2.1-1.5-1.5c.8-.9 1.4-2 1.8-3.2C18.1 8.3 15.2 6 12 6c-.6 0-1.1.1-1.7.2L8.7 4.6C9.7 4.2 10.8 4 12 4c4.5 0 8.9 3.4 10.5 8-.7 2-1.8 3.7-3.3 5z"
        />
      )}
    </svg>
  );
}

export function MemoryStudyStep({
  task,
  visualOpen,
  onPlayed,
  onVisual,
  onReady,
  onSkip,
}: Props) {
  return (
    <div className="memory-flow memory-flow-screen">
      <p className="memory-instruction">{task.instruction}</p>

      {visualOpen ? (
        <p className="memory-stimulus">{task.stimulus.visualText}</p>
      ) : null}

      <div className="listen-row">
        <ListenButton
          text={speakable(task)}
          label="Atskaņot"
          ariaLabel="Atskaņot sarakstu"
          speakingRate={0.5}
          onStart={onPlayed}
        />
      </div>

      <div className="memory-actions">
        <Button variant="secondary" onClick={() => onVisual(!visualOpen)}>
          <span className="listen-btn-inner">
            <EyeIcon open={visualOpen} />
            <span>{visualOpen ? 'Paslēpt' : 'Apskatīt'}</span>
          </span>
        </Button>
        <Button variant="primary" onClick={onReady}>
          Esmu gatavs
        </Button>
      </div>
      <Button variant="neutral" className="task-skip-btn memory-skip" onClick={onSkip}>
        Izlaist
      </Button>
    </div>
  );
}
