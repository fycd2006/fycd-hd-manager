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

const isUuidPattern = (s: string) =>
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s.trim()) ||
  /^[0-9a-f]{24,}$/i.test(s.trim())

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

  if (matched) {
    if (typeof matched === 'string') {
      return isUuidPattern(matched) ? '' : matched;
    }
    const label = matched.name ?? matched.label ?? matched.text ?? matched.value;
    if (label !== undefined && label !== null && String(label).trim() !== '') {
      const labelStr = String(label).trim();
      return isUuidPattern(labelStr) ? '' : labelStr;
    }
    if (matched.id !== undefined && matched.id !== null) {
      const idStr = String(matched.id).trim();
      return isUuidPattern(idStr) ? '' : idStr;
    }
  }

  // If not matched and string is a raw UUID, never display as chip
  if (isUuidPattern(strTrimmed)) {
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

export function evaluateCellCondition(
  val: any,
  field: { type?: string; options?: any } | undefined,
  operator: string,
  targetValue: string
): boolean {
  const target = (targetValue || '').toLowerCase().trim();

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

  let formatted = '';
  if (decimals !== null) {
    formatted = format === 'standard'
      ? num.toFixed(decimals)
      : num.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  } else {
    formatted = format === 'standard' ? String(num) : num.toLocaleString();
  }

  return `${prefix}${formatted}${suffix}`;
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
