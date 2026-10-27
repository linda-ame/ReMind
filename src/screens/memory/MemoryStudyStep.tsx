import { useEffect, useRef, useState } from 'react';
import { Button } from '../../components/Button';
import {
  pickLatvianVoice,
  speakLatvianSegments,
  stopLatvianSpeech,
} from '../../speech/lvTts';
import type { MemoryCategory, MemoryRecallTask } from '../../types/memory';

interface Props {
  task: MemoryRecallTask;
  playCount: number;
  visualOpen: boolean;
  visualFirst: boolean;
  onPlayed: () => void;
  onVisual: (open: boolean) => void;
  onReady: () => void;
}

function heading(category: MemoryCategory): string {
  switch (category) {
    case 'digits':
      return 'Noklausies ciparus';
    case 'numbers':
      return 'Noklausies skaitļus';
    case 'words':
      return 'Noklausies vārdus';
    case 'shopping':
      return 'Noklausies iepirkumus';
    case 'appointment':
      return 'Noklausies tikšanos';
  }
}

export function MemoryStudyStep({
  task,
  playCount,
  visualOpen,
  visualFirst,
  onPlayed,
  onVisual,
  onReady,
}: Props) {
  const [voiceReady, setVoiceReady] = useState(false);
  const [hasLatvian, setHasLatvian] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [speechError, setSpeechError] = useState<string | null>(null);
  const generation = useRef<{ cancelled: boolean }>({ cancelled: true });
  const revealed = useRef(false);

  useEffect(() => {
    const synth = window.speechSynthesis;
    if (!synth) {
      setVoiceReady(true);
      setHasLatvian(false);
      return;
    }
    const load = () => {
      setHasLatvian(pickLatvianVoice(synth.getVoices()) != null);
      setVoiceReady(true);
    };
    load();
    synth.addEventListener('voiceschanged', load);
    return () => {
      synth.removeEventListener('voiceschanged', load);
      generation.current.cancelled = true;
      stopLatvianSpeech();
    };
  }, []);

  useEffect(() => {
    if (!voiceReady || revealed.current) return;
    if (visualFirst || !hasLatvian) {
      revealed.current = true;
      if (!visualOpen) onVisual(true);
    }
  }, [voiceReady, hasLatvian, visualFirst, visualOpen, onVisual]);

  const stop = () => {
    generation.current.cancelled = true;
    stopLatvianSpeech();
    setSpeaking(false);
  };

  const play = () => {
    if (!hasLatvian) return;
    if (speaking) {
      stop();
      return;
    }
    const token = { cancelled: false };
    generation.current = token;
    setSpeechError(null);
    onPlayed();
    setSpeaking(true);
    void speakLatvianSegments(task.stimulus.ttsSegments, token).then((ok) => {
      if (token.cancelled) return;
      setSpeaking(false);
      if (!ok) {
        setSpeechError(
          'Neizdevās atskaņot latviešu balsi. Tekstu var apskatīt.',
        );
        if (!visualOpen) onVisual(true);
      }
    });
  };

  const showText = visualOpen;
  const listenLabel = speaking
    ? 'Apturēt'
    : playCount > 0
      ? 'Noklausīties vēlreiz'
      : 'Noklausīties';

  return (
    <div className="memory-flow">
      <h1 className="memory-heading">{heading(task.category)}</h1>
      <p className="memory-instruction">{task.instruction}</p>

      {showText ? (
        <p className="memory-stimulus">{task.stimulus.visualText}</p>
      ) : (
        <p className="memory-instruction">
          {voiceReady
            ? 'Teksts ir paslēpts. Varat noklausīties vai apskatīt.'
            : 'Sagatavo…'}
        </p>
      )}

      {voiceReady && !hasLatvian ? (
        <p className="memory-note" role="status">
          Latviešu balss šajā ierīcē nav pieejama. Teksts ir redzams.
        </p>
      ) : null}
      {speechError ? (
        <p className="memory-note" role="alert">
          {speechError}
        </p>
      ) : null}

      <div className="memory-actions">
        {hasLatvian ? (
          <Button variant="secondary" onClick={play}>
            {listenLabel}
          </Button>
        ) : null}
        <Button
          variant="secondary"
          onClick={() => onVisual(!showText)}
        >
          {showText ? 'Paslēpt' : 'Apskatīt'}
        </Button>
        <Button variant="primary" onClick={onReady}>
          Esmu gatavs
        </Button>
      </div>
    </div>
  );
}
