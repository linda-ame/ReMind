import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import type { Screen } from '../navigation/types';
import {
  CONTENT_SCALE_OPTIONS,
  type ContentScale,
  type TextAlign,
  type TextPosition,
} from '../types/progress';

interface SettingsScreenProps {
  onNavigate: (screen: Screen) => void;
  onBack: () => void;
  onHome: () => void;
}

export function SettingsScreen({ onBack, onHome }: SettingsScreenProps) {
  const { settings, updateSettings } = useApp();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!savedMsg) return;
    const t = window.setTimeout(() => setSavedMsg(null), 2000);
    return () => window.clearTimeout(t);
  }, [savedMsg]);

  const change = async (partial: Parameters<typeof updateSettings>[0]) => {
    await updateSettings(partial);
    setSavedMsg('Saglabāts');
  };

  return (
    <Layout subtitle="Iestatījumi" onHome={onHome} onBack={onBack}>
      <p className="muted settings-hint">
        Izmaiņas saglabājas automātiski šajā ierīcē.
      </p>
      {savedMsg ? (
        <p className="settings-saved" role="status">
          {savedMsg}
        </p>
      ) : null}

      <div className="settings-block">
        <p className="settings-label">Satura izmērs</p>
        <p className="muted settings-explain">
          Maina arī pašu uzdevumu tekstu (vārdus, teikumus, lasāmo tekstu), ne
          tikai pogas. Standarts pielāgojas ekrānam; ja vajag lielākus
          burtus — palieliniet.
        </p>
        <div className="stack scale-stack">
          {CONTENT_SCALE_OPTIONS.map((opt) => (
            <Button
              key={opt.value}
              variant={
                settings.contentScale === opt.value ? 'primary' : 'secondary'
              }
              onClick={() =>
                void change({ contentScale: opt.value as ContentScale })
              }
            >
              {opt.label}
              {opt.value === 1 ? ' (ieteicams)' : ''} — {opt.note}
            </Button>
          ))}
        </div>
        <p className="preview-text" aria-live="polite">
          Paraugs ({Math.round(settings.contentScale * 100)}%): māja, ūdens,
          saule
        </p>
      </div>

      <div className="settings-block">
        <p className="settings-label">Teksta novietojums (redzes laukam)</p>
        <div className="btn-row">
          {([
            ['left', 'Pa kreisi'],
            ['center', 'Centrā'],
            ['right', 'Pa labi'],
          ] as [TextAlign, string][]).map(([value, label]) => (
            <Button
              key={value}
              variant={settings.textAlign === value ? 'primary' : 'secondary'}
              onClick={() => void change({ textAlign: value })}
            >
              {label}
            </Button>
          ))}
        </div>
        <div className="btn-row">
          {([
            ['top', 'Augšā'],
            ['middle', 'Vidū'],
            ['bottom', 'Apakšā'],
          ] as [TextPosition, string][]).map(([value, label]) => (
            <Button
              key={value}
              variant={settings.textPosition === value ? 'primary' : 'secondary'}
              onClick={() => void change({ textPosition: value })}
            >
              {label}
            </Button>
          ))}
        </div>
      </div>

      <div className="settings-block">
        <p className="settings-label">Kontrasts</p>
        <Button
          variant={settings.highContrast ? 'primary' : 'secondary'}
          onClick={() =>
            void change({ highContrast: !settings.highContrast })
          }
        >
          {settings.highContrast
            ? 'Augsts kontrasts: ieslēgts'
            : 'Augsts kontrasts: izslēgts'}
        </Button>
      </div>
    </Layout>
  );
}
