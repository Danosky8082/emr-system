// src/hooks/useCountUp.js
//
// Dramatic count-up animation.
//
// Returns { value, isAnimating, progress } so callers can style
// the digit differently while it's still climbing vs when it settles.
//
import { useState, useEffect, useRef } from 'react';

export const useCountUp = (target, duration = 6000) => {
  const numericTarget =
    typeof target === 'number' && Number.isFinite(target) ? Math.max(0, target) : 0;

  const [value, setValue] = useState(0);
  const [progress, setProgress] = useState(0);
  const [isAnimating, setIsAnimating] = useState(numericTarget > 0);

  const frameRef = useRef(null);
  const startRef = useRef(null);
  const fromRef = useRef(0);

  useEffect(() => {
    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReduced || numericTarget === 0 || duration <= 0) {
      setValue(numericTarget);
      setProgress(1);
      setIsAnimating(false);
      return;
    }

    fromRef.current = value;
    startRef.current = null;
    setIsAnimating(true);

    const tick = (ts) => {
      if (startRef.current === null) startRef.current = ts;
      const elapsed = ts - startRef.current;
      const t = Math.min(1, elapsed / duration);

      // easeOutExpo — huge leap at the start, long crawl at the finish
      const eased = t === 1 ? 1 : 1 - Math.pow(2, -10 * t);
      const next = Math.round(fromRef.current + (numericTarget - fromRef.current) * eased);

      setValue(next);
      setProgress(t);

      if (t < 1) {
        frameRef.current = requestAnimationFrame(tick);
      } else {
        setIsAnimating(false);
      }
    };

    frameRef.current = requestAnimationFrame(tick);
    return () => {
      if (frameRef.current) cancelAnimationFrame(frameRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [numericTarget, duration]);

  return { value, isAnimating, progress };
};

export default useCountUp;