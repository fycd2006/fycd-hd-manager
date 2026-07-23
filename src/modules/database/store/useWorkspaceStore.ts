/**
 * Database Module - Workspace Store Hook
 * Manages workspace, database, and table state
 */

import { useState, useCallback, useMemo } from 'react'
import { Workspace, DynamicTable } from '../types'
import * as workspaceService from '../services/workspace'

export interface WorkspaceState {
  workspaces: Workspace[]
  activeWorkspaceId: number | null
  activeTableId: number | null
  activeViewId: number | null
  collapsedWorkspaces: Record<number, boolean>
  collapsedDatabases: Record<number, boolean>
  showWorkspaceModal: boolean
  showDatabaseModal: boolean
  newWorkspaceName: string
  newDatabaseName: string
  modalWsId: number | null
  modalDbId: number | null
}


export interface WorkspaceActions {
  setWorkspaces: (workspaces: Workspace[]) => void
  setActiveWorkspaceId: (id: number | null) => void
  setActiveTableId: (id: number | null) => void
  setActiveViewId: (id: number | null) => void
  setCollapsedWorkspaces: (collapsed: Record<number, boolean>) => void
  setCollapsedDatabases: (collapsed: Record<number, boolean>) => void
  toggleWorkspaceCollapse: (wsId: number) => void
  toggleDatabaseCollapse: (dbId: number) => void
  setShowWorkspaceModal: (show: boolean) => void
  setShowDatabaseModal: (show: boolean) => void
  setNewWorkspaceName: (name: string) => void
  setNewDatabaseName: (name: string) => void
  setModalWsId: (id: number | null) => void
  setModalDbId: (id: number | null) => void
  fetchWorkspaces: () => Promise<Workspace[]>
  createWorkspace: (name: string) => Promise<{ ok: boolean; error?: string }>
  createDatabase: (wsId: number, name: string) => Promise<{ ok: boolean; error?: string }>
  createTable: (dbId: number, name: string) => Promise<{ ok: boolean; error?: string }>
  deleteWorkspaceOrDb: (action: 'delete_workspace' | 'delete_database', id: number) => Promise<{ ok: boolean; error?: string }>
}

export const useWorkspaceStore = (): [WorkspaceState, WorkspaceActions] => {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([])
  const [activeWorkspaceId, setActiveWorkspaceIdState] = useState<number | null>(null)
  const [activeTableId, setActiveTableId] = useState<number | null>(null)
  const [activeViewId, setActiveViewId] = useState<number | null>(null)
  const [collapsedWorkspaces, setCollapsedWorkspaces] = useState<Record<number, boolean>>({})
  const [collapsedDatabases, setCollapsedDatabases] = useState<Record<number, boolean>>({})
  const [showWorkspaceModal, setShowWorkspaceModal] = useState(false)
  const [showDatabaseModal, setShowDatabaseModal] = useState(false)
  const [newWorkspaceName, setNewWorkspaceName] = useState('')
  const [newDatabaseName, setNewDatabaseName] = useState('')
  const [modalWsId, setModalWsId] = useState<number | null>(null)
  const [modalDbId, setModalDbId] = useState<number | null>(null)

  const toggleWorkspaceCollapse = useCallback((wsId: number) => {
    setCollapsedWorkspaces(prev => ({
      ...prev,
      [wsId]: !prev[wsId],
    }))
  }, [])

  const toggleDatabaseCollapse = useCallback((dbId: number) => {
    setCollapsedDatabases(prev => ({
      ...prev,
      [dbId]: !prev[dbId],
    }))
  }, [])

  const setActiveWorkspaceId = useCallback((id: number | null) => {
    setActiveWorkspaceIdState(id)
    if (id !== null) {
      setWorkspaces(currentWorkspaces => {
        const targetWs = currentWorkspaces.find(w => w.id === id)
        if (targetWs && targetWs.databases && targetWs.databases.length > 0) {
          const firstTable = targetWs.databases[0]?.tables?.[0]
          if (firstTable) {
            setActiveTableId(firstTable.id)
          }
        }
        return currentWorkspaces
      })
    }
  }, [])

  const fetchWorkspaces = useCallback(async () => {
    const result = await workspaceService.fetchWorkspaces()
    setWorkspaces(result)

    if (result.length > 0) {
      setActiveWorkspaceIdState(prev => {
        const currentActive = prev ?? result[0].id
        const targetWs = result.find(w => w.id === currentActive) || result[0]
        const firstTable = targetWs.databases?.[0]?.tables?.[0]
        if (firstTable) {
          setActiveTableId(firstTable.id)
        }
        return currentActive
      })
    }

    return result
  }, [])

  const createWorkspace = useCallback(async (name: string) => {
    const result = await workspaceService.createWorkspace(name)
    if (result.ok) {
      await fetchWorkspaces()
    }
    return { ok: result.ok, error: result.error }
  }, [fetchWorkspaces])

  const createDatabase = useCallback(async (wsId: number, name: string) => {
    const result = await workspaceService.createDatabase(wsId, name)
    if (result.ok) {
      await fetchWorkspaces()
    }
    return { ok: result.ok, error: result.error }
  }, [fetchWorkspaces])

  const createTable = useCallback(async (dbId: number, name: string) => {
    const result = await workspaceService.createTable(dbId, name)
    if (result.ok) {
      await fetchWorkspaces()
    }
    return { ok: result.ok, error: result.error }
  }, [fetchWorkspaces])

  const deleteWorkspaceOrDb = useCallback(
    async (action: 'delete_workspace' | 'delete_database', id: number) => {
      const result = await workspaceService.deleteWorkspaceOrDatabase(action, id)
      if (result.ok) {
        await fetchWorkspaces()
      }
      return { ok: result.ok, error: result.error }
    },
    [fetchWorkspaces]
  )

  const state: WorkspaceState = {
    workspaces,
    activeWorkspaceId,
    activeTableId,
    activeViewId,
    collapsedWorkspaces,
    collapsedDatabases,
    showWorkspaceModal,
    showDatabaseModal,
    newWorkspaceName,
    newDatabaseName,
    modalWsId,
    modalDbId,
  }

  const actions: WorkspaceActions = useMemo(() => ({
    setWorkspaces,
    setActiveWorkspaceId,
    setActiveTableId,
    setActiveViewId,
    setCollapsedWorkspaces,
    setCollapsedDatabases,
    toggleWorkspaceCollapse,
    toggleDatabaseCollapse,
    setShowWorkspaceModal,
    setShowDatabaseModal,
    setNewWorkspaceName,
    setNewDatabaseName,
    setModalWsId,
    setModalDbId,
    fetchWorkspaces,
    createWorkspace,
    createDatabase,
    createTable,
    deleteWorkspaceOrDb,
  }), [setWorkspaces, setActiveWorkspaceId, setActiveTableId, setActiveViewId, setCollapsedWorkspaces, setCollapsedDatabases, toggleWorkspaceCollapse, toggleDatabaseCollapse, setShowWorkspaceModal, setShowDatabaseModal, setNewWorkspaceName, setNewDatabaseName, setModalWsId, setModalDbId, fetchWorkspaces, createWorkspace, createDatabase, createTable, deleteWorkspaceOrDb])

  return [state, actions]
}
