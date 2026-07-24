'use client'

import React, { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { Home, Database as DatabaseIcon, Search, Bell, Settings, X, Table as TableIcon, ChevronRight, Check, GripVertical, ChevronDown, Compass, Layers, Sparkles, Plus } from 'lucide-react'
import type { Workspace, User, TableField, TableRow } from '@/modules/database/types'
import { useThemeStore } from '@/modules/database/store/useThemeStore'
import MobileSearchModal from './MobileSearchModal'

interface MobileBottomNavProps {
  workspaces: Workspace[]
  activeWorkspaceId: number | null
  activeTableId: number | null
  currentUser: User | null
  notificationCount?: number
  fields?: TableField[]
  rows?: TableRow[]
  onSelectDashboard: () => void
  onSetActiveWorkspaceId: (wsId: number) => void
  onSetActiveTableId: (tableId: number) => void
  onShowNotificationsModal: () => void
  onShowUserSettingsModal: () => void
  onSelectRow?: (row: TableRow) => void
  onToggleTheme?: () => void
  onToggleDarkReaderPanel?: () => void
  onLogout?: () => void
}

// Crisp native haptic vibration helper
const triggerHapticFeedback = (duration = 10) => {
  if (typeof window !== 'undefined' && 'navigator' in window && typeof navigator.vibrate === 'function') {
    try {
      navigator.vibrate(duration)
    } catch {
      // Ignore security policy errors
    }
  }
}

export default function MobileBottomNav({
  workspaces = [],
  activeWorkspaceId,
  activeTableId,
  currentUser,
  notificationCount = 0,
  fields = [],
  rows = [],
  onSelectDashboard,
  onSetActiveWorkspaceId,
  onSetActiveTableId,
  onShowNotificationsModal,
  onShowUserSettingsModal,
  onSelectRow,
  onToggleTheme,
  onToggleDarkReaderPanel,
  onLogout
}: MobileBottomNavProps) {
  const [mounted, setMounted] = useState(false)
  const [activeTab, setActiveTab] = useState<'home' | 'database' | 'search' | 'alerts' | 'settings'>('home')
  const [showDbModal, setShowDbModal] = useState(false)
  const [showSearchModal, setShowSearchModal] = useState(false)
  
  // Store theme state
  const [themeState] = useThemeStore()
  const isDark = themeState.theme === 'dark'

  // LIVBubbleMenu Radial Expansion State
  const [isBubbleMenuOpen, setIsBubbleMenuOpen] = useState(false)
  const [isCollapsed, setIsCollapsed] = useState(true) // Default to clean LIVBubbleMenu floating bubble

  // Full Nav Bar Drag State & Boundary Clamping
  const [position, setPosition] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDragging, setIsDragging] = useState(false)
  const dragStartRef = useRef<{ startX: number; startY: number; initialX: number; initialY: number; currentX: number; currentY: number }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    currentX: 0,
    currentY: 0
  })

  // Collapsed Android / LIVBubbleMenu Floating FAB State & Physics Velocity Track
  const [bubblePos, setBubblePos] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isDraggingBubble, setIsDraggingBubble] = useState(false)
  const [bubbleVelocity, setBubbleVelocity] = useState<{ vx: number; vy: number }>({ vx: 0, vy: 0 })

  const bubbleDragRef = useRef<{
    startX: number
    startY: number
    initialX: number
    initialY: number
    currentX: number
    currentY: number
    lastX: number
    lastY: number
    lastTime: number
    vx: number
    vy: number
  }>({
    startX: 0,
    startY: 0,
    initialX: 0,
    initialY: 0,
    currentX: 0,
    currentY: 0,
    lastX: 0,
    lastY: 0,
    lastTime: 0,
    vx: 0,
    vy: 0
  })

  useEffect(() => {
    setMounted(true)
  }, [])

  // Sync activeTab when table changes externally
  useEffect(() => {
    if (activeTableId === 0 || activeTableId === null) {
      setActiveTab('home')
    } else {
      setActiveTab('database')
    }
  }, [activeTableId])

  // Drag Handler for Expanded Nav Bar with Boundary Clamping
  const handleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY

    dragStartRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: position.x,
      initialY: position.y,
      currentX: position.x,
      currentY: position.y
    }
    setIsDragging(false)

    const handleMove = (moveEvent: TouchEvent | MouseEvent) => {
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY
      const deltaX = moveX - dragStartRef.current.startX
      const deltaY = moveY - dragStartRef.current.startY

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        setIsDragging(true)
      }

      // Screen boundary clamping for full bar
      const winW = typeof window !== 'undefined' ? window.innerWidth : 400
      const winH = typeof window !== 'undefined' ? window.innerHeight : 800
      const maxDeltaX = (winW / 2) - 40
      const maxDeltaYUp = -(winH - 100)
      const maxDeltaYDown = 10

      const clampedX = Math.max(-maxDeltaX, Math.min(maxDeltaX, dragStartRef.current.initialX + deltaX))
      const clampedY = Math.max(maxDeltaYUp, Math.min(maxDeltaYDown, dragStartRef.current.initialY + deltaY))

      dragStartRef.current.currentX = clampedX
      dragStartRef.current.currentY = clampedY
      setPosition({ x: clampedX, y: clampedY })
    }

    const handleEnd = () => {
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)
    }

    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleEnd)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
  }

  // Drag Handler for Floating Bubble: Free 100% Position + 8px Strict Edge Magnet Snap
  const handleBubbleDragStart = (e: React.TouchEvent | React.MouseEvent) => {
    const clientX = 'touches' in e ? e.touches[0].clientX : e.clientX
    const clientY = 'touches' in e ? e.touches[0].clientY : e.clientY
    const now = Date.now()

    bubbleDragRef.current = {
      startX: clientX,
      startY: clientY,
      initialX: bubblePos.x,
      initialY: bubblePos.y,
      currentX: bubblePos.x,
      currentY: bubblePos.y,
      lastX: clientX,
      lastY: clientY,
      lastTime: now,
      vx: 0,
      vy: 0
    }
    setIsDraggingBubble(false)
    setBubbleVelocity({ vx: 0, vy: 0 })

    const handleMove = (moveEvent: TouchEvent | MouseEvent) => {
      const moveX = 'touches' in moveEvent ? moveEvent.touches[0].clientX : moveEvent.clientX
      const moveY = 'touches' in moveEvent ? moveEvent.touches[0].clientY : moveEvent.clientY
      const currentTime = Date.now()
      const dt = Math.max(1, currentTime - bubbleDragRef.current.lastTime)

      const deltaX = moveX - bubbleDragRef.current.startX
      const deltaY = moveY - bubbleDragRef.current.startY

      // Calculate velocity
      const instVx = (moveX - bubbleDragRef.current.lastX) / dt
      const instVy = (moveY - bubbleDragRef.current.lastY) / dt
      bubbleDragRef.current.vx = instVx
      bubbleDragRef.current.vy = instVy
      bubbleDragRef.current.lastX = moveX
      bubbleDragRef.current.lastY = moveY
      bubbleDragRef.current.lastTime = currentTime
      setBubbleVelocity({ vx: instVx, vy: instVy })

      if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
        setIsDraggingBubble(true)
      }

      // Viewport boundaries during live dragging
      const winW = typeof window !== 'undefined' ? window.innerWidth : 390
      const winH = typeof window !== 'undefined' ? window.innerHeight : 840

      const minX = -(winW - 52 - 16) // Left screen margin
      const maxX = 8                  // Right screen margin
      const minY = -(winH - 52 - 30) // Top screen margin
      const maxY = 8                  // Bottom screen margin

      const rawX = bubbleDragRef.current.initialX + deltaX
      const rawY = bubbleDragRef.current.initialY + deltaY

      const clampedX = Math.max(minX, Math.min(maxX, rawX))
      const clampedY = Math.max(minY, Math.min(maxY, rawY))

      // Always update live current coordinates ref to prevent stale closure bugs
      bubbleDragRef.current.currentX = clampedX
      bubbleDragRef.current.currentY = clampedY

      setBubblePos({ x: clampedX, y: clampedY })
    }

    const handleEnd = () => {
      window.removeEventListener('touchmove', handleMove)
      window.removeEventListener('touchend', handleEnd)
      window.removeEventListener('mousemove', handleMove)
      window.removeEventListener('mouseup', handleEnd)

      if (bubbleDragRef.current) {
        const winW = typeof window !== 'undefined' ? window.innerWidth : 390
        const winH = typeof window !== 'undefined' ? window.innerHeight : 840

        const minX = -(winW - 52 - 16)
        const maxX = 8
        const minY = -(winH - 52 - 30)
        const maxY = 8

        let targetX = bubbleDragRef.current.currentX
        let targetY = bubbleDragRef.current.currentY

        // Strict Magnet Proximity Snap: ONLY trigger magnet snap if within 8px of screen boundaries
        const SNAP_THRESHOLD = 8
        let snapped = false

        if (maxX - targetX <= SNAP_THRESHOLD) {
          targetX = maxX
          snapped = true
        } else if (targetX - minX <= SNAP_THRESHOLD) {
          targetX = minX
          snapped = true
        }

        if (maxY - targetY <= SNAP_THRESHOLD) {
          targetY = maxY
          snapped = true
        } else if (targetY - minY <= SNAP_THRESHOLD) {
          targetY = minY
          snapped = true
        }

        if (snapped) {
          triggerHapticFeedback(12)
        }

        setIsDraggingBubble(false)
        setBubblePos({ x: targetX, y: targetY })
      }
    }

    window.addEventListener('touchmove', handleMove, { passive: false })
    window.addEventListener('touchend', handleEnd)
    window.addEventListener('mousemove', handleMove)
    window.addEventListener('mouseup', handleEnd)
  }

  // LIVBubbleMenu Radial expansion menu item definitions (5 core items, Settings includes theme/filters/logout)
  const radialMenuItems = [
    {
      id: 'home',
      label: '首頁 (Home)',
      icon: Home,
      action: () => {
        setActiveTab('home')
        setShowDbModal(false)
        setShowSearchModal(false)
        onSelectDashboard()
      }
    },
    {
      id: 'database',
      label: '資料庫 (Tables)',
      icon: DatabaseIcon,
      action: () => {
        setActiveTab('database')
        setShowSearchModal(false)
        setShowDbModal(true)
      }
    },
    {
      id: 'search',
      label: '搜尋 (Search)',
      icon: Search,
      action: () => {
        setActiveTab('search')
        setShowDbModal(false)
        setShowSearchModal(true)
      }
    },
    {
      id: 'alerts',
      label: '通知 (Alerts)',
      icon: Bell,
      badge: notificationCount,
      action: () => {
        setActiveTab('alerts')
        setShowDbModal(false)
        setShowSearchModal(false)
        onShowNotificationsModal()
      }
    },
    {
      id: 'settings',
      label: '設定 (Settings)',
      icon: Settings,
      action: () => {
        setActiveTab('settings')
        setShowDbModal(false)
        setShowSearchModal(false)
        onShowUserSettingsModal()
      }
    }
  ]

  // Calculate dynamic radial angle range based on screen position of bubble
  const getRadialAngles = (pos: { x: number; y: number }, totalItems: number) => {
    const winW = typeof window !== 'undefined' ? window.innerWidth : 390
    const winH = typeof window !== 'undefined' ? window.innerHeight : 840

    // Absolute center coordinates of the main bubble
    const currentCenterX = winW - 24 + pos.x - 26
    const currentCenterY = winH - 24 + pos.y - 26

    const isLeft = currentCenterX < winW / 2
    const isTop = currentCenterY < winH / 2

    let startAngleDeg = 180
    let endAngleDeg = 270

    if (!isLeft && !isTop) {
      // Bottom-Right: expand top-left (180° to 270°)
      startAngleDeg = 180
      endAngleDeg = 270
    } else if (isLeft && !isTop) {
      // Bottom-Left: expand top-right (270° to 360°)
      startAngleDeg = 270
      endAngleDeg = 360
    } else if (!isLeft && isTop) {
      // Top-Right: expand bottom-left (90° to 180°)
      startAngleDeg = 90
      endAngleDeg = 180
    } else {
      // Top-Left: expand bottom-right (0° to 90°)
      startAngleDeg = 0
      endAngleDeg = 90
    }

    const angles: number[] = []
    const step = (endAngleDeg - startAngleDeg) / Math.max(1, totalItems - 1)
    for (let i = 0; i < totalItems; i++) {
      const deg = startAngleDeg + (i * step)
      const rad = (deg * Math.PI) / 180
      angles.push(rad)
    }
    return angles
  }

  if (!mounted) return null

  // Fallback safety
  const safeWorkspaces = workspaces && workspaces.length > 0 ? workspaces : []
  const activeWorkspace = safeWorkspaces.find(w => w.id === activeWorkspaceId) || safeWorkspaces[0]
  const radialAngles = getRadialAngles(bubblePos, radialMenuItems.length)
  const RADIAL_RADIUS = 88 // Distance in px for pop-out sub-bubbles

  const portalContent = (
    <>
      <style>{`
        .ui-ux-mobile-bottom-nav-portal { display: flex !important; }

        @keyframes liv-bubble-pulse-dark {
          0% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.45); }
          70% { box-shadow: 0 0 0 16px rgba(59, 130, 246, 0); }
          100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0); }
        }

        @keyframes liv-bubble-pulse-light {
          0% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0.35); }
          70% { box-shadow: 0 0 0 16px rgba(37, 99, 235, 0); }
          100% { box-shadow: 0 0 0 0 rgba(37, 99, 235, 0); }
        }
      `}</style>

      {/* Backdrop overlay for closing LIVBubbleMenu when expanded */}
      {isCollapsed && isBubbleMenuOpen && (
        <div
          onClick={() => {
            triggerHapticFeedback(10)
            setIsBubbleMenuOpen(false)
          }}
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 99999990,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.35)' : 'rgba(15, 23, 42, 0.18)',
            backdropFilter: 'blur(3px)',
            pointerEvents: 'auto'
          }}
        />
      )}

      {/* Collapsed LIVBubbleMenu Bouncy Radial Floating Bubble FAB */}
      {isCollapsed ? (
        <div
          className="ui-ux-mobile-bottom-nav-portal"
          style={{
            position: 'fixed',
            bottom: '24px',
            right: '24px',
            transform: `translate(${bubblePos.x}px, ${bubblePos.y}px)`,
            zIndex: 99999999,
            pointerEvents: 'auto',
            touchAction: 'none',
            userSelect: 'none',
          }}
        >
          {/* Radial Expand Sub-Bubbles (LIVBubbleMenu Bouncy iOS Arc Style) */}
          {radialMenuItems.map((item, idx) => {
            const angle = radialAngles[idx]
            const offsetX = Math.cos(angle) * RADIAL_RADIUS
            const offsetY = Math.sin(angle) * RADIAL_RADIUS
            const Icon = item.icon
            const isActive = activeTab === item.id

            return (
              <div
                key={item.id}
                onClick={(e) => {
                  e.stopPropagation()
                  triggerHapticFeedback(15)
                  setIsBubbleMenuOpen(false)
                  item.action()
                }}
                style={{
                  position: 'absolute',
                  left: '4px',
                  top: '4px',
                  width: '44px',
                  height: '44px',
                  borderRadius: '9999px',
                  backgroundColor: isActive
                    ? '#2563eb'
                    : isDark
                    ? 'rgba(15, 23, 42, 0.94)'
                    : 'rgba(255, 255, 255, 0.96)',
                  backdropFilter: 'blur(16px)',
                  WebkitBackdropFilter: 'blur(16px)',
                  border: isActive
                    ? '2px solid #ffffff'
                    : isDark
                    ? '1px solid rgba(255, 255, 255, 0.25)'
                    : '1px solid rgba(203, 213, 225, 0.9)',
                  boxShadow: isActive
                    ? '0 10px 25px rgba(37, 99, 235, 0.45), 0 0 15px rgba(37, 99, 235, 0.4)'
                    : isDark
                    ? '0 8px 20px rgba(0, 0, 0, 0.4)'
                    : '0 8px 22px rgba(15, 23, 42, 0.14)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  transform: isBubbleMenuOpen
                    ? `translate(${offsetX}px, ${offsetY}px) scale(1)`
                    : 'translate(0px, 0px) scale(0)',
                  opacity: isBubbleMenuOpen ? 1 : 0,
                  transition: `all 0.35s cubic-bezier(0.34, 1.56, 0.64, 1)`,
                  transitionDelay: isBubbleMenuOpen ? `${idx * 35}ms` : '0ms',
                  pointerEvents: isBubbleMenuOpen ? 'auto' : 'none',
                  zIndex: 99999995
                }}
                title={item.label}
              >
                <Icon
                  size={20}
                  color={isActive ? '#ffffff' : isDark ? '#ffffff' : '#1e293b'}
                  style={{ pointerEvents: 'none' }}
                />

                {/* Optional Badge */}
                {item.badge && item.badge > 0 ? (
                  <span style={{
                    position: 'absolute',
                    top: '-2px',
                    right: '-2px',
                    width: '16px',
                    height: '16px',
                    borderRadius: '9999px',
                    backgroundColor: '#ef4444',
                    color: '#ffffff',
                    fontSize: '9px',
                    fontWeight: 800,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.3)'
                  }}>
                    {item.badge}
                  </span>
                ) : null}


              </div>
            )
          })}

          {/* Central Main Drag Trigger Bubble (LIVBubbleMenu Master Button with Dark/Light styling) */}
          <div
            onMouseDown={handleBubbleDragStart}
            onTouchStart={handleBubbleDragStart}
            onClick={(e) => {
              e.stopPropagation()
              if (isDraggingBubble) return
              triggerHapticFeedback(15)
              setIsBubbleMenuOpen(prev => !prev)
            }}
            style={{
              width: '52px',
              height: '52px',
              borderRadius: '9999px',
              backgroundColor: isBubbleMenuOpen
                ? '#2563eb'
                : isDark
                ? 'rgba(15, 23, 42, 0.94)'
                : 'rgba(255, 255, 255, 0.96)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: isBubbleMenuOpen
                ? '2px solid #ffffff'
                : isDark
                ? '1.5px solid rgba(255, 255, 255, 0.35)'
                : '1.5px solid rgba(37, 99, 235, 0.35)',
              boxShadow: isDraggingBubble
                ? isDark
                  ? '0 20px 45px rgba(0, 0, 0, 0.45), 0 0 25px rgba(59, 130, 246, 0.6)'
                  : '0 20px 45px rgba(15, 23, 42, 0.25), 0 0 25px rgba(37, 99, 235, 0.5)'
                : isBubbleMenuOpen
                ? '0 12px 35px rgba(37, 99, 235, 0.5), 0 0 20px rgba(37, 99, 235, 0.5)'
                : isDark
                ? '0 12px 35px rgba(0, 0, 0, 0.35), 0 0 15px rgba(59, 130, 246, 0.3)'
                : '0 12px 35px rgba(15, 23, 42, 0.16), 0 0 15px rgba(37, 99, 235, 0.25)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: isDraggingBubble ? 'grabbing' : 'grab',
              transform: `scale(${isDraggingBubble ? 1.12 : 1}) rotate(${isBubbleMenuOpen ? '45deg' : isDraggingBubble ? `${Math.max(-15, Math.min(15, bubbleVelocity.vx * 15))}deg` : '0deg'})`,
              transition: isDraggingBubble ? 'none' : 'all 0.28s cubic-bezier(0.34, 1.56, 0.64, 1)',
              animation: !isBubbleMenuOpen && !isDraggingBubble
                ? isDark
                  ? 'liv-bubble-pulse-dark 3s infinite'
                  : 'liv-bubble-pulse-light 3s infinite'
                : 'none'
            }}
            title="點擊展開 LIVBubbleMenu 放射彈力選單，按住可自由拖曳擺放"
          >
            {isBubbleMenuOpen ? (
              <Plus size={26} color="#ffffff" style={{ pointerEvents: 'none' }} />
            ) : (
              <Compass size={26} color={isDark ? '#60a5fa' : '#2563eb'} style={{ pointerEvents: 'none' }} />
            )}
          </div>
        </div>
      ) : (
        /* Expanded Floating Centered Glass Capsule Navigation Bar */
        <nav
          className="ui-ux-mobile-bottom-nav-portal"
          style={{
            position: 'fixed',
            bottom: '16px',
            left: '50%',
            transform: `translate(calc(-50% + ${position.x}px), ${position.y}px)`,
            width: 'calc(100% - 24px)',
            maxWidth: '440px',
            height: '58px',
            zIndex: 99999999,
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.94)' : 'rgba(255, 255, 255, 0.96)',
            backdropFilter: 'blur(20px) saturate(180%)',
            WebkitBackdropFilter: 'blur(20px) saturate(180%)',
            border: isDark ? '1px solid rgba(255, 255, 255, 0.2)' : '1px solid rgba(255, 255, 255, 0.8)',
            boxShadow: isDark ? '0 16px 45px -10px rgba(0, 0, 0, 0.5)' : '0 16px 45px -10px rgba(15, 23, 42, 0.20)',
            borderRadius: '9999px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 6px',
            pointerEvents: 'auto',
            touchAction: 'none',
            userSelect: 'none',
          }}
          aria-label="導向列"
        >
          {/* Drag Grip Handle */}
          <div
            onMouseDown={handleDragStart}
            onTouchStart={handleDragStart}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: '12px 3px',
              cursor: 'grab',
              touchAction: 'none',
              color: isDark ? '#64748b' : '#94a3b8',
              flexShrink: 0
            }}
            title="按住拖曳移動位置"
          >
            <GripVertical size={16} />
          </div>

          {/* 5 Tab Items */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flex: 1, minWidth: 0, padding: '0 2px', gap: '4px' }}>
            {/* Tab 1: Home Dashboard */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isDragging) return
                triggerHapticFeedback()
                setActiveTab('home')
                setShowDbModal(false)
                setShowSearchModal(false)
                onSelectDashboard()
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minWidth: 0,
                padding: '5px 2px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: activeTab === 'home' ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                color: activeTab === 'home' ? '#2563eb' : isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                touchAction: 'manipulation'
              }}
            >
              <Home size={18} color={activeTab === 'home' ? '#2563eb' : isDark ? '#94a3b8' : '#64748b'} style={{ flexShrink: 0, display: 'block', margin: '0 auto' }} />
              <span style={{ fontSize: '10px', fontWeight: activeTab === 'home' ? 800 : 500, lineHeight: 1.2, marginTop: '2px', whiteSpace: 'nowrap', textAlign: 'center', display: 'block' }}>
                首頁
              </span>
            </button>

            {/* Tab 2: Databases & Tables Modal */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isDragging) return
                triggerHapticFeedback()
                setActiveTab('database')
                setShowSearchModal(false)
                setShowDbModal(prev => !prev)
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minWidth: 0,
                padding: '5px 2px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: (activeTab === 'database' || showDbModal) ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                color: (activeTab === 'database' || showDbModal) ? '#2563eb' : isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                touchAction: 'manipulation'
              }}
            >
              <DatabaseIcon size={18} color={(activeTab === 'database' || showDbModal) ? '#2563eb' : isDark ? '#94a3b8' : '#64748b'} style={{ flexShrink: 0, display: 'block', margin: '0 auto' }} />
              <span style={{ fontSize: '10px', fontWeight: (activeTab === 'database' || showDbModal) ? 800 : 500, lineHeight: 1.2, marginTop: '2px', whiteSpace: 'nowrap', textAlign: 'center', display: 'block' }}>
                資料庫
              </span>
            </button>

            {/* Tab 3: Search */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isDragging) return
                triggerHapticFeedback()
                setActiveTab('search')
                setShowDbModal(false)
                setShowSearchModal(true)
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minWidth: 0,
                padding: '5px 2px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: (activeTab === 'search' || showSearchModal) ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                color: (activeTab === 'search' || showSearchModal) ? '#2563eb' : isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                touchAction: 'manipulation'
              }}
            >
              <Search size={18} color={(activeTab === 'search' || showSearchModal) ? '#2563eb' : isDark ? '#94a3b8' : '#64748b'} style={{ flexShrink: 0, display: 'block', margin: '0 auto' }} />
              <span style={{ fontSize: '10px', fontWeight: (activeTab === 'search' || showSearchModal) ? 800 : 500, lineHeight: 1.2, marginTop: '2px', whiteSpace: 'nowrap', textAlign: 'center', display: 'block' }}>
                搜尋
              </span>
            </button>

            {/* Tab 4: Notifications */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isDragging) return
                triggerHapticFeedback()
                setActiveTab('alerts')
                setShowDbModal(false)
                setShowSearchModal(false)
                onShowNotificationsModal()
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minWidth: 0,
                padding: '5px 2px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: activeTab === 'alerts' ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                color: activeTab === 'alerts' ? '#2563eb' : isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                touchAction: 'manipulation',
                position: 'relative'
              }}
            >
              <Bell size={18} color={activeTab === 'alerts' ? '#2563eb' : isDark ? '#94a3b8' : '#64748b'} style={{ flexShrink: 0, display: 'block', margin: '0 auto' }} />
              <span style={{ fontSize: '10px', fontWeight: activeTab === 'alerts' ? 800 : 500, lineHeight: 1.2, marginTop: '2px', whiteSpace: 'nowrap', textAlign: 'center', display: 'block' }}>
                通知
              </span>
              {notificationCount > 0 && (
                <span className="absolute top-0.5 right-1.5 w-3.5 h-3.5 rounded-full bg-red-500 text-white text-[8.5px] font-extrabold flex items-center justify-center shadow-xs">
                  {notificationCount}
                </span>
              )}
            </button>

            {/* Tab 5: Settings (Opens UserSettingsModal with Theme/Filters/Logout inside) */}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault()
                e.stopPropagation()
                if (isDragging) return
                triggerHapticFeedback()
                setActiveTab('settings')
                setShowDbModal(false)
                setShowSearchModal(false)
                onShowUserSettingsModal()
              }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                flex: 1,
                minWidth: 0,
                padding: '5px 2px',
                borderRadius: '14px',
                border: 'none',
                backgroundColor: activeTab === 'settings' ? (isDark ? '#1e3a8a' : '#eff6ff') : 'transparent',
                color: activeTab === 'settings' ? '#2563eb' : isDark ? '#94a3b8' : '#64748b',
                cursor: 'pointer',
                transition: 'all 0.15s ease-out',
                touchAction: 'manipulation'
              }}
            >
              <Settings size={18} color={activeTab === 'settings' ? '#2563eb' : isDark ? '#94a3b8' : '#64748b'} style={{ flexShrink: 0, display: 'block', margin: '0 auto' }} />
              <span style={{ fontSize: '10px', fontWeight: activeTab === 'settings' ? 800 : 500, lineHeight: 1.2, marginTop: '2px', whiteSpace: 'nowrap', textAlign: 'center', display: 'block' }}>
                設定
              </span>
            </button>
          </div>

          {/* Switch to LIVBubbleMenu FAB */}
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              triggerHapticFeedback()
              setIsCollapsed(true)
            }}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: '28px',
              height: '28px',
              borderRadius: '9999px',
              backgroundColor: isDark ? '#334155' : '#f1f5f9',
              border: 'none',
              color: isDark ? '#cbd5e1' : '#64748b',
              cursor: 'pointer',
              marginLeft: '2px',
              flexShrink: 0
            }}
            title="切換至 LIVBubbleMenu 放射彈力懸浮球"
          >
            <ChevronDown size={16} />
          </button>
        </nav>
      )}

      {/* Independent Mobile Search Modal */}
      <MobileSearchModal
        show={showSearchModal}
        onClose={() => setShowSearchModal(false)}
        fields={fields}
        rows={rows}
        onSelectRow={onSelectRow}
      />

      {/* Database & Table Selector Modal */}
      {showDbModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            zIndex: 1050,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(15, 23, 42, 0.45)',
            backdropFilter: 'blur(4px)',
            pointerEvents: 'auto',
            touchAction: 'manipulation'
          }}
          onClick={() => setShowDbModal(false)}
        >
          <div
            style={{
              width: '500px',
              maxWidth: '92vw',
              maxHeight: '80vh',
              backgroundColor: isDark ? '#0f172a' : '#ffffff',
              borderRadius: '24px',
              boxShadow: '0 25px 60px -15px rgba(15, 23, 42, 0.35)',
              border: isDark ? '1px solid rgba(255,255,255,0.1)' : 'none',
              display: 'flex',
              flexDirection: 'column',
              overflow: 'hidden'
            }}
            onClick={e => e.stopPropagation()}
            role="dialog"
            aria-label="選擇資料庫與資料表"
          >
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                padding: '20px 24px 12px 24px',
                backgroundColor: isDark ? '#0f172a' : '#ffffff'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <div style={{ width: '36px', height: '36px', borderRadius: '12px', backgroundColor: isDark ? '#1e293b' : '#eff6ff', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <DatabaseIcon size={18} color="#2563eb" />
                </div>
                <h3 style={{ fontSize: '17px', fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: 0, letterSpacing: '-0.01em' }}>
                  資料庫與資料表
                </h3>
              </div>
              <button
                onClick={() => setShowDbModal(false)}
                style={{
                  width: '32px',
                  height: '32px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: isDark ? '#1e293b' : '#f1f5f9',
                  border: 'none',
                  color: isDark ? '#94a3b8' : '#64748b',
                  cursor: 'pointer',
                  borderRadius: '9999px',
                  transition: 'transform 0.15s ease'
                }}
              >
                <X size={16} />
              </button>
            </div>

            <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px 24px 24px' }}>
              {safeWorkspaces.length > 1 && (
                <div style={{ marginBottom: '16px' }}>
                  <label style={{ display: 'block', fontSize: '11px', fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em', marginBottom: '8px' }}>
                    工作區 (Workspaces)
                  </label>
                  <div style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '4px' }}>
                    {safeWorkspaces.map(ws => (
                      <button
                        key={ws.id}
                        type="button"
                        onClick={() => onSetActiveWorkspaceId(ws.id)}
                        style={{
                          padding: '7px 16px',
                          borderRadius: '10px',
                          fontSize: '12px',
                          fontWeight: 600,
                          whiteSpace: 'nowrap',
                          cursor: 'pointer',
                          backgroundColor: activeWorkspaceId === ws.id ? '#2563eb' : isDark ? '#1e293b' : '#f1f5f9',
                          color: activeWorkspaceId === ws.id ? '#ffffff' : isDark ? '#cbd5e1' : '#475569',
                          border: 'none'
                        }}
                      >
                        {ws.name}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {activeWorkspace && activeWorkspace.databases && activeWorkspace.databases.length > 0 ? (
                  activeWorkspace.databases.map(db => (
                    <div key={db.id} style={{ backgroundColor: isDark ? '#1e293b' : '#f8fafc', border: 'none', borderRadius: '16px', padding: '14px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '10px', padding: '0 2px' }}>
                        <DatabaseIcon size={16} color="#2563eb" />
                        <h4 style={{ fontSize: '13px', fontWeight: 700, color: isDark ? '#ffffff' : '#0f172a', margin: 0 }}>{db.name}</h4>
                      </div>

                      <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                        {db.tables && db.tables.map(table => {
                          const isSelected = activeTableId === table.id
                          return (
                            <button
                              key={table.id}
                              type="button"
                              onClick={() => {
                                onSetActiveTableId(table.id)
                                setShowDbModal(false)
                              }}
                              style={{
                                width: '100%',
                                textAlign: 'left',
                                padding: '10px 14px',
                                borderRadius: '10px',
                                display: 'flex',
                                alignItems: 'center',
                                justifyContent: 'space-between',
                                fontSize: '13px',
                                fontWeight: 600,
                                cursor: 'pointer',
                                transition: 'all 0.15s ease',
                                backgroundColor: isSelected ? '#2563eb' : isDark ? '#0f172a' : '#ffffff',
                                color: isSelected ? '#ffffff' : isDark ? '#e2e8f0' : '#334155',
                                border: 'none',
                                boxShadow: isSelected ? '0 4px 12px rgba(37,99,235,0.25)' : 'none'
                              }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
                                <TableIcon size={16} color={isSelected ? '#ffffff' : '#2563eb'} />
                                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{table.name}</span>
                              </div>
                              {isSelected ? (
                                <Check size={16} color="#ffffff" style={{ flexShrink: 0 }} />
                              ) : (
                                <ChevronRight size={16} color="#94a3b8" style={{ flexShrink: 0 }} />
                              )}
                            </button>
                          )
                        })}
                      </div>
                    </div>
                  ))
                ) : (
                  <div style={{ textAlign: 'center', padding: '24px 0', color: '#94a3b8', fontSize: '13px', fontWeight: 500 }}>
                    尚無資料庫或載入中...
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )

  return createPortal(portalContent, document.body)
}
