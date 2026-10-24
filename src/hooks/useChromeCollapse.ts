import { useEffect, useRef, useState, type RefObject } from 'react';

const TOP_REVEAL_PX = 8;
const DELTA_PX = 12;

/**
 * Hide chrome when scrolling down in `scrollRef`; show again on scroll up
 * (or when near the top). No-op when `enabled` is false.
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

        if (top < TOP_REVEAL_PX) {
          setCollapsed(false);
          return;
        }
        if (delta > DELTA_PX) setCollapsed(true);
        else if (delta < -DELTA_PX) setCollapsed(false);
      });
    };

    el.addEventListener('scroll', onScroll, { passive: true });
    return () => el.removeEventListener('scroll', onScroll);
  }, [enabled, scrollRef]);

  return collapsed;
}
