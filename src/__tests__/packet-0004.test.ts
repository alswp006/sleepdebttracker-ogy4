import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SleepRecord, Streak, SaveResult } from '@/lib/types';

/**
 * Packet 0004: 기록 upsert + 스트릭 갱신 로직
 *
 * Tests for:
 * - saveRecord(input, date, currentDate): SaveResult — upsert 기록, QUOTA 전파, streak 갱신
 * - updateStreak(today): Streak — 연속 체크인 로직 (어제→+1, 3일 건너뜀→1, 오늘→불변)
 *
 * Requirements:
 * AC-1: 동일 date 재저장 시 배열 length 불변·항목만 갱신
 * AC-2: streak 어제기록 3→4, 3일 건너뜀→1(best 유지), 오늘 재저장 불변
 * AC-3: QUOTA 반환 전파
 */

// ============================================================================
// saveRecord Tests
// ============================================================================

describe('saveRecord', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('AC-1[P0]: should add new record when date does not exist', () => {
    const { saveRecord } = require('@/lib/records');

    // Arrange: 빈 records 상태
    const input = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    const date = '2026-07-30';
    const currentDate = '2026-07-30';

    // Act
    const result = saveRecord(input, date, currentDate);

    // Assert: ok=true, 반환 레코드는 정확한 값 보유
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.date).toBe('2026-07-30');
      expect(result.record.bedTime).toBe('23:30');
      expect(result.record.wakeTime).toBe('06:00');
      expect(result.record.sleepMinutes).toBe(390);
      expect(result.record.debtMinutes).toBe(90);
    }
  });

  it('AC-1[P0]: should preserve array length when updating existing date (upsert)', () => {
    const { saveRecord } = require('@/lib/records');
    const { getRecords, writeRecords } = require('@/lib/storage');

    // Arrange: 기존 2026-07-30 기록 1건 존재, 다른 날짜 1건
    const existingRecords: SleepRecord[] = [
      {
        id: '2026-07-29',
        date: '2026-07-29',
        bedTime: '23:00',
        wakeTime: '06:00',
        sleepMinutes: 420,
        debtMinutes: 60,
        createdAt: 1722249600000,
      },
      {
        id: '2026-07-30',
        date: '2026-07-30',
        bedTime: '22:00',
        wakeTime: '08:00',
        sleepMinutes: 600,
        debtMinutes: 0, // 이전 기록
        createdAt: 1722336000000,
      },
    ];
    writeRecords(existingRecords);
    const originalLength = getRecords().length; // 2

    // Act: 동일 date로 saveRecord 호출
    const input = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    const result = saveRecord(input, '2026-07-30', '2026-07-30');

    // Assert: 배열 길이 불변, 항목 갱신됨
    const records = getRecords();
    expect(records.length).toBe(originalLength);
    expect(records.length).toBe(2);

    // 같은 date의 항목만 갱신
    const updated = records.find((r: SleepRecord) => r.date === '2026-07-30');
    expect(updated).toBeDefined();
    if (updated) {
      expect(updated.sleepMinutes).toBe(390); // 새로운 값
      expect(updated.debtMinutes).toBe(90); // 새로운 값
    }

    // 다른 date 항목은 유지
    const other = records.find((r: SleepRecord) => r.date === '2026-07-29');
    expect(other?.debtMinutes).toBe(60); // 변경 없음
  });

  it('AC-1[P0]: should maintain sort order after upsert', () => {
    const { saveRecord } = require('@/lib/records');
    const { getRecords, writeRecords } = require('@/lib/storage');

    // Arrange: 3개 기록 (2026-07-28, 2026-07-30, 2026-07-31)
    const existingRecords: SleepRecord[] = [
      {
        id: '2026-07-28',
        date: '2026-07-28',
        bedTime: '23:00',
        wakeTime: '06:00',
        sleepMinutes: 420,
        debtMinutes: 60,
        createdAt: 1722076800000,
      },
      {
        id: '2026-07-30',
        date: '2026-07-30',
        bedTime: '22:00',
        wakeTime: '08:00',
        sleepMinutes: 600,
        debtMinutes: 0,
        createdAt: 1722336000000,
      },
      {
        id: '2026-07-31',
        date: '2026-07-31',
        bedTime: '23:00',
        wakeTime: '07:00',
        sleepMinutes: 480,
        debtMinutes: 0,
        createdAt: 1722422400000,
      },
    ];
    writeRecords(existingRecords);

    // Act: 중간 date 갱신
    const input = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    saveRecord(input, '2026-07-30', '2026-07-30');

    // Assert: 날짜 오름차순 유지
    const records = getRecords();
    expect(records[0].date).toBe('2026-07-28');
    expect(records[1].date).toBe('2026-07-30');
    expect(records[2].date).toBe('2026-07-31');
  });

  it('AC-3[P0]: should return {ok:false, reason:"QUOTA"} when writeRecords fails', () => {
    const { saveRecord } = require('@/lib/records');

    // Arrange: localStorage.setItem이 QuotaExceededError throw
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });

    // Act
    const input = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    const result = saveRecord(input, '2026-07-30', '2026-07-30');

    // Assert: 에러 반환, throw 안 함
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.reason).toBe('QUOTA');
    }

    // Cleanup
    localStorage.setItem = originalSetItem;
  });

  it('AC-3[P0]: should not call updateStreak when saveRecord fails with QUOTA', () => {
    const { saveRecord } = require('@/lib/records');

    // Arrange
    const originalSetItem = localStorage.setItem;
    localStorage.setItem = vi.fn(() => {
      const err = new Error('QuotaExceededError');
      err.name = 'QuotaExceededError';
      throw err;
    });

    // Spy on updateStreak
    const updateStreakSpy = vi.spyOn(require('@/lib/records'), 'updateStreak');

    // Act
    const input = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    saveRecord(input, '2026-07-30', '2026-07-30');

    // Assert: updateStreak 호출 안 됨
    expect(updateStreakSpy).not.toHaveBeenCalled();

    // Cleanup
    localStorage.setItem = originalSetItem;
    updateStreakSpy.mockRestore();
  });

  it('should call updateStreak with currentDate on successful save', () => {
    const { saveRecord } = require('@/lib/records');
    const updateStreakSpy = vi.spyOn(require('@/lib/records'), 'updateStreak');

    // Act
    const input = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    const result = saveRecord(input, '2026-07-30', '2026-07-30');

    // Assert: ok=true이고 updateStreak 호출됨
    expect(result.ok).toBe(true);
    expect(updateStreakSpy).toHaveBeenCalledWith('2026-07-30');

    // Cleanup
    updateStreakSpy.mockRestore();
  });
});

