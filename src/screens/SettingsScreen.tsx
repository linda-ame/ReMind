import { useEffect, useState } from 'react';
import {
  loadMemoryVisualFirst,
  saveMemoryVisualFirst,
} from '../utils/memoryVisual';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
import type { Screen } from '../navigation/types';
import {
  clampContentScale,
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
  onHome: () => void;
}

export function SettingsScreen({ onNavigate, onHome }: SettingsScreenProps) {
  const { settings, updateSettings, cloudSync } = useApp();
  const { user, configured } = useAuth();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [memoryVisualFirst, setMemoryVisualFirst] = useState(
    loadMemoryVisualFirst,
  );

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
  const atMin = settings.contentScale <= CONTENT_SCALE_MIN + 0.001;
  const atMax = settings.contentScale >= CONTENT_SCALE_MAX - 0.001;

  const nudgeScale = (direction: -1 | 1) => {
    const next = clampContentScale(
      settings.contentScale + direction * CONTENT_SCALE_STEP,
    );
    if (Math.abs(next - settings.contentScale) < 0.001) return;
    void change({ contentScale: next });
  };

  return (
    <Layout onHome={onHome}>
      <p className="muted settings-hint">
        {cloudSync
          ? 'Izmaiņas saglabājas mākonī (un ir pieejamas citā ierīcē).'
          : 'Izmaiņas saglabājas automātiski šajā ierīcē.'}
      </p>
      {savedMsg ? (
        <p className="settings-saved" role="status">
          {savedMsg}
        </p>
      ) : null}

      {user ? null : (
        <div className="settings-block">
          <p className="settings-label">Konts</p>
          <p className="muted settings-explain">
            {configured
              ? 'Bez konta progress paliek tikai šajā ierīcē. Izveidojiet kontu, lai saglabātu mākonī.'
              : 'Konts nav konfigurēts (trūkst Supabase atslēgu). Progress joprojām darbojas lokāli.'}
          </p>
          <Button
            variant="secondary"
            onClick={() => onNavigate({ name: 'auth' })}
          >
            Ielogoties / reģistrēties
          </Button>
        </div>
      )}

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
          <div className="scale-stepper" role="group" aria-label="Burtu izmērs">
            <Button
              variant="secondary"
              fullWidth={false}
              className="scale-step-btn"
              aria-label="Samazināt par 5 procentiem"
              disabled={atMin}
              onClick={() => nudgeScale(-1)}
            >
              −
            </Button>
            <p className="scale-slider-value" aria-live="polite">
              {percent}%
            </p>
            <Button
              variant="secondary"
              fullWidth={false}
              className="scale-step-btn"
              aria-label="Palielināt par 5 procentiem"
              disabled={atMax}
              onClick={() => nudgeScale(1)}
            >
              +
            </Button>
          </div>
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
        <p className="settings-label">Atmiņas uzdevumi</p>
        <p className="muted settings-explain">
          Ja ieslēgts, iegaumēšanas laikā teksts ir redzams uzreiz. Ja izslēgts
          un ierīcē ir latviešu balss, teksts paliek paslēpts, līdz nospiežat
          Apskatīt.
        </p>
        <Button
          variant={memoryVisualFirst ? 'primary' : 'secondary'}
          onClick={() => {
            const next = !memoryVisualFirst;
            saveMemoryVisualFirst(next);
            setMemoryVisualFirst(next);
            setSavedMsg('Saglabāts');
          }}
        >
          {memoryVisualFirst
            ? 'Rādīt tekstu uzreiz: ieslēgts'
            : 'Rādīt tekstu uzreiz: izslēgts'}
        </Button>
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
