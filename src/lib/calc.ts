import type { SleepRecord, UserSettings } from "@/lib/types";
import { ROLLING_WINDOW_DAYS } from "./types.ts";

const TIME_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

export type CalcSleepOk = {
  ok: true;
  sleepMinutes: number;
  debtMinutes: number;
};

export type CalcSleepFail = {
  ok: false;
  reason: "INVALID_TIME";
};

export type CalcSleepOutcome = CalcSleepOk | CalcSleepFail;

function toMinutes(time: string): number {
  const [hour, minute] = time.split(":").map(Number);
  return hour * 60 + minute;
}

export function calcSleep(
  { bedTime, wakeTime }: { bedTime: string; wakeTime: string },
  targetMinutes: number,
): CalcSleepOutcome {
  if (!TIME_PATTERN.test(bedTime) || !TIME_PATTERN.test(wakeTime) || bedTime === wakeTime) {
    return { ok: false, reason: "INVALID_TIME" };
  }

  const bed = toMinutes(bedTime);
  let wake = toMinutes(wakeTime);
  if (wake <= bed) {
    wake += 24 * 60;
  }

  const sleepMinutes = wake - bed;
  const debtMinutes = Math.max(0, targetMinutes - sleepMinutes);

  return { ok: true, sleepMinutes, debtMinutes };
}

function daysBetween(from: string, to: string): number {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

export function getCumulativeDebt(records: SleepRecord[], currentDate: string): number {
  const total = records.reduce((sum, record) => {
    const diff = daysBetween(record.date, currentDate);
    if (diff < 0 || diff >= ROLLING_WINDOW_DAYS) {
      return sum;
    }
    return sum + record.debtMinutes;
  }, 0);

  return Math.max(0, total);
}

export function estimatePayoffDays(
  cumDebt: number,
  records: SleepRecord[],
  settings: Pick<UserSettings, "targetMinutes">,
): number {
  if (cumDebt <= 0) {
    return 0;
  }

  const avgDebt =
    records.length === 0
      ? 0
      : records.reduce((sum, record) => sum + record.debtMinutes, 0) / records.length;

  const dailyRate = Math.max(30, Math.abs(avgDebt));

  return Math.ceil(cumDebt / dailyRate);
}

export function formatMinutes(totalMinutes: number): string {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours === 0) {
    return `${minutes}분`;
  }
  if (minutes === 0) {
    return `${hours}시간`;
  }
  return `${hours}시간 ${minutes}분`;
}
