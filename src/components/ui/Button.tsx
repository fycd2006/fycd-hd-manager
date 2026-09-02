'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'motion/react'

interface ButtonProps {
  children?: React.ReactNode
  onClick?: (e?: any) => void
  type?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'upload'
  buttonType?: 'button' | 'submit' | 'reset'
  size?: 'tiny' | 'small' | 'regular' | 'large' | 'xlarge'
  disabled?: boolean
  loading?: boolean
  active?: boolean
  fullWidth?: boolean
  icon?: React.ReactNode
  iconPosition?: 'left' | 'right'
  className?: string
  href?: string
  target?: string
  download?: string
}

export default function Button({
  children,
  onClick,
  type = 'primary',
  buttonType,
  size = 'regular',
  disabled = false,
  loading = false,
  active = false,
  fullWidth = false,
  icon,
  iconPosition = 'left',
  className = '',
  href,
  target,
  download,
}: ButtonProps) {
  const [isHovered, setIsHovered] = useState(false)
  const baseClasses = 'button'

  const typeClasses = {
    primary: 'button--primary',
    secondary: 'button--secondary',
    danger: 'button--danger',
    ghost: 'button--ghost',
    upload: 'button--upload',
  }

  const sizeClasses = {
    tiny: 'button--tiny',
    small: 'button--small',
    regular: 'button--regular',
    large: 'button--large',
    xlarge: 'button--xlarge',
  }

  const classes = [
    baseClasses,
    typeClasses[type],
    sizeClasses[size],
    'transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime-500/40',
    fullWidth && 'button--full-width',
    loading && 'button--loading',
    active && 'button--active',
    !children && icon && 'button--icon-only',
    className,
  ]
    .filter(Boolean)
    .join(' ')

  // Clone icon and pass isHovered if it's an AnimatedIcon or accepts hover state
  const renderedIcon = React.isValidElement(icon)
    ? React.cloneElement(icon as React.ReactElement<any>, {
        isHovered: (icon as any).props?.isHovered !== undefined ? (icon as any).props.isHovered : isHovered,
      })
    : icon

  const content = (
    <>
      {renderedIcon && iconPosition === 'left' && (
        <span className="button__icon button__icon--left">{renderedIcon}</span>
      )}
      {children && <span className="button__label">{children}</span>}
      {renderedIcon && iconPosition === 'right' && (
        <span className="button__icon button__icon--right flex items-center justify-center rounded-full w-5 h-5 bg-black/5 dark:bg-white/10 ml-1.5">
          {renderedIcon}
        </span>
      )}
      <AnimatePresence>
        {loading && (
          <motion.span
            initial={{ opacity: 0, scale: 0.6 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.6 }}
            transition={{ duration: 0.15 }}
            className="button__spinner"
          />
        )}
      </AnimatePresence>
    </>
  )

  const motionSpringProps = {
    whileHover: !disabled && !loading ? { scale: 1.015 } : undefined,
    whileTap: !disabled && !loading ? { scale: 0.96 } : undefined,
    transition: { type: 'spring' as const, stiffness: 450, damping: 25 },
  }

  if (href) {
    return (
      <motion.a
        href={href}
        target={target}
        download={download}
        className={classes}
        onClick={onClick}
        onMouseEnter={() => setIsHovered(true)}
        onMouseLeave={() => setIsHovered(false)}
        {...motionSpringProps}
      >
        {content}
      </motion.a>
    )
  }

  const computedButtonType = buttonType || (type === 'primary' ? 'submit' : 'button')

  return (
    <motion.button
      type={computedButtonType}
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      {...motionSpringProps}
    >
      {content}
    </motion.button>
  )
}
