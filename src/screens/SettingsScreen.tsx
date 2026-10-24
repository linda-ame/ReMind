import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import type { Screen } from '../navigation/types';
import {
  CONTENT_SCALE_MAX,
  CONTENT_SCALE_MIN,
  CONTENT_SCALE_OPTIONS,
  CONTENT_SCALE_STEP,
  isContentScalePreset,
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

  const change = async (
    partial: Parameters<typeof updateSettings>[0],
    announce = true,
  ) => {
    await updateSettings(partial);
    if (announce) setSavedMsg('Saglabāts');
  };

  const percent = Math.round(settings.contentScale * 100);

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
                isContentScalePreset(settings.contentScale, opt.value)
                  ? 'primary'
                  : 'secondary'
              }
              onClick={() => void change({ contentScale: opt.value })}
            >
              {opt.label}
              {opt.value === 1 ? ' (ieteicams)' : ''} — {opt.note}
            </Button>
          ))}
        </div>

        <div className="scale-slider-block">
          <label className="settings-label" htmlFor="content-scale-slider">
            Precīzāk — pabīdiet
          </label>
          <p className="muted settings-explain">
            Starp ātrajām izvēlēm vai vēl lielāks / mazāks.
          </p>
          <div className="scale-slider-row">
            <span className="scale-slider-end" aria-hidden="true">
              A
            </span>
            <input
              id="content-scale-slider"
              className="scale-slider"
              type="range"
              min={CONTENT_SCALE_MIN}
              max={CONTENT_SCALE_MAX}
              step={CONTENT_SCALE_STEP}
              value={settings.contentScale}
              aria-valuemin={CONTENT_SCALE_MIN}
              aria-valuemax={CONTENT_SCALE_MAX}
              aria-valuenow={settings.contentScale}
              aria-valuetext={`${percent} procenti`}
              onInput={(e) => {
                const value = Number(e.currentTarget.value);
                void change({ contentScale: value }, false);
              }}
              onChange={(e) => {
                const value = Number(e.currentTarget.value);
                void change({ contentScale: value }, true);
              }}
            />
            <span className="scale-slider-end scale-slider-end-lg" aria-hidden="true">
              A
            </span>
          </div>
          <p className="scale-slider-value" aria-live="polite">
            {percent}%
          </p>
        </div>

        <p className="preview-text" aria-live="polite">
          Paraugs ({percent}%): māja, ūdens, saule
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