// ============================================================================
// updateStreak Tests
// ============================================================================

describe('updateStreak', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('AC-2[P0]: should increment streak when lastCheckDate is yesterday', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange: 어제 기록한 streak
    const yesterday = '2026-07-29';
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 3,
      best: 5,
      lastCheckDate: yesterday,
    };
    writeStreak(currentStreak);

    // Act
    updateStreak(today);

    // Assert: current 증가, best 유지, lastCheckDate 갱신
    const updated = getStreak();
    expect(updated.current).toBe(4);
    expect(updated.best).toBe(5);
    expect(updated.lastCheckDate).toBe(today);
  });

  it('AC-2[P0]: should reset streak to 1 when gap > 1 day, but keep best record', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange: 3일 전 기록
    const dayAgo = '2026-07-27';
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 3,
      best: 8, // 최고 기록은 8
      lastCheckDate: dayAgo,
    };
    writeStreak(currentStreak);

    // Act
    updateStreak(today);

    // Assert: current 리셋, best 유지
    const updated = getStreak();
    expect(updated.current).toBe(1); // 리셋
    expect(updated.best).toBe(8); // 유지
    expect(updated.lastCheckDate).toBe(today);
  });

  it('AC-2[P0]: should not change streak when saving on same day twice', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange: 오늘 이미 기록
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 5,
      best: 6,
      lastCheckDate: today,
    };
    writeStreak(currentStreak);

    // Act: 같은 날짜로 updateStreak 호출
    updateStreak(today);

    // Assert: 변경 없음
    const updated = getStreak();
    expect(updated.current).toBe(5); // 불변
    expect(updated.best).toBe(6); // 불변
    expect(updated.lastCheckDate).toBe(today);
  });

  it('should update best when current exceeds best', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange: current=3이 best=2보다 큼 (어제 기록)
    const yesterday = '2026-07-29';
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 2,
      best: 2,
      lastCheckDate: yesterday,
    };
    writeStreak(currentStreak);

    // Act
    updateStreak(today);

    // Assert: current+1=3, best 업데이트
    const updated = getStreak();
    expect(updated.current).toBe(3);
    expect(updated.best).toBe(3); // best 갱신됨
  });

  it('should handle empty lastCheckDate (first time)', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange: 초기 상태 (lastCheckDate = "")
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 0,
      best: 0,
      lastCheckDate: '',
    };
    writeStreak(currentStreak);

    // Act
    updateStreak(today);

    // Assert: current=1, best=1로 초기화
    const updated = getStreak();
    expect(updated.current).toBe(1);
    expect(updated.best).toBe(1);
    expect(updated.lastCheckDate).toBe(today);
  });

  it('should handle streak reset while keeping high best record', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange: 일주일 전 기록, best=20
    const weekAgo = '2026-07-23';
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 5,
      best: 20,
      lastCheckDate: weekAgo,
    };
    writeStreak(currentStreak);

    // Act: 일주일 후 기록
    updateStreak(today);

    // Assert: current=1 (리셋), best=20 (유지)
    const updated = getStreak();
    expect(updated.current).toBe(1);
    expect(updated.best).toBe(20);
    expect(updated.lastCheckDate).toBe(today);
  });

  it('should correctly identify yesterday vs older dates', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange: 정확히 어제 (2026-07-29)
    const yesterday = '2026-07-29';
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 1,
      best: 3,
      lastCheckDate: yesterday,
    };
    writeStreak(currentStreak);

    // Act
    updateStreak(today);

    // Assert: 어제로 인식되어 +1
    const updated = getStreak();
    expect(updated.current).toBe(2); // 1 + 1
  });

  it('should persist updated streak to storage', () => {
    const { updateStreak } = require('@/lib/records');
    const { getStreak, writeStreak } = require('@/lib/storage');

    // Arrange
    const yesterday = '2026-07-29';
    const today = '2026-07-30';
    const currentStreak: Streak = {
      current: 7,
      best: 10,
      lastCheckDate: yesterday,
    };
    writeStreak(currentStreak);

    // Act
    updateStreak(today);

    // Assert: localStorage에 저장됨
    const stored = getStreak();
    expect(stored.current).toBe(8);
    expect(stored.best).toBe(10);
    expect(stored.lastCheckDate).toBe(today);
  });
});

