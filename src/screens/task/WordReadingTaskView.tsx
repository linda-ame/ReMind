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
 * Scale the word down until it fits the available area (width + height).
 * Long words like “rakstāmmašīna” / “spilvendrāna” stay fully visible.
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
      if (maxW < 40 || maxH < 40) return;

      const scale = Number.isFinite(contentScale) ? contentScale : 1;
      const fontMin = Math.round(FONT_MIN_BASE_PX * scale);
      const fontMax = Math.round(FONT_MAX_BASE_PX * scale);

      let lo = fontMin;
      let hi = Math.min(fontMax, Math.floor(maxH * 0.85));
      let best = lo;

      el.style.whiteSpace = 'nowrap';
      el.style.fontSize = `${hi}px`;

      // If even max fits, use it; else binary-search.
      if (el.scrollWidth <= maxW && el.scrollHeight <= maxH) {
        setFontPx(hi);
        return;
      }

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        el.style.fontSize = `${mid}px`;
        const fits =
          el.scrollWidth <= maxW && el.scrollHeight <= maxH;
        if (fits) {
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
        // Shrink further with wrap enabled
        lo = fontMin;
        hi = best;
        best = fontMin;
        while (lo <= hi) {
          const mid = Math.floor((lo + hi) / 2);
          el.style.fontSize = `${mid}px`;
          if (el.scrollWidth <= maxW && el.scrollHeight <= maxH) {
            best = mid;
            lo = mid + 1;
          } else {
            hi = mid - 1;
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
