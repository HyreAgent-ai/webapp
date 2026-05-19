import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { getWeekDays, calcStreak, buildSparkData } from '../src/lib/dashboard-utils.js';

describe('getWeekDays', () => {
  it('returns 7 Date objects', () => {
    const days = getWeekDays();
    expect(days).toHaveLength(7);
    days.forEach(d => expect(d).toBeInstanceOf(Date));
  });

  it('first day is Monday (getDay() === 1)', () => {
    const days = getWeekDays();
    expect(days[0].getDay()).toBe(1);
  });

  it('days are consecutive', () => {
    const days = getWeekDays();
    for (let i = 1; i < 7; i++) {
      const diff = days[i].getTime() - days[i-1].getTime();
      expect(diff).toBe(86400000); // exactly 1 day
    }
  });
});

describe('calcStreak', () => {
  const today = new Date();
  const ds = (offsetDays) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  it('returns 0 when no activity', () => {
    expect(calcStreak([], [])).toBe(0);
  });

  it('returns 1 when only today has activity', () => {
    const apps = [{ date: ds(0) }];
    expect(calcStreak(apps, [])).toBe(1);
  });

  it('counts consecutive days with apps or networking', () => {
    const apps = [{ date: ds(0) }, { date: ds(1) }];
    const net  = [{ date: ds(2) }];
    expect(calcStreak(apps, net)).toBe(3);
  });

  it('stops at first gap (day 3 is missing)', () => {
    const apps = [{ date: ds(0) }, { date: ds(1) }, { date: ds(4) }];
    expect(calcStreak(apps, [])).toBe(2);
  });

  it('returns streak from yesterday when today has no activity', () => {
    const apps = [{ date: ds(1) }, { date: ds(2) }];
    expect(calcStreak(apps, [])).toBe(2);
  });
});

describe('buildSparkData', () => {
  const today = new Date();
  const ds = (offsetDays) => {
    const d = new Date(today);
    d.setDate(today.getDate() - offsetDays);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  it('returns an array of length 7', () => {
    expect(buildSparkData([], 7)).toHaveLength(7);
  });

  it('counts items per day correctly', () => {
    const items = [
      { date: ds(0) }, { date: ds(0) }, // 2 today
      { date: ds(1) },                   // 1 yesterday
    ];
    const spark = buildSparkData(items, 7);
    expect(spark[6]).toBe(2); // index 6 = today
    expect(spark[5]).toBe(1); // index 5 = yesterday
    expect(spark[4]).toBe(0); // index 4 = 2 days ago
  });
});
