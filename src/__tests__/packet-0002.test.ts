import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  getRecords,
  writeRecords,
  getSettings,
  writeSettings,
  getStreak,
  writeStreak,
  getChronotype,
  writeChronotype,
} from "@/lib/storage";
import type { SleepRecord, ChronotypeResult } from "@/lib/types";

describe("localStorage CRUD 헬퍼 (packet 0002)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  // Helper to create test records
  const createRecord = (date: string, overrides?: Partial<SleepRecord>): SleepRecord => ({
    id: `rec-${date}`,
    date,
    bedTime: "23:00",
    wakeTime: "07:00",
    sleepMinutes: 480,
    debtMinutes: 0,
    createdAt: Date.parse(date),
    ...overrides,
  });

  // Helper to create test chronotype result
  const createChronotype = (type: "MORNING" | "EVENING" | "INTERMEDIATE", overrides?: Partial<ChronotypeResult>): ChronotypeResult => ({
    type,
    score: 85,
    answeredAt: Date.now(),
    ...overrides,
  });

  // ============================================================================
  // AC-1: 손상 문자열 주입 시 기본값 반환·크래시 없음·console.error 없음
  // ============================================================================

  describe("AC-1: Handle corrupted JSON gracefully", () => {
    it("AC-1[P0]: getRecords returns [] for corrupted JSON without throwing or logging", () => {
      // Arrange
      localStorage.setItem("sdt.records", "{invalid");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Act
      const result = getRecords();

      // Assert
      expect(result).toEqual([]);
      expect(result).toHaveLength(0);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("AC-1[P0]: getSettings returns default for corrupted JSON without throwing or logging", () => {
      // Arrange
      localStorage.setItem("sdt.settings", "{invalid");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Act
      const result = getSettings();

      // Assert
      expect(result.targetMinutes).toBe(480);
      expect(result.aiNoticeAck).toBe(false);
      expect(result.onboarded).toBe(false);
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("AC-1[P0]: getStreak returns default for corrupted JSON without throwing or logging", () => {
      // Arrange
      localStorage.setItem("sdt.streak", "{invalid");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Act
      const result = getStreak();

      // Assert
      expect(result.current).toBe(0);
      expect(result.best).toBe(0);
      expect(result.lastCheckDate).toBe("");
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });

    it("AC-1[P0]: getChronotype returns null for corrupted JSON without throwing or logging", () => {
      // Arrange
      localStorage.setItem("sdt.chronotype", "{invalid");
      const consoleErrorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

      // Act
      const result = getChronotype();

      // Assert
      expect(result).toBeNull();
      expect(consoleErrorSpy).not.toHaveBeenCalled();
      consoleErrorSpy.mockRestore();
    });
  });

  // ============================================================================
  // AC-2: QUOTA mock 시 {ok:false,reason:'QUOTA'} 반환
  // ============================================================================

  describe("AC-2: Handle QuotaExceededError", () => {
    it("AC-2[P0]: writeRecords returns {ok: false, reason: 'QUOTA'} on QuotaExceededError", () => {
      // Arrange
      const records = [createRecord("2026-07-30")];
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        const error = new Error("QuotaExceededError");
        (error as any).name = "QuotaExceededError";
        throw error;
      });

      // Act
      const result = writeRecords(records);

      // Assert
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("QUOTA");
      expect(setItemSpy).toHaveBeenCalled();
      setItemSpy.mockRestore();
    });

    it("AC-2[P0]: writeSettings returns {ok: false, reason: 'QUOTA'} on QuotaExceededError", () => {
      // Arrange
      const settings = { targetMinutes: 480, aiNoticeAck: false, onboarded: false };
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        const error = new Error("QuotaExceededError");
        (error as any).name = "QuotaExceededError";
        throw error;
      });

      // Act
      const result = writeSettings(settings);

      // Assert
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("QUOTA");
      setItemSpy.mockRestore();
    });

    it("AC-2[P0]: writeStreak returns {ok: false, reason: 'QUOTA'} on QuotaExceededError", () => {
      // Arrange
      const streak = { current: 5, best: 10, lastCheckDate: "2026-07-30" };
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        const error = new Error("QuotaExceededError");
        (error as any).name = "QuotaExceededError";
        throw error;
      });

      // Act
      const result = writeStreak(streak);

      // Assert
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("QUOTA");
      setItemSpy.mockRestore();
    });

    it("AC-2[P0]: writeChronotype returns {ok: false, reason: 'QUOTA'} on QuotaExceededError", () => {
      // Arrange
      const chronotype = createChronotype("MORNING");
      const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
        const error = new Error("QuotaExceededError");
        (error as any).name = "QuotaExceededError";
        throw error;
      });

      // Act
      const result = writeChronotype(chronotype);

      // Assert
      expect(result.ok).toBe(false);
      expect(result.reason).toBe("QUOTA");
      setItemSpy.mockRestore();
    });
  });

  // ============================================================================
  // AC-3: getRecords date 오름차순 정렬 반환
  // ============================================================================

  describe("AC-3: Sort records by date ascending", () => {
    it("AC-3[P0]: getRecords returns records sorted by date in ascending order", () => {
      // Arrange
      const records = [
        createRecord("2026-07-30", { sleepMinutes: 420 }),
        createRecord("2026-07-28", { sleepMinutes: 360 }),
        createRecord("2026-07-29", { sleepMinutes: 300 }),
      ];
      localStorage.setItem("sdt.records", JSON.stringify(records));

      // Act
      const result = getRecords();

      // Assert
      expect(result).toHaveLength(3);
      expect(result[0].date).toBe("2026-07-28");
      expect(result[0].sleepMinutes).toBe(360);
      expect(result[1].date).toBe("2026-07-29");
      expect(result[1].sleepMinutes).toBe(300);
      expect(result[2].date).toBe("2026-07-30");
      expect(result[2].sleepMinutes).toBe(420);
    });

    it("AC-3[P0]: getRecords maintains sort order for large dataset", () => {
      // Arrange
      const records = [
        createRecord("2026-08-05", { sleepMinutes: 480 }),
        createRecord("2026-07-25", { sleepMinutes: 300 }),
        createRecord("2026-07-30", { sleepMinutes: 420 }),
        createRecord("2026-08-01", { sleepMinutes: 360 }),
        createRecord("2026-07-28", { sleepMinutes: 240 }),
      ];
      localStorage.setItem("sdt.records", JSON.stringify(records));

      // Act
      const result = getRecords();

      // Assert
      expect(result).toHaveLength(5);
      const dates: string[] = result.map((r) => r.date);
      expect(dates).toEqual(["2026-07-25", "2026-07-28", "2026-07-30", "2026-08-01", "2026-08-05"]);
    });
  });

  // ============================================================================
  // Happy path tests
  // ============================================================================

  describe("getRecords - happy path", () => {
    it("should return empty array when key does not exist", () => {
      // Act
      const result = getRecords();

      // Assert
      expect(result).toEqual([]);
      expect(Array.isArray(result)).toBe(true);
    });

    it("should return valid records array", () => {
      // Arrange
      const records = [
        createRecord("2026-07-28", { sleepMinutes: 390 }),
        createRecord("2026-07-29", { sleepMinutes: 420 }),
      ];
      localStorage.setItem("sdt.records", JSON.stringify(records));

      // Act
      const result = getRecords();

      // Assert
      expect(result).toHaveLength(2);
      expect(result[0].date).toBe("2026-07-28");
      expect(result[0].sleepMinutes).toBe(390);
    });
  });

  describe("writeRecords - happy path", () => {
    it("should return {ok: true} on successful write", () => {
      // Arrange
      const records = [createRecord("2026-07-30")];

      // Act
      const result = writeRecords(records);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should persist records to localStorage", () => {
      // Arrange
      const records = [
        createRecord("2026-07-28", { sleepMinutes: 360 }),
        createRecord("2026-07-29", { sleepMinutes: 420 }),
      ];

      // Act
      writeRecords(records);

      // Assert
      const stored = localStorage.getItem("sdt.records");
      expect(stored).toBe(JSON.stringify(records));
    });
  });

  describe("getSettings - happy path", () => {
    it("should return default settings when key does not exist", () => {
      // Act
      const result = getSettings();

      // Assert
      expect(result.targetMinutes).toBe(480);
      expect(result.aiNoticeAck).toBe(false);
      expect(result.onboarded).toBe(false);
    });

    it("should return custom settings when stored", () => {
      // Arrange
      const settings = { targetMinutes: 600, aiNoticeAck: true, onboarded: true };
      localStorage.setItem("sdt.settings", JSON.stringify(settings));

      // Act
      const result = getSettings();

      // Assert
      expect(result.targetMinutes).toBe(600);
      expect(result.aiNoticeAck).toBe(true);
      expect(result.onboarded).toBe(true);
    });
  });

  describe("writeSettings - happy path", () => {
    it("should return {ok: true} on successful write", () => {
      // Arrange
      const settings = { targetMinutes: 600, aiNoticeAck: true, onboarded: true };

      // Act
      const result = writeSettings(settings);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should persist settings to localStorage", () => {
      // Arrange
      const settings = { targetMinutes: 420, aiNoticeAck: false, onboarded: true };

      // Act
      writeSettings(settings);

      // Assert
      const stored = localStorage.getItem("sdt.settings");
      expect(stored).toBe(JSON.stringify(settings));
    });
  });

  describe("getStreak - happy path", () => {
    it("should return default streak when key does not exist", () => {
      // Act
      const result = getStreak();

      // Assert
      expect(result.current).toBe(0);
      expect(result.best).toBe(0);
      expect(result.lastCheckDate).toBe("");
    });

    it("should return custom streak when stored", () => {
      // Arrange
      const streak = { current: 7, best: 14, lastCheckDate: "2026-07-30" };
      localStorage.setItem("sdt.streak", JSON.stringify(streak));

      // Act
      const result = getStreak();

      // Assert
      expect(result.current).toBe(7);
      expect(result.best).toBe(14);
      expect(result.lastCheckDate).toBe("2026-07-30");
    });
  });

  describe("writeStreak - happy path", () => {
    it("should return {ok: true} on successful write", () => {
      // Arrange
      const streak = { current: 5, best: 10, lastCheckDate: "2026-07-30" };

      // Act
      const result = writeStreak(streak);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should persist streak to localStorage", () => {
      // Arrange
      const streak = { current: 3, best: 8, lastCheckDate: "2026-07-29" };

      // Act
      writeStreak(streak);

      // Assert
      const stored = localStorage.getItem("sdt.streak");
      expect(stored).toBe(JSON.stringify(streak));
    });
  });

  describe("getChronotype - happy path", () => {
    it("should return null when key does not exist", () => {
      // Act
      const result = getChronotype();

      // Assert
      expect(result).toBeNull();
    });

    it("should return chronotype when valid data exists", () => {
      // Arrange
      const chronotype = createChronotype("MORNING");
      localStorage.setItem("sdt.chronotype", JSON.stringify(chronotype));

      // Act
      const result = getChronotype();

      // Assert
      expect(result).toEqual(chronotype);
      expect(result?.type).toBe("MORNING");
      expect(result?.score).toBe(85);
    });
  });

  describe("writeChronotype - happy path", () => {
    it("should return {ok: true} on successful write of chronotype object", () => {
      // Arrange
      const chronotype = createChronotype("MORNING");

      // Act
      const result = writeChronotype(chronotype);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should return {ok: true} on successful write of null", () => {
      // Arrange & Act
      const result = writeChronotype(null);

      // Assert
      expect(result.ok).toBe(true);
      expect(result.reason).toBeUndefined();
    });

    it("should persist chronotype to localStorage", () => {
      // Arrange
      const chronotype = createChronotype("EVENING", { score: 75 });

      // Act
      writeChronotype(chronotype);

      // Assert
      const stored = localStorage.getItem("sdt.chronotype");
      expect(stored).toBe(JSON.stringify(chronotype));
    });

    it("should persist null chronotype to localStorage", () => {
      // Arrange & Act
      writeChronotype(null);

      // Assert
      const stored = localStorage.getItem("sdt.chronotype");
      expect(stored).toBe("null");
    });
  });
});
