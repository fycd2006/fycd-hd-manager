import {
  parseCommentTime,
  formatRelativeTime,
  avatarColor,
  avatarInitial,
  isContinuation,
  formatCommentTime,
  formatCommentDate,
} from '../cells/commentUtils';

describe('commentUtils', () => {
  const now = new Date(2026, 9, 18, 15, 0, 0); // 2026/10/18 15:00:00

  it('parses zh-TW locale strings and ISO strings', () => {
    expect(parseCommentTime('2026/10/18 14:03:05')?.getTime()).toBe(new Date(2026, 9, 18, 14, 3, 5).getTime());
    expect(parseCommentTime('2026/9/1 08:00')?.getTime()).toBe(new Date(2026, 8, 1, 8, 0, 0).getTime());
    expect(parseCommentTime('2026-10-18T07:00:00.000Z')?.toISOString()).toBe('2026-10-18T07:00:00.000Z');
    expect(parseCommentTime('2026/09/01')?.getTime()).toBe(new Date(2026, 8, 1).getTime());
    expect(parseCommentTime('不是時間')).toBeNull();
    expect(parseCommentTime(undefined)).toBeNull();
  });

  it('formats relative time', () => {
    expect(formatRelativeTime('2026/10/18 14:59:30', now)).toBe('剛剛');
    expect(formatRelativeTime('2026/10/18 14:35:00', now)).toBe('25 分鐘前');
    expect(formatRelativeTime('2026/10/18 12:00:00', now)).toBe('3 小時前');
    expect(formatRelativeTime('2026/10/17 09:05:00', now)).toBe('昨天 09:05');
    expect(formatRelativeTime('2026/10/14 09:05:00', now)).toBe('4 天前');
    expect(formatRelativeTime('2026/09/01 09:05:00', now)).toBe('9/1');
    expect(formatRelativeTime('2025/09/01 09:05:00', now)).toBe('2025/9/1');
    expect(formatRelativeTime('不是時間', now)).toBe('不是時間');
  });

  it('formats the date part only', () => {
    expect(formatCommentDate('2026/9/1 08:00')).toBe('2026/09/01');
    expect(formatCommentDate('2026/10/18 14:03:05')).toBe('2026/10/18');
    expect(formatCommentDate('不是時間')).toBe('不是時間');
    expect(formatCommentDate(undefined)).toBe('');
  });

  it('formats a full timestamp for new entries', () => {
    expect(formatCommentTime(new Date(2026, 9, 18, 9, 5, 7))).toBe('2026/10/18 09:05:07');
  });

  it('gives stable avatar colors and initials', () => {
    expect(avatarColor('王大同')).toBe(avatarColor('王大同'));
    expect(avatarColor('王大同')).toMatch(/^#[0-9a-f]{6}$/i);
    expect(avatarInitial('王大同')).toBe('王');
    expect(avatarInitial('  jeff ')).toBe('J');
    expect(avatarInitial('')).toBe('?');
  });

  it('detects continuation of the same author within 5 minutes', () => {
    const a = { id: '1', user: '王', time: '2026/10/18 10:00:00', content: 'a' };
    const b = { id: '2', user: '王', time: '2026/10/18 10:04:00', content: 'b' };
    const c = { id: '3', user: '李', time: '2026/10/18 10:04:30', content: 'c' };
    const d = { id: '4', user: '王', time: '2026/10/18 10:20:00', content: 'd' };
    expect(isContinuation(b, a)).toBe(true);
    expect(isContinuation(c, b)).toBe(false);
    expect(isContinuation(d, b)).toBe(false);
    expect(isContinuation(a, undefined)).toBe(false);
  });
});
