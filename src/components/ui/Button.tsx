'use client'

import React from 'react'

interface ButtonProps {
  children?: React.ReactNode
  onClick?: () => void
  type?: 'primary' | 'secondary' | 'danger' | 'ghost' | 'upload'
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
  download
}: ButtonProps) {
  const baseClasses = 'button'
  
  const typeClasses = {
    primary: 'button--primary',
    secondary: 'button--secondary',
    danger: 'button--danger',
    ghost: 'button--ghost',
    upload: 'button--upload'
  }

  const sizeClasses = {
    tiny: 'button--tiny',
    small: 'button--small',
    regular: 'button--regular',
    large: 'button--large',
    xlarge: 'button--xlarge'
  }

  const classes = [
    baseClasses,
    typeClasses[type],
    sizeClasses[size],
    fullWidth && 'button--full-width',
    loading && 'button--loading',
    active && 'button--active',
    !children && icon && 'button--icon-only',
    className
  ].filter(Boolean).join(' ')

  const content = (
    <>
      {icon && iconPosition === 'left' && <span className="button__icon button__icon--left">{icon}</span>}
      {children && <span className="button__label">{children}</span>}
      {icon && iconPosition === 'right' && <span className="button__icon button__icon--right">{icon}</span>}
      {loading && <span className="button__spinner" />}
    </>
  )

  if (href) {
    return (
      <a
        href={href}
        target={target}
        download={download}
        className={classes}
        onClick={onClick}
      >
        {content}
      </a>
    )
  }

  return (
    <button
      className={classes}
      onClick={onClick}
      disabled={disabled || loading}
    >
      {content}
    </button>
  )
}
