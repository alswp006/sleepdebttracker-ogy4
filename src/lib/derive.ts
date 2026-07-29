import type { ChronotypeResult, ChronotypeType, SleepRecord } from "@/lib/types";

const WEEK_DAYS = 7;
const RECOVERY_CEILING_MINUTES = 120;
const MIN_RECORDS_FOR_REPORT = 3;

export type WeekReport = {
  sleepMinutes: number[]; // 최근 7일, 과거→오늘 순
  totalDebtMinutes: number;
  averageSleepMinutes: number;
  maxDebtDate: string | null;
  maxDebtMinutes: number;
  insufficientData: boolean;
};

export type RecoveryPlan = {
  recommendedSaturdayMinutes: number;
  recommendedSundayMinutes: number;
  additionalMinutesNeeded: number;
};

function addDays(date: string, days: number): string {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function getWeekReport(records: SleepRecord[], currentDate: string): WeekReport {
  const byDate = new Map(records.map((r) => [r.date, r]));
  const sleepMinutes: number[] = [];
  let totalDebtMinutes = 0;
  let sleepSum = 0;
  let recordCount = 0;
  let maxDebtDate: string | null = null;
  let maxDebtMinutes = 0;

  for (let i = WEEK_DAYS - 1; i >= 0; i--) {
    const date = addDays(currentDate, -i);
    const record = byDate.get(date);
    sleepMinutes.push(record?.sleepMinutes ?? 0);

    if (record) {
      recordCount++;
      sleepSum += record.sleepMinutes;
      totalDebtMinutes += record.debtMinutes;
      if (record.debtMinutes > maxDebtMinutes) {
        maxDebtMinutes = record.debtMinutes;
        maxDebtDate = record.date;
      }
    }
  }

  return {
    sleepMinutes,
    totalDebtMinutes,
    averageSleepMinutes: recordCount === 0 ? 0 : Math.round(sleepSum / recordCount),
    maxDebtDate,
    maxDebtMinutes,
    insufficientData: recordCount < MIN_RECORDS_FOR_REPORT,
  };
}

export function getRecoveryPlan(cumDebt: number, targetMinutes: number): RecoveryPlan | null {
  if (cumDebt <= 0) {
    return null;
  }

  const additionalMinutesNeeded = Math.min(Math.round(cumDebt / 2), RECOVERY_CEILING_MINUTES);
  const recommendedMinutes = targetMinutes + additionalMinutesNeeded;

  return {
    recommendedSaturdayMinutes: recommendedMinutes,
    recommendedSundayMinutes: recommendedMinutes,
    additionalMinutesNeeded,
  };
}

export function diagnoseChronotype(answers: number[]): ChronotypeResult {
  const score = answers.reduce((sum, answer) => sum + Math.min(5, Math.max(1, answer)), 0);
  const type: ChronotypeType = score <= 11 ? "MORNING" : score <= 19 ? "INTERMEDIATE" : "EVENING";

  return { type, score, answeredAt: Date.now() };
}
