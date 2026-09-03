export interface PaletteColor {
  id: string;
  name: string;
  bg: string;
  text: string;
  border: string;
}

export const BASEROW_PALETTE: PaletteColor[] = [
  { id: 'red', name: '紅 (Red)', bg: '#fee2e2', text: '#991b1b', border: '#fca5a5' },
  { id: 'blue', name: '藍 (Blue)', bg: '#dbeafe', text: '#1e40af', border: '#93c5fd' },
  { id: 'green', name: '綠 (Green)', bg: '#dcfce7', text: '#166534', border: '#86efac' },
  { id: 'yellow', name: '黃 (Yellow)', bg: '#fef3c7', text: '#92400e', border: '#fde047' },
  { id: 'purple', name: '紫 (Purple)', bg: '#f3e8ff', text: '#6b21a8', border: '#d8b4fe' },
  { id: 'pink', name: '粉 (Pink)', bg: '#fce7f3', text: '#9d174d', border: '#f9a8d4' },
  { id: 'orange', name: '橘 (Orange)', bg: '#ffedd5', text: '#9a3412', border: '#fdba74' },
  { id: 'teal', name: '青 (Teal)', bg: '#ccfbf1', text: '#115e59', border: '#5eead4' },
  { id: 'indigo', name: '靛 (Indigo)', bg: '#e0e7ff', text: '#3730a3', border: '#a5b4fc' },
  { id: 'cyan', name: '水藍 (Cyan)', bg: '#cffafe', text: '#155e75', border: '#67e8f9' },
  { id: 'emerald', name: '翡翠 (Emerald)', bg: '#ecfdf5', text: '#047857', border: '#6ee7b7' },
  { id: 'gray', name: '灰 (Gray)', bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' },
];

export const getOptionColor = (str: string, allOptions?: any[]) => {
  if (!str) return { bg: '#f1f5f9', text: '#475569', backgroundColor: '#f1f5f9', color: '#475569' };
  
  if (allOptions && Array.isArray(allOptions)) {
    const opt = allOptions.find(o => {
      if (typeof o === 'string') return o.toLowerCase() === str.toLowerCase();
      return o && (o.id === str || o.name === str || (o.name && o.name.toLowerCase() === str.toLowerCase()));
    });
    
    if (opt && typeof opt === 'object' && opt.color) {
      const p = BASEROW_PALETTE.find(
        p =>
          p.id.toLowerCase() === String(opt.color).toLowerCase() ||
          p.bg.toLowerCase() === String(opt.color).toLowerCase() ||
          p.text.toLowerCase() === String(opt.color).toLowerCase() ||
          p.name.toLowerCase() === String(opt.color).toLowerCase()
      );
      if (p) return { backgroundColor: p.bg, color: p.text, bg: p.bg, text: p.text };
      return { backgroundColor: opt.color, color: '#1e293b', bg: opt.color, text: '#1e293b' };
    }
  }

  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
  }
  const idx = Math.abs(hash);

  const palette = BASEROW_PALETTE[idx % BASEROW_PALETTE.length];
  return {
    backgroundColor: palette.bg,
    color: palette.text,
    bg: palette.bg,
    text: palette.text
  };
};

const isChoiceIdPattern = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
  /^[0-9a-f]{24,}$/i.test(s.trim()) ||
  /^opt_[a-z0-9_]+$/i.test(s.trim());

let lastSelfHealTime = 0;
export const triggerBackgroundFieldSync = () => {
  if (typeof window === 'undefined') return;
  const now = Date.now();
  if (now - lastSelfHealTime < 3000) return;
  lastSelfHealTime = now;
  const win = window as any;
  const activeTableId = win.__activeTableId;
  if (typeof win.fetchTableData === 'function' && activeTableId) {
    win.fetchTableData(activeTableId).catch(() => {});
  }
};

