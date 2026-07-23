'use client'

import React from 'react'
import { X, CreditCard, Sparkles, Check, HardDrive, Database, Users } from 'lucide-react'
import type { Workspace } from '@/modules/database/types'

interface SubscriptionModalProps {
  show: boolean
  onClose: () => void
  workspace: Workspace | null
  onToast: (msg: string, type: 'success' | 'error' | 'info') => void
}

export default function SubscriptionModal({
  show,
  onClose,
  workspace,
  onToast
}: SubscriptionModalProps) {
  if (!show || !workspace) return null

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 1100, display: 'flex', alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(15, 23, 42, 0.45)', backdropFilter: 'blur(4px)' }}>
      <div style={{ width: '580px', backgroundColor: '#ffffff', borderRadius: '16px', boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)', border: '1px solid #e2e8f0', overflow: 'hidden' }}>
        
        {/* Modal Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 24px', borderBottom: '1px solid #e2e8f0', backgroundColor: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <CreditCard size={20} color="#2563eb" />
            <h3 style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a', margin: 0 }}>Subscriptions (訂閱與資源用量)</h3>
          </div>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#94a3b8', cursor: 'pointer', padding: '4px' }}>
            <X size={20} />
          </button>
        </div>

        {/* Modal Body */}
        <div style={{ padding: '24px', display: 'flex', flexDirection: 'column', gap: '20px' }}>
          
          {/* Current Plan Banner */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', background: 'linear-gradient(135deg, #eff6ff 0%, #dbeafe 100%)', borderRadius: '12px', border: '1px solid #bfdbfe' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <Sparkles size={16} color="#2563eb" />
                <span style={{ fontSize: '15px', fontWeight: 700, color: '#1e40af' }}>Enterprise Pro Plan (企業版)</span>
              </div>
              <span style={{ fontSize: '12px', color: '#3b82f6', fontWeight: 500 }}>
                【{workspace.name}】工作區目前享有無限資源與進階權限
              </span>
            </div>
            <span style={{ fontSize: '12px', fontWeight: 700, color: '#15803d', backgroundColor: '#dcfce7', padding: '4px 10px', borderRadius: '12px' }}>
              Active (使用中)
            </span>
          </div>

          {/* Usage Metrics */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px' }}>
            <div style={{ padding: '14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                <Database size={14} /> 資料庫數量
              </div>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>{workspace.databases?.length || 0} / 無限</span>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                <HardDrive size={14} /> 資料容量
              </div>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>無上限 (Unlimited)</span>
            </div>

            <div style={{ padding: '14px', backgroundColor: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: '10px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12px', color: '#64748b' }}>
                <Users size={14} /> 團隊成員上限
              </div>
              <span style={{ fontSize: '18px', fontWeight: 700, color: '#0f172a' }}>無上限 (Unlimited)</span>
            </div>
          </div>

          {/* Plan Features */}
          <div style={{ borderTop: '1px solid #f1f5f9', paddingTop: '16px', display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <span style={{ fontSize: '13px', fontWeight: 700, color: '#0f172a' }}>方案包含功能權益：</span>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', fontSize: '13px', color: '#334155' }}>
              {['動態資料表無限欄位', '檢視表與看板分組', '即時儲存格匯總計算', '進階權限控管 (RBAC)', '全功能 API 與 Webhook', '歷史變更與復原紀錄'].map(feat => (
                <div key={feat} style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <Check size={15} color="#16a34a" />
                  <span>{feat}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Buttons */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '8px' }}>
            <button
              onClick={onClose}
              style={{ padding: '10px 20px', backgroundColor: '#2563eb', color: '#ffffff', border: 'none', borderRadius: '8px', fontSize: '14px', fontWeight: 600, cursor: 'pointer', boxShadow: '0 4px 12px rgba(37,99,235,0.25)' }}
            >
              關閉
            </button>
          </div>

        </div>
      </div>
    </div>
  )
}
