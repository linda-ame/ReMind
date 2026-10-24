import {
  forwardRef,
  useImperativeHandle,
  useRef,
  useState,
} from 'react';
import type { Task } from '../types/task';
import { Button } from './Button';

interface HintAnswersProps {
  hint?: string;
  answers?: string[];
  /** Kept for call-site compatibility; display uses short “Atbilde: …”. */
  taskType: Task['type'];
  onUsedHint?: () => void;
  onViewedAnswers: () => void;
  /** When true, answers are shown and reveal controls are hidden. */
  readOnly?: boolean;
  /** Start with answers visible (e.g. already viewed in a prior session). */
  initiallyShowAnswers?: boolean;
  /**
   * Show “Parādīt atbildi” button. Off for typed/dictation tasks — Enter /
   * finished speech already reveals via reveal().
   */
  showRevealButton?: boolean;
}

export type HintAnswersHandle = {
  /** Show the answer key (no-op if empty or already shown). Returns true if newly revealed. */
  reveal: () => boolean;
};

function formatAnswersLine(answers: string[]): string {
  const quoted = answers.map((a) => `"${a}"`).join(', ');
  return answers.length <= 1 ? `Atbilde: ${quoted}` : `Atbildes: ${quoted}`;
}

export const HintAnswers = forwardRef<HintAnswersHandle, HintAnswersProps>(
  function HintAnswers(
    {
      hint,
      answers,
      onUsedHint,
      onViewedAnswers,
      readOnly = false,
      initiallyShowAnswers = false,
      showRevealButton = true,
    },
    ref,
  ) {
    const [showHint, setShowHint] = useState(false);
    const [showAnswers, setShowAnswers] = useState(
      readOnly || initiallyShowAnswers,
    );
    const showAnswersRef = useRef(showAnswers);
    showAnswersRef.current = showAnswers;
    const answerCount = answers?.length ?? 0;

    useImperativeHandle(ref, () => ({
      reveal: () => {
        if (answerCount === 0 || showAnswersRef.current) return false;
        showAnswersRef.current = true;
        setShowAnswers(true);
        onViewedAnswers();
        return true;
      },
    }));

    const revealFromButton = () => {
      if (answerCount === 0 || showAnswersRef.current) return;
      showAnswersRef.current = true;
      setShowAnswers(true);
      onViewedAnswers();
    };

    const showControls =
      !readOnly && (Boolean(hint) || (showRevealButton && answerCount > 0 && !showAnswers));

    return (
      <div className="hint-answers">
        {showControls ? (
          <div className="btn-row">
            {hint ? (
              <Button
                variant="help"
                onClick={() => {
                  setShowHint(true);
                  onUsedHint?.();
                }}
              >
                Mājiens
              </Button>
            ) : null}
            {showRevealButton && answerCount > 0 && !showAnswers ? (
              <Button
                variant="secondary"
                className="btn-reveal-answer"
                onClick={revealFromButton}
              >
                {answerCount === 1 ? 'Parādīt atbildi' : 'Parādīt atbildes'}
              </Button>
            ) : null}
          </div>
        ) : null}

        {showHint && hint ? (
          <p className="hint-box" role="status">
            Mājiens: {hint}
          </p>
        ) : null}

        {showAnswers && answers && answerCount > 0 ? (
          <p className="answers-inline" role="status">
            {formatAnswersLine(answers)}
          </p>
        ) : null}
      </div>
    );
  },
);
