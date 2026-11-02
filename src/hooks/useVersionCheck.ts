'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import {
  APP_CURRENT_VERSION,
  CHANGELOG_RELEASES,
  type VersionRelease,
} from '@/config/changelog'

export interface UseVersionCheckOptions {
  checkIntervalMs?: number
  endpoint?: string
  reloadFn?: () => void
}

export interface UseVersionCheckResult {
  currentVersion: string
  latestVersion: string | null
  latestRelease: VersionRelease | null
  changelog: VersionRelease[]
  hasUpdate: boolean
  isDismissed: boolean
  isChecking: boolean
  showModal: boolean
  setShowModal: (open: boolean) => void
  checkForUpdates: () => Promise<void>
  dismissUpdateNotification: () => void
  applyUpdate: () => void
}

export function useVersionCheck(options: UseVersionCheckOptions = {}): UseVersionCheckResult {
  const {
    checkIntervalMs = 5 * 60 * 1000, // 5 minutes
    endpoint = '/api/version',
    reloadFn,
  } = options

  const [currentVersion] = useState<string>(APP_CURRENT_VERSION)
  const [latestVersion, setLatestVersion] = useState<string | null>(APP_CURRENT_VERSION)
  const [latestRelease, setLatestRelease] = useState<VersionRelease | null>(
    CHANGELOG_RELEASES[0] ?? null
  )
  const [changelog, setChangelog] = useState<VersionRelease[]>(CHANGELOG_RELEASES)
  const [hasUpdate, setHasUpdate] = useState<boolean>(false)
  const [isDismissed, setIsDismissed] = useState<boolean>(false)
  const [isChecking, setIsChecking] = useState<boolean>(false)
  const [showModal, setShowModal] = useState<boolean>(false)

  const isMountedRef = useRef<boolean>(true)
  const lastCheckTimeRef = useRef<number>(0)

  const checkForUpdates = useCallback(async () => {
    // Avoid double-checking within 5 seconds
    const now = Date.now()
    if (now - lastCheckTimeRef.current < 5000 && lastCheckTimeRef.current > 0) {
      return
    }
    lastCheckTimeRef.current = now

    setIsChecking(true)
    try {
      const res = await fetch(endpoint, {
        cache: 'no-store',
        headers: {
          'Cache-Control': 'no-cache',
          Pragma: 'no-cache',
        },
      })

      if (!res.ok) return

      const data = await res.json()
      if (!isMountedRef.current) return

      if (data?.version) {
        setLatestVersion(data.version)
        setHasUpdate(data.version !== currentVersion)
      }

      if (data?.latestRelease) {
        setLatestRelease(data.latestRelease)
      }

      if (Array.isArray(data?.history) && data.history.length > 0) {
        setChangelog(data.history)
      }
    } catch (err) {
      // Non-blocking error: update checks fail silently
      console.warn('Failed to check for application updates:', err)
    } finally {
      if (isMountedRef.current) {
        setIsChecking(false)
      }
    }
  }, [currentVersion, endpoint])

  const dismissUpdateNotification = useCallback(() => {
    setIsDismissed(true)
  }, [])

  const applyUpdate = useCallback(() => {
    if (reloadFn) {
      reloadFn()
    } else if (typeof window !== 'undefined') {
      window.location.reload()
    }
  }, [reloadFn])

  useEffect(() => {
    isMountedRef.current = true

    // Check on initial mount asynchronously
    const initialTimer = setTimeout(() => {
      void checkForUpdates()
    }, 0)

    // Setup periodic polling
    const timer = setInterval(() => {
      void checkForUpdates()
    }, checkIntervalMs)

    // Visibility change listener: check when user switches back to this tab
    const handleVisibilityChange = () => {
      if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
        void checkForUpdates()
      }
    }

    if (typeof document !== 'undefined') {
      document.addEventListener('visibilitychange', handleVisibilityChange)
    }

    return () => {
      isMountedRef.current = false
      clearTimeout(initialTimer)
      clearInterval(timer)
      if (typeof document !== 'undefined') {
        document.removeEventListener('visibilitychange', handleVisibilityChange)
      }
    }
  }, [checkForUpdates, checkIntervalMs])

  return {
    currentVersion,
    latestVersion,
    latestRelease,
    changelog,
    hasUpdate,
    isDismissed,
    isChecking,
    showModal,
    setShowModal,
    checkForUpdates,
    dismissUpdateNotification,
    applyUpdate,
  }
}
