import { useLayoutEffect, useRef, useState } from 'react';
import type { WordReadingTask } from '../../types/task';
import { useApp } from '../../context/AppContext';

interface Props {
  task: WordReadingTask;
}

/** Base caps at contentScale 1; settings scale raises the target size. */
const FONT_MAX_BASE_PX = 120;
const FONT_MIN_BASE_PX = 28;

/**
 * Fit the word primarily to WIDTH so landscape (wider) can stay large.
 * Height is a soft limit only; the container may scroll a little if needed.
 * `contentScale` from settings raises min/max so “Lielāks” grows task words too.
 */
function useFitWord(word: string, contentScale: number) {
  const containerRef = useRef<HTMLDivElement>(null);
  const wordRef = useRef<HTMLParagraphElement>(null);
  const [fontPx, setFontPx] = useState(
    Math.round(FONT_MAX_BASE_PX * contentScale),
  );

  useLayoutEffect(() => {
    const container = containerRef.current;
    const el = wordRef.current;
    if (!container || !el) return;

    const fit = () => {
      const maxW = container.clientWidth;
      const maxH = container.clientHeight;
      if (maxW < 40) return;

      const scale = Number.isFinite(contentScale) ? contentScale : 1;
      const fontMin = Math.round(FONT_MIN_BASE_PX * scale);
      const fontMax = Math.round(FONT_MAX_BASE_PX * scale);

      // Soft height cap: never crush below ~65% of desired max just because
      // landscape height is short (container can scroll).
      const softHeightCap =
        maxH >= 40 ? Math.floor(maxH * 0.92) : fontMax;
      const heightFloor = Math.round(fontMax * 0.65);
      let hi = Math.min(
        fontMax,
        Math.max(softHeightCap, Math.min(heightFloor, fontMax)),
      );

      let lo = fontMin;
      let best = lo;

      el.style.whiteSpace = 'nowrap';
      el.style.fontSize = `${hi}px`;

      // Prefer width fit; height overflow is OK (scroll).
      if (el.scrollWidth <= maxW) {
        setFontPx(hi);
        el.style.fontSize = `${hi}px`;
        return;
      }

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = `${mid}px`;
        if (el.scrollWidth <= maxW) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      // Still overflowing at min → allow wrap as last resort
      el.style.fontSize = `${best}px`;
      if (el.scrollWidth > maxW) {
        el.style.whiteSpace = 'normal';
        lo = fontMin;
        let wrapHi = best;
        best = fontMin;
        while (lo <= wrapHi) {
          const mid = Math.floor((lo + wrapHi) / 2);
          el.style.fontSize = `${mid}px`;
          if (el.scrollWidth <= maxW) {
            best = mid;
            lo = mid + 1;
          } else {
            wrapHi = mid - 1;
          }
        }
      }

      setFontPx(best);
      el.style.fontSize = `${best}px`;
    };

    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(container);
    window.addEventListener('resize', fit);
    return () => {
      ro.disconnect();
      window.removeEventListener('resize', fit);
    };
  }, [word, contentScale]);

  return { containerRef, wordRef, fontPx };
}

/** Minimal mode: only the word — no instruction, hint, or extra copy. */
export function WordReadingTaskView({ task }: Props) {
  const { settings } = useApp();
  const { containerRef, wordRef, fontPx } = useFitWord(
    task.word,
    settings.contentScale,
  );

  return (
    <div ref={containerRef} className="task-view task-view-word-reading">
      <p
        ref={wordRef}
        className="focus-word-reading"
        lang="lv"
        style={{ fontSize: fontPx }}
      >
        {task.word}
      </p>
    </div>
  );
}
