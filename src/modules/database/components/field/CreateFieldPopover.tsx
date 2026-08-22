'use client'

import React, { useState, useEffect, useRef } from 'react'
import PopoverPortal from '@/components/ui/PopoverPortal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import { TableField } from '@/modules/database/types'
import { parseFormula } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'
import { FieldTypeSelector } from '../modals/FieldTypeSelector'
import { FieldModalHeader } from '../modals/FieldModalHeader'
import { NumberFieldOptions } from '../modals/field-options/NumberFieldOptions'
import { SelectFieldOptions, type SelectOptionItem } from '../modals/field-options/SelectFieldOptions'
import { LinkRowFieldOptions } from '../modals/field-options/LinkRowFieldOptions'
import { RollupLookupFieldOptions } from '../modals/field-options/RollupLookupFieldOptions'
import { FormulaFieldOptions } from '../modals/field-options/FormulaFieldOptions'
import { BASEROW_PALETTE } from '../views/grid/cells/utils'

export interface CreateFieldPopoverProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string, type: string, options?: any) => Promise<void>
  position: { top: number; left: number; width?: number } | null
  tables?: Array<{ id: number; name: string; fields?: any[] }>
  fields?: any[]
  editField?: TableField | null
  defaultType?: string
}

export function CreateFieldPopover({
  show,
  onClose,
  onSubmit,
  position,
  tables = [],
  fields = [],
  editField = null,
  defaultType = 'text',
}: CreateFieldPopoverProps) {
  const { t } = useI18n()
  const [name, setName] = useState('')
  const [nameError, setNameError] = useState(false)
  const [type, setType] = useState(defaultType)
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(false)
  const [loading, setLoading] = useState(false)

  // Sub-field states
  const [optionsList, setOptionsList] = useState<SelectOptionItem[]>([])
  const [newOptionText, setNewOptionText] = useState('')
  const [targetTableId, setTargetTableId] = useState<number | null>(null)
  const [relationFieldId, setRelationFieldId] = useState<number | null>(null)
  const [targetFieldId, setTargetFieldId] = useState<number | null>(null)
  const [rollupFunction, setRollupFunction] = useState('sum')
  const [formula, setFormula] = useState('')
  const [formulaTab, setFormulaTab] = useState<'fields' | 'functions' | 'operators'>('fields')
  const [functionSearch, setFunctionSearch] = useState('')
  const [activeHoverFunc, setActiveHoverFunc] = useState<{ name: string; doc: string; snippet: string; category?: string } | null>(null)
  const [selectedHelpFunc, setSelectedHelpFunc] = useState<{ name: string; doc: string; snippet: string; category?: string } | null>(null)

  // Number field options state
  const [numberDecimalPlaces, setNumberDecimalPlaces] = useState<number>(0)
  const [numberFormat, setNumberFormat] = useState<string>('thousands')
  const [numberPrefix, setNumberPrefix] = useState<string>('')
  const [numberSuffix, setNumberSuffix] = useState<string>('')

  const [fetchedTargetFields, setFetchedTargetFields] = useState<any[]>([])
  const [description, setDescription] = useState('')
  const formulaTextareaRef = useRef<HTMLTextAreaElement>(null)

  // Link row config
  const [createRelatedField, setCreateRelatedField] = useState(true)
  const [allowMultiple, setAllowMultiple] = useState(true)

  const selectedRelationField = fields?.find((f: any) => f.id === relationFieldId)
  const relOpts = typeof selectedRelationField?.options === 'object'
    ? selectedRelationField.options
    : safeJsonParse<Record<string, any>>(selectedRelationField?.options, {})
  const targetTableIdFromRel = Number(
    relOpts?.targetTableId ?? relOpts?.link_row_table_id ?? relOpts?.target_table_id ?? (selectedRelationField as any)?.targetTableId
  ) || null
  const targetTableObj = tables?.find((t: any) => t.id === targetTableIdFromRel)

  useEffect(() => {
    if (!targetTableIdFromRel) {
      setFetchedTargetFields([])
      return
    }
    if (targetTableObj?.fields && targetTableObj.fields.length > 0) {
      setFetchedTargetFields(targetTableObj.fields)
    } else {
      fetch(`/api/tables/${targetTableIdFromRel}/fields`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) setFetchedTargetFields(data)
        })
        .catch(err => console.error(err))
    }
  }, [targetTableIdFromRel, targetTableObj])

  const insertAtCursor = (text: string, cursorOffsetFromEnd: number = 0) => {
    const el = formulaTextareaRef.current
    if (!el) {
      setFormula(prev => prev + (prev && !prev.endsWith(' ') ? ' ' : '') + text)
      return
    }
    const start = el.selectionStart ?? formula.length
    const end = el.selectionEnd ?? formula.length
    const before = formula.slice(0, start)
    const after = formula.slice(end)

    const needsLeadingSpace = before.length > 0 && !/\s|[({,]/.test(before.slice(-1)) && !/^[),%]/.test(text)
    const prefix = needsLeadingSpace ? ' ' : ''
    const insertedText = prefix + text

    const newFormula = before + insertedText + after
    setFormula(newFormula)

    const targetPos = start + insertedText.length - cursorOffsetFromEnd

    requestAnimationFrame(() => {
      el.focus()
      el.setSelectionRange(targetPos, targetPos)
    })
  }

  let formulaSyntaxError = ''
  if (formula && formula.trim()) {
    try {
      parseFormula(formula)
    } catch (err: any) {
      formulaSyntaxError = err.message || '語法錯誤'
    }
  }

  useEffect(() => {
    if (show) {
      if (editField) {
        setName(editField.name || '')
        setType(editField.type || 'text')
        setTypeDropdownOpen(false)
        let choices: SelectOptionItem[] = []
        let formulaStr = ''
        if (editField.options) {
          try {
            let parsed = typeof editField.options === 'string' ? JSON.parse(editField.options) : editField.options
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed) } catch {}
            }
            let rawList: any[] = []
            if (Array.isArray(parsed)) rawList = parsed
            else if (parsed && Array.isArray(parsed.choices)) rawList = parsed.choices
            else if (parsed && Array.isArray(parsed.select_options)) rawList = parsed.select_options
            else if (parsed && Array.isArray(parsed.options)) rawList = parsed.options
            else if (typeof editField.options === 'string' && editField.options.includes(',')) rawList = editField.options.split(',')

            const isUuidPattern = (s: string) =>
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
              /^[0-9a-f]{24,}$/i.test(s.trim())

            choices = rawList
              .map((item, idx) => {
                if (typeof item === 'object' && item !== null) {
                  const id = item.id || `opt_${idx}`
                  const name = item.name || item.label || item.text || item.value || ''
                  const color = item.color || BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg
                  return { id, name, color }
                }
                const str = String(item || '').trim()
                return {
                  id: `opt_${idx}`,
                  name: str,
                  color: BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg,
                }
              })
              .filter((c) => c.name.length > 0 && !isUuidPattern(c.name))

            if (parsed && typeof parsed === 'object') {
              if (parsed.targetTableId) setTargetTableId(Number(parsed.targetTableId))
              if (parsed.relationFieldId) setRelationFieldId(Number(parsed.relationFieldId))
              if (parsed.targetFieldId) setTargetFieldId(Number(parsed.targetFieldId))
              if (parsed.rollupFunction) setRollupFunction(parsed.rollupFunction)
              if (typeof parsed.createRelatedField === 'boolean') setCreateRelatedField(parsed.createRelatedField)
              if (typeof parsed.allowMultiple === 'boolean') setAllowMultiple(parsed.allowMultiple)
              if (parsed.formula) formulaStr = String(parsed.formula)
              if (typeof parsed.number_decimal_places === 'number') setNumberDecimalPlaces(parsed.number_decimal_places)
              if (parsed.number_format) setNumberFormat(parsed.number_format)
              if (parsed.number_prefix) setNumberPrefix(parsed.number_prefix)
              if (parsed.number_suffix) setNumberSuffix(parsed.number_suffix)
            } else if (typeof editField.options === 'string' && !editField.options.startsWith('{')) {
              formulaStr = editField.options
            }
          } catch {
            if (typeof editField.options === 'string') formulaStr = editField.options
          }
        }
        setOptionsList(choices)
        setFormula(formulaStr)
      } else {
        setName('Single line text')
        setType(defaultType || 'text')
        setTypeDropdownOpen(false)
        setOptionsList([])
        setFormula('')
        setRelationFieldId(null)
        setTargetFieldId(null)
        setRollupFunction('sum')
        setNumberDecimalPlaces(0)
        setNumberFormat('thousands')
        setNumberPrefix('')
        setNumberSuffix('')
        setCreateRelatedField(true)
        setAllowMultiple(true)
      }
    }
  }, [editField, show, defaultType])

  const handleSubmit = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) {
      setNameError(true)
      return
    }

    setLoading(true)
    try {
      let parsedOptions: any = null
      if (type === 'single_select' || type === 'multiple_select') {
        const isUuidPattern = (s: string) =>
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
          /^[0-9a-f]{24,}$/i.test(s.trim())

        const cleanChoices = optionsList
          .map((c, idx) => {
            if (typeof c === 'object' && c !== null) {
              return {
                id: c.id || `opt_${idx}`,
                name: c.name.trim(),
                color: c.color || BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg,
              }
            }
            const str = String(c || '').trim()
            return {
              id: `opt_${idx}`,
              name: str,
              color: BASEROW_PALETTE[idx % BASEROW_PALETTE.length].bg,
            }
          })
          .filter((c) => c.name.length > 0 && !isUuidPattern(c.name))

        parsedOptions = { choices: cleanChoices }
      } else if (type === 'link_row' && targetTableId) {
        parsedOptions = { targetTableId, createRelatedField, allowMultiple }
      } else if ((type === 'lookup' || type === 'rollup') && relationFieldId) {
        parsedOptions = {
          relationFieldId,
          targetFieldId,
          ...(type === 'rollup' && { rollupFunction })
        }
      } else if (type === 'formula') {
        parsedOptions = { formula }
      } else if (type === 'number') {
        parsedOptions = {
          number_decimal_places: numberDecimalPlaces,
          number_format: numberFormat,
          number_prefix: numberPrefix,
          number_suffix: numberSuffix
        }
      }

      await onSubmit(name.trim(), type, parsedOptions)
      setName('')
      setNameError(false)
      setType('text')
      setOptionsList([])
      onClose()
    } finally {
      setLoading(false)
    }
  }

  // Adjust position to stay safely on screen
  const safePosition = React.useMemo(() => {
    if (!position) return null
    const popoverWidth = type === 'formula' ? 520 : 380
    const screenWidth = typeof window !== 'undefined' ? window.innerWidth : 1200
    const screenHeight = typeof window !== 'undefined' ? window.innerHeight : 800

    let left = position.left
    if (left + popoverWidth > screenWidth - 16) {
      left = Math.max(16, screenWidth - popoverWidth - 16)
    }

    let top = position.top
    const estimatedHeight = type === 'formula' ? 520 : (type === 'single_select' || type === 'multiple_select' || type === 'number') ? 460 : 320
    if (top + estimatedHeight > screenHeight - 16) {
      top = Math.max(16, screenHeight - estimatedHeight - 16)
    }

    return { top, left, width: popoverWidth }
  }, [position, type])

  if (!show || !safePosition) return null

  return (
    <PopoverPortal show={show} onClose={onClose} position={safePosition}>
      <div
        className="baserow-create-field-popover"
        style={{
          background: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 10px 30px -5px rgba(0, 0, 0, 0.16), 0 0 0 1px rgba(0, 0, 0, 0.08)',
          border: '1px solid #e2e8f0',
          padding: '16px',
          width: `${safePosition.width}px`,
          maxHeight: 'calc(100vh - 40px)',
          overflowY: 'auto',
          boxSizing: 'border-box',
          animation: 'scaleIn 0.15s cubic-bezier(0.16, 1, 0.3, 1)',
        }}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.stopPropagation()
            onClose()
          }
        }}
      >
        <form onSubmit={handleSubmit}>
          <FieldModalHeader activeTab={activeTab} setActiveTab={setActiveTab} />

          {activeTab === 'basic' ? (
            <div style={{ marginTop: '12px' }}>
              {/* Name Input */}
              <div style={{ marginBottom: '14px' }}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value)
                    if (nameError) setNameError(false)
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault()
                      handleSubmit()
                    }
                  }}
                  placeholder={t('fieldModal.namePlaceholder')}
                  autoFocus
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    border: nameError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                    borderRadius: '6px',
                    fontSize: '13px',
                    outline: 'none',
                    boxSizing: 'border-box'
                  }}
                />
                {nameError && (
                  <div style={{ color: '#ef4444', fontSize: '11px', marginTop: '4px' }}>
                    {t('fieldModal.nameRequired')}
                  </div>
                )}
              </div>

              <FieldTypeSelector
                type={type}
                setType={setType}
                setName={setName}
                typeDropdownOpen={typeDropdownOpen}
                setTypeDropdownOpen={setTypeDropdownOpen}
              />

              {/* Type Specific Options */}
              {type === 'number' && (
                <NumberFieldOptions
                  numberDecimalPlaces={numberDecimalPlaces}
                  setNumberDecimalPlaces={setNumberDecimalPlaces}
                  numberFormat={numberFormat}
                  setNumberFormat={setNumberFormat}
                  numberPrefix={numberPrefix}
                  setNumberPrefix={setNumberPrefix}
                  numberSuffix={numberSuffix}
                  setNumberSuffix={setNumberSuffix}
                />
              )}

              {(type === 'single_select' || type === 'multiple_select') && (
                <SelectFieldOptions
                  optionsList={optionsList}
                  setOptionsList={setOptionsList}
                  newOptionText={newOptionText}
                  setNewOptionText={setNewOptionText}
                />
              )}

              {type === 'link_row' && (
                <LinkRowFieldOptions
                  targetTableId={targetTableId}
                  setTargetTableId={setTargetTableId}
                  tables={tables}
                  createRelatedField={createRelatedField}
                  setCreateRelatedField={setCreateRelatedField}
                  allowMultiple={allowMultiple}
                  setAllowMultiple={setAllowMultiple}
                />
              )}

              {(type === 'lookup' || type === 'rollup') && (
                <RollupLookupFieldOptions
                  type={type}
                  relationFieldId={relationFieldId}
                  setRelationFieldId={setRelationFieldId}
                  targetFieldId={targetFieldId}
                  setTargetFieldId={setTargetFieldId}
                  rollupFunction={rollupFunction}
                  setRollupFunction={setRollupFunction}
                  fields={fields}
                  fetchedTargetFields={fetchedTargetFields}
                />
              )}

              {type === 'formula' && (
                <FormulaFieldOptions
                  formula={formula}
                  setFormula={setFormula}
                  formulaSyntaxError={formulaSyntaxError}
                  formulaTextareaRef={formulaTextareaRef}
                  insertAtCursor={insertAtCursor}
                  formulaTab={formulaTab}
                  setFormulaTab={setFormulaTab}
                  fields={fields}
                  functionSearch={functionSearch}
                  setFunctionSearch={setFunctionSearch}
                  activeHoverFunc={activeHoverFunc}
                  setActiveHoverFunc={setActiveHoverFunc}
                  selectedHelpFunc={selectedHelpFunc}
                  setSelectedHelpFunc={setSelectedHelpFunc}
                />
              )}
            </div>
          ) : (
            <div style={{ padding: '4px 0', marginTop: '12px' }}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                  Description / Help text
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter description or guidance for this field..."
                  rows={3}
                  style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '13px', outline: 'none', boxSizing: 'border-box' }}
                />
              </div>
            </div>
          )}

          {/* Footer Actions */}
          <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '16px' }}>
            <Button type="secondary" size="small" onClick={onClose}>
              {t('fieldModal.cancel')}
            </Button>
            <Button type="primary" size="small" onClick={handleSubmit} loading={loading}>
              {loading ? '...' : editField ? t('fieldModal.save') : t('fieldModal.create')}
            </Button>
          </div>
        </form>
      </div>
    </PopoverPortal>
  )
}
