import { useState } from 'react';
import { Button } from './Button';

interface HintAnswersProps {
  hint?: string;
  answers?: string[];
  onUsedHint?: () => void;
  onViewedAnswers: () => void;
  /** When true, answers are shown and reveal controls are hidden. */
  readOnly?: boolean;
  /** Start with answers visible (e.g. already viewed in a prior session). */
  initiallyShowAnswers?: boolean;
}

export function HintAnswers({
  hint,
  answers,
  onUsedHint,
  onViewedAnswers,
  readOnly = false,
  initiallyShowAnswers = false,
}: HintAnswersProps) {
  const [showHint, setShowHint] = useState(false);
  const [showAnswers, setShowAnswers] = useState(
    readOnly || initiallyShowAnswers,
  );
  const answerCount = answers?.length ?? 0;

  return (
    <div className="hint-answers">
      {!readOnly ? (
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
          {answerCount > 0 && !showAnswers ? (
            <Button
              variant="secondary"
              className="btn-reveal-answer"
              onClick={() => {
                setShowAnswers(true);
                onViewedAnswers();
              }}
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

      {showAnswers && answers ? (
        <div className="answers-box" role="status">
          {readOnly ? (
            <p className="answers-box-label">Pareizā atbilde</p>
          ) : null}
          <ul className="answers-list">
            {answers.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
