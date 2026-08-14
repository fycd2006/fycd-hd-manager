import React from 'react'
import { LinkedRowCard, type LinkedRowCardItem } from '@/modules/database/components/cards/LinkedRowCard'

export interface LinkedRowCardChipProps {
  item: LinkedRowCardItem
  onOpenDetail?: (id: number, e: React.MouseEvent) => void
  onDetach?: (id: number, e: React.MouseEvent) => void
  showDetachButton?: boolean
  disabled?: boolean
}

export const LinkedRowCardChip: React.FC<LinkedRowCardChipProps> = ({
  item,
  onOpenDetail,
  onDetach,
  showDetachButton = false,
  disabled = false,
}) => {
  return (
    <LinkedRowCard
      item={item}
      onOpenDetail={(id, _tableId, e) => {
        if (onOpenDetail && e) {
          onOpenDetail(id, e)
        }
      }}
      onDetach={onDetach ? (id, e) => {
        if (e) onDetach(id, e)
      } : undefined}
      showDetachButton={showDetachButton}
      disabled={disabled}
    />
  )
}

export default LinkedRowCardChip
