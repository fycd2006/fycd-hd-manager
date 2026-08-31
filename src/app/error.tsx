'use client'

import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw, Home } from 'lucide-react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error('[Application Error Boundary caught error]:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1f1f1f] p-4 font-sans">
      <div className="max-w-md w-full bg-white dark:bg-[#2a2a2a] rounded-xl shadow-lg border border-gray-200 dark:border-neutral-700 p-6 text-center">
        <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-7 h-7" />
        </div>

        <h2 className="text-xl font-bold text-gray-900 dark:text-white mb-2">
          系統暫時發生異常
        </h2>

        <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6">
          頁面載入或元件渲染時發生非預期狀況，請點擊下方按鈕重新嘗試或重新整理。
        </p>

        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            重新嘗試
          </button>
          <button
            onClick={() => window.location.reload()}
            className="inline-flex items-center justify-center gap-2 px-4 py-2 bg-gray-100 hover:bg-gray-200 dark:bg-neutral-800 dark:hover:bg-neutral-700 text-gray-700 dark:text-neutral-200 rounded-lg text-sm font-medium transition cursor-pointer"
          >
            <Home className="w-4 h-4" />
            重新載入頁面
          </button>
        </div>
      </div>
    </div>
  )
}