export const resolveChoiceString = (str: string, fieldOptions?: any): string => {
  if (!str) return '';
  const strTrimmed = String(str).trim();
  const strLower = strTrimmed.toLowerCase();

  let opts: any = fieldOptions;
  if (typeof opts === 'string') {
    try {
      let parsed = JSON.parse(opts);
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      opts = parsed;
    } catch {}
  }
  let rawItems: any[] = [];
  if (Array.isArray(opts)) {
    rawItems = opts;
  } else if (opts && typeof opts === 'object') {
    if (Array.isArray(opts.choices)) rawItems = opts.choices;
    else if (Array.isArray(opts.select_options)) rawItems = opts.select_options;
    else if (Array.isArray(opts.options)) rawItems = opts.options;
    else if (Array.isArray(opts.selectOptions)) rawItems = opts.selectOptions;
  }

  const matched = rawItems.find((item: any) => {
    if (typeof item === 'string') {
      const itTrimmed = item.trim();
      return itTrimmed === strTrimmed || itTrimmed.toLowerCase() === strLower;
    }
    if (item && typeof item === 'object') {
      const itemId = item.id != null ? String(item.id).trim() : '';
      const itemVal = item.value != null ? String(item.value).trim() : '';
      const itemName = item.name != null ? String(item.name).trim() : '';
      const itemLabel = item.label != null ? String(item.label).trim() : '';
      const itemText = item.text != null ? String(item.text).trim() : '';

      return (
        (itemId && (itemId === strTrimmed || itemId.toLowerCase() === strLower)) ||
        (itemVal && (itemVal === strTrimmed || itemVal.toLowerCase() === strLower)) ||
        (itemName && (itemName === strTrimmed || itemName.toLowerCase() === strLower)) ||
        (itemLabel && (itemLabel === strTrimmed || itemLabel.toLowerCase() === strLower)) ||
        (itemText && (itemText === strTrimmed || itemText.toLowerCase() === strLower))
      );
    }
    return false;
  });

  let effectiveMatched = matched;
  if (!effectiveMatched && typeof window !== 'undefined' && Array.isArray((window as any).fields)) {
    for (const f of (window as any).fields) {
      if (!f?.options) continue;
      let fOpts = f.options;
      if (typeof fOpts === 'string') {
        try {
          fOpts = JSON.parse(fOpts);
          if (typeof fOpts === 'string') fOpts = JSON.parse(fOpts);
        } catch {}
      }
      const choices = Array.isArray(fOpts) ? fOpts : (fOpts?.choices || fOpts?.select_options || fOpts?.options || []);
      const found = choices.find((c: any) => {
        if (!c) return false;
        if (typeof c === 'string') return c.trim() === strTrimmed || c.trim().toLowerCase() === strLower;
        const cId = c.id != null ? String(c.id).trim() : '';
        const cVal = c.value != null ? String(c.value).trim() : '';
        const cName = c.name != null ? String(c.name).trim() : '';
        return (cId && (cId === strTrimmed || cId.toLowerCase() === strLower)) ||
               (cVal && (cVal === strTrimmed || cVal.toLowerCase() === strLower)) ||
               (cName && (cName === strTrimmed || cName.toLowerCase() === strLower));
      });
      if (found) {
        effectiveMatched = found;
        break;
      }
    }
  }

  if (effectiveMatched) {
    if (typeof effectiveMatched === 'string') {
      return isChoiceIdPattern(effectiveMatched) ? '' : effectiveMatched;
    }
    const label = effectiveMatched.name ?? effectiveMatched.label ?? effectiveMatched.text ?? effectiveMatched.value;
    if (label !== undefined && label !== null && String(label).trim() !== '') {
      const labelStr = String(label).trim();
      return isChoiceIdPattern(labelStr) ? '' : labelStr;
    }
    if (effectiveMatched.id !== undefined && effectiveMatched.id !== null) {
      const idStr = String(effectiveMatched.id).trim();
      return isChoiceIdPattern(idStr) ? '' : idStr;
    }
  }

  // If not matched and string is a raw ID (UUID or opt_*), never display as chip
  if (isChoiceIdPattern(strTrimmed)) {
    triggerBackgroundFieldSync();
    return '';
  }

  return strTrimmed;
};

export const parseSelectItems = (val: any, fieldOptions?: any): string[] => {
  if (val === null || val === undefined || val === '') return [];
  if (Array.isArray(val)) {
    return val.flatMap(item => parseSelectItems(item, fieldOptions)).filter(Boolean);
  }
  if (typeof val === 'object') {
    if (Array.isArray(val.choices)) return val.choices.flatMap(cleanChoice);
    // Prioritize human-readable label properties over raw id
    const label = val.name ?? val.label ?? val.text ?? val.value ?? val.id;
    if (label !== undefined && label !== null) return [resolveChoiceString(String(label), fieldOptions)];
    return [resolveChoiceString(String(val), fieldOptions)];
  }
  if (typeof val === 'string') {
    const trimmed = val.trim();
    if (!trimmed) return [];
    try {
      let parsed = JSON.parse(trimmed);
      if (typeof parsed === 'string') {
        try { parsed = JSON.parse(parsed); } catch {}
      }
      return parseSelectItems(parsed, fieldOptions);
    } catch {
      return trimmed.split(',').map(s => resolveChoiceString(s.trim(), fieldOptions)).filter(Boolean);
    }
  }
  return [resolveChoiceString(String(val), fieldOptions)];
};

