'use client';

import React from 'react';
import styles from './intro.module.css';

interface FYCDLogoSVGProps {
  isPulsing?: boolean;
}

export const FYCDLogoSVG: React.FC<FYCDLogoSVGProps> = ({ isPulsing = false }) => {
  return (
    <img
      src="/FYCD_HD_original-match.svg"
      alt="FYCD HD Logo"
      className={`${styles.brandLogo} ${isPulsing ? styles.pulseActive : ''}`}
      aria-hidden="true"
    />
  );
};
