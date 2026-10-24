import { useEffect, useRef, useState, type RefObject } from 'react';

/**
 * Hide chrome as soon as the user scrolls down; show again on scroll up
 * (or when back at the top). No-op when `enabled` is false.
 */
export function useChromeCollapse(
  scrollRef: RefObject<HTMLElement | null>,
  enabled: boolean,
): boolean {
  const [collapsed, setCollapsed] = useState(false);
  const lastTop = useRef(0);
  const ticking = useRef(false);

  useEffect(() => {
    if (!enabled) {
      setCollapsed(false);
      return;
    }

    const el = scrollRef.current;
    if (!el) return;

    lastTop.current = el.scrollTop;
    setCollapsed(false);

    const onScroll = () => {
      if (ticking.current) return;
      ticking.current = true;
      requestAnimationFrame(() => {
        ticking.current = false;
        const top = el.scrollTop;
        const delta = top - lastTop.current;
        lastTop.current = top;

        if (top <= 0) {
          setCollapsed(false);
          return;
        }
        // Any downward movement hides immediately; any upward reveals.
        if (delta > 0) setCollapsed(true);
        else if (delta < 0) setCollapsed(false);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [enabled, scrollRef]);

  return collapsed;
}
