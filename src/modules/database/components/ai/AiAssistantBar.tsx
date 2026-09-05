'use client';

import React, { useState, useRef, useEffect } from 'react';
import { Sparkles, ArrowRight, Loader2, X, Lightbulb } from 'lucide-react';
import { getSocketId } from '@/lib/pusher-client';
import type { DiffPreviewData } from './AiDiffModal';

import { useOptionalTableContext } from '@/modules/database/context/TableContext';
import { generateSmartPresets, CATEGORY_BADGES } from './smartPresets';

interface AiAssistantBarProps {
  tableId: number | null;
  isOpen: boolean;
  onClose: () => void;
  onShowDiff: (diff: DiffPreviewData) => void;
  addToast: (msg: string, type: 'success' | 'error' | 'info') => void;
}

export function AiAssistantBar({ tableId, isOpen, onClose, onShowDiff, addToast }: AiAssistantBarProps) {
  const tableCtx = useOptionalTableContext();
  const [prompt, setPrompt] = useState('');
  const [loading, setLoading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const dynamicPresets = React.useMemo(() => {
    return generateSmartPresets({
      table: tableCtx?.activeTable,
      fields: tableCtx?.fields,
      rows: tableCtx?.rows,
    });
  }, [tableCtx?.activeTable, tableCtx?.fields, tableCtx?.rows]);

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  if (!isOpen || !tableId) return null;

  const handleSubmit = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const query = prompt.trim();
    if (!query) return;

    setLoading(true);
    try {
      const socketId = getSocketId();
      const res = await fetch('/api/ai/table-agent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(socketId ? { 'x-socket-id': socketId } : {}),
        },
        body: JSON.stringify({
          tableId,
          userPrompt: query,
          mode: 'dry_run',
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        addToast(data.error || 'AI 請求失敗', 'error');
        setLoading(false);
        return;
      }

      if (data.type === 'diff_preview') {
        onShowDiff(data);
      } else if (data.type === 'text_reply') {
        addToast(data.message, 'info');
      } else {
        addToast(data.message || '指令分析完成', 'info');
      }
    } catch (err: any) {
      addToast(err?.message || '呼叫 AI 服務時發生錯誤', 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      style={{
        borderBottom: '1px solid #e2e8f0',
        background: 'linear-gradient(90deg, #f5f3ff 0%, #ede9fe 50%, #f0fdf4 100%)',
        padding: '10px 16px',
        display: 'flex',
        flexDirection: 'column',
        gap: '8px',
        boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)',
        animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1)',
      }}
    >
      <form
        onSubmit={handleSubmit}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          width: '100%',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            flex: 1,
            backgroundColor: '#ffffff',
            borderRadius: '10px',
            padding: '4px 12px',
            border: '1.5px solid #c4b5fd',
            boxShadow: '0 2px 5px rgba(124, 58, 237, 0.08)',
          }}
        >
          <Sparkles size={18} color="#7c3aed" style={{ flexShrink: 0 }} />
          <input
            ref={inputRef}
            type="text"
            placeholder="請輸入自然語言指令，例如：「把所有未分組的列改為建興組」或「刪除金額小於 100 的資料」..."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            disabled={loading}
            style={{
              width: '100%',
              border: 'none',
              outline: 'none',
              fontSize: '13.5px',
              color: '#1e293b',
              backgroundColor: 'transparent',
            }}
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose();
            }}
          />
          {prompt && (
            <button
              type="button"
              onClick={() => setPrompt('')}
              style={{
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8',
                padding: '2px',
              }}
            >
              <X size={14} />
            </button>
          )}
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            padding: '8px 16px',
            borderRadius: '10px',
            background: 'linear-gradient(135deg, #6366f1 0%, #7c3aed 100%)',
            color: '#ffffff',
            border: 'none',
            fontSize: '13px',
            fontWeight: 600,
            cursor: loading || !prompt.trim() ? 'not-allowed' : 'pointer',
            opacity: loading || !prompt.trim() ? 0.6 : 1,
            boxShadow: '0 2px 8px rgba(124, 58, 237, 0.25)',
            whiteSpace: 'nowrap',
            transition: 'all 0.15s ease',
          }}
        >
          {loading ? (
            <>
              <Loader2 size={16} className="animate-spin" />
              <span>Gemini 分析中...</span>
            </>
          ) : (
            <>
              <span>執行分析</span>
              <ArrowRight size={15} />
            </>
          )}
        </button>

        <button
          type="button"
          onClick={onClose}
          title="關閉 AI 助手"
          style={{
            background: 'none',
            border: 'none',
            color: '#64748b',
            cursor: 'pointer',
            padding: '6px',
            borderRadius: '6px',
          }}
        >
          <X size={16} />
        </button>
      </form>

      {/* Preset Suggestions */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '6px', flexWrap: 'wrap', fontSize: '12px', color: '#6b7280' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '4px', color: '#7c3aed', fontWeight: 500 }}>
          <Lightbulb size={13} />
          <span>範例：</span>
        </div>
        {dynamicPresets.slice(0, 4).map((p, idx) => {
          const badgeInfo = CATEGORY_BADGES[p.category] || CATEGORY_BADGES.general;
          return (
            <button
              key={idx}
              type="button"
              onClick={() => setPrompt(p.prompt)}
              style={{
                background: '#ffffff',
                border: '1px solid #e9d5ff',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '12px',
                color: '#6d28d9',
                cursor: 'pointer',
                transition: 'all 0.1s ease',
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
              }}
              onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = '#f5f3ff')}
              onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = '#ffffff')}
            >
              <span
                style={{
                  fontSize: '9.5px',
                  fontWeight: 600,
                  padding: '1px 4px',
                  borderRadius: '4px',
                  color: badgeInfo.color,
                  backgroundColor: badgeInfo.bg,
                  border: `1px solid ${badgeInfo.color}25`,
                  lineHeight: '12px',
                }}
              >
                {badgeInfo.badge}
              </span>
              <span>{p.label || p.prompt}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
