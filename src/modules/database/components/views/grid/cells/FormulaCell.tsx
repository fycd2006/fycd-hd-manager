import React from 'react';
import { AlertTriangle } from 'lucide-react';

export function renderFormulaCell(value: any) {
  if (value === null || value === undefined || value === '') {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', width: '100%', height: '100%', background: 'rgba(248, 250, 252, 0.4)' }}>
        <span style={{ fontSize: '11px', color: '#94a3b8', fontWeight: 600, fontFamily: 'monospace', opacity: 0.6 }}>ƒ</span>
      </div>
    );
  }

  const valStr = String(value);

  // 1. Formula Errors (#DIV/0!, #ERROR!, #NAME?, #CIRCULAR!, #VALUE!, #N/A)
  if (valStr.startsWith('#')) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', width: '100%', height: '100%', background: 'rgba(254, 226, 226, 0.4)' }}>
        <span style={{
          fontSize: '11px',
          color: '#b91c1c',
          background: '#fee2e2',
          padding: '2px 6px',
          borderRadius: '4px',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '4px'
        }}>
          <AlertTriangle size={12} color="#dc2626" /> {valStr}
        </span>
      </div>
    );
  }

  // 2. Boolean values
  if (value === true || value === false || valStr === 'true' || valStr === 'false') {
    const isTrue = value === true || valStr === 'true';
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', padding: '0 8px', width: '100%', height: '100%', background: 'rgba(248, 250, 252, 0.4)' }}>
        <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, opacity: 0.7 }}>ƒ</span>
        <span style={{
          fontSize: '11px',
          fontWeight: 600,
          color: isTrue ? '#15803d' : '#475569',
          background: isTrue ? '#dcfce7' : '#f1f5f9',
          border: isTrue ? '1px solid #86efac' : '1px solid #cbd5e1',
          padding: '1px 8px',
          borderRadius: '12px'
        }}>
          {isTrue ? '✓ True' : '✗ False'}
        </span>
      </div>
    );
  }

  // 3. Numeric values
  const num = Number(value);
  const isNumeric = !isNaN(num) && typeof value !== 'boolean' && valStr.trim() !== '';

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: isNumeric ? 'flex-end' : 'flex-start', gap: '6px', padding: '0 8px', overflow: 'hidden', width: '100%', height: '100%', background: 'rgba(248, 250, 252, 0.4)' }}>
      <span style={{ fontSize: '11px', color: '#64748b', fontWeight: 600, flexShrink: 0, opacity: 0.7 }}>ƒ</span>
      <span style={{
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        textOverflow: 'ellipsis',
        fontSize: '13px',
        color: '#1e293b',
        fontWeight: isNumeric ? 600 : 400,
        fontFamily: isNumeric ? 'monospace' : 'inherit'
      }}>
        {isNumeric ? num.toLocaleString() : valStr}
      </span>
    </div>
  );
}
