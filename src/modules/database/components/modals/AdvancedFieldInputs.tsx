'use client'

import React from 'react'
import type { TableField } from '@/modules/database/types'
import { SelectFieldInput } from './inputs/SelectFieldInput'
import { AttachmentInput } from './inputs/AttachmentInput'
import { LinkRowInput } from './inputs/LinkRowInput'
import { LatestCommentInput } from './inputs/LatestCommentInput'

export interface AttachmentFile {
  url: string
  name: string
  size?: number
}

interface AdvancedFieldInputsProps {
  field: TableField
  value: any
  onChange: (value: any) => void
  onUpdateField?: (fieldId: number, updates: Partial<TableField>) => Promise<void>
  readOnly?: boolean
}

export function AdvancedFieldInputs({
  field,
  value,
  onChange,
  onUpdateField,
  readOnly = false,
}: AdvancedFieldInputsProps) {
  if (field.type === 'single_select' || field.type === 'multiple_select') {
    return (
      <SelectFieldInput
        field={field}
        value={value}
        onChange={onChange}
        onUpdateField={onUpdateField}
        readOnly={readOnly}
      />
    )
  }

  if (field.type === 'file' || field.type === 'attachment') {
    return (
      <AttachmentInput
        field={field}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    )
  }

  if (field.type === 'link_row') {
    return (
      <LinkRowInput
        field={field}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    )
  }

  if (field.type === 'latest_comment') {
    return (
      <LatestCommentInput
        field={field}
        value={value}
        onChange={onChange}
        readOnly={readOnly}
      />
    )
  }

  return null
}

export default AdvancedFieldInputs
