'use client';

import React, { useState, useEffect } from 'react';
import { FYCDLogoSVG } from './FYCDLogoSVG';
import styles from './intro.module.css';

const SESSION_KEY = 'fycd_intro_shown';

export const FYCDBrandIntro: React.FC = () => {
  const [mounted, setMounted] = useState(false);
  const [shouldShow, setShouldShow] = useState(false);
  const [isPulsing, setIsPulsing] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setMounted(true);

    // Prevent reading sessionStorage during SSR
    try {
      const alreadyShown = sessionStorage.getItem(SESSION_KEY);
      if (alreadyShown === 'true') {
        setIsCompleted(true);
        return;
      }
    } catch {
      // Fallback if sessionStorage is disabled/unavailable
    }

    setShouldShow(true);

    // Check prefers-reduced-motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      // Reduced motion: Quick 0.3s exit without line-drawing or pulse
      const reducedTimer = setTimeout(() => {
        setIsFadingOut(true);
        const completeTimer = setTimeout(() => {
          try {
            sessionStorage.setItem(SESSION_KEY, 'true');
          } catch {}
          setIsCompleted(true);
        }, 200);
        return () => clearTimeout(completeTimer);
      }, 300);

      return () => clearTimeout(reducedTimer);
    }

    // Timeline Timers for Full Motion (~2.3s Total)
    // 1.80s: Brand pulse animation
    const pulseTimer = setTimeout(() => {
      setIsPulsing(true);
    }, 1800);

    // 2.10s: Start Overlay fade-out
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 2100);

    // 2.35s: Complete & unmount from DOM, save session flag
    const completeTimer = setTimeout(() => {
      try {
        sessionStorage.setItem(SESSION_KEY, 'true');
      } catch {}
      setIsCompleted(true);
    }, 2350);

    return () => {
      clearTimeout(pulseTimer);
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, []);

  // SSR phase or animation already completed in this session
  if (!mounted || isCompleted || !shouldShow) {
    return null;
  }

  return (
    <div
      className={`${styles.overlay} ${isFadingOut ? styles.fadeOut : ''}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className={styles.container}>
        <div className={styles.svgWrapper}>
          <FYCDLogoSVG isPulsing={isPulsing} />
        </div>
      </div>
    </div>
  );
};
