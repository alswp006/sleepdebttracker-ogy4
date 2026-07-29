import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { SleepRecord, ChronotypeResult } from '@/lib/types';

/**
 * Packet 0005: 리포트/플랜/크로노타입 파생 계산
 *
 * Tests for:
 * - getWeekReport(records, currentDate): 최근7일 sleepMinutes[7], 주간 총부채, 평균수면, 최다부족요일, 기록<3 플래그
 * - getRecoveryPlan(cumDebt, targetMinutes): 토·일 권장 수면 (target + min(부채/2, 120)), cumDebt=0 시 null
 * - diagnoseChronotype(answers: number[]): 각 응답 1~5 클램프, 합계 score, 분류(≤11 MORNING / 12~19 INTERMEDIATE / ≥20 EVENING)
 *
 * Requirements:
 * AC-1: 목표480·부채720→권장600(상한120 적용)
 * AC-2: score21→EVENING; 응답값6→5 클램프 후 계산·크래시 없음
 * AC-3: getWeekReport 7일 sleepMinutes 배열 반환
 */

// ============================================================================
// getRecoveryPlan Tests
// ============================================================================

describe('getRecoveryPlan', () => {
  it('AC-1[P0]: should calculate recovery plan with target 480min and debt 720min → recommended 600min (120min ceiling)', () => {
    const { getRecoveryPlan } = require('@/lib/derive');

    // Arrange
    const cumDebt = 720; // 12시간
    const targetMinutes = 480; // 8시간

    // Act
    const result = getRecoveryPlan(cumDebt, targetMinutes);

    // Assert
    // 토·일 각각 권장값 = target + min(debt/2, 120) = 480 + min(360, 120) = 480 + 120 = 600
    expect(result).not.toBeNull();
    if (result) {
      expect(result.recommendedSaturdayMinutes).toBe(600);
      expect(result.recommendedSundayMinutes).toBe(600);
      expect(result.additionalMinutesNeeded).toBe(120); // min(720/2, 120) = 120
    }
  });

  it('AC-1 variant: should apply 120min ceiling when debt/2 > 120', () => {
    const { getRecoveryPlan } = require('@/lib/derive');

    // Arrange: 부채 360분 → debt/2 = 180, 상한120으로 제한
    const cumDebt = 360;
    const targetMinutes = 480;

    // Act
    const result = getRecoveryPlan(cumDebt, targetMinutes);

    // Assert
    expect(result).not.toBeNull();
    if (result) {
      expect(result.recommendedSaturdayMinutes).toBe(600); // 480 + 120 (capped)
      expect(result.additionalMinutesNeeded).toBe(120); // min(180, 120)
    }
  });

  it('should return null when cumDebt is 0 (no repayment needed)', () => {
    const { getRecoveryPlan } = require('@/lib/derive');

    // Arrange
    const cumDebt = 0;
    const targetMinutes = 480;

    // Act
    const result = getRecoveryPlan(cumDebt, targetMinutes);

    // Assert
    expect(result).toBeNull();
  });

  it('should calculate correct additional minutes for smaller debt', () => {
    const { getRecoveryPlan } = require('@/lib/derive');

    // Arrange: 부채 100분 → additional = min(50, 120) = 50
    const cumDebt = 100;
    const targetMinutes = 480;

    // Act
    const result = getRecoveryPlan(cumDebt, targetMinutes);

    // Assert
    expect(result).not.toBeNull();
    if (result) {
      expect(result.additionalMinutesNeeded).toBe(50);
      expect(result.recommendedSaturdayMinutes).toBe(530); // 480 + 50
      expect(result.recommendedSundayMinutes).toBe(530);
    }
  });
});

// ============================================================================
// diagnoseChronotype Tests
// ============================================================================

