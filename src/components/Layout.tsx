import {
  useEffect,
  useLayoutEffect,
  useRef,
  type CSSProperties,
  type MouseEvent,
  type PointerEvent,
  type ReactNode,
  type TouchEvent,
} from 'react';
import { useApp } from '../context/AppContext';
import type { Screen } from '../navigation/types';
import type { HomeView } from '../types/progress';
import {
  adjacentMenuSection,
  menuSectionLabel,
  menuSectionScreen,
  type MenuSection,
} from '../utils/sectionPractice';

interface LayoutProps {
  children: ReactNode;
  footer?: ReactNode;
  /** If set, tapping ReMind / the R mark returns home. Omit on the home screen. */
  onHome?: () => void;
  /**
   * Home practice section. Header shows the R mark, this section’s name
   * (no task count), and arrows to the previous / next section.
   */
  sectionType?: MenuSection;
  onNavigate?: (screen: Screen) => void;
  /** Home only. Puts Teksts / Ikonas on either side of the title. */
  homeView?: HomeView;
  onHomeViewChange?: (view: HomeView) => void;
}

export function Layout({
  children,
  footer,
  onHome,
  sectionType,
  onNavigate,
  homeView,
  onHomeViewChange,
}: LayoutProps) {
  const { settings, attempts, taskSkips } = useApp();
  /** Avoid double-fire when Android synthesizes click after pointerup. */
  const homeFiredAt = useRef(0);
  const chromeRef = useRef<HTMLDivElement>(null);

  // Apply scale on <html> so every calc(var(--content-scale)) picks it up.
  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--content-scale', String(settings.contentScale));
    root.dataset.contentScale = String(settings.contentScale);
  }, [settings.contentScale]);

  // Header is outside the scrollport. Measure it so task layout still fits.
  useLayoutEffect(() => {
    const el = chromeRef.current;
    if (!el) return;
    const apply = () => {
      const shell = el.closest('.app-shell');
      if (!(shell instanceof HTMLElement)) return;
      shell.style.setProperty(
        '--app-chrome-offset',
        `${el.getBoundingClientRect().height}px`,
      );
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => observer.disconnect();
  }, [sectionType]);

  const positionClass =
    settings.textPosition === 'top'
      ? 'content-top'
      : settings.textPosition === 'bottom'
        ? 'content-bottom'
        : 'content-middle';

  const goHome = () => {
    if (!onHome) return;
    const now = Date.now();
    if (now - homeFiredAt.current < 400) return;
    homeFiredAt.current = now;
    onHome();
  };

  const homeHandlers = {
    onClick: (e: MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      goHome();
    },
    onPointerUp: (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (e.pointerType === 'touch' || e.pointerType === 'pen') {
        e.preventDefault();
        e.stopPropagation();
        goHome();
      }
    },
    onTouchStart: (e: TouchEvent) => {
      e.stopPropagation();
    },
    onTouchEnd: (e: TouchEvent) => {
      e.stopPropagation();
    },
  };

  const prevSection = sectionType ? adjacentMenuSection(sectionType, -1) : null;
  const nextSection = sectionType ? adjacentMenuSection(sectionType, 1) : null;

  const openSection = (section: MenuSection) => {
    if (!onNavigate) return;
    onNavigate(menuSectionScreen(section, attempts, taskSkips));
  };

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
      <div className="app-chrome" ref={chromeRef}>
        <header
          className={
            sectionType
              ? 'app-header app-header-section'
              : onHomeViewChange
                ? 'app-header app-header-home'
                : 'app-header'
          }
        >
          {sectionType ? (
            <>
              <button
                type="button"
                className="brand-mark"
                aria-label="ReMind — uz sākumu"
                {...homeHandlers}
              >
                <span aria-hidden="true">R</span>
              </button>
              <p className="section-switch-title">
                {menuSectionLabel(sectionType)}
              </p>
              <div className="section-switch">
                <button
                  type="button"
                  className="section-switch-btn"
                  aria-label="Iepriekšējā sadaļa"
                  disabled={!prevSection}
                  onClick={() => {
                    if (prevSection) openSection(prevSection);
                  }}
                >
                  <span aria-hidden="true">←</span>
                </button>
                <button
                  type="button"
                  className="section-switch-btn"
                  aria-label="Nākamā sadaļa"
                  disabled={!nextSection}
                  onClick={() => {
                    if (nextSection) openSection(nextSection);
                  }}
                >
                  <span aria-hidden="true">→</span>
                </button>
              </div>
            </>
          ) : onHome ? (
            <button
              type="button"
              className="brand-btn"
              aria-label="ReMind — uz sākumu"
              {...homeHandlers}
            >
              ReMind
            </button>
          ) : (
            <>
              {onHomeViewChange ? (
                <button
                  type="button"
                  className="home-view-side"
                  aria-pressed={homeView === 'text'}
                  onClick={() => onHomeViewChange('text')}
                >
                  Teksts
                </button>
              ) : null}
              <h1 className="brand-static">ReMind</h1>
              {onHomeViewChange ? (
                <button
                  type="button"
                  className="home-view-side home-view-side-end"
                  aria-pressed={homeView === 'icons'}
                  onClick={() => onHomeViewChange('icons')}
                >
                  Ikonas
                </button>
              ) : null}
            </>
          )}
        </header>
      </div>

      <main className="app-main">
        <div className={`app-main-body ${positionClass}`}>{children}</div>
      </main>

      {footer ? <footer className="app-footer">{footer}</footer> : null}
    </div>
  );
}
