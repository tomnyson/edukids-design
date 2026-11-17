export interface ActivityTimes {
  lastOpenedAt: number;
  lastEditedAt?: number;
}

const MINUTE = 60_000;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;
const WEEK = 7 * DAY;

const pad = (n: number) => String(n).padStart(2, '0');

function formatDate(time: number): string {
  const date = new Date(time);
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()}`;
}

function ago(time: number, now: number): string {
  const elapsed = Math.max(0, now - time);
  if (elapsed < MINUTE) return 'vừa xong';
  if (elapsed < HOUR) return `${Math.floor(elapsed / MINUTE)} phút trước`;
  if (elapsed < DAY) return `${Math.floor(elapsed / HOUR)} giờ trước`;
  if (elapsed < WEEK) return `${Math.floor(elapsed / DAY)} ngày trước`;
  return formatDate(time);
}

/** "Mở 3 phút trước" or "Sửa 2 giờ trước", whichever happened last; a date from a week on */
export function activityLabel(times: ActivityTimes, now: number): string {
  const edited = times.lastEditedAt !== undefined && times.lastEditedAt > times.lastOpenedAt;
  return edited ? `Sửa ${ago(times.lastEditedAt!, now)}` : `Mở ${ago(times.lastOpenedAt, now)}`;
}
