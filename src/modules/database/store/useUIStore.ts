/**
 * Database Module - UI State Store Hook
 * Manages UI state like toasts, modals, and panels
 */

import { useState, useCallback, useMemo } from 'react'
import { Toast } from '../types'

export interface UIState {
  toasts: Toast[]
  showRenameModal: boolean
  renameType: 'workspace' | 'database' | 'table' | null
  renameId: number | null
  renameNameValue: string
  sidebarCollapsed: boolean
  showHiddenFieldsPanel: boolean
  showRowColorsPanel: boolean
  showGroupByPanel: boolean
  showMembersModal: boolean
  showTrashModal: boolean
  showDetailModal: boolean
  showFilterPanel: boolean
}

export interface UIActions {
  addToast: (message: string, type: Toast['type'], options?: { action?: Toast['action']; duration?: number }) => void
  setShowRenameModal: (show: boolean) => void
  setRenameType: (type: 'workspace' | 'database' | 'table' | null) => void
  setRenameId: (id: number | null) => void
  setRenameNameValue: (value: string) => void
  setSidebarCollapsed: (collapsed: boolean) => void
  toggleSidebarCollapsed: () => void
  setShowHiddenFieldsPanel: (show: boolean) => void
  setShowRowColorsPanel: (show: boolean) => void
  setShowGroupByPanel: (show: boolean) => void
  setShowMembersModal: (show: boolean) => void
  setShowTrashModal: (show: boolean) => void
  setShowDetailModal: (show: boolean) => void
  setShowFilterPanel: (show: boolean) => void
}

export const useUIStore = (): [UIState, UIActions] => {
  const [toasts, setToasts] = useState<Toast[]>([])
  const [showRenameModal, setShowRenameModal] = useState(false)
  const [renameType, setRenameType] = useState<'workspace' | 'database' | 'table' | null>(null)
  const [renameId, setRenameId] = useState<number | null>(null)
  const [renameNameValue, setRenameNameValue] = useState('')
  const [sidebarCollapsed, setSidebarCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return localStorage.getItem('sidebar-collapsed') === 'true'
  })
  const [showHiddenFieldsPanel, setShowHiddenFieldsPanel] = useState(false)
  const [showRowColorsPanel, setShowRowColorsPanel] = useState(false)
  const [showGroupByPanel, setShowGroupByPanel] = useState(false)
  const [showMembersModal, setShowMembersModal] = useState(false)
  const [showTrashModal, setShowTrashModal] = useState(false)
  const [showDetailModal, setShowDetailModal] = useState(false)
  const [showFilterPanel, setShowFilterPanel] = useState(false)

  const addToast = useCallback((message: string, type: Toast['type'] = 'info', options?: { action?: Toast['action']; duration?: number }) => {
    const id = `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`
    const duration = options?.duration ?? (options?.action ? 10000 : 3000)
    setToasts(prev => [...prev, { id, message, type, action: options?.action, duration }])
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), duration)
  }, [])

  const toggleSidebarCollapsed = useCallback(() => {
    setSidebarCollapsed(prev => {
      const newState = !prev
      localStorage.setItem('sidebar-collapsed', String(newState))
      return newState
    })
  }, [])

  const state: UIState = {
    toasts,
    showRenameModal,
    renameType,
    renameId,
    renameNameValue,
    sidebarCollapsed,
    showHiddenFieldsPanel,
    showRowColorsPanel,
    showGroupByPanel,
    showMembersModal,
    showTrashModal,
    showDetailModal,
    showFilterPanel,
  }

  const actions: UIActions = useMemo(() => ({
    addToast,
    setShowRenameModal,
    setRenameType,
    setRenameId,
    setRenameNameValue,
    setSidebarCollapsed,
    toggleSidebarCollapsed,
    setShowHiddenFieldsPanel,
    setShowRowColorsPanel,
    setShowGroupByPanel,
    setShowMembersModal,
    setShowTrashModal,
    setShowDetailModal,
    setShowFilterPanel,
  }), [addToast, setShowRenameModal, setRenameType, setRenameId, setRenameNameValue, setSidebarCollapsed, toggleSidebarCollapsed, setShowHiddenFieldsPanel, setShowRowColorsPanel, setShowGroupByPanel, setShowMembersModal, setShowTrashModal, setShowDetailModal, setShowFilterPanel])

  return [state, actions]
}