describe('diagnoseChronotype', () => {
  it('AC-2[P0]: should classify score 21 as EVENING chronotype', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 5개 항목 각 4점 = 20점 → EVENING 범위에 진입하기 위해 21 필요
    // 사용자 응답 [5, 5, 5, 5, 1] = 21점 → EVENING (≥20)
    const answers = [5, 5, 5, 5, 1];

    // Act
    const result = diagnoseChronotype(answers);

    // Assert
    expect(result).not.toBeNull();
    expect(result.type).toBe('EVENING');
    expect(result.score).toBe(21);
    expect(result.answeredAt).toBeDefined();
    expect(typeof result.answeredAt).toBe('number');
  });

  it('AC-2[P0]: should clamp answer value 6 to 5 and calculate correctly without crash', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 응답값이 범위 초과 [6, 7, 8, 1, 2] → 클램프 [5, 5, 5, 1, 2] = 18점
    const answers = [6, 7, 8, 1, 2];

    // Act
    const result = diagnoseChronotype(answers);

    // Assert: 계산 성공·크래시 없음
    expect(result).not.toBeNull();
    expect(result.score).toBe(18); // 5+5+5+1+2
    expect(result.type).toBe('INTERMEDIATE'); // 12~19 범위
  });

  it('should classify score ≤11 as MORNING chronotype', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 모든 응답 1 = 5점
    const answers = [1, 1, 1, 1, 1];

    // Act
    const result = diagnoseChronotype(answers);

    // Assert
    expect(result.type).toBe('MORNING');
    expect(result.score).toBe(5);
  });

  it('should classify score 11 as boundary MORNING (≤11)', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 점수 정확히 11
    const answers = [3, 2, 3, 2, 1]; // 3+2+3+2+1 = 11

    // Act
    const result = diagnoseChronotype(answers);

    // Assert
    expect(result.type).toBe('MORNING');
    expect(result.score).toBe(11);
  });

  it('should classify score 12 as INTERMEDIATE (12~19)', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 점수 정확히 12 → INTERMEDIATE 범위 시작
    const answers = [3, 2, 3, 2, 2]; // 3+2+3+2+2 = 12

    // Act
    const result = diagnoseChronotype(answers);

    // Assert
    expect(result.type).toBe('INTERMEDIATE');
    expect(result.score).toBe(12);
  });

  it('should classify score 20 as EVENING (≥20)', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 점수 정확히 20 → EVENING 범위 시작
    const answers = [4, 4, 4, 4, 4]; // 4+4+4+4+4 = 20

    // Act
    const result = diagnoseChronotype(answers);

    // Assert
    expect(result.type).toBe('EVENING');
    expect(result.score).toBe(20);
  });

  it('should clamp negative values to 1', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 음수 응답값 → 클램프 1
    const answers = [-5, 0, 1, 2, 3]; // [-5→1, 0→1, 1, 2, 3] = 8점

    // Act
    const result = diagnoseChronotype(answers);

    // Assert
    expect(result.score).toBe(8); // 1+1+1+2+3
    expect(result.type).toBe('MORNING');
  });

  it('should handle large answer array gracefully', () => {
    const { diagnoseChronotype } = require('@/lib/derive');

    // Arrange: 큰 배열
    const answers = Array(20).fill(3); // 20개 항목, 각 3점 = 60점

    // Act
    const result = diagnoseChronotype(answers);

    // Assert: 크래시 없이 처리
    expect(result).not.toBeNull();
    expect(result.score).toBe(60); // 3 * 20
    expect(result.type).toBe('EVENING');
  });

  it('should include answeredAt timestamp (recent)', () => {
    const { diagnoseChronotype } = require('@/lib/derive');
    const before = Date.now();

    // Arrange
    const answers = [3, 3, 3, 3, 3]; // 15점

    // Act
    const result = diagnoseChronotype(answers);

    // Assert
    const after = Date.now();
    expect(result.answeredAt).toBeGreaterThanOrEqual(before);
    expect(result.answeredAt).toBeLessThanOrEqual(after + 1000); // 1초 여유
  });
});

// ============================================================================
// getWeekReport Tests
// ============================================================================