// ============================================================================
// Integration: saveRecord + updateStreak flow
// ============================================================================

describe('saveRecord + updateStreak flow (integration)', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it('should execute full flow: calc → upsert → streak update', () => {
    const { saveRecord } = require('@/lib/records');
    const { getRecords, getStreak } = require('@/lib/storage');

    // Arrange: 첫 기록
    const input = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    const date = '2026-07-30';
    const currentDate = '2026-07-30';

    // Act
    const result = saveRecord(input, date, currentDate);

    // Assert: 기록 저장 + streak 갱신
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.record.sleepMinutes).toBe(390);
      expect(result.record.debtMinutes).toBe(90);
    }

    // 기록 확인
    const records = getRecords();
    expect(records.length).toBe(1);
    expect(records[0].date).toBe(date);

    // streak 확인
    const streak = getStreak();
    expect(streak.current).toBe(1);
    expect(streak.lastCheckDate).toBe(currentDate);
  });

  it('should handle consecutive day records: day1→day2→day3', () => {
    const { saveRecord } = require('@/lib/records');
    const { getStreak } = require('@/lib/storage');

    // Day 1
    const input1 = { bedTime: '23:30', wakeTime: '06:00', targetMinutes: 480 };
    saveRecord(input1, '2026-07-28', '2026-07-28');
    let streak = getStreak();
    expect(streak.current).toBe(1);
    expect(streak.lastCheckDate).toBe('2026-07-28');

    // Day 2 (yesterday from day 3's perspective)
    const input2 = { bedTime: '23:00', wakeTime: '07:00', targetMinutes: 480 };
    saveRecord(input2, '2026-07-29', '2026-07-29');
    streak = getStreak();
    expect(streak.current).toBe(2);
    expect(streak.lastCheckDate).toBe('2026-07-29');

    // Day 3
    const input3 = { bedTime: '22:30', wakeTime: '06:30', targetMinutes: 480 };
    saveRecord(input3, '2026-07-30', '2026-07-30');
    streak = getStreak();
    expect(streak.current).toBe(3);
    expect(streak.best).toBe(3);
    expect(streak.lastCheckDate).toBe('2026-07-30');
  });
});
