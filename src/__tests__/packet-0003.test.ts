import { describe, it, expect } from 'vitest';
import type { SleepRecord } from '@/lib/types';

/**
 * Packet 0003: 부채 계산 엔진 (순수 함수)
 *
 * Tests for:
 * - calcSleep: time validation + sleep/debt calculation
 * - getCumulativeDebt: rolling 14-day sum with negative clamp
 * - estimatePayoffDays: repayment timeline estimation
 * - formatMinutes: user-facing time formatting
 */

// ============================================================================
// calcSleep Tests
// ============================================================================

describe('calcSleep', () => {
  it('AC-1[P0]: should calculate sleep and debt for normal case (23:30 → 06:00, target 480min)', () => {
    // Arrange: 침대 23:30 → 깨어남 06:00 = 6시간 30분 = 390분, 목표 480분 → 부채 90분
    const { calcSleep } = require('@/lib/calc');

    // Act
    const result = calcSleep({ bedTime: '23:30', wakeTime: '06:00' }, 480);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.sleepMinutes).toBe(390);
    expect(result.debtMinutes).toBe(90);
  });

  it('AC-2a[P0]: should calculate debt for morning wake (01:00 → 06:00, target 480min)', () => {
    // Arrange: 01:00 → 06:00 = 5시간 = 300분, 목표 480분 → 부채 180분
    const { calcSleep } = require('@/lib/calc');

    // Act
    const result = calcSleep({ bedTime: '01:00', wakeTime: '06:00' }, 480);

    // Assert
    expect(result.ok).toBe(true);
    expect(result.sleepMinutes).toBe(300);
    expect(result.debtMinutes).toBe(180);
  });

  it('AC-2b[P0]: should reject same bed and wake time', () => {
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: '07:00', wakeTime: '07:00' }, 480);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_TIME');
  });

  it('AC-2c[P0]: should reject malformed time (25:70)', () => {
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: '25:70', wakeTime: '06:00' }, 480);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_TIME');
  });

  it('should reject invalid bed time format', () => {
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: 'invalid', wakeTime: '06:00' }, 480);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_TIME');
  });

  it('should reject invalid wake time format', () => {
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: '23:30', wakeTime: 'not-time' }, 480);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_TIME');
  });

  it('should handle wake time after midnight (10:30 bed → 06:00 wake)', () => {
    // 10:30 PM (22:30) → 6:00 AM = 7.5 hours = 450 minutes
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: '22:30', wakeTime: '06:00' }, 480);

    expect(result.ok).toBe(true);
    expect(result.sleepMinutes).toBe(450);
    expect(result.debtMinutes).toBe(30);
  });

  it('should calculate zero debt when sleep >= target', () => {
    // 22:00 → 08:00 = 10 hours = 600 minutes, target 480 → surplus, debt 0
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: '22:00', wakeTime: '08:00' }, 480);

    expect(result.ok).toBe(true);
    expect(result.sleepMinutes).toBe(600);
    expect(result.debtMinutes).toBe(0);
  });

  it('should reject hour out of range (24:00)', () => {
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: '24:00', wakeTime: '06:00' }, 480);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_TIME');
  });

  it('should reject minute out of range (23:60)', () => {
    const { calcSleep } = require('@/lib/calc');

    const result = calcSleep({ bedTime: '23:60', wakeTime: '06:00' }, 480);

    expect(result.ok).toBe(false);
    expect(result.reason).toBe('INVALID_TIME');
  });
});

// ============================================================================
// getCumulativeDebt Tests
// ============================================================================

describe('getCumulativeDebt', () => {
  it('AC-3a[P0]: should sum last 14 days of debt', () => {
    const { getCumulativeDebt } = require('@/lib/calc');

    // Arrange: 14개 기록, 각 60분 부채 = 840분 총합
    const records: SleepRecord[] = Array.from({ length: 14 }, (_, i) => {
      const date = new Date(2026, 6, 30 - i);
      return {
        id: `rec-${i}`,
        date: date.toISOString().split('T')[0],
        bedTime: '23:00',
        wakeTime: '06:00',
        debtMinutes: 60,
        sleepMinutes: 420,
        createdAt: date.getTime(),
      };
    });
    const currentDate = '2026-07-30';

    // Act
    const result = getCumulativeDebt(records, currentDate);

    // Assert
    expect(result).toBe(840);
  });

  it('AC-3b[P0]: should clamp negative debt to 0', () => {
    const { getCumulativeDebt } = require('@/lib/calc');

    // Arrange: 음수 부채 (수면 초과)
    const date = new Date(2026, 6, 30);
    const records: SleepRecord[] = [
      {
        id: 'rec-1',
        date: '2026-07-30',
        bedTime: '22:00',
        wakeTime: '08:00',
        debtMinutes: -50,
        sleepMinutes: 600,
        createdAt: date.getTime(),
      },
    ];
    const currentDate = '2026-07-30';

    // Act
    const result = getCumulativeDebt(records, currentDate);

    // Assert
    expect(result).toBe(0);
  });

  it('should sum only records within last 14 days', () => {
    const { getCumulativeDebt } = require('@/lib/calc');

    // Arrange: 20개 기록 (모두 2026-06-11부터 2026-06-30)
    // 최근 14일(2026-07-17 ~ 2026-07-30): 14개만 합산
    const records: SleepRecord[] = Array.from({ length: 20 }, (_, i) => {
      const date = new Date(2026, 6, 30 - i);
      return {
        id: `rec-${i}`,
        date: date.toISOString().split('T')[0],
        bedTime: '23:00',
        wakeTime: '06:00',
        debtMinutes: 100,
        sleepMinutes: 420,
        createdAt: date.getTime(),
      };
    });
    const currentDate = '2026-07-30';

    // Act
    const result = getCumulativeDebt(records, currentDate);

    // Assert (최근 14개만: 100 * 14 = 1400)
    expect(result).toBe(1400);
  });

  it('should handle empty records', () => {
    const { getCumulativeDebt } = require('@/lib/calc');

    const result = getCumulativeDebt([], '2026-07-30');

    expect(result).toBe(0);
  });

  it('should handle mixed positive and negative debt', () => {
    const { getCumulativeDebt } = require('@/lib/calc');

    // Arrange: 부채 60분 + 부채 -20분 (초과) = 40분
    const date1 = new Date(2026, 6, 30);
    const date2 = new Date(2026, 6, 29);
    const records: SleepRecord[] = [
      {
        id: 'rec-1',
        date: '2026-07-30',
        bedTime: '23:00',
        wakeTime: '06:00',
        debtMinutes: 60,
        sleepMinutes: 420,
        createdAt: date1.getTime(),
      },
      {
        id: 'rec-2',
        date: '2026-07-29',
        bedTime: '22:00',
        wakeTime: '08:00',
        debtMinutes: -20,
        sleepMinutes: 600,
        createdAt: date2.getTime(),
      },
    ];
    const currentDate = '2026-07-30';

    // Act
    const result = getCumulativeDebt(records, currentDate);

    // Assert
    expect(result).toBe(40);
  });
});

