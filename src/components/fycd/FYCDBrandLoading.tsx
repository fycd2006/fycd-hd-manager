'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import styles from './FYCDBrandLoading.module.css';
import { FycdLogo } from '@/components/brand/FycdLogo';

const SESSION_KEY = 'fycd_brand_loading_shown';
const EXIT_DURATION_MS = 400;
// FycdLogo 進場動畫總長約 1.4s（摺紙面延遲 0.7s＋0.7s）
const MIN_VISIBLE_MS = 1500;

interface FYCDBrandLoadingProps {
  show: boolean;
  workspaceReady: boolean;
  onExitComplete?: () => void;
  /** 進場淡入完成（含 reduced motion 與本 session 已播過的略過路徑）時呼叫一次 */
  onEntered?: () => void;
  /** 為 true 時忽略「本 session 已播過」旗標（登入後的載入一律覆蓋畫面） */
  replay?: boolean;
}

type Phase = 'hidden' | 'enter' | 'scan' | 'breathing' | 'exit';

export const FYCDBrandLoading: React.FC<FYCDBrandLoadingProps> = ({
  show,
  workspaceReady,
  onExitComplete,
  onEntered,
  replay = false
}) => {
  const [mounted, setMounted] = useState(false);
  const [phase, setPhase] = useState<Phase>('hidden');
  const phaseRef = useRef<Phase>('hidden');
  const skipCalledRef = useRef(false);
  const enteredRef = useRef(false);
  const startedAtRef = useRef(0);
  const reducedMotionRef = useRef(false);
  const exitTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const onEnteredRef = useRef(onEntered);

  useEffect(() => {
    onEnteredRef.current = onEntered;
  }, [onEntered]);

  const notifyEntered = useCallback(() => {
    if (enteredRef.current) return;
    enteredRef.current = true;
    onEnteredRef.current?.();
  }, []);

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
    if (exitTimerRef.current) {
      clearTimeout(exitTimerRef.current);
      exitTimerRef.current = null;
    }
    setPhase('exit');
    try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch {}
    setTimeout(() => {
      setPhase('hidden');
      onExitComplete?.();
    }, EXIT_DURATION_MS);
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
      enteredRef.current = false;
      try {
        if (!replay && sessionStorage.getItem(SESSION_KEY) === 'true') {
          notifyEntered();
          onExitComplete?.();
          return;
        }
      } catch {}

      // Start the intro sequence
      skipCalledRef.current = false;
      setPhase('enter');
      startedAtRef.current = Date.now();
      const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      reducedMotionRef.current = prefersReducedMotion;

      if (prefersReducedMotion) {
        notifyEntered();
        return;
      }

      // Enter phase lasts 0 - 250ms
      const scanTimer = setTimeout(() => {
        notifyEntered();
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
  }, [show, mounted, notifyEntered, replay]);

  useEffect(() => {
    if (!mounted) return;

    // 工作區就緒後退場；但至少讓 Logo 進場動畫播完（reduced motion 不等）
    if (workspaceReady && show && phase !== 'hidden' && phase !== 'exit') {
      if (skipCalledRef.current || exitTimerRef.current) return;

      const elapsed = Date.now() - startedAtRef.current;
      const remaining = reducedMotionRef.current ? 0 : Math.max(0, MIN_VISIBLE_MS - elapsed);

      exitTimerRef.current = setTimeout(() => {
        exitTimerRef.current = null;
        if (skipCalledRef.current) return;
        skipCalledRef.current = true;
        setPhase('exit');
        try { sessionStorage.setItem(SESSION_KEY, 'true'); } catch {}
        setTimeout(() => {
          setPhase('hidden');
          onExitComplete?.();
        }, EXIT_DURATION_MS);
      }, remaining);
    }
  }, [workspaceReady, show, phase, mounted, onExitComplete]);

  useEffect(() => () => {
    if (exitTimerRef.current) clearTimeout(exitTimerRef.current);
  }, []);

  if (!mounted || phase === 'hidden') return null;

  return (
    <div
      className={`${styles.overlay} ${styles[`phase-${phase}`]}`}
      role="status"
      aria-label="正在載入工作區"
    >
      <div className={styles.logoContainer}>
        <FycdLogo variant="full" animated height="auto" style={{ width: '100%' }} />
        <div className={styles.progress} />
      </div>
    </div>
  );
};

