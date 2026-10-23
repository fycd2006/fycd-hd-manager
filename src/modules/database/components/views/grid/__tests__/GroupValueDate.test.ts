import { parseGroupValue } from '../GridView';
import type { TableField } from '@/modules/database/types';

describe('parseGroupValue date groups', () => {
  it('groups created_on by day in the field zone with a date-only header', () => {
    const field: TableField = {
      id: 3, tableId: 1, name: '建立時間', type: 'created_on', order: 0,
      options: JSON.stringify({ date_time_zone: 'Asia/Taipei' }),
    };
    const g = parseGroupValue('2026-10-18T06:30:00.000Z', field);
    expect(g.key).toBe('2026-10-18');
    expect(g.displayTitle).toBe('2026-10-18');
    expect(g.badges[0].label).toBe('2026-10-18');
    expect(parseGroupValue('2026-10-18T06:31:00.000Z', field).key).toBe('2026-10-18');
    expect(parseGroupValue('2026-10-18T16:30:00.000Z', field).key).toBe('2026-10-19');
  });

  it('uses a sortable day key and the field date format for the header', () => {
    const field: TableField = {
      id: 4, tableId: 1, name: '日期', type: 'date', order: 0,
      options: JSON.stringify({ date_format: 'us', date_include_time: true, date_time_format: '12', date_time_zone: 'Asia/Taipei' }),
    };
    const g = parseGroupValue('2025-12-01T03:00:00.000Z', field);
    expect(g.key).toBe('2025-12-01');
    expect(g.displayTitle).toBe('12/01/2025');
    expect(g.badges[0].label).toBe('12/01/2025');
  });

  it('keeps unparseable date values in the blank group', () => {
    const field: TableField = { id: 5, tableId: 1, name: '日期', type: 'date', order: 0, options: null };
    expect(parseGroupValue('not a date', field).isBlank).toBe(true);
  });
});
