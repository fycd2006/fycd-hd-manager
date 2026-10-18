import type { CommentLogEntry } from './LatestCommentModal';

const LOCAL_TIME_RE = /^(\d{4})[/-](\d{1,2})[/-](\d{1,2})(?:\s+(\d{1,2}):(\d{2})(?::(\d{2}))?)?$/;

const pad2 = (n: number) => String(n).padStart(2, '0');

/** 解析留言時間：支援 zh-TW `toLocaleString`（YYYY/M/D HH:mm:ss）與 ISO 字串 */
export function parseCommentTime(time?: string | null): Date | null {
  if (!time) return null;
  const trimmed = time.trim();
  const m = trimmed.match(LOCAL_TIME_RE);
  if (m) {
    const [, y, mo, d, h = '0', mi = '0', s = '0'] = m;
    return new Date(Number(y), Number(mo) - 1, Number(d), Number(h), Number(mi), Number(s));
  }
  if (trimmed.includes('T')) {
    const date = new Date(trimmed);
    if (!isNaN(date.getTime())) return date;
  }
  return null;
}

/** 新留言寫入的時間格式，與既有資料（zh-TW、24 小時制）一致 */
export function formatCommentTime(date: Date): string {
  return `${date.getFullYear()}/${pad2(date.getMonth() + 1)}/${pad2(date.getDate())} ${pad2(date.getHours())}:${pad2(date.getMinutes())}:${pad2(date.getSeconds())}`;
}

export function formatRelativeTime(time: string | undefined, now: Date = new Date()): string {
  const date = parseCommentTime(time);
  if (!date) return time || '';
  const diffMs = now.getTime() - date.getTime();
  const minutes = Math.floor(diffMs / 60000);
  if (minutes < 1) return '剛剛';
  if (minutes < 60) return `${minutes} 分鐘前`;

  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(date)) / 86400000);
  if (dayDiff === 0) return `${Math.floor(minutes / 60)} 小時前`;
  if (dayDiff === 1) return `昨天 ${pad2(date.getHours())}:${pad2(date.getMinutes())}`;
  if (dayDiff < 7) return `${dayDiff} 天前`;
  if (date.getFullYear() === now.getFullYear()) return `${date.getMonth() + 1}/${date.getDate()}`;
  return `${date.getFullYear()}/${date.getMonth() + 1}/${date.getDate()}`;
}

const AVATAR_COLORS = ['#ea580c', '#3f6212', '#b45309', '#0f766e', '#9a3412', '#4d7c0f', '#a16207', '#57534e'];

export function avatarColor(name: string): string {
  let hash = 0;
  for (const ch of name || '') hash = (hash * 31 + ch.codePointAt(0)!) >>> 0;
  return AVATAR_COLORS[hash % AVATAR_COLORS.length];
}

export function avatarInitial(name: string): string {
  const trimmed = (name || '').trim();
  return trimmed ? Array.from(trimmed)[0].toUpperCase() : '?';
}

const CONTINUATION_MS = 5 * 60 * 1000;

/** 同一作者、與前一則相差 5 分鐘內的留言合併顯示（不重複頭像與名字） */
export function isContinuation(entry: CommentLogEntry, previous?: CommentLogEntry): boolean {
  if (!previous || previous.user !== entry.user) return false;
  const a = parseCommentTime(entry.time);
  const b = parseCommentTime(previous.time);
  if (!a || !b) return false;
  return Math.abs(a.getTime() - b.getTime()) <= CONTINUATION_MS;
}
