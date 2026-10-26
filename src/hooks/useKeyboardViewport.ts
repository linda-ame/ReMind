import { useEffect } from 'react';

/**
 * Keeps the answer field just above the mobile keyboard.
 *
 * Browsers otherwise pan the page by roughly the keyboard height, so the
 * field (and the task number under it) float in a tall gap and the question
 * slides off the top. While the keyboard is open the shell tracks the visual
 * viewport, and a drag inside the task scrolls the question without blurring
 * the field.
 */

const KEYBOARD_MIN_PX = 140;

function isTextField(
  el: EventTarget | null,
): el is HTMLInputElement | HTMLTextAreaElement {
  if (!(el instanceof HTMLInputElement || el instanceof HTMLTextAreaElement)) {
    return false;
  }
  if (el.disabled || el.readOnly) return false;
  const type = el instanceof HTMLInputElement ? el.type : 'text';
  return type !== 'checkbox' && type !== 'radio' && type !== 'button' && type !== 'range';
}

function focusedField(): HTMLInputElement | HTMLTextAreaElement | null {
  const el = document.activeElement;
  return isTextField(el) ? el : null;
}

export function useKeyboardViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let baseline = Math.round(
      Math.max(window.innerHeight, (vv?.height ?? 0) + (vv?.offsetTop ?? 0)),
    );
    let baselineWidth = window.innerWidth;
    let userAdjusted = false;
    /** Compensates browsers that already position fixed elements in the visual viewport. */
    let offsetFix = 0;
    let pinFrame = 0;
    let gesture: { scroller: HTMLElement; startY: number } | null = null;

    const fullHeight = () =>
      Math.round(
        Math.max(window.innerHeight, (vv?.height ?? 0) + (vv?.offsetTop ?? 0)),
      );

    const keyboardInset = () => {
      if (!vv) return 0;
      return Math.max(0, baseline - vv.height - vv.offsetTop);
    };

    const close = () => {
      offsetFix = 0;
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--vv-height');
      root.style.removeProperty('--vv-offset');
    };

    const applyOffset = () => {
      if (!vv) return;
      root.style.setProperty(
        '--vv-offset',
        `${Math.round(vv.offsetTop + offsetFix)}px`,
      );
    };

    const pinField = (input: HTMLElement, allowPullDown: boolean) => {
      if (!vv) return;
      const scroller = input.closest('.app-main');
      if (!(scroller instanceof HTMLElement)) return;
      // getBoundingClientRect is relative to the visual viewport.
      const delta = input.getBoundingClientRect().bottom - (vv.height - 8);
      if (delta > 2 || (allowPullDown && delta < -2)) scroller.scrollTop += delta;
    };

    const schedulePin = (allowPullDown: boolean) => {
      cancelAnimationFrame(pinFrame);
      pinFrame = requestAnimationFrame(() => {
        const shell = document.querySelector('.app-shell');
        if (shell instanceof HTMLElement && vv) {
          const top = shell.getBoundingClientRect().top;
          if (Math.abs(top) > 2) {
            offsetFix -= top;
            applyOffset();
            const after = shell.getBoundingClientRect().top;
            if (Math.abs(after) >= Math.abs(top) - 1) {
              offsetFix += top;
              applyOffset();
            }
          }
        }
        const input = focusedField();
        if (!input) return;
        pinField(input, allowPullDown);
      });
    };

    const sync = () => {
      const input = focusedField();
      const width = window.innerWidth;
      if (Math.abs(width - baselineWidth) > 80) {
        baselineWidth = width;
        baseline = fullHeight();
        userAdjusted = false;
      }

      const open = Boolean(input) && keyboardInset() > KEYBOARD_MIN_PX;
      if (!open) {
        if (!input) {
          const next = fullHeight();
          // Ignore a mid-animation shrink after blur; follow growth and URL-bar jitter.
          if (next >= baseline - 80) baseline = next;
        }
        close();
        return;
      }

      if (!vv) return;
      root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
      applyOffset();
      root.classList.add('keyboard-open');
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      schedulePin(!userAdjusted);
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTextField(event.target)) return;
      if (event.isTrusted) {
        userAdjusted = false;
        offsetFix = 0;
      }
      sync();
    };

    const onFocusOut = () => {
      window.setTimeout(sync, 30);
    };

    // A drag on the question must not blur the field (that closes the keyboard).
    // preventDefault on pointerdown blocks the focus change but not touch scrolling.
    const onPointerDown = (event: PointerEvent) => {
      if (!focusedField()) return;
      const target = event.target;
      if (!(target instanceof Element)) return;
      if (target.closest('input, textarea, select, button, a, label, [role="button"]')) {
        return;
      }
      if (!target.closest('.app-main')) return;
      event.preventDefault();
    };

    const onTouchStart = (event: TouchEvent) => {
      gesture = null;
      if (!root.classList.contains('keyboard-open')) return;
      const touch = event.touches[0];
      const target = event.target;
      if (!touch || !(target instanceof Element)) return;
      const scroller = target.closest('.app-main');
      if (!(scroller instanceof HTMLElement)) return;
      gesture = { scroller, startY: touch.clientY };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture) return;
      const point = event.touches[0];
      if (!point) return;
      const dy = point.clientY - gesture.startY;
      const { scroller } = gesture;
      const atTop = scroller.scrollTop <= 0;
      const atBottom =
        scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
      // Rubber-band past the edges pans the page and dismisses the keyboard.
      if ((atTop && dy > 0) || (atBottom && dy < 0)) {
        event.preventDefault();
        return;
      }
      if (Math.abs(dy) > 8) userAdjusted = true;
    };

    const onTouchEnd = () => {
      gesture = null;
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('pointerdown', onPointerDown);
    document.addEventListener('touchstart', onTouchStart, { passive: true });
    document.addEventListener('touchmove', onTouchMove, { passive: false });
    document.addEventListener('touchend', onTouchEnd);
    document.addEventListener('touchcancel', onTouchEnd);
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);

    return () => {
      cancelAnimationFrame(pinFrame);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('pointerdown', onPointerDown);
      document.removeEventListener('touchstart', onTouchStart);
      document.removeEventListener('touchmove', onTouchMove);
      document.removeEventListener('touchend', onTouchEnd);
      document.removeEventListener('touchcancel', onTouchEnd);
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      close();
    };
  }, []);
}
