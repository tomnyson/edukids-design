import { describe, it, expect } from 'vitest';
import { activityLabel } from '../../src/lib/relative-time';

const now = new Date(2026, 10, 1, 12, 0, 0).getTime();
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('activityLabel', () => {
  it('says "just now" under a minute', () => {
    expect(activityLabel({ lastOpenedAt: now - 20_000 }, now)).toBe('Mở vừa xong');
  });

  it('counts minutes under an hour, hours under a day, days under a week', () => {
    expect(activityLabel({ lastOpenedAt: now - 3 * MIN }, now)).toBe('Mở 3 phút trước');
    expect(activityLabel({ lastOpenedAt: now - 5 * HOUR }, now)).toBe('Mở 5 giờ trước');
    expect(activityLabel({ lastOpenedAt: now - 6 * DAY }, now)).toBe('Mở 6 ngày trước');
  });

  it('shows the date from a week on', () => {
    expect(activityLabel({ lastOpenedAt: new Date(2026, 9, 5, 9, 0).getTime() }, now)).toBe('Mở 05/10/2026');
  });

  it('reports the later of opened and edited', () => {
    expect(activityLabel({ lastOpenedAt: now - 2 * HOUR, lastEditedAt: now - 10 * MIN }, now)).toBe('Sửa 10 phút trước');
    expect(activityLabel({ lastOpenedAt: now - 10 * MIN, lastEditedAt: now - 2 * HOUR }, now)).toBe('Mở 10 phút trước');
  });

  it('treats a timestamp in the future (clock skew) as just now', () => {
    expect(activityLabel({ lastOpenedAt: now + 5 * MIN }, now)).toBe('Mở vừa xong');
  });
});