// ============================================================================
// estimatePayoffDays Tests
// ============================================================================

describe('estimatePayoffDays', () => {
  it('AC-3c[P0]: should calculate 10 days to repay 600 min debt (60 min/day repayment)', () => {
    const { estimatePayoffDays } = require('@/lib/calc');

    // Arrange: 600분 부채, 일평균 상환량 60분 → 10일
    // 일평균 상환량 = max(30, |목표 - 최근평균수면|)
    const cumDebt = 600;
    const records: SleepRecord[] = Array.from({ length: 7 }, (_, i) => {
      const date = new Date(2026, 6, 30 - i);
      return {
        id: `rec-${i}`,
        date: date.toISOString().split('T')[0],
        bedTime: '23:00',
        wakeTime: '06:00',
        debtMinutes: 60,
        sleepMinutes: 420,
        createdAt: date.getTime(),
      };
    });
    const settings = { targetMinutes: 480 };

    // Act
    const result = estimatePayoffDays(cumDebt, records, settings);

    // Assert (600 / 60 = 10, 올림)
    expect(result).toBe(10);
  });

  it('should use minimum 30 min/day repayment rate', () => {
    const { estimatePayoffDays } = require('@/lib/calc');

    // Arrange: 500분 부채, 일평균 상환량 < 30분 → min 30 사용 → 올림(500/30=16.67→17)
    const cumDebt = 500;
    const date = new Date(2026, 6, 30);
    const records: SleepRecord[] = [
      {
        id: 'rec-1',
        date: '2026-07-30',
        bedTime: '23:30',
        wakeTime: '06:00',
        debtMinutes: 10,
        sleepMinutes: 390,
        createdAt: date.getTime(),
      },
    ];
    const settings = { targetMinutes: 480 };

    // Act
    const result = estimatePayoffDays(cumDebt, records, settings);

    // Assert
    expect(result).toBe(Math.ceil(500 / 30));
  });

  it('should return 0 for zero debt', () => {
    const { estimatePayoffDays } = require('@/lib/calc');

    const result = estimatePayoffDays(0, [], { targetMinutes: 480 });

    expect(result).toBe(0);
  });

  it('should handle large debt values', () => {
    const { estimatePayoffDays } = require('@/lib/calc');

    // Arrange: 10000분 부채, 100분/day → 100일
    const cumDebt = 10000;
    const date = new Date(2026, 6, 30);
    const records: SleepRecord[] = Array.from({ length: 7 }, (_, i) => ({
      id: `rec-${i}`,
      date: new Date(2026, 6, 30 - i).toISOString().split('T')[0],
      bedTime: '23:00',
      wakeTime: '06:00',
      debtMinutes: 100,
      sleepMinutes: 380,
      createdAt: date.getTime(),
    }));
    const settings = { targetMinutes: 480 };

    // Act
    const result = estimatePayoffDays(cumDebt, records, settings);

    // Assert
    expect(result).toBe(100);
  });
});

// ============================================================================
// formatMinutes Tests
// ============================================================================

describe('formatMinutes', () => {
  it('should format 90 minutes as "1시간 30분"', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(90);

    expect(result).toBe('1시간 30분');
  });

  it('should format 0 minutes as "0분"', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(0);

    expect(result).toBe('0분');
  });

  it('should format 60 minutes as "1시간"', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(60);

    expect(result).toBe('1시간');
  });

  it('should format 30 minutes as "30분"', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(30);

    expect(result).toBe('30분');
  });

  it('should format 600 minutes as "10시간"', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(600);

    expect(result).toBe('10시간');
  });

  it('should format 845 minutes as "14시간 5분"', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(845);

    expect(result).toBe('14시간 5분');
  });

  it('should omit hour when 0', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(45);

    expect(result).toBe('45분');
  });

  it('should omit minute when 0', () => {
    const { formatMinutes } = require('@/lib/calc');

    const result = formatMinutes(120);

    expect(result).toBe('2시간');
  });
});
