import { useEffect } from 'react';

/**
 * Keeps the answer field against the mobile keyboard.
 *
 * iOS pans the visual viewport and reports that pan as offsetTop. Subtracting
 * it from the height loss made the keyboard look closed, so the page stayed
 * in the browser’s pan: a tall gap under the field and “1/40” in that gap.
 * Height loss alone is the keyboard. While it is open, a drag on the question
 * scrolls the task and does not blur the field.
 */

const KEYBOARD_MIN_PX = 120;

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

function isScrollerChrome(target: Element): boolean {
  return Boolean(
    target.closest('input, textarea, select, button, a, label, [role="button"]'),
  );
}

export function useKeyboardViewport(): void {
  useEffect(() => {
    const root = document.documentElement;
    const vv = window.visualViewport;
    let baseline = Math.round(
      Math.max(window.innerHeight, (vv?.height ?? 0) + (vv?.offsetTop ?? 0)),
    );
    let baselineWidth = window.innerWidth;
    /** Stays true until blur so a later pan cannot drop the layout. */
    let open = false;
    let userAdjusted = false;
    let pinFrame = 0;
    let settleTimer = 0;
    let gesture: {
      scroller: HTMLElement;
      lastY: number;
      moved: number;
    } | null = null;

    const restingHeight = () =>
      Math.round(
        Math.max(window.innerHeight, (vv?.height ?? 0) + (vv?.offsetTop ?? 0)),
      );

    const heightLost = () => {
      if (!vv) return 0;
      // Do not subtract offsetTop — that is the browser pan, not the keyboard.
      return Math.max(0, baseline - vv.height);
    };

    const close = () => {
      open = false;
      gesture = null;
      root.classList.remove('keyboard-open');
      root.style.removeProperty('--vv-height');
      root.style.removeProperty('--vv-offset');
    };

    const alignShell = () => {
      if (!vv) return;
      const shell = document.querySelector('.app-shell');
      root.style.setProperty('--vv-height', `${Math.round(vv.height)}px`);
      root.style.setProperty('--vv-offset', `${Math.round(vv.offsetTop)}px`);
      if (!(shell instanceof HTMLElement)) return;

      const top = shell.getBoundingClientRect().top;
      if (Math.abs(top) > 1) {
        const adjusted = Math.round(vv.offsetTop - top);
        root.style.setProperty('--vv-offset', `${adjusted}px`);
        const after = shell.getBoundingClientRect().top;
        if (Math.abs(after) > Math.abs(top)) {
          root.style.setProperty('--vv-offset', `${Math.round(vv.offsetTop)}px`);
        }
      }

      // Snap the shell’s bottom edge to the visual viewport (the keyboard top).
      const placed = shell.getBoundingClientRect();
      const gap = vv.height - placed.bottom;
      if (Math.abs(gap) > 2 && Math.abs(placed.top) <= 2) {
        root.style.setProperty(
          '--vv-height',
          `${Math.round(placed.height + gap)}px`,
        );
      }
    };

    const pinField = () => {
      if (!vv || userAdjusted || gesture) return;
      const input = focusedField();
      if (!input?.closest('.answer-field')) return;
      const scroller = input.closest('.app-main');
      const shell = input.closest('.app-shell');
      if (!(scroller instanceof HTMLElement) || !(shell instanceof HTMLElement)) return;
      const box = input.closest('.answer-field') ?? input;
      const delta = box.getBoundingClientRect().bottom - shell.getBoundingClientRect().bottom;
      if (Math.abs(delta) > 1) scroller.scrollTop += delta;
    };

    const apply = () => {
      if (!vv) return;
      root.classList.add('keyboard-open');
      if (window.scrollX || window.scrollY) window.scrollTo(0, 0);
      alignShell();
      pinField();
    };

    const burstPin = () => {
      cancelAnimationFrame(pinFrame);
      let frames = 0;
      const step = () => {
        if (!open || userAdjusted) return;
        apply();
        frames += 1;
        if (frames < 12) pinFrame = requestAnimationFrame(step);
      };
      pinFrame = requestAnimationFrame(step);
    };

    const noteRestingHeight = () => {
      const next = restingHeight();
      if (next >= baseline - 80) baseline = next;
    };

    const sync = () => {
      const input = focusedField();
      const width = window.innerWidth;
      if (Math.abs(width - baselineWidth) > 80) {
        baselineWidth = width;
        baseline = restingHeight();
        userAdjusted = false;
        open = false;
      }

      if (!input?.closest('.answer-field')) {
        noteRestingHeight();
        userAdjusted = false;
        close();
        return;
      }

      if (!open && heightLost() >= KEYBOARD_MIN_PX) {
        open = true;
        userAdjusted = false;
      }
      if (!open) return;
      apply();
    };

    const onFocusIn = (event: FocusEvent) => {
      if (!isTextField(event.target) || !event.target.closest('.answer-field')) return;
      userAdjusted = false;
      gesture = null;
      // Touch devices: sit the field on the bottom edge as the keyboard animates,
      // before visualViewport has finished shrinking.
      if (window.matchMedia('(pointer: coarse)').matches) {
        open = true;
        apply();
        burstPin();
      } else {
        sync();
      }
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        if (!focusedField()) {
          close();
          return;
        }
        // Hardware keyboard on a tablet: the viewport never shrinks.
        if (heightLost() < 80) {
          userAdjusted = false;
          close();
          noteRestingHeight();
          return;
        }
        open = true;
        if (!userAdjusted) burstPin();
        else apply();
      }, 450);
    };

    const onFocusOut = () => {
      window.setTimeout(() => {
        if (!focusedField()) sync();
      }, 40);
    };

    // Capture + preventDefault keeps focus (and the keyboard) when the finger
    // lands on the question. Scrolling is applied by hand in touchmove.
    const onTouchStart = (event: TouchEvent) => {
      gesture = null;
      if (!open) return;
      const touch = event.touches[0];
      const target = event.target;
      if (!touch || !(target instanceof Element)) return;
      if (isScrollerChrome(target)) return;
      const scroller = target.closest('.app-main');
      if (!(scroller instanceof HTMLElement)) return;
      if (event.cancelable) event.preventDefault();
      gesture = { scroller, lastY: touch.clientY, moved: 0 };
    };

    const onTouchMove = (event: TouchEvent) => {
      if (!gesture) return;
      const point = event.touches[0];
      if (!point) return;
      if (event.cancelable) event.preventDefault();
      const dy = point.clientY - gesture.lastY;
      gesture.lastY = point.clientY;
      gesture.moved += dy;
      const max = Math.max(0, gesture.scroller.scrollHeight - gesture.scroller.clientHeight);
      const next = Math.min(max, Math.max(0, gesture.scroller.scrollTop - dy));
      gesture.scroller.scrollTop = next;
      if (Math.abs(gesture.moved) > 8) {
        userAdjusted = true;
        cancelAnimationFrame(pinFrame);
      }
    };

    const onTouchEnd = () => {
      gesture = null;
    };

    document.addEventListener('focusin', onFocusIn);
    document.addEventListener('focusout', onFocusOut);
    document.addEventListener('touchstart', onTouchStart, {
      passive: false,
      capture: true,
    });
    document.addEventListener('touchmove', onTouchMove, {
      passive: false,
      capture: true,
    });
    document.addEventListener('touchend', onTouchEnd, { capture: true });
    document.addEventListener('touchcancel', onTouchEnd, { capture: true });
    vv?.addEventListener('resize', sync);
    vv?.addEventListener('scroll', sync);
    window.addEventListener('resize', sync);

    return () => {
      cancelAnimationFrame(pinFrame);
      window.clearTimeout(settleTimer);
      document.removeEventListener('focusin', onFocusIn);
      document.removeEventListener('focusout', onFocusOut);
      document.removeEventListener('touchstart', onTouchStart, { capture: true });
      document.removeEventListener('touchmove', onTouchMove, { capture: true });
      document.removeEventListener('touchend', onTouchEnd, { capture: true });
      document.removeEventListener('touchcancel', onTouchEnd, { capture: true });
      vv?.removeEventListener('resize', sync);
      vv?.removeEventListener('scroll', sync);
      window.removeEventListener('resize', sync);
      close();
    };
  }, []);
}
