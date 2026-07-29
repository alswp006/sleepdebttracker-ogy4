import type { CalcInput, SaveResult, SleepRecord, Streak } from "@/lib/types";
import { calcSleep } from "./calc.ts";
import { getRecords, getStreak, writeRecords, writeStreak } from "./storage.ts";

function daysBetween(from: string, to: string): number {
  const fromMs = new Date(from).getTime();
  const toMs = new Date(to).getTime();
  return Math.floor((toMs - fromMs) / (24 * 60 * 60 * 1000));
}

export function updateStreak(today: string): Streak {
  const streak = getStreak();
  if (streak.lastCheckDate === today) {
    return streak;
  }

  const isYesterday = streak.lastCheckDate !== "" && daysBetween(streak.lastCheckDate, today) === 1;
  const current = isYesterday ? streak.current + 1 : 1;
  const best = Math.max(streak.best, current);
  const next: Streak = { current, best, lastCheckDate: today };

  writeStreak(next);
  return next;
}

export function saveRecord(input: CalcInput, date: string, currentDate: string): SaveResult {
  const outcome = calcSleep(input, input.targetMinutes);
  if (!outcome.ok) {
    return { ok: false, reason: "INVALID_TIME" };
  }

  const records = getRecords();
  const existingIndex = records.findIndex((r) => r.date === date);
  const record: SleepRecord = {
    id: date,
    date,
    bedTime: input.bedTime,
    wakeTime: input.wakeTime,
    sleepMinutes: outcome.sleepMinutes,
    debtMinutes: outcome.debtMinutes,
    createdAt: existingIndex >= 0 ? records[existingIndex].createdAt : Date.now(),
  };

  const nextRecords =
    existingIndex >= 0
      ? records.map((r, i) => (i === existingIndex ? record : r))
      : [...records, record];

  const writeResult = writeRecords(nextRecords);
  if (!writeResult.ok) {
    return { ok: false, reason: "QUOTA" };
  }

  updateStreak(currentDate);

  return { ok: true, record };
}
