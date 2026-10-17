'use client'

import React, { useId } from 'react'
import styles from './FycdLogo.module.css'

export interface FycdLogoProps {
  variant?: 'full' | 'icon'
  tone?: 'brand' | 'onDark' | 'mono'
  animated?: boolean
  height?: number | string
  className?: string
  style?: React.CSSProperties
}

// 品牌色（spec：docs/superpowers/specs/2026-10-17-brand-login-loading-design.md）
const OLIVE = '#39452B'
const ORANGE = '#F58220'
const ORANGE_DEEP = '#DD6410'
const IVORY = '#F5F0E6'

const FYCD_PATHS = [
  'M0 0H82V25H27V39H66V62H27V100H0Z',
  'M86 0H116L130 31L144 0H174L143 57V100H116V57Z',
  'M272 0H228C198 0 180 19 180 47V53C180 81 198 100 228 100H272V75H232C215 75 207 67 207 53V47C207 33 215 25 232 25H272Z',
  'M278 0H330C358 0 377 19 377 47V53C377 81 358 100 330 100H278ZM305 25V75H326C342 75 350 67 350 53V47C350 33 342 25 326 25Z',
]

const HD_PATHS = [
  'M0 0H29V37H67V0H96V100H67V63H29V100H0Z',
  'M104 0H156C190 0 210 21 210 50C210 79 190 100 156 100H104ZM133 26V74H153C171 74 181 64 181 50C181 36 171 26 153 26Z',
]

const VIEW_BOX = { full: '8 -30 704 136', icon: '400 -30 312 136' }
const HD_TRANSFORM = 'translate(392 -24) scale(1.24)'

const renderPaths = (paths: string[]) =>
  paths.map(d => <path key={d} d={d} fillRule="evenodd" />)

export function FycdLogo({
  variant = 'full',
  tone = 'brand',
  animated = false,
  height = 40,
  className,
  style,
}: FycdLogoProps) {
  const gradientId = `fycd-fold-${useId().replace(/:/g, '')}`
  const [, , vbW, vbH] = VIEW_BOX[variant].split(' ').map(Number)

  const fycdColor = tone === 'mono' ? 'currentColor' : tone === 'onDark' ? IVORY : OLIVE
  const hdColor = tone === 'mono' ? 'currentColor' : ORANGE
  const showFold = tone !== 'mono'

  const classes = [animated ? styles.animated : '', className].filter(Boolean).join(' ')

  return (
    <svg
      viewBox={VIEW_BOX[variant]}
      height={height}
      style={{ aspectRatio: `${vbW} / ${vbH}`, width: 'auto', display: 'block', overflow: 'visible', ...style }}
      className={classes || undefined}
      role="img"
      aria-label="FYCD HD"
      data-variant={variant}
      data-tone={tone}
    >
      {showFold && (
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0.5" stopColor={ORANGE} />
            <stop offset="0.5" stopColor={ORANGE_DEEP} />
          </linearGradient>
        </defs>
      )}
      <g transform="translate(46 0) skewX(-17)">
        {variant === 'full' && (
          <g data-part="fycd" fill={fycdColor} stroke={fycdColor} strokeWidth={3} strokeLinejoin="round">
            {renderPaths(FYCD_PATHS)}
          </g>
        )}
        <g transform={HD_TRANSFORM}>
          <g data-part="hd" fill={hdColor} stroke={hdColor} strokeWidth={2.4} strokeLinejoin="round">
            {renderPaths(HD_PATHS)}
          </g>
          {showFold && (
            <g
              data-part="fold"
              fill={`url(#${gradientId})`}
              stroke={`url(#${gradientId})`}
              strokeWidth={2.4}
              strokeLinejoin="round"
            >
              {renderPaths(HD_PATHS)}
            </g>
          )}
        </g>
      </g>
    </svg>
  )
}

export default FycdLogo
