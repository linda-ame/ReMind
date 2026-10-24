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
  const showTitleBar = Boolean(subtitle || handleBack);

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
      {/*
        Chrome lives inside the scroll container so it moves with the finger —
        never sticky, never JS-collapsed. It only comes back at the top.
      */}
      <main className="app-main">
        <div className="app-chrome">
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

          {showTitleBar ? (
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
              {subtitle ? <h2 className="app-subtitle">{subtitle}</h2> : null}
            </div>
          ) : null}
        </div>

        <div className={`app-main-body ${positionClass}`}>{children}</div>
      </main>

      {footer ? <footer className="app-footer">{footer}</footer> : null}
    </div>
  );
}
