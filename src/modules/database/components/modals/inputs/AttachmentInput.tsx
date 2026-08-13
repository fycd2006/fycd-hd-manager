'use client'

import React from 'react'
import { Paperclip, X } from 'lucide-react'
import type { TableField } from '@/modules/database/types'
import { useI18n } from '@/lib/i18n/i18nContext'
import type { AttachmentFile } from '../AdvancedFieldInputs'

interface AttachmentInputProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  readOnly?: boolean
}

export function AttachmentInput({ field, value, onChange, readOnly }: AttachmentInputProps) {
  const { t } = useI18n()

  const parseAttachmentFiles = (val: any): AttachmentFile[] => {
    if (val == null || val === '') return []
    let list: any[] = []
    if (Array.isArray(val)) list = val
    else if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val)
        if (Array.isArray(parsed)) list = parsed
        else list = [parsed]
      } catch {
        list = [{ url: val, name: val.split('/').pop() || t('advancedInputs.attachment') }]
      }
    } else if (typeof val === 'object') {
      list = [val]
    }
    return list.map(item => {
      if (typeof item === 'object' && item !== null) {
        return {
          url: String(item.url || item.path || ''),
          name: String(item.name || item.filename || item.url?.split('/').pop() || t('advancedInputs.attachment')),
          size: item.size
        }
      }
      return { url: String(item), name: String(item).split('/').pop() || t('advancedInputs.attachment') }
    }).filter(f => Boolean(f.url || f.name))
  }

  const files = parseAttachmentFiles(value)

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || e.target.files.length === 0 || readOnly) return
    const uploadedFiles: AttachmentFile[] = Array.from(e.target.files).map(f => ({
      url: URL.createObjectURL(f),
      name: f.name,
      size: f.size
    }))
    const nextFiles = [...files, ...uploadedFiles]
    onChange(nextFiles)
  }

  const removeFile = (idx: number) => {
    if (readOnly) return
    const nextFiles = files.filter((_, i) => i !== idx)
    onChange(nextFiles)
  }

  return (
    <div style={{ border: '1px solid #e2e8f0', borderRadius: '12px', padding: '10px 12px', background: '#ffffff', display: 'flex', flexDirection: 'column', gap: '8px' }}>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', alignItems: 'center' }}>
        {files.length === 0 ? (
          <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>{t('modals.noAttachments')}</span>
        ) : (
          files.map((file, idx) => (
            <div
              key={idx}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '6px',
                padding: '5px 12px',
                background: '#f1f5f9',
                border: '1px solid #cbd5e1',
                borderRadius: '10px',
                fontSize: '12px',
                color: '#1e293b',
                fontWeight: 500
              }}
            >
              <Paperclip size={14} color="#EA580C" />
              <a href={file.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none', maxWidth: '150px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                {file.name}
              </a>
              {!readOnly && (
                <button
                  type="button"
                  onClick={() => removeFile(idx)}
                  style={{
                    background: 'none',
                    border: 'none',
                    padding: '2px',
                    cursor: 'pointer',
                    color: '#94a3b8',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginLeft: '4px'
                  }}
                  className="hover:text-red-500 hover:bg-red-50 rounded-full"
                >
                  <X size={14} />
                </button>
              )}
            </div>
          ))
        )}
      </div>

      {!readOnly && (
        <div style={{ marginTop: '4px' }}>
          <label style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            padding: '6px 14px',
            background: '#ffffff',
            border: '1px dashed #cbd5e1',
            borderRadius: '10px',
            fontSize: '12px',
            fontWeight: 600,
            color: '#64748b',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
          className="hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50/30">
            <Paperclip size={14} />
            <span>{t('advancedInputs.addFile')}</span>
            <input
              type="file"
              multiple
              style={{ display: 'none' }}
              onChange={handleFileUpload}
            />
          </label>
        </div>
      )}
    </div>
  )
}
