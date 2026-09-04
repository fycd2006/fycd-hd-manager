'use client';

import React from 'react';
import { Sparkles, Check, X, AlertTriangle, ArrowRight, PlusCircle, Trash2 } from 'lucide-react';

export interface DiffPreviewData {
  type: 'diff_preview';
  action: 'update_cells' | 'create_rows' | 'delete_rows';
  reason: string;
  changes?: Array<{
    rowId: number;
    rowTitle: string;
    fieldKey: string;
    fieldName: string;
    oldValue: string;
    newValue: string;
  }>;
  newRows?: Array<Record<string, any>>;
  deletedRows?: Array<{ id: number; title: string }>;
  actionPayload: {
    name: string;
    args: any;
  };
}

interface AiDiffModalProps {
  diff: DiffPreviewData | null;
  isOpen: boolean;
  isApplying: boolean;
  onConfirm: () => void;
  onClose: () => void;
}

export function AiDiffModal({ diff, isOpen, isApplying, onConfirm, onClose }: AiDiffModalProps) {
  if (!isOpen || !diff) return null;

  return (
    <div 
      style={{
        position: 'fixed',
        inset: 0,
        backgroundColor: 'rgba(15, 23, 42, 0.45)',
        backdropFilter: 'blur(3px)',
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '16px',
        animation: 'fadeIn 0.15s ease-out',
      }}
      onClick={(e) => {
        if (e.target === e.currentTarget && !isApplying) onClose();
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '720px',
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '16px',
          boxShadow: '0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          border: '1px solid #e2e8f0',
        }}
      >
        {/* Header */}
        <div
          style={{
            padding: '18px 24px',
            borderBottom: '1px solid #f1f5f9',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            background: 'linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%)',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '32px',
                height: '32px',
                borderRadius: '8px',
                background: 'linear-gradient(135deg, #4f46e5 0%, #7c3aed 100%)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#ffffff',
                boxShadow: '0 2px 6px rgba(124, 58, 237, 0.3)',
              }}
            >
              <Sparkles size={18} />
            </div>
            <div>
              <h3 style={{ margin: 0, fontSize: '16px', fontWeight: 600, color: '#0f172a' }}>
                AI 自動化變更預覽
              </h3>
              <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
                {diff.reason}
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            style={{
              background: 'none',
              border: 'none',
              cursor: isApplying ? 'not-allowed' : 'pointer',
              color: '#94a3b8',
              padding: '4px',
              borderRadius: '6px',
            }}
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div style={{ padding: '20px 24px', overflowY: 'auto', flex: 1 }}>
          {/* Action: UPDATE CELLS */}
          {diff.action === 'update_cells' && diff.changes && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '13px', color: '#475569', fontWeight: 500 }}>
                <span>即將更新以下 <strong>{diff.changes.length}</strong> 個儲存格：</span>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflow: 'hidden' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      <th style={{ padding: '10px 12px' }}>資料列 (主要欄位)</th>
                      <th style={{ padding: '10px 12px' }}>欄位</th>
                      <th style={{ padding: '10px 12px' }}>原始數值</th>
                      <th style={{ padding: '10px 12px', width: '24px' }}></th>
                      <th style={{ padding: '10px 12px' }}>變更為</th>
                    </tr>
                  </thead>
                  <tbody>
                    {diff.changes.map((c, i) => (
                      <tr key={i} style={{ borderBottom: i < diff.changes!.length - 1 ? '1px solid #f1f5f9' : 'none' }}>
                        <td style={{ padding: '10px 12px', fontWeight: 500, color: '#1e293b' }}>{c.rowTitle}</td>
                        <td style={{ padding: '10px 12px', color: '#64748b' }}>{c.fieldName}</td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ backgroundColor: '#fee2e2', color: '#991b1b', padding: '2px 8px', borderRadius: '4px', textDecoration: 'line-through' }}>
                            {c.oldValue || '(空白)'}
                          </span>
                        </td>
                        <td style={{ padding: '10px 6px', color: '#94a3b8' }}>
                          <ArrowRight size={14} />
                        </td>
                        <td style={{ padding: '10px 12px' }}>
                          <span style={{ backgroundColor: '#dcfce7', color: '#166534', padding: '2px 8px', borderRadius: '4px', fontWeight: 600 }}>
                            {c.newValue}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action: CREATE ROWS */}
          {diff.action === 'create_rows' && diff.newRows && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '13px', color: '#166534', fontWeight: 500 }}>
                <PlusCircle size={16} />
                <span>即將新增 <strong>{diff.newRows.length}</strong> 筆資料：</span>
              </div>
              <div style={{ border: '1px solid #e2e8f0', borderRadius: '10px', overflowX: 'auto' }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
                  <thead>
                    <tr style={{ backgroundColor: '#f8fafc', borderBottom: '1px solid #e2e8f0', color: '#475569' }}>
                      {Object.keys(diff.newRows[0] || {}).map((col, idx) => (
                        <th key={idx} style={{ padding: '10px 12px', whiteSpace: 'nowrap' }}>{col}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {diff.newRows.map((row, idx) => (
                      <tr key={idx} style={{ borderBottom: idx < diff.newRows!.length - 1 ? '1px solid #f1f5f9' : 'none', backgroundColor: '#f0fdf4' }}>
                        {Object.values(row).map((val: any, vIdx) => (
                          <td key={vIdx} style={{ padding: '10px 12px', color: '#1e293b' }}>
                            {String(val ?? '')}
                          </td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Action: DELETE ROWS */}
          {diff.action === 'delete_rows' && diff.deletedRows && (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginBottom: '12px', fontSize: '13px', color: '#dc2626', fontWeight: 500 }}>
                <AlertTriangle size={16} />
                <span>注意：即將刪除以下 <strong>{diff.deletedRows.length}</strong> 筆資料：</span>
              </div>
              <div style={{ border: '1px solid #fee2e2', backgroundColor: '#fff5f5', borderRadius: '10px', padding: '12px' }}>
                <ul style={{ margin: 0, paddingLeft: '20px', fontSize: '13px', color: '#991b1b' }}>
                  {diff.deletedRows.map(r => (
                    <li key={r.id} style={{ margin: '4px 0' }}>
                      <strong>{r.title}</strong> (ID: {r.id})
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div
          style={{
            padding: '16px 24px',
            borderTop: '1px solid #e2e8f0',
            backgroundColor: '#f8fafc',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-end',
            gap: '12px',
          }}
        >
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            style={{
              padding: '8px 16px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#475569',
              backgroundColor: '#ffffff',
              border: '1px solid #cbd5e1',
              borderRadius: '8px',
              cursor: isApplying ? 'not-allowed' : 'pointer',
              transition: 'background 0.15s',
            }}
          >
            放棄變更
          </button>

          <button
            type="button"
            onClick={onConfirm}
            disabled={isApplying}
            style={{
              padding: '8px 20px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#ffffff',
              backgroundColor: diff.action === 'delete_rows' ? '#dc2626' : '#4f46e5',
              border: 'none',
              borderRadius: '8px',
              cursor: isApplying ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              boxShadow: diff.action === 'delete_rows' ? '0 2px 6px rgba(220, 38, 38, 0.3)' : '0 2px 6px rgba(79, 70, 229, 0.3)',
              opacity: isApplying ? 0.7 : 1,
            }}
          >
            {isApplying ? (
              <span>寫入中...</span>
            ) : (
              <>
                <Check size={16} />
                <span>確認套用變更</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
