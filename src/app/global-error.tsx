'use client'

import React from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <html lang="zh-TW">
      <body className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-[#1f1f1f] p-4 font-sans antialiased text-gray-900 dark:text-neutral-100">
        <div className="max-w-md w-full bg-white dark:bg-[#2a2a2a] rounded-xl shadow-xl border border-gray-200 dark:border-neutral-700 p-6 text-center">
          <div className="w-14 h-14 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertTriangle className="w-7 h-7" />
          </div>

          <h2 className="text-xl font-bold mb-2">系統發生異常</h2>

          <p className="text-sm text-gray-600 dark:text-neutral-400 mb-6">
            應用程式初始化或執行時發生非預期錯誤，請點擊下方按鈕重新嘗試連線。
          </p>

          <button
            onClick={() => reset()}
            className="inline-flex items-center justify-center gap-2 px-5 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm font-medium transition shadow-sm cursor-pointer"
          >
            <RefreshCw className="w-4 h-4" />
            重試連線
          </button>
        </div>
      </body>
    </html>
  )
}