export function parseNumberInput(val: any): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') {
    return isNaN(val) || !isFinite(val) ? null : val;
  }
  const str = String(val).trim();
  if (str === '') return null;

  const isNegative = /^\s*[-–—]|\([^\)]+\)/.test(str) || (str.includes('-') && !str.toLowerCase().includes('e-'));
  
  // Strip currency symbols, commas, percent, units and parentheses
  let cleaned = str
    .replace(/[,\s$¥€£元%]/g, '')
    .replace(/^NT\$/i, '')
    .replace(/^NT/i, '')
    .replace(/[()]/g, '');

  if (cleaned === '' || cleaned === '-' || cleaned === '+') return null;

  const parsed = Number(cleaned);
  if (isNaN(parsed)) return null;

  return isNegative && parsed > 0 ? -parsed : parsed;
}

export function evaluateCellCondition(
  val: any,
  field: { type?: string; options?: any } | undefined,
  operator: string,
  targetValue: string
): boolean {
  const target = (targetValue || '').toLowerCase().trim();

  // 1. Select field types
  if (field?.type === 'single_select' || field?.type === 'multiple_select') {
    const selectNames = parseSelectItems(val, field.options).map(s => s.toLowerCase());
    switch (operator) {
      case 'equals':
        return selectNames.includes(target);
      case 'contains':
        return selectNames.some(n => n.includes(target));
      case 'not_equals':
        return !selectNames.includes(target);
      case 'not_contains':
        return !selectNames.some(n => n.includes(target));
      case 'empty':
        return selectNames.length === 0;
      case 'not_empty':
        return selectNames.length > 0;
      default:
        return false;
    }
  }

  // 1b. Latest comment field type
  if (field?.type === 'latest_comment') {
    let commentList: Array<{ content?: string; user?: string; time?: string }> = [];
    if (Array.isArray(val)) {
      commentList = val;
    } else if (typeof val === 'string' && val.trim()) {
      try {
        const parsed = JSON.parse(val);
        if (Array.isArray(parsed)) commentList = parsed;
      } catch {}
    }

    const matchAny = commentList.some(item => {
      const c = String(item?.content || '').toLowerCase();
      const u = String(item?.user || '').toLowerCase();
      return c.includes(target) || u.includes(target);
    });

    switch (operator) {
      case 'contains':
        return matchAny;
      case 'not_contains':
        return !matchAny;
      case 'empty':
        return commentList.length === 0;
      case 'not_empty':
        return commentList.length > 0;
      case 'equals':
        return commentList.some(item => String(item?.content || '').toLowerCase().trim() === target);
      case 'not_equals':
        return !commentList.some(item => String(item?.content || '').toLowerCase().trim() === target);
      default:
        return matchAny;
    }
  }

  // 2. Numeric comparison for numeric field types or numeric operators
  const isNumericField = field && ['number', 'rating', 'autonumber', 'percent', 'currency'].includes(field.type || '');
  const isNumericOp = ['higher_than', 'higher_than_or_equal', 'lower_than', 'lower_than_or_equal', 'greater_than', 'greater_or_equal', 'less_than', 'less_or_equal', '>', '<', '>=', '<='].includes(operator);

  if (isNumericField || isNumericOp) {
    const cellNum = parseNumberInput(val);
    const targetNum = parseNumberInput(targetValue);
    const isCellEmpty = val === null || val === undefined || String(val).trim() === '';

    switch (operator) {
      case 'empty':
        return isCellEmpty;
      case 'not_empty':
        return !isCellEmpty;
      case 'equals':
        if (cellNum !== null && targetNum !== null) return cellNum === targetNum;
        return String(val ?? '').trim().toLowerCase() === target;
      case 'not_equals':
        if (cellNum !== null && targetNum !== null) return cellNum !== targetNum;
        return String(val ?? '').trim().toLowerCase() !== target;
      case 'higher_than':
      case 'greater_than':
      case '>':
        if (cellNum === null || targetNum === null) return false;
        return cellNum > targetNum;
      case 'higher_than_or_equal':
      case 'greater_or_equal':
      case '>=':
        if (cellNum === null || targetNum === null) return false;
        return cellNum >= targetNum;
      case 'lower_than':
      case 'less_than':
      case '<':
        if (cellNum === null || targetNum === null) return false;
        return cellNum < targetNum;
      case 'lower_than_or_equal':
      case 'less_or_equal':
      case '<=':
        if (cellNum === null || targetNum === null) return false;
        return cellNum <= targetNum;
      case 'contains':
        return String(val ?? '').toLowerCase().includes(target);
      case 'not_contains':
        return !String(val ?? '').toLowerCase().includes(target);
      default:
        return false;
    }
  }

  const strVal = String(val ?? '').toLowerCase();
  switch (operator) {
    case 'equals':
      return strVal === target;
    case 'contains':
      return strVal.includes(target);
    case 'not_equals':
      return strVal !== target;
    case 'not_contains':
      return !strVal.includes(target);
    case 'empty':
      return val === null || val === undefined || strVal === '' || strVal === 'null' || strVal === 'undefined';
    case 'not_empty':
      return val !== null && val !== undefined && strVal !== '' && strVal !== 'null' && strVal !== 'undefined';
    case 'higher_than':
    case 'greater_than':
    case '>': {
      const n1 = parseNumberInput(val);
      const n2 = parseNumberInput(targetValue);
      return n1 !== null && n2 !== null && n1 > n2;
    }
    case 'higher_than_or_equal':
    case 'greater_or_equal':
    case '>=': {
      const n1 = parseNumberInput(val);
      const n2 = parseNumberInput(targetValue);
      return n1 !== null && n2 !== null && n1 >= n2;
    }
    case 'lower_than':
    case 'less_than':
    case '<': {
      const n1 = parseNumberInput(val);
      const n2 = parseNumberInput(targetValue);
      return n1 !== null && n2 !== null && n1 < n2;
    }
    case 'lower_than_or_equal':
    case 'less_or_equal':
    case '<=': {
      const n1 = parseNumberInput(val);
      const n2 = parseNumberInput(targetValue);
      return n1 !== null && n2 !== null && n1 <= n2;
    }
    default:
      return false;
  }
}

