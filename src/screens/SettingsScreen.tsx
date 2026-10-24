import { useEffect, useState } from 'react';
import { Layout } from '../components/Layout';
import { Button } from '../components/Button';
import { useApp } from '../context/AppContext';
import { useAuth } from '../context/AuthContext';
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
  onHome: () => void;
}

export function SettingsScreen({ onNavigate, onHome }: SettingsScreenProps) {
  const { settings, updateSettings, cloudSync } = useApp();
  const { user, configured, signOut } = useAuth();
  const [savedMsg, setSavedMsg] = useState<string | null>(null);
  const [accountMsg, setAccountMsg] = useState<string | null>(null);
  const [signingOut, setSigningOut] = useState(false);

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

  const handleSignOut = async () => {
    setAccountMsg(null);
    setSigningOut(true);
    try {
      await signOut();
      setAccountMsg('Izrakstīts. Progress šajā ierīcē paliek lokāli.');
    } catch (err) {
      setAccountMsg(err instanceof Error ? err.message : 'Neizdevās izrakstīties.');
    } finally {
      setSigningOut(false);
    }
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

      <div className="settings-block">
        <p className="settings-label">Konts</p>
        {user ? (
          <>
            <p className="muted settings-explain account-copy">{user.email}</p>
            <p className="muted settings-explain account-copy">
              Progress tiek sinhronizēts ar mākonī. Vārdu, e-pastu un paroli
              varat mainīt sadaļā Konts.
            </p>
            <Button
              variant="secondary"
              onClick={() => onNavigate({ name: 'auth' })}
            >
              Atvērt kontu
            </Button>
            <Button
              variant="danger"
              disabled={signingOut}
              onClick={() => void handleSignOut()}
            >
              {signingOut ? 'Izrakstās…' : 'Izrakstīties'}
            </Button>
          </>
        ) : (
          <>
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
          </>
        )}
        {accountMsg ? (
          <p className="settings-saved" role="status">
            {accountMsg}
          </p>
        ) : null}
      </div>

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
