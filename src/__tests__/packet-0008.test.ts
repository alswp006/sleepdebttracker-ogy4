import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter, seedLocalStorage } from "@/__tests__/__helpers__/test-utils";
import type { SleepRecord, UserSettings } from "@/lib/types";
import { STORAGE_KEYS } from "@/lib/types";
import { getRecords } from "@/lib/storage";

/**
 * Packet 0008: 수면 입력 페이지 /record
 *
 * Tests for:
 * - RecordPage (default export): ScreenScaffold + TextField(취침/기상) + SubmitFooter 저장
 *
 * Requirements:
 * AC-1: {23:00,07:00}→480,0 저장·Toast·홈 이동; {01:00,06:00}→300,180
 * AC-2: 기상 빈값 disabled; 동일시간 거부; 기존 date 프리필·갱신
 * AC-3: QUOTA Toast·크래시 없음
 */

mockAll();

// mockAll() already mocks react-router-dom's useNavigate -> mockNavigate.
import { mockNavigate } from "@/__tests__/__helpers__/mocks";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

// NOTE: src/pages/RecordPage.tsx does not exist yet (TDD red phase).
// A static `import` would fail tsc with TS2307 before the Coder creates the file,
// so — matching this project's established red-phase convention (see packet-0006.test.ts) —
// it's loaded via require() inside each test instead.

const TODAY = "2026-01-15";
const NOW = new Date("2026-01-15T09:00:00");

const BED_PLACEHOLDER = "23:00";
const WAKE_PLACEHOLDER = "07:00";
const SAVE_BUTTON_NAME = "기록 저장";

function fillTimes(bedTime: string, wakeTime: string) {
  fireEvent.change(screen.getByPlaceholderText(BED_PLACEHOLDER), { target: { value: bedTime } });
  fireEvent.change(screen.getByPlaceholderText(WAKE_PLACEHOLDER), { target: { value: wakeTime } });
}

describe("RecordPage /record", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-1[P0]: saving {23:00,07:00} stores sleepMinutes 480 / debtMinutes 0, fires success haptic, shows a toast, and navigates home", async () => {
    const RecordPage = require("@/pages/RecordPage").default;
    renderWithRouter(React.createElement(RecordPage));

    fillTimes("23:00", "07:00");

    // live preview reflects 8 hours before saving
    expect(screen.getByTestId("sleep-preview").textContent).toContain("8시간");

    fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });
    expect(await screen.findByText("기록이 저장됐어요")).toBeInTheDocument();
    expect(mockNavigate).toHaveBeenCalledWith("/");

    const saved = getRecords().find((r) => r.date === TODAY);
    expect(saved?.sleepMinutes).toBe(480);
    expect(saved?.debtMinutes).toBe(0);
  });

  it("AC-1[P0]: saving {01:00,06:00} stores sleepMinutes 300 / debtMinutes 180 (default target 480m)", async () => {
    const RecordPage = require("@/pages/RecordPage").default;
    renderWithRouter(React.createElement(RecordPage));

    fillTimes("01:00", "06:00");
    expect(screen.getByTestId("sleep-preview").textContent).toContain("5시간");

    fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

    expect(await screen.findByText("기록이 저장됐어요")).toBeInTheDocument();
    const saved = getRecords().find((r) => r.date === TODAY);
    expect(saved?.sleepMinutes).toBe(300);
    expect(saved?.debtMinutes).toBe(180);
  });

  it("AC-2[P0]: 저장 button is disabled while 기상 is empty, and becomes enabled once both times are filled", () => {
    const RecordPage = require("@/pages/RecordPage").default;
    renderWithRouter(React.createElement(RecordPage));

    const saveButton = screen.getByRole("button", { name: SAVE_BUTTON_NAME });
    expect(saveButton).toBeDisabled();

    fireEvent.change(screen.getByPlaceholderText(BED_PLACEHOLDER), { target: { value: "23:00" } });
    expect(saveButton).toBeDisabled(); // wakeTime still empty

    fireEvent.change(screen.getByPlaceholderText(WAKE_PLACEHOLDER), { target: { value: "07:00" } });
    expect(saveButton).not.toBeDisabled();

    fireEvent.click(saveButton);
    expect(mockNavigate).toHaveBeenCalledWith("/");
  });

  it("AC-2[P0]: identical bedTime/wakeTime shows '취침·기상 시간이 같아요' and does not save or navigate", () => {
    const RecordPage = require("@/pages/RecordPage").default;
    renderWithRouter(React.createElement(RecordPage));

    fillTimes("23:00", "23:00");
    fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

    expect(screen.getByText("취침·기상 시간이 같아요")).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getRecords().find((r) => r.date === TODAY)).toBeUndefined();
  });

  it("AC-2: prefills bedTime/wakeTime from an existing record on the target date, and saving updates it in place", async () => {
    const existing: SleepRecord = {
      id: TODAY,
      date: TODAY,
      bedTime: "22:30",
      wakeTime: "06:15",
      sleepMinutes: 465,
      debtMinutes: 15,
      createdAt: 1,
    };
    seedLocalStorage({ [STORAGE_KEYS.records]: [existing] });

    const RecordPage = require("@/pages/RecordPage").default;
    renderWithRouter(React.createElement(RecordPage));

    expect(screen.getByPlaceholderText(BED_PLACEHOLDER)).toHaveValue("22:30");
    expect(screen.getByPlaceholderText(WAKE_PLACEHOLDER)).toHaveValue("06:15");

    fillTimes("23:00", "07:00");
    fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

    expect(await screen.findByText("기록이 저장됐어요")).toBeInTheDocument();
    const records = getRecords();
    expect(records.filter((r) => r.date === TODAY)).toHaveLength(1);
    expect(records.find((r) => r.date === TODAY)?.sleepMinutes).toBe(480);
  });

  it("AC-2: uses location.state.date instead of today when navigated with a target date", async () => {
    const RecordPage = require("@/pages/RecordPage").default;
    renderWithRouter(React.createElement(RecordPage), {
      initialEntries: [{ pathname: "/record", state: { date: "2026-01-10" } }],
    });

    fillTimes("23:00", "07:00");
    fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

    expect(await screen.findByText("기록이 저장됐어요")).toBeInTheDocument();
    const saved = getRecords().find((r) => r.date === "2026-01-10");
    expect(saved).toBeDefined();
    expect(saved?.sleepMinutes).toBe(480);
    // today itself was not written to
    expect(getRecords().find((r) => r.date === TODAY)).toBeUndefined();
  });

  it("AC-3[P0]: shows '저장 공간이 부족해요' toast and does not crash or navigate when storage write fails (QUOTA)", async () => {
    // localStorage.setItem cannot be reassigned directly in jsdom (legacy platform object) —
    // spy on Storage.prototype so writeRecords()'s try/catch actually observes the throw.
    const setItemSpy = vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("quota exceeded", "QuotaExceededError");
    });

    try {
      const RecordPage = require("@/pages/RecordPage").default;
      renderWithRouter(React.createElement(RecordPage));

      fillTimes("23:00", "07:00");
      fireEvent.click(screen.getByRole("button", { name: SAVE_BUTTON_NAME }));

      expect(await screen.findByText("저장 공간이 부족해요")).toBeInTheDocument();
      expect(mockNavigate).not.toHaveBeenCalled();
      // page did not crash — form is still on screen
      expect(screen.getByRole("button", { name: SAVE_BUTTON_NAME })).toBeInTheDocument();
    } finally {
      setItemSpy.mockRestore();
    }
  });

});
