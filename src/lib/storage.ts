export function getItem<T>(key: string): T | null {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setItem<T>(key: string, value: T): void {
  localStorage.setItem(key, JSON.stringify(value));
}

export function removeItem(key: string): void {
  localStorage.removeItem(key);
}

// Packet 0002: Concrete CRUD helpers for domain entities

import type { SleepRecord, UserSettings, Streak, ChronotypeResult } from "./types.ts";
import { STORAGE_KEYS, DEFAULT_TARGET_MINUTES } from "./types.ts";

type WriteResult = { ok: boolean; reason?: "QUOTA" };

function writeJSON(key: string, value: unknown): WriteResult {
  try {
    localStorage.setItem(key, JSON.stringify(value));
    return { ok: true };
  } catch (e) {
    if (e instanceof Error && e.name === "QuotaExceededError") {
      return { ok: false, reason: "QUOTA" };
    }
    return { ok: false, reason: "QUOTA" };
  }
}

export function getRecords(): SleepRecord[] {
  const raw = getItem<SleepRecord[]>(STORAGE_KEYS.records);
  if (!Array.isArray(raw)) return [];
  return [...raw].sort((a, b) => a.date.localeCompare(b.date));
}

export function writeRecords(records: SleepRecord[]): WriteResult {
  return writeJSON(STORAGE_KEYS.records, records);
}

export function getSettings(): UserSettings {
  const defaults: UserSettings = {
    targetMinutes: DEFAULT_TARGET_MINUTES,
    aiNoticeAck: false,
    onboarded: false,
  };
  const raw = getItem<UserSettings>(STORAGE_KEYS.settings);
  return raw ?? defaults;
}

export function writeSettings(settings: UserSettings): WriteResult {
  return writeJSON(STORAGE_KEYS.settings, settings);
}

export function getStreak(): Streak {
  const defaults: Streak = { current: 0, best: 0, lastCheckDate: "" };
  const raw = getItem<Streak>(STORAGE_KEYS.streak);
  return raw ?? defaults;
}

export function writeStreak(streak: Streak): WriteResult {
  return writeJSON(STORAGE_KEYS.streak, streak);
}

export function getChronotype(): ChronotypeResult | null {
  return getItem<ChronotypeResult>(STORAGE_KEYS.chronotype);
}

export function writeChronotype(chronotype: ChronotypeResult | null): WriteResult {
  return writeJSON(STORAGE_KEYS.chronotype, chronotype);
}
