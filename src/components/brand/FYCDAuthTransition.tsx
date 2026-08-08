'use client';

import React, { useState, useEffect } from 'react';
import styles from './auth-transition.module.css';

interface FYCDAuthTransitionProps {
  onComplete?: () => void;
  statusHint?: string;
}

export const FYCDAuthTransition: React.FC<FYCDAuthTransitionProps> = ({
  onComplete,
  statusHint = '驗證成功，正在切換至工作區...'
}) => {
  const [mounted, setMounted] = useState(false);
  const [isFadingOut, setIsFadingOut] = useState(false);
  const [isCompleted, setIsCompleted] = useState(false);

  useEffect(() => {
    setMounted(true);

    const prefersReducedMotion = typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    if (prefersReducedMotion) {
      const quickTimer = setTimeout(() => {
        setIsFadingOut(true);
        setTimeout(() => {
          setIsCompleted(true);
          onComplete?.();
        }, 150);
      }, 150);
      return () => clearTimeout(quickTimer);
    }

    // Fast 0.45s - 0.60s Auth Transition
    const fadeOutTimer = setTimeout(() => {
      setIsFadingOut(true);
    }, 450);

    const completeTimer = setTimeout(() => {
      setIsCompleted(true);
      onComplete?.();
    }, 650);

    return () => {
      clearTimeout(fadeOutTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  if (!mounted || isCompleted) return null;

  return (
    <div
      className={`${styles.overlay} ${isFadingOut ? styles.fadeOut : ''}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className={styles.container}>
        <img
          src="/logo.png"
          alt="FYCD HD Logo"
          className={`${styles.miniLogo} ${styles.pulseNode}`}
        />
        <span className={styles.text}>{statusHint}</span>
      </div>
    </div>
  );
};
