'use client';

import React from 'react';
import styles from './intro.module.css';

interface FYCDLogoSVGProps {
  isPulsing?: boolean;
}

export const FYCDLogoSVG: React.FC<FYCDLogoSVGProps> = ({ isPulsing = false }) => {
  return (
    <svg
      viewBox="0 0 1000 1000"
      className={`${styles.brandLogo} ${isPulsing ? styles.pulseActive : ''}`}
      aria-hidden="true"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      {/* Layer 1: Outer Green Circuit Arc (Top-Left to Top-Right) */}
      <g className={styles.arcGreen}>
        <path
          d="M 185,570 A 370,370 0 1,1 640,160"
          stroke="#52A628"
          strokeWidth="15"
          strokeLinecap="round"
        />
        <circle cx="640" cy="160" r="14" fill="#52A628" />
      </g>

      {/* Layer 2: Outer Orange Circuit Arc (Right to Bottom) */}
      <g className={styles.arcOrange}>
        <path
          d="M 815,350 A 370,370 0 0,1 480,860"
          stroke="#F97316"
          strokeWidth="15"
          strokeLinecap="round"
        />
        {/* Bottom decorative dash & node */}
        <path
          d="M 440,860 L 560,860"
          stroke="#F97316"
          strokeWidth="13"
          strokeLinecap="round"
        />
        <circle cx="700" cy="805" r="10" fill="#F97316" />
      </g>

      {/* Layer 3: Circuit Chopsticks & Traces (Top Right) */}
      <g className={styles.circuitNodes}>
        {/* Chopstick 1 */}
        <path
          d="M 530,420 L 730,220 L 775,220"
          stroke="#F97316"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="775" cy="220" r="12" fill="#F97316" />

        {/* Chopstick 2 */}
        <path
          d="M 570,420 L 770,260 L 800,260"
          stroke="#F97316"
          strokeWidth="14"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <circle cx="800" cy="260" r="12" fill="#F97316" />

        {/* Trace 3 */}
        <path
          d="M 700,320 L 750,320"
          stroke="#F97316"
          strokeWidth="12"
          strokeLinecap="round"
        />
        <circle cx="750" cy="320" r="10" fill="#F97316" />
      </g>

      {/* Layer 4: Food Elements */}
      <g className={styles.foodElements}>
        {/* Orange Heart */}
        <path
          d="M 415,275 C 400,250 365,265 375,295 C 385,320 415,338 415,338 C 415,338 445,320 455,295 C 465,265 430,250 415,275 Z"
          fill="#F97316"
        />

        {/* Small Leaf Sprout */}
        <path
          d="M 305,328 C 300,305 320,285 345,285 C 345,310 325,330 305,328 Z"
          fill="#52A628"
        />
        <path
          d="M 345,300 C 355,285 370,290 370,305 C 365,318 350,320 345,300 Z"
          fill="#52A628"
        />

        {/* Large Salad Leaf */}
        <path
          d="M 455,410 C 445,340 505,265 595,265 C 605,335 545,410 455,410 Z"
          fill="#52A628"
        />
        <path
          d="M 475,390 C 495,350 535,305 575,285"
          stroke="#74C643"
          strokeWidth="6"
          strokeLinecap="round"
        />

        {/* Orange/Tomato Dome */}
        <path
          d="M 315,415 C 315,360 375,355 440,355 C 475,355 480,395 480,435 L 315,435 Z"
          fill="#F97316"
        />
      </g>

      {/* Layer 5: Bowl Group */}
      <g className={styles.bowlGroup}>
        {/* Bowl Rim Shadow */}
        <path
          d="M 290,425 C 290,425 485,460 685,405 C 645,545 565,585 500,585 C 435,585 355,545 290,425 Z"
          fill="#F97316"
        />
        {/* Bowl Main Green Body */}
        <path
          d="M 285,425 C 285,425 485,445 680,405 C 660,535 570,575 500,575 C 430,575 340,535 285,425 Z"
          fill="#52A628"
        />
        {/* Bowl Top Rim */}
        <path
          d="M 285,425 Q 485,465 680,405"
          stroke="#52A628"
          strokeWidth="20"
          strokeLinecap="round"
        />
        {/* Bowl Base Stand */}
        <path
          d="M 390,555 C 390,555 440,585 500,585 C 560,585 610,555 610,555 L 590,590 C 590,590 540,600 500,600 C 460,600 410,590 410,590 Z"
          fill="#F97316"
        />
        {/* Bowl Accents */}
        <line x1="540" y1="450" x2="540" y2="485" stroke="#52A628" strokeWidth="12" strokeLinecap="round" />
        <line x1="570" y1="450" x2="570" y2="485" stroke="#52A628" strokeWidth="12" strokeLinecap="round" />
      </g>

      {/* Layer 6: 中文品牌名稱 「北科伙食團」 */}
      <g className={styles.textZh}>
        <text
          x="185"
          y="690"
          fill="#52A628"
          fontSize="115"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="-0.02em"
        >
          北科
        </text>
        <text
          x="445"
          y="690"
          fill="#F97316"
          fontSize="115"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="-0.02em"
        >
          伙食
        </text>
        {/* 「團」 Green Tag */}
        <rect x="700" y="595" width="112" height="112" rx="22" fill="#52A628" />
        <text
          x="716"
          y="682"
          fill="#FFFFFF"
          fontSize="82"
          fontWeight="900"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
        >
          團
        </text>
      </g>

      {/* Layer 7: 英文副標題 「o-- FYCD HD --o」 */}
      <g className={styles.textEn}>
        {/* Left Circuit Connector */}
        <circle cx="235" cy="765" r="9" stroke="#52A628" strokeWidth="5" fill="none" />
        <path d="M 244,765 L 315,765 L 335,780 L 355,780" stroke="#52A628" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />

        {/* FYCD HD Text */}
        <text
          x="360"
          y="788"
          fill="#52A628"
          fontSize="56"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="0.12em"
        >
          FYCD
        </text>
        <text
          x="560"
          y="788"
          fill="#F97316"
          fontSize="56"
          fontWeight="800"
          fontFamily="system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif"
          letterSpacing="0.12em"
        >
          HD
        </text>

        {/* Right Circuit Connector */}
        <path d="M 665,780 L 685,780 L 705,765 L 755,765" stroke="#F97316" strokeWidth="5" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="765" cy="765" r="9" stroke="#F97316" strokeWidth="5" fill="none" />
      </g>
    </svg>
  );
};
