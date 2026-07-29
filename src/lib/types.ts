// Domain types — add your app-specific types here

export interface SleepRecord {
  id: string;
  date: string; // YYYY-MM-DD
  bedTime: string; // HH:mm
  wakeTime: string; // HH:mm
  sleepMinutes: number;
  debtMinutes: number;
  createdAt: number;
}

export interface UserSettings {
  targetMinutes: number; // TARGET_MIN..TARGET_MAX
  aiNoticeAck: boolean;
  onboarded: boolean;
}

export interface Streak {
  current: number;
  best: number;
  lastCheckDate: string; // YYYY-MM-DD or ""
}

export type ChronotypeType = "MORNING" | "EVENING" | "INTERMEDIATE";

export interface ChronotypeResult {
  type: ChronotypeType;
  score: number;
  answeredAt: number;
}

export type CalcInput = {
  bedTime: string;
  wakeTime: string;
  targetMinutes: number;
};

export type CalcSleepResult = {
  sleepMinutes: number;
  debtMinutes: number;
};

export type SaveResult =
  | { ok: true; record: SleepRecord }
  | { ok: false; error: string };

export type RouteState = {
  "/": undefined;
  "/onboarding": undefined;
  "/record": { date?: string } | undefined;
  "/report": undefined;
  "/plan": undefined;
  "/settings": undefined;
  "/chronotype": undefined;
  "/chronotype/result": { result: ChronotypeResult } | undefined;
};

export const STORAGE_KEYS = {
  records: "sdt.records",
  settings: "sdt.settings",
  streak: "sdt.streak",
  chronotype: "sdt.chronotype",
} as const;

export const DEFAULT_TARGET_MINUTES = 480;
export const TARGET_MIN = 240;
export const TARGET_MAX = 720;
export const ROLLING_WINDOW_DAYS = 14;