describe('getWeekReport', () => {
  it('AC-3[P0]: should return 7-day sleepMinutes array for last 7 days', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 7개 레코드 (최근 7일, 역순)
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      {
        id: '2026-07-30',
        date: '2026-07-30',
        bedTime: '23:30',
        wakeTime: '07:00',
        sleepMinutes: 450,
        debtMinutes: 30,
        createdAt: Date.now(),
      },
      {
        id: '2026-07-29',
        date: '2026-07-29',
        bedTime: '23:00',
        wakeTime: '07:00',
        sleepMinutes: 480,
        debtMinutes: 0,
        createdAt: Date.now(),
      },
      {
        id: '2026-07-28',
        date: '2026-07-28',
        bedTime: '00:00',
        wakeTime: '07:00',
        sleepMinutes: 420,
        debtMinutes: 60,
        createdAt: Date.now(),
      },
      {
        id: '2026-07-27',
        date: '2026-07-27',
        bedTime: '22:00',
        wakeTime: '06:00',
        sleepMinutes: 480,
        debtMinutes: 0,
        createdAt: Date.now(),
      },
      {
        id: '2026-07-26',
        date: '2026-07-26',
        bedTime: '23:00',
        wakeTime: '07:00',
        sleepMinutes: 480,
        debtMinutes: 0,
        createdAt: Date.now(),
      },
      {
        id: '2026-07-25',
        date: '2026-07-25',
        bedTime: '23:30',
        wakeTime: '06:30',
        sleepMinutes: 420,
        debtMinutes: 60,
        createdAt: Date.now(),
      },
      {
        id: '2026-07-24',
        date: '2026-07-24',
        bedTime: '22:30',
        wakeTime: '06:30',
        sleepMinutes: 480,
        debtMinutes: 0,
        createdAt: Date.now(),
      },
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert
    expect(result.sleepMinutes).toHaveLength(7);
    expect(result.sleepMinutes).toEqual([480, 420, 480, 480, 420, 480, 450]); // 7일 역순
  });

  it('should calculate weekly debt sum correctly', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      { id: '2026-07-30', date: '2026-07-30', bedTime: '23:30', wakeTime: '07:00', sleepMinutes: 450, debtMinutes: 30, createdAt: Date.now() },
      { id: '2026-07-29', date: '2026-07-29', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 480, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-28', date: '2026-07-28', bedTime: '00:00', wakeTime: '07:00', sleepMinutes: 420, debtMinutes: 60, createdAt: Date.now() },
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert: 30 + 0 + 60 = 90
    expect(result.totalDebtMinutes).toBe(90);
  });

  it('should calculate average sleep minutes correctly', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 3개 레코드 (420, 480, 360) → 평균 420
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      { id: '2026-07-30', date: '2026-07-30', bedTime: '23:30', wakeTime: '06:30', sleepMinutes: 420, debtMinutes: 60, createdAt: Date.now() },
      { id: '2026-07-29', date: '2026-07-29', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 480, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-28', date: '2026-07-28', bedTime: '00:00', wakeTime: '06:00', sleepMinutes: 360, debtMinutes: 120, createdAt: Date.now() },
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert: (420 + 480 + 360) / 3 = 420
    expect(result.averageSleepMinutes).toBe(420);
  });

  it('should identify max debt day correctly', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 최대 부채 120분 (2026-07-28)
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      { id: '2026-07-30', date: '2026-07-30', bedTime: '23:30', wakeTime: '06:30', sleepMinutes: 420, debtMinutes: 60, createdAt: Date.now() },
      { id: '2026-07-29', date: '2026-07-29', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 480, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-28', date: '2026-07-28', bedTime: '00:00', wakeTime: '06:00', sleepMinutes: 360, debtMinutes: 120, createdAt: Date.now() },
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert
    expect(result.maxDebtDate).toBe('2026-07-28');
    expect(result.maxDebtMinutes).toBe(120);
  });

  it('should flag insufficient records (< 3 days)', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 2개 레코드만
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      { id: '2026-07-30', date: '2026-07-30', bedTime: '23:30', wakeTime: '06:30', sleepMinutes: 420, debtMinutes: 60, createdAt: Date.now() },
      { id: '2026-07-29', date: '2026-07-29', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 480, debtMinutes: 0, createdAt: Date.now() },
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert
    expect(result.insufficientData).toBe(true);
  });

  it('should flag sufficient records (≥ 3 days)', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 3개 레코드
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      { id: '2026-07-30', date: '2026-07-30', bedTime: '23:30', wakeTime: '06:30', sleepMinutes: 420, debtMinutes: 60, createdAt: Date.now() },
      { id: '2026-07-29', date: '2026-07-29', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 480, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-28', date: '2026-07-28', bedTime: '00:00', wakeTime: '06:00', sleepMinutes: 360, debtMinutes: 120, createdAt: Date.now() },
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert
    expect(result.insufficientData).toBe(false);
  });

  it('should handle empty records gracefully', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 빈 배열
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert: 7개 0값 배열 + 플래그 true
    expect(result.sleepMinutes).toHaveLength(7);
    expect(result.sleepMinutes.every((m: number) => m === 0)).toBe(true);
    expect(result.insufficientData).toBe(true);
    expect(result.totalDebtMinutes).toBe(0);
  });

  it('should ignore records outside 7-day window', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 현재 2026-07-30, 8일 전 기록 포함 → 무시
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      { id: '2026-07-30', date: '2026-07-30', bedTime: '23:30', wakeTime: '06:30', sleepMinutes: 420, debtMinutes: 60, createdAt: Date.now() },
      { id: '2026-07-22', date: '2026-07-22', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 480, debtMinutes: 0, createdAt: Date.now() }, // 8일 전 → 무시
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert: 2026-07-22 무시, 2026-07-30만 포함
    expect(result.sleepMinutes[6]).toBe(420); // index 6 = 오늘 (2026-07-30)
    expect(result.totalDebtMinutes).toBe(60); // 2026-07-22 제외
  });

  it('should return correct day order (oldest to newest)', () => {
    const { getWeekReport } = require('@/lib/derive');

    // Arrange: 명확한 점수로 순서 확인
    const currentDate = '2026-07-30';
    const records: SleepRecord[] = [
      { id: '2026-07-30', date: '2026-07-30', bedTime: '23:30', wakeTime: '07:00', sleepMinutes: 100, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-29', date: '2026-07-29', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 200, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-28', date: '2026-07-28', bedTime: '00:00', wakeTime: '07:00', sleepMinutes: 300, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-27', date: '2026-07-27', bedTime: '22:00', wakeTime: '06:00', sleepMinutes: 400, debtMinutes: 0, createdAt: Date.now() },
      { id: '2026-07-26', date: '2026-07-26', bedTime: '23:00', wakeTime: '07:00', sleepMinutes: 500, debtMinutes: 0, createdAt: Date.now() },
    ];

    // Act
    const result = getWeekReport(records, currentDate);

    // Assert: index 0부터 [2026-07-26(500), ..., 2026-07-30(100)]
    expect(result.sleepMinutes[0]).toBe(500); // 2026-07-26 (oldest)
    expect(result.sleepMinutes[4]).toBe(100); // 2026-07-30 (newest)
  });
});
