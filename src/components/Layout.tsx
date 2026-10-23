import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';

interface LayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  /** Section title shown below the header (e.g. task type). */
  subtitle?: string;
  /** If set, tapping ReMind returns home. Omit on the home screen. */
  onHome?: () => void;
  /** Back control next to the section title. Defaults to onHome when subtitle is set. */
  onBack?: () => void;
}

export function Layout({ children, footer, subtitle, onHome, onBack }: LayoutProps) {
  const { settings } = useApp();
  const handleBack = onBack ?? onHome;

  // Apply scale on <html> so every calc(var(--content-scale)) picks it up.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--content-scale', String(settings.contentScale));
    root.dataset.contentScale = String(settings.contentScale);
  }, [settings.contentScale]);

  const positionClass =
    settings.textPosition === 'top'
      ? 'content-top'
      : settings.textPosition === 'bottom'
        ? 'content-bottom'
        : 'content-middle';

  return (
    <div
      className={`app-shell${settings.highContrast ? ' high-contrast' : ''}`}
      data-scale={settings.contentScale}
      style={
        {
          '--content-scale': settings.contentScale,
          '--app-text-align': settings.textAlign,
        } as CSSProperties
      }
    >
      <header className="app-header">
        {onHome ? (
          <button
            type="button"
            className="brand-btn"
            onClick={onHome}
            aria-label="ReMind — uz sākumu"
          >
            ReMind
          </button>
        ) : (
          <h1 className="brand-static">ReMind</h1>
        )}
      </header>

      {subtitle ? (
        <div className="app-title-bar">
          {handleBack ? (
            <button
              type="button"
              className="page-back-btn"
              onClick={handleBack}
              aria-label="Atpakaļ"
            >
              ← Atpakaļ
            </button>
          ) : null}
          <h2 className="app-subtitle">{subtitle}</h2>
        </div>
      ) : null}

      <main className={`app-main ${positionClass}`}>{children}</main>

      {footer ? <footer className="app-footer">{footer}</footer> : null}
    </div>
  );
}
