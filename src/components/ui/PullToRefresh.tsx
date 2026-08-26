'use client'

import React, { useState, useRef, useCallback } from 'react'
import { RefreshCw, ArrowDown, Check } from 'lucide-react'

interface PullToRefreshProps {
  onRefresh: () => Promise<void>
  disabled?: boolean
  children: React.ReactNode
  pullThreshold?: number
}

// Haptic feedback helper
const triggerHaptic = (ms = 12) => {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(ms)
    } catch {}
  }
}

export default function PullToRefresh({
  onRefresh,
  disabled = false,
  children,
  pullThreshold = 68,
}: PullToRefreshProps) {
  const [pullDistance, setPullDistance] = useState(0)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [refreshSuccess, setRefreshSuccess] = useState(false)
  const [isThresholdReached, setIsThresholdReached] = useState(false)

  const containerRef = useRef<HTMLDivElement>(null)
  const touchStartRef = useRef<{ y: number; x: number; isTopAtStart: boolean }>({
    y: 0,
    x: 0,
    isTopAtStart: false,
  })
  const isDraggingRef = useRef(false)

  // Check if scroll container is at the very top
  const isScrollAtTop = useCallback(() => {
    if (!containerRef.current) return true
    
    // Check if inner virtualized or scroll element is at scrollTop <= 0
    const scrollableChild = containerRef.current.querySelector('.grid-view-container, .table-container, [data-virtualized-container="true"], .content')
    if (scrollableChild) {
      return scrollableChild.scrollTop <= 0
    }
    return containerRef.current.scrollTop <= 0
  }, [])

  const handleTouchStart = (e: React.TouchEvent) => {
    if (disabled || isRefreshing) return
    const touch = e.touches[0]
    const atTop = isScrollAtTop()

    touchStartRef.current = {
      y: touch.clientY,
      x: touch.clientX,
      isTopAtStart: atTop,
    }
    isDraggingRef.current = false
  }

  const handleTouchMove = (e: React.TouchEvent) => {
    if (disabled || isRefreshing || !touchStartRef.current.isTopAtStart) return

    const touch = e.touches[0]
    const deltaY = touch.clientY - touchStartRef.current.y
    const deltaX = touch.clientX - touchStartRef.current.x

    // Only activate if dragging downward more than sideways
    if (deltaY > 8 && Math.abs(deltaY) > Math.abs(deltaX) * 1.2 && isScrollAtTop()) {
      isDraggingRef.current = true

      // Apply resistance dampening factor
      const resistance = 0.45
      const distance = Math.min(120, deltaY * resistance)
      setPullDistance(distance)

      const reached = distance >= pullThreshold
      if (reached && !isThresholdReached) {
        setIsThresholdReached(true)
        triggerHaptic(12)
      } else if (!reached && isThresholdReached) {
        setIsThresholdReached(false)
      }

      // Prevent native overscroll / full page reload flash while pulling in-app
      if (e.cancelable && distance > 10) {
        e.preventDefault()
      }
    }
  }

  const handleTouchEnd = async () => {
    if (disabled || isRefreshing || !isDraggingRef.current) {
      setPullDistance(0)
      setIsThresholdReached(false)
      return
    }

    isDraggingRef.current = false

    if (pullDistance >= pullThreshold) {
      setIsRefreshing(true)
      setPullDistance(pullThreshold)
      triggerHaptic(18)

      try {
        await onRefresh()
        setRefreshSuccess(true)
        triggerHaptic(25)
        setTimeout(() => setRefreshSuccess(false), 1200)
      } catch (err) {
        console.error('Pull to refresh failed:', err)
      } finally {
        setTimeout(() => {
          setIsRefreshing(false)
          setPullDistance(0)
          setIsThresholdReached(false)
        }, 400)
      }
    } else {
      setPullDistance(0)
      setIsThresholdReached(false)
    }
  }

  const rotationDeg = Math.min(360, (pullDistance / pullThreshold) * 360)
  const opacity = Math.min(1, pullDistance / (pullThreshold * 0.6))

  return (
    <div
      ref={containerRef}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      style={{
        position: 'relative',
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* Pull Indicator Container */}
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          height: `${pullDistance}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 40,
          pointerEvents: 'none',
          overflow: 'hidden',
          transition: pullDistance > 0 ? 'none' : 'height 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
      >
        <div
          style={{
            opacity: isRefreshing ? 1 : opacity,
            transform: `scale(${Math.min(1, pullDistance / pullThreshold)})`,
            transition: pullDistance > 0 ? 'opacity 0.1s ease' : 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            backgroundColor: isThresholdReached || isRefreshing ? '#3F6212' : '#ffffff',
            color: isThresholdReached || isRefreshing ? '#ffffff' : '#3F6212',
            border: isThresholdReached || isRefreshing ? 'none' : '1px solid #cbd5e1',
            boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
            width: '40px',
            height: '40px',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          {refreshSuccess ? (
            <Check size={20} color="#ffffff" className="animate-in zoom-in-50 duration-200" />
          ) : isRefreshing ? (
            <RefreshCw size={20} className="animate-spin" />
          ) : (
            <ArrowDown
              size={20}
              style={{
                transform: `rotate(${isThresholdReached ? 180 : rotationDeg}deg)`,
                transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
              }}
            />
          )}
        </div>
      </div>

      {/* Main Content Area Shifted Downward During Pull */}
      <div
        style={{
          flex: 1,
          width: '100%',
          height: '100%',
          transform: `translateY(${pullDistance}px)`,
          transition: pullDistance > 0 ? 'none' : 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          display: 'flex',
          flexDirection: 'column',
          minHeight: 0,
        }}
      >
        {children}
      </div>
    </div>
  )
}
