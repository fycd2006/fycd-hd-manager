'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './FYCDBrandLoading.module.css';

const SESSION_KEY = 'fycd_brand_loading_shown';

interface FYCDBrandLoadingProps {
  show: boolean;
  workspaceReady: boolean;
  onExitComplete?: () => void;
}

type Phase = 'hidden' | 'enter' | 'scan' | 'breathing' | 'exit';

export const FYCDBrandLoading: React.FC<FYCDBrandLoadingProps> = ({
  show,
  workspaceReady,
  onExitComplete
}) => {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('hidden');
  const phaseRef = useRef<Phase>('hidden');
  const startTimeRef = useRef<number>(0);
  const skipCalledRef = useRef(false);

  // Keep phase state in sync with ref for timeouts
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // On mount
  useEffect(() => {
    setMounted(true);
  }, []);

  // Skip handler: immediately exit
  const handleSkip = useCallback(() => {
    if (skipCalledRef.current) return;
    skipCalledRef.current = true;
    setPhase('exit');
    try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch {}
    setTimeout(() => {
      setPhase('hidden');
      onExitComplete?.();
    }, 200);
  }, [onExitComplete]);

  // Esc key and click to skip
  useEffect(() => {
    if (!mounted || phase === 'hidden') return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') handleSkip();
    };
    const handleClick = () => handleSkip();

    window.addEventListener('keydown', handleKeyDown);
    window.addEventListener('click', handleClick);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      window.removeEventListener('click', handleClick);
    };
  }, [mounted, phase, handleSkip]);

  useEffect(() => {
    if (!mounted) return;

    if (show && phase === 'hidden') {
      // Check sessionStorage — don't repeat in same session
      try {
        if (sessionStorage.getItem(SESSION_KEY) === 'true') {
          onExitComplete?.();
          return;
        }
      } catch {}

      // Start the intro sequence
      skipCalledRef.current = false;
      setPhase('enter');
      startTimeRef.current = Date.now();
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

      if (prefersReducedMotion) {
        return;
      }

      // Enter phase lasts 0 - 250ms
      const scanTimer = setTimeout(() => {
        if (phaseRef.current === 'enter') {
          setPhase('scan');
        }
      }, 250);

      // Scan phase lasts 250 - 550ms
      const breathingTimer = setTimeout(() => {
        if (phaseRef.current === 'scan') {
          setPhase('breathing');
        }
      }, 550);

      return () => {
        clearTimeout(scanTimer);
        clearTimeout(breathingTimer);
      };
    } else if (!show && phase !== 'hidden') {
      // If the parent forcibly turns it off (e.g. error)
      setPhase('hidden');
    }
  }, [show, mounted]);

  useEffect(() => {
    if (!mounted) return;

    // Trigger exit when workspace is ready — NO artificial delay
    if (workspaceReady && show && phase !== 'hidden' && phase !== 'exit') {
      if (skipCalledRef.current) return;
      skipCalledRef.current = true;

      const exitSequence = () => {
        setPhase('exit');
        try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch {}
        setTimeout(() => {
          setPhase('hidden');
          onExitComplete?.();
        }, 350); // wait for 350ms exit fade out
      };

      exitSequence();
    }
  }, [workspaceReady, show, phase, mounted, onExitComplete]);

  if (!mounted || phase === 'hidden') return null;

  return (
    <div
      className={`${styles.overlay} ${styles[`phase-${phase}`]}`}
      aria-hidden="true"
      role="presentation"
    >
      <div className={styles.logoContainer}>
        <img
          src={`/FYCD_HD_Premium_Sequential_PremiumGreen.svg?t=${startTimeRef.current}`}
          alt="FYCD HD Logo"
          className={styles.brandLogo}
        />
        <p style={{ 
          color: 'rgba(255,255,255,0.4)', 
          fontSize: '12px', 
          marginTop: '16px',
          fontFamily: 'system-ui, sans-serif',
          letterSpacing: '0.05em'
        }}>
          按 Esc 或點擊畫面跳過
        </p>
      </div>
    </div>
  );
};