export function formatNumberValue(val: any, options?: any): string {
  if (val === null || val === undefined || val === '') return '';
  const num = Number(val);
  if (isNaN(num)) return String(val);

  let opts: any = {};
  if (options) {
    try {
      opts = typeof options === 'string' ? JSON.parse(options) : options;
    } catch {}
  }

  const decimals = typeof opts.number_decimal_places === 'number' ? opts.number_decimal_places : null;
  const prefix = opts.number_prefix || '';
  const suffix = opts.number_suffix || '';
  const format = opts.number_format || 'thousands';

  const isNegative = num < 0;
  const absNum = Math.abs(num);

  let formatted = '';
  if (decimals !== null) {
    formatted = format === 'standard'
      ? absNum.toFixed(decimals)
      : absNum.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } else {
    formatted = format === 'standard' ? String(absNum) : absNum.toLocaleString();
  }

  const sign = isNegative ? '-' : '';
  return `${sign}${prefix}${formatted}${suffix}`;
}

export const cleanChoice = (item: any): string[] => {
  if (item === null || item === undefined || item === '') return [];
  if (typeof item === 'object') {
    if (Array.isArray(item.choices)) return item.choices.flatMap(cleanChoice);
    const label = item.name ?? item.label ?? item.text ?? item.value ?? item.id;
    if (label !== undefined && label !== null) return [String(label)];
    return [String(item)];
  }
  if (typeof item === 'string') {
    const trimmed = item.trim();
    if (!trimmed) return [];
    if (trimmed.startsWith('{') || trimmed.startsWith('[') || trimmed.startsWith('"{\\') || trimmed.startsWith('"{')) {
      try {
        let parsed = JSON.parse(trimmed);
        if (typeof parsed === 'string') {
          try { parsed = JSON.parse(parsed); } catch {}
        }
        return cleanChoice(parsed);
      } catch {}
    }
    return [trimmed];
  }
  return [String(item)];
};

export const doesCellMatchFilter = evaluateCellCondition;
