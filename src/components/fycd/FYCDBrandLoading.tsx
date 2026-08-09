'use client';

import React, { useEffect, useState, useRef } from 'react';
import styles from './FYCDBrandLoading.module.css';

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

  // Keep phase state in sync with ref for timeouts
  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  // On mount
  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!mounted) return;

    if (show && phase === 'hidden') {
      // Start the intro sequence
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

    // Trigger exit when workspace is ready, but only if we are currently showing it
    if (workspaceReady && show && phase !== 'hidden' && phase !== 'exit') {
      const elapsed = Date.now() - startTimeRef.current;
      const remainingTime = Math.max(0, 1500 - elapsed);
      
      const exitSequence = () => {
        setPhase('exit');
        setTimeout(() => {
          setPhase('hidden');
          onExitComplete?.();
        }, 350); // wait for 350ms exit fade out
      };

      if (remainingTime > 0) {
        const minTimer = setTimeout(exitSequence, remainingTime);
        return () => clearTimeout(minTimer);
      } else {
        exitSequence();
      }
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
      </div>
    </div>
  );
};
