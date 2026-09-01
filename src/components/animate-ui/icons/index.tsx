'use client'

import React, { useState } from 'react'
import { motion, type HTMLMotionProps, type Variants } from 'motion/react'
import { cn } from '@/lib/utils'

export interface AnimatedIconProps extends React.SVGAttributes<SVGSVGElement> {
  size?: number | string
  className?: string
  isHovered?: boolean
}

/**
 * 🏠 Animated Home Icon (Animate UI)
 * Roof elevates subtly and door pulses on hover
 */
export const AnimatedHome: React.FC<AnimatedIconProps> = ({
  size = 18,
  className,
  isHovered,
  style,
  ...props
}) => {
  const [internalHover, setInternalHover] = useState(false)
  const hovered = isHovered !== undefined ? isHovered : internalHover

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0', className)}
      style={{ overflow: 'visible', ...style }}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      {...(props as any)}
    >
      {/* House Body */}
      <motion.path
        d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"
        animate={{
          scale: hovered ? 1.05 : 1,
          y: hovered ? -1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />
      {/* Door */}
      <motion.polyline
        points="9 22 9 12 15 12 15 22"
        animate={{
          scaleY: hovered ? 1.15 : 1,
          y: hovered ? -0.5 : 0,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 20 }}
      />
    </motion.svg>
  )
}

/**
 * 🔔 Animated Bell Notification Icon (Animate UI)
 * Realistic swinging bell & vibrating clapper on hover
 */
export const AnimatedBell: React.FC<AnimatedIconProps> = ({
  size = 18,
  className,
  isHovered,
  style,
  ...props
}) => {
  const [internalHover, setInternalHover] = useState(false)
  const hovered = isHovered !== undefined ? isHovered : internalHover

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0', className)}
      style={{ overflow: 'visible', transformOrigin: 'top center', ...style }}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      animate={
        hovered
          ? {
              rotate: [0, -15, 12, -9, 6, -3, 0],
              transition: {
                duration: 0.65,
                ease: 'easeInOut',
              },
            }
          : { rotate: 0 }
      }
      {...(props as any)}
    >
      <path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9" />
      <motion.path
        d="M10.3 21a1.94 1.94 0 0 0 3.4 0"
        animate={
          hovered
            ? {
                x: [0, 2, -2, 1.5, -1, 0],
                transition: { duration: 0.65, ease: 'easeInOut' },
              }
            : { x: 0 }
        }
      />
    </motion.svg>
  )
}

/**
 * 👥 Animated Users Icon (Animate UI)
 * Secondary user peeks out and primary user pulses on hover
 */
