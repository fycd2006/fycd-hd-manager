'use client'

import React from 'react'
import { X, Sliders, Sun, Moon, RotateCcw, Eye, Sparkles } from 'lucide-react'
import type { Theme, DarkReaderSettings } from '@/modules/database/types'

interface DarkReaderModalProps {
  show: boolean
  onClose: () => void
  theme: Theme
  onToggleTheme: () => void
  darkReaderSettings: DarkReaderSettings
  onUpdateDarkReaderSettings: (settings: Partial<DarkReaderSettings>) => void
  onToast?: (msg: string, type: 'success' | 'error' | 'info') => void
}

export default function DarkReaderModal({
  show,
  onClose,
  theme,
  onToggleTheme,
  darkReaderSettings,
  onUpdateDarkReaderSettings,
  onToast
}: DarkReaderModalProps) {
  if (!show) return null

  const handleReset = () => {
    onUpdateDarkReaderSettings({
      brightness: 100,
      contrast: 100,
      sepia: 0,
      grayscale: 0
    })
    onToast?.('色彩與濾鏡設定已恢復為系統預設值', 'info')
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '460px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '18px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <Sliders size={20} color="#2563eb" />
            <h3 style={{ fontSize: '17px', fontWeight: 700, color: '#0f172a', margin: 0 }}>色彩與顯示客製化調整</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Light / Dark Mode Quick Switch */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
            <label style={{ fontSize: '13px', fontWeight: 600, color: '#334155', display: 'flex', alignItems: 'center', gap: '6px' }}>
              <Sparkles size={15} color="#2563eb" /> 主題深淺模式 (Theme Mode)
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => { if (theme !== 'light') onToggleTheme() }}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: theme === 'light' ? '2px solid #2563eb' : '1px solid #cbd5e1',
                  backgroundColor: theme === 'light' ? '#eff6ff' : '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: theme === 'light' ? '#2563eb' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                <Sun size={16} />
                <span>明亮模式 (Light)</span>
              </button>

              <button
                type="button"
                onClick={() => { if (theme !== 'dark') onToggleTheme() }}
                style={{
                  padding: '12px',
                  borderRadius: '10px',
                  border: theme === 'dark' ? '2px solid #4f46e5' : '1px solid #cbd5e1',
                  backgroundColor: theme === 'dark' ? '#312e81' : '#f8fafc',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '8px',
                  fontWeight: 600,
                  fontSize: '13px',
                  color: theme === 'dark' ? '#ffffff' : '#64748b',
                  cursor: 'pointer'
                }}
              >
                <Moon size={16} />
                <span>夜間模式 (Dark)</span>
              </button>
            </div>
          </div>

          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a', display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Eye size={15} color="#2563eb" /> 視覺與對比微調 (Filters)
              </span>
              <button
                type="button"
                onClick={handleReset}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: '12px', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '4px', fontWeight: 500 }}
              >
                <RotateCcw size={12} />
                <span>重設預設值</span>
              </button>
            </div>

            {/* Brightness Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                <span>亮度 (Brightness)</span>
                <span>{darkReaderSettings.brightness}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={darkReaderSettings.brightness}
                onChange={e => onUpdateDarkReaderSettings({ brightness: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
              />
            </div>

            {/* Contrast Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                <span>對比度 (Contrast)</span>
                <span>{darkReaderSettings.contrast}%</span>
              </div>
              <input
                type="range"
                min="50"
                max="150"
                value={darkReaderSettings.contrast}
                onChange={e => onUpdateDarkReaderSettings({ contrast: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#2563eb', cursor: 'pointer' }}
              />
            </div>

            {/* Warmth / Sepia Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                <span>護眼暖色 (Warmth / Sepia)</span>
                <span>{darkReaderSettings.sepia}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={darkReaderSettings.sepia}
                onChange={e => onUpdateDarkReaderSettings({ sepia: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#d97706', cursor: 'pointer' }}
              />
            </div>

            {/* Grayscale Slider */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#475569', fontWeight: 500 }}>
                <span>灰階 (Grayscale)</span>
                <span>{darkReaderSettings.grayscale}%</span>
              </div>
              <input
                type="range"
                min="0"
                max="100"
                value={darkReaderSettings.grayscale}
                onChange={e => onUpdateDarkReaderSettings({ grayscale: Number(e.target.value) })}
                style={{ width: '100%', accentColor: '#475569', cursor: 'pointer' }}
              />
            </div>

          </div>

          {/* Footer Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '4px' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 22px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
            >
              完成與關閉
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
