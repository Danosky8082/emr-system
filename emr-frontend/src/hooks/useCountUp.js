// src/hooks/useCountUp.js
//
// Animates a number from 0 to `target` over `duration` ms.
// Returns an integer that re-renders each frame.
//
// Usage:
//   const displayed = useCountUp(stats.totalPatients);
//   <span>{displayed.toLocaleString()}</span>
//
// Handles:
//   - target = 0 or null → returns 0 immediately, no animation
//   - target changing mid-animation → restarts from current value
//   - unmounting cleanly
//   - prefers-reduced-motion → snaps to target instantly
//
import { useState, useEffect, useRef } from 'react';

export const useCountUp = (target, duration = 800) => {
  const numericTarget =
    typeof target === 'number' && Number.isFinite(target) ? Math.max(0, target) : 0;

  const [value, setValue] = useState(0);
  const frameRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    // Respect the OS "reduce motion" setting
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || numericTarget === 0 || duration <= 0) {
      setValue(numericTarget);
      return;
    }

    // If we're already running an animation, start from the current
    // value so a mid-animation change doesn't snap back to 0.
    fromRef.current = value;
    startRef.current = null;

    const tick = (ts) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);
      // easeOutCubic
      const eased = 1 - Math.pow(1 - t, 3);
      const next = Math.round(fromRef.current + (numericTarget - fromRef.current) * eased);

      setValue(next);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      }
    };

    frameRef.current = requestAnimationFrame(tick);

    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericTarget, duration]);

  return value;
};

export default useCountUp;