import { parseGroupValue } from '../GridView';
import type { TableField } from '@/modules/database/types';

describe('parseGroupValue date groups', () => {
  it('formats created_on group headers per the field options instead of raw ISO', () => {
    const field: TableField = {
      id: 3, tableId: 1, name: '建立時間', type: 'created_on', order: 0,
      options: JSON.stringify({ date_time_zone: 'Asia/Taipei' }),
    };
    const g = parseGroupValue('2026-10-18T06:30:00.000Z', field);
    expect(g.displayTitle).toBe('2026-10-18 14:30');
    expect(g.badges[0].label).toBe('2026-10-18 14:30');
  });
});