export const AnimatedUsers: React.FC<AnimatedIconProps> = ({
  size = 18,
  className,
  isHovered,
  style,
  ...props
}) => {
  const [internalHover, setInternalHover] = useState(false)
  const hovered = isHovered !== undefined ? isHovered : internalHover

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0', className)}
      style={{ overflow: 'visible', ...style }}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      {...(props as any)}
    >
      {/* Front User Body & Head */}
      <motion.path
        d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"
        animate={{
          scale: hovered ? 1.04 : 1,
          x: hovered ? -1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      />
      <motion.circle
        cx="9"
        cy="7"
        r="4"
        animate={{
          scale: hovered ? 1.08 : 1,
          y: hovered ? -1 : 0,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      />

      {/* Back User Secondary Silhouette */}
      <motion.path
        d="M22 21v-2a4 4 0 0 0-3-3.87"
        animate={{
          x: hovered ? 1.5 : 0,
          opacity: hovered ? 1 : 0.85,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      />
      <motion.path
        d="M16 3.13a4 4 0 0 1 0 7.75"
        animate={{
          x: hovered ? 1.5 : 0,
          y: hovered ? -0.5 : 0,
          opacity: hovered ? 1 : 0.85,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      />
    </motion.svg>
  )
}

/**
 * 🗄️ Animated Database Icon (Animate UI)
 * Cylinder disks step and expand with mechanical fluidity on hover
 */
export const AnimatedDatabase: React.FC<AnimatedIconProps> = ({
  size = 18,
  className,
  isHovered,
  style,
  ...props
}) => {
  const [internalHover, setInternalHover] = useState(false)
  const hovered = isHovered !== undefined ? isHovered : internalHover

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0', className)}
      style={{ overflow: 'visible', ...style }}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      {...(props as any)}
    >
      {/* Top Cylinder Disc */}
      <motion.ellipse
        cx="12"
        cy="5"
        rx="9"
        ry="3"
        animate={{
          y: hovered ? -2 : 0,
          scale: hovered ? 1.05 : 1,
        }}
        transition={{ type: 'spring', stiffness: 450, damping: 25 }}
      />

      {/* Middle Cylinder Layer */}
      <motion.path
        d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5"
        animate={{
          y: hovered ? 0.5 : 0,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      />

      {/* Internal Separator Layer */}
      <motion.path
        d="M3 12c0 1.66 4 3 9 3s9-1.34 9-3"
        animate={{
          y: hovered ? -0.8 : 0,
          opacity: hovered ? 1 : 0.9,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />
    </motion.svg>
  )
}

/**
 * 📊 Animated Table Grid Icon (Animate UI)
 * Grid cells and header line pulse with staggered micro-animation
 */
export const AnimatedTable: React.FC<AnimatedIconProps> = ({
  size = 18,
  className,
  isHovered,
  style,
  ...props
}) => {
  const [internalHover, setInternalHover] = useState(false)
  const hovered = isHovered !== undefined ? isHovered : internalHover

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0', className)}
      style={{ overflow: 'visible', ...style }}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      {...(props as any)}
    >
      {/* Outer Rectangle Frame */}
      <motion.path
        d="M12 3v18"
        animate={{
          scaleY: hovered ? 1.06 : 1,
          opacity: hovered ? 1 : 0.85,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />
      <rect width="18" height="18" x="3" y="3" rx="2" />
      {/* Row Split Line 1 */}
      <motion.path
        d="M3 9h18"
        animate={{
          scaleX: hovered ? 1.05 : 1,
        }}
        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      />
      {/* Row Split Line 2 */}
      <motion.path
        d="M3 15h18"
        animate={{
          scaleX: hovered ? 1.05 : 1,
          y: hovered ? 0.5 : 0,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      />
    </motion.svg>
  )
}

/**
 * ➕ Animated Plus Icon (Animate UI)
 * Snappy 90deg spring rotation on hover
 */
export const AnimatedPlus: React.FC<AnimatedIconProps> = ({
  size = 18,
  className,
  isHovered,
  style,
  ...props
}) => {
  const [internalHover, setInternalHover] = useState(false)
  const hovered = isHovered !== undefined ? isHovered : internalHover

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0', className)}
      style={{ overflow: 'visible', ...style }}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      animate={{
        rotate: hovered ? 90 : 0,
        scale: hovered ? 1.15 : 1,
      }}
      transition={{ type: 'spring', stiffness: 400, damping: 20 }}
      {...(props as any)}
    >
      <path d="M5 12h14" />
      <path d="M12 5v14" />
    </motion.svg>
  )
}

/**
 * 📁➕ Animated FolderPlus Icon (Animate UI)
 * Folder flap lifts slightly & plus rotates on hover
 */
export const AnimatedFolderPlus: React.FC<AnimatedIconProps> = ({
  size = 18,
  className,
  isHovered,
  style,
  ...props
}) => {
  const [internalHover, setInternalHover] = useState(false)
  const hovered = isHovered !== undefined ? isHovered : internalHover

  return (
    <motion.svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={cn('inline-block shrink-0', className)}
      style={{ overflow: 'visible', ...style }}
      onMouseEnter={() => setInternalHover(true)}
      onMouseLeave={() => setInternalHover(false)}
      {...(props as any)}
    >
      <motion.path
        d="M20 20a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.9a2 2 0 0 1-1.69-.9L9.6 3.9A2 2 0 0 0 8 3H4a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2Z"
        animate={{
          scale: hovered ? 1.04 : 1,
        }}
        transition={{ type: 'spring', stiffness: 350, damping: 25 }}
      />
      <motion.path
        d="M12 10v6"
        animate={{
          rotate: hovered ? 90 : 0,
          scale: hovered ? 1.2 : 1,
        }}
        style={{ transformOrigin: '12px 13px' }}
        transition={{ type: 'spring', stiffness: 450, damping: 20 }}
      />
      <motion.path
        d="M9 13h6"
        animate={{
          rotate: hovered ? 90 : 0,
          scale: hovered ? 1.2 : 1,
        }}
        style={{ transformOrigin: '12px 13px' }}
        transition={{ type: 'spring', stiffness: 450, damping: 20 }}
      />
    </motion.svg>
  )
}
