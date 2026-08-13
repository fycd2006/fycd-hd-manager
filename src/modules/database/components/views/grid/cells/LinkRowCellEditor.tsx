import React, { useState, useEffect } from 'react';
import { Search } from 'lucide-react';
import ModalOverlay from '@/components/ui/ModalOverlay';
import { TableField } from '@/modules/database/types';

interface LinkRowCellEditorProps {
  value: any;
  targetTableId: number | null;
  allowMultiple: boolean;
  onUpdate: (val: any) => void;
  onCancelEdit: () => void;
}

export const LinkRowCellEditor: React.FC<LinkRowCellEditorProps> = ({
  value,
  targetTableId,
  allowMultiple,
  onUpdate,
  onCancelEdit
}) => {
  const [relationSearch, setRelationSearch] = useState('');
  const [relationRows, setRelationRows] = useState<any[]>([]);
  const [targetFields, setTargetFields] = useState<TableField[]>([]);
  const [relationLoading, setRelationLoading] = useState(false);
  const [tempSelectedItems, setTempSelectedItems] = useState<Array<{ id: number; value: string }>>([]);

  useEffect(() => {
    if (targetTableId) {
      setRelationLoading(true);
      fetch(`/api/tables/${targetTableId}/fields`)
        .then(res => res.json())
        .then(data => {
          if (Array.isArray(data)) {
            data.sort((a, b) => (a.order || 0) - (b.order || 0));
            setTargetFields(data);
          }
        })
        .catch(console.error);

      fetch(`/api/tables/${targetTableId}/rows?page=1&pageSize=30`)
        .then(res => res.json())
        .then(data => {
          const rowsArray = Array.isArray(data) ? data : (data.rows || []);
          setRelationRows(rowsArray);
        })
        .catch(console.error)
        .finally(() => setRelationLoading(false));
    }
  }, [targetTableId]);

  useEffect(() => {
    let rawList: any[] = [];
    if (Array.isArray(value)) {
      rawList = value;
    } else if (typeof value === 'string' && value.trim()) {
      try {
        const parsed = JSON.parse(value);
        if (Array.isArray(parsed)) rawList = parsed;
      } catch {}
    }

    const initialItems = rawList.flatMap(item => {
      if (typeof item === 'object' && item !== null && 'id' in item) {
        const numId = Number((item as any).id);
        if (isNaN(numId)) return [];
        return [{ id: numId, value: String((item as any).value || `列 ID: ${numId}`) }];
      }
      const numId = Number(item);
      if (!isNaN(numId)) {
        return [{ id: numId, value: `列 ID: ${numId}` }];
      }
      return [];
    });

    setTempSelectedItems(initialItems);
  }, [value]);

  useEffect(() => {
    if (targetTableId) {
      const timer = setTimeout(() => {
        setRelationLoading(true);
        const url = relationSearch.trim()
          ? `/api/tables/${targetTableId}/rows?search=${encodeURIComponent(relationSearch.trim())}&page=1&pageSize=30`
          : `/api/tables/${targetTableId}/rows?page=1&pageSize=30`;
        fetch(url)
          .then(res => res.json())
          .then(data => setRelationRows(Array.isArray(data) ? data : (data.rows || [])))
          .catch(console.error)
          .finally(() => setRelationLoading(false));
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [relationSearch, targetTableId]);

  const currentIds = tempSelectedItems.map(i => i.id);

  const toggleRowSelection = (targetRow: any) => {
    const targetId = targetRow.id;
    const isLinked = currentIds.includes(targetId);
    if (isLinked) {
      setTempSelectedItems(prev => prev.filter(i => i.id !== targetId));
    } else {
      const primaryField = targetFields[0];
      const primaryKey = primaryField ? `field_${primaryField.id}` : Object.keys(targetRow.data || {})[0];
      const primaryVal = String(targetRow.data?.[primaryKey] ?? `列 ID: ${targetId}`);
      if (allowMultiple) {
        setTempSelectedItems(prev => [...prev, { id: targetId, value: primaryVal }]);
      } else {
        setTempSelectedItems([{ id: targetId, value: primaryVal }]);
      }
    }
  };

  const handleCreateNewRow = async () => {
    if (!targetTableId) return;
    try {
      setRelationLoading(true);
      const primaryField = targetFields[0];
      const initialData: Record<string, any> = {};
      if (primaryField && relationSearch.trim()) {
        initialData[`field_${primaryField.id}`] = relationSearch.trim();
      }
      const res = await fetch(`/api/tables/${targetTableId}/rows`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: initialData }),
      });
      if (!res.ok) throw new Error('新增列失敗');
      const newRow = await res.json();

      setRelationRows(prev => [newRow, ...prev]);
      const primaryKey = primaryField ? `field_${primaryField.id}` : Object.keys(newRow.data || {})[0];
      const primaryVal = String(newRow.data?.[primaryKey] || relationSearch.trim() || `列 ID: ${newRow.id}`);

      if (allowMultiple) {
        setTempSelectedItems(prev => [...prev, { id: newRow.id, value: primaryVal }]);
      } else {
        setTempSelectedItems([{ id: newRow.id, value: primaryVal }]);
      }
    } catch (err) {
      console.error('[Create New Row Error]:', err);
    } finally {
      setRelationLoading(false);
    }
  };

  const handleConfirmRelation = () => {
    // Before updating, format temp items to contain id and resolved value
    const finalItems = tempSelectedItems.map(item => {
      let label = item.value;
      if (!label || label.startsWith('列 ID:')) {
        const rRow = relationRows.find(r => r.id === item.id);
        const primaryField = targetFields[0];
        const primaryKey = primaryField ? `field_${primaryField.id}` : null;
        if (rRow && primaryKey && rRow.data?.[primaryKey]) {
          label = String(rRow.data[primaryKey]);
        }
      }
      return { id: item.id, value: label || `列 ID: ${item.id}` };
    });
    
    onUpdate(finalItems);
    onCancelEdit();
  };

  return (
    <ModalOverlay
      show={true}
      onClose={handleConfirmRelation}
      zIndex={99999}
      blur={false}
      lockScroll={false}
      style={{ backgroundColor: 'rgba(0, 0, 0, 0.45)' }}
    >
      <div
        style={{
          width: '780px',
          maxWidth: '92vw',
          height: '560px',
          maxHeight: '85vh',
          backgroundColor: '#ffffff',
          borderRadius: '8px',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15), 0 10px 10px -5px rgba(0,0,0,0.08)',
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1, maxWidth: '420px' }}>
            <Search size={15} color="#64748b" style={{ flexShrink: 0 }} />
            <input
              type="text"
              placeholder="Search rows (支援全欄位比對)..."
              value={relationSearch}
              onChange={e => setRelationSearch(e.target.value)}
              style={{ flex: 1, padding: '6px 12px', fontSize: '13px', border: '1px solid #cbd5e1', borderRadius: '6px', outline: 'none' }}
            />
            <button
              type="button"
              onClick={handleCreateNewRow}
              style={{
                padding: '6px 12px',
                background: '#18181B',
                color: '#ffffff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '12px',
                fontWeight: 600,
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              ＋ 新增列
            </button>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            <span style={{ fontSize: '12px', color: '#64748b' }}>
              已選擇 {currentIds.length} 項{!allowMultiple && ' (單選)'}
            </span>
            <button
              onClick={() => handleConfirmRelation()}
              style={{ padding: '6px 12px', background: '#e2e8f0', border: 'none', borderRadius: '6px', fontSize: '12px', fontWeight: 600, color: '#475569', cursor: 'pointer' }}
            >
              ✕ 完成關閉
            </button>
          </div>
        </div>

        <div style={{ flex: 1, overflow: 'auto', background: '#ffffff' }}>
          {relationLoading ? (
            <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8', fontSize: '13px' }}>
              載入關聯表格資料中...
            </div>
          ) : (
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '13px', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: '#f1f5f9', borderBottom: '2px solid #cbd5e1' }}>
                  <th style={{ width: '44px', padding: '10px 12px', textAlign: 'center' }}>選取</th>
                  {targetFields.map(f => (
                    <th key={f.id} style={{ padding: '10px 12px', fontWeight: 600, color: '#334155', borderRight: '1px solid #e2e8f0' }}>
                      {f.name}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {relationRows.length === 0 ? (
                  <tr>
                    <td colSpan={targetFields.length + 1} style={{ textAlign: 'center', padding: '30px', color: '#94a3b8', fontStyle: 'italic' }}>
                      找不到符合條件的關聯列
                    </td>
                  </tr>
                ) : (
                  relationRows.map(r => {
                    const isLinked = currentIds.includes(r.id);
                    return (
                      <tr
                        key={r.id}
                        onClick={() => toggleRowSelection(r)}
                        style={{
                          borderBottom: '1px solid #e2e8f0',
                          background: isLinked ? '#f0fdf4' : 'transparent',
                          cursor: 'pointer',
                          transition: 'background 0.1s ease',
                        }}
                      >
                        <td style={{ padding: '10px 12px', textAlign: 'center' }}>
                          <input
                            type="checkbox"
                            checked={isLinked}
                            onChange={() => {}}
                            style={{ width: '16px', height: '16px', cursor: 'pointer' }}
                          />
                        </td>
                        {targetFields.map(f => {
                          const fKey = `field_${f.id}`;
                          const cellVal = r.data?.[fKey];
                          let displayCell = '';
                          if (cellVal != null && cellVal !== '') {
                            if (typeof cellVal === 'boolean') {
                              displayCell = cellVal ? '✓' : '';
                            } else if (Array.isArray(cellVal)) {
                              displayCell = cellVal
                                .map(item => (typeof item === 'object' && item !== null ? item.value || item.name || item.id : String(item)))
                                .filter(Boolean)
                                .join(', ');
                            } else if (typeof cellVal === 'object') {
                              displayCell = String(cellVal.value || cellVal.name || cellVal.id || '');
                            } else {
                              displayCell = String(cellVal);
                            }
                          }
                          return (
                            <td key={f.id} style={{ padding: '10px 12px', color: '#1e293b', borderRight: '1px solid #f1f5f9', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: '200px' }}>
                              {displayCell}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', padding: '10px 16px', borderTop: '1px solid #e2e8f0', background: '#f8fafc' }}>
          <button
            onClick={() => handleConfirmRelation()}
            style={{ padding: '6px 16px', background: '#18181B', border: 'none', borderRadius: '6px', color: 'white', fontSize: '12px', fontWeight: 600, cursor: 'pointer' }}
          >
            確認
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
};
