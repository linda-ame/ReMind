import { useEffect, useRef, type CSSProperties, type ReactNode } from 'react';
import { useApp } from '../context/AppContext';
import { useChromeCollapse } from '../hooks/useChromeCollapse';

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
  const mainRef = useRef<HTMLElement>(null);
  const showTitleBar = Boolean(subtitle || handleBack);
  // Home keeps brand always visible; elsewhere free vertical space for reading.
  const chromeCollapsed = useChromeCollapse(mainRef, showTitleBar);

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
      <div
        className={`app-chrome${chromeCollapsed ? ' app-chrome--hidden' : ''}`}
        aria-hidden={chromeCollapsed || undefined}
      >
        <div className="app-chrome-inner">
          <header className="app-header">
            {onHome ? (
              <button
                type="button"
                className="brand-btn"
                onClick={onHome}
                aria-label="ReMind — uz sākumu"
                tabIndex={chromeCollapsed ? -1 : undefined}
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
                  tabIndex={chromeCollapsed ? -1 : undefined}
                >
                  ← Atpakaļ
                </button>
              ) : null}
              {subtitle ? <h2 className="app-subtitle">{subtitle}</h2> : null}
            </div>
          ) : null}
        </div>
      </div>

      <main ref={mainRef} className={`app-main ${positionClass}`}>
        {children}
      </main>

      {footer ? <footer className="app-footer">{footer}</footer> : null}
    </div>
  );
}
