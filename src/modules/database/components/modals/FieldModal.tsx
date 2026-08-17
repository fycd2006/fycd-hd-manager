'use client'

import React, { useState, useEffect, useRef } from 'react'
import Modal from '@/components/ui/Modal'
import Button from '@/components/ui/Button'
import { useI18n } from '@/lib/i18n/i18nContext'
import { 
  Type, AlignLeft, Plug, Hash, Star, CheckCircle2, Calendar, Edit3, User,
  Plus, UserCheck, Clock, Link2, Mail, CheckCircle, List, Phone,
  Calculator, Grid, Box, Glasses, Users, Tag, Binary, Lock, FileEdit,
  Sparkles, Search, ChevronDown, X, AlertCircle, MessageSquare
} from 'lucide-react'
import { TableField } from '@/modules/database/types'
import { parseFormula, getSupportedFunctions } from '@/lib/formula'
import { safeJsonParse } from '@/lib/json-utils'
import { FieldTypeSelector } from './FieldTypeSelector'
import { FieldModalHeader } from './FieldModalHeader'
import { NumberFieldOptions } from './field-options/NumberFieldOptions'
import { SelectFieldOptions } from './field-options/SelectFieldOptions'
import { LinkRowFieldOptions } from './field-options/LinkRowFieldOptions'
import { RollupLookupFieldOptions } from './field-options/RollupLookupFieldOptions'
import { FormulaFieldOptions } from './field-options/FormulaFieldOptions'

export interface FieldModalProps {
  show: boolean
  onClose: () => void
  onSubmit: (name: string, type: string, options?: any) => Promise<void>
  tables?: Array<{ id: number; name: string; fields?: any[] }>
  fields?: any[]
  editField?: TableField | null
}

const getOptionColor = (str: string) => {
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  const hue = Math.abs(hash % 360)
  return { bg: `hsl(${hue}, 80%, 93%)`, text: `hsl(${hue}, 80%, 30%)` }
}

export function FieldModal({ show, onClose, onSubmit, tables = [], fields = [], editField }: FieldModalProps) {
  const { t, locale } = useI18n()
  const [activeTab, setActiveTab] = useState<'basic' | 'advanced'>('basic')
  const [name, setName] = useState('Single line text')
  const [nameError, setNameError] = useState(false)
  const [type, setType] = useState('text')
  const [typeDropdownOpen, setTypeDropdownOpen] = useState(true)
  // Options state
  const [optionsList, setOptionsList] = useState<string[]>([])
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
        .catch(() => setFetchedTargetFields([]))
    }
  }, [targetTableIdFromRel, targetTableObj])

  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const formulaTextareaRef = useRef<HTMLTextAreaElement>(null)

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

    // Add spacing if needed
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

  const [createRelatedField, setCreateRelatedField] = useState<boolean>(true)
  const [allowMultiple, setAllowMultiple] = useState<boolean>(true)


  useEffect(() => {
    if (show) {
      if (editField) {

        setName(editField.name || '')
        setType(editField.type || 'text')
        setTypeDropdownOpen(false)
        let choices: string[] = []
        let formulaStr = ''
        if (editField.options) {
          try {
            let parsed = typeof editField.options === 'string' ? JSON.parse(editField.options) : editField.options
            if (typeof parsed === 'string') {
              try { parsed = JSON.parse(parsed) } catch {}
            }
            if (Array.isArray(parsed)) choices = parsed.map((o: any) => typeof o === 'object' && o !== null ? (o.name ?? o.label ?? o.text ?? o.value ?? o.id ?? String(o)) : String(o))
            else if (parsed && Array.isArray(parsed.choices)) choices = parsed.choices.map((o: any) => typeof o === 'object' && o !== null ? (o.name ?? o.label ?? o.text ?? o.value ?? o.id ?? String(o)) : String(o))
            else if (parsed && Array.isArray(parsed.select_options)) choices = parsed.select_options.map((o: any) => typeof o === 'object' && o !== null ? (o.name ?? o.label ?? o.text ?? o.value ?? o.id ?? String(o)) : String(o))

            const isUuidPattern = (s: string) =>
              /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
              /^[0-9a-f]{24,}$/i.test(s.trim())

            choices = choices.filter((c) => c && typeof c === 'string' && !isUuidPattern(c))

            if (parsed && typeof parsed === 'object') {
              if (parsed.targetTableId) setTargetTableId(Number(parsed.targetTableId))
              if (parsed.relationFieldId) setRelationFieldId(Number(parsed.relationFieldId))
              if (parsed.targetFieldId) setTargetFieldId(Number(parsed.targetFieldId))
              if (parsed.rollupFunction) setRollupFunction(parsed.rollupFunction)
              if (typeof parsed.createRelatedField === 'boolean') setCreateRelatedField(parsed.createRelatedField)
              if (typeof parsed.allowMultiple === 'boolean') setAllowMultiple(parsed.allowMultiple)
              if (parsed.formula) {
                formulaStr = String(parsed.formula)
              }
              if (typeof parsed.number_decimal_places === 'number') {
                setNumberDecimalPlaces(parsed.number_decimal_places)
              }
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
        setType('text')
        setTypeDropdownOpen(true)
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
  }, [editField, show])


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
        parsedOptions = { choices: optionsList.filter((c) => c && typeof c === 'string' && !isUuidPattern(c)) }
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
    } finally {
      setLoading(false)
    }
  }


  return (
    <Modal show={show} onClose={onClose} title="" size={type === 'formula' ? 'medium' : 'small'} overflowVisible={true}>
      <form onSubmit={handleSubmit}>
        <FieldModalHeader activeTab={activeTab} setActiveTab={setActiveTab} />

        {activeTab === 'basic' ? (
          <div>
            {/* Name Input */}
            <div style={{ marginBottom: '16px' }}>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value)
                  if (nameError) setNameError(false)
                }}
                placeholder={t('fieldModal.namePlaceholder')}
                autoFocus
                style={{
                  width: '100%',
                  padding: '10px 14px',
                  border: nameError ? '1px solid #ef4444' : '1px solid #cbd5e1',
                  borderRadius: '6px',
                  fontSize: '14px',
                  outline: 'none'
                }}
              />
              {nameError && (
                <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '4px' }}>
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
          <div style={{ padding: '4px 0' }}>
            <div style={{ marginBottom: '16px' }}>
              <label style={{ fontSize: '12px', fontWeight: 600, color: '#475569', marginBottom: '6px', display: 'block' }}>
                Description / Help text
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Enter description or guidance for this field..."
                rows={3}
                style={{ width: '100%', padding: '8px 12px', border: '1px solid #cbd5e1', borderRadius: '6px', fontSize: '14px', outline: 'none' }}
              />
            </div>
          </div>
        )}

        {/* Footer Actions */}
        <div className="actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px' }}>
          <Button type="secondary" size="large" onClick={onClose}>
            {t('fieldModal.cancel')}
          </Button>
          <Button type="primary" size="large" onClick={handleSubmit} loading={loading}>
            {loading ? '...' : editField ? t('fieldModal.save') : t('fieldModal.create')}
          </Button>
        </div>
      </form>
    </Modal>
  )
}
