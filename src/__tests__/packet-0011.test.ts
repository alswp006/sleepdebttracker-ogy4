import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, screen, within } from "@testing-library/react";
import { mockAll } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { getChronotype } from "@/lib/storage";

/**
 * Packet 0011: 수면 유형 진단 페이지 /chronotype
 *
 * Tests for:
 * - ChronotypePage (default export): ScreenScaffold + ListRow(문항)×5 + Chip 5점 척도 + SubmitFooter(결과 보기)
 *
 * Requirements:
 * AC-1: score21 입력 → EVENING result로 이동 (diagnoseChronotype + writeChronotype 저장)
 * AC-2: 미응답 시 결과 보기 버튼 disabled
 * AC-3: 척도 ≥44px; 결과 writeChronotype 저장
 */

mockAll();

// mockAll() already mocks react-router-dom's useNavigate -> mockNavigate.
import { mockNavigate } from "@/__tests__/__helpers__/mocks";
import { generateHapticFeedback } from "@apps-in-toss/web-framework";

// NOTE: src/pages/ChronotypePage.tsx does not exist yet (TDD red phase).
// A static `import` would fail tsc with TS2307 before the Coder creates the file,
// so — matching this project's established red-phase convention (see packet-0006.test.ts) —
// it's loaded via require() inside each test instead.

const NOW = new Date("2026-07-30T09:00:00");
const RESULT_BUTTON_NAME = "결과 보기";

// 5문항 각 1~5점. 합계 21 → EVENING (score >= 20)
const ANSWERS_SUM_21 = [5, 4, 4, 4, 4];

function answerQuestion(index: number, value: number) {
  const questions = screen.getAllByTestId("chronotype-question");
  const question = questions[index];
  fireEvent.click(within(question).getByRole("button", { name: String(value) }));
}

function answerAll(values: number[]) {
  values.forEach((value, index) => answerQuestion(index, value));
}

describe("ChronotypePage /chronotype", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
    vi.useRealTimers();
    vi.setSystemTime(NOW);
  });

  it("AC-1[P0]: renders 5 questions, each with a 1~5 point scale", () => {
    const ChronotypePage = require("@/pages/ChronotypePage").default;
    renderWithRouter(React.createElement(ChronotypePage));

    const questions = screen.getAllByTestId("chronotype-question");
    expect(questions).toHaveLength(5);

    for (const question of questions) {
      const scoped = within(question);
      expect(scoped.getByRole("button", { name: "1" })).toBeInTheDocument();
      expect(scoped.getByRole("button", { name: "5" })).toBeInTheDocument();
    }
  });

  it("AC-1[P0]: answering all 5 questions with sum 21 and clicking 결과 보기 diagnoses EVENING, saves it, fires success haptic, and navigates to /chronotype/result with the result", () => {
    const ChronotypePage = require("@/pages/ChronotypePage").default;
    renderWithRouter(React.createElement(ChronotypePage));

    // 척도 선택 시 tickWeak 햅틱
    answerQuestion(0, ANSWERS_SUM_21[0]);
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "tickWeak" });

    answerQuestion(1, ANSWERS_SUM_21[1]);
    answerQuestion(2, ANSWERS_SUM_21[2]);
    answerQuestion(3, ANSWERS_SUM_21[3]);
    answerQuestion(4, ANSWERS_SUM_21[4]);

    fireEvent.click(screen.getByRole("button", { name: RESULT_BUTTON_NAME }));

    const expectedResult = { type: "EVENING", score: 21, answeredAt: NOW.getTime() };

    // 완료 시 success 햅틱
    expect(generateHapticFeedback).toHaveBeenCalledWith({ type: "success" });

    // 저장
    expect(getChronotype()).toEqual(expectedResult);

    // 이동
    expect(mockNavigate).toHaveBeenCalledWith("/chronotype/result", {
      state: { result: expectedResult },
    });
  });

  it("AC-2[P0]: 결과 보기 button is disabled until all 5 questions are answered", () => {
    const ChronotypePage = require("@/pages/ChronotypePage").default;
    renderWithRouter(React.createElement(ChronotypePage));

    const submitButton = screen.getByRole("button", { name: RESULT_BUTTON_NAME });
    expect(submitButton).toBeDisabled();

    answerQuestion(0, 3);
    answerQuestion(1, 3);
    answerQuestion(2, 3);
    answerQuestion(3, 3);
    expect(submitButton).toBeDisabled(); // 5번째 문항 미응답

    answerQuestion(4, 3);
    expect(submitButton).not.toBeDisabled();
  });

  it("AC-2[P0]: clicking the disabled 결과 보기 button does not save or navigate", () => {
    const ChronotypePage = require("@/pages/ChronotypePage").default;
    renderWithRouter(React.createElement(ChronotypePage));

    fireEvent.click(screen.getByRole("button", { name: RESULT_BUTTON_NAME }));

    expect(mockNavigate).not.toHaveBeenCalled();
    expect(getChronotype()).toBeNull();
  });

  it("AC-3[P0]: renders 25 scale chips (5 questions x 5 points) each with a >=44px touch target", () => {
    const ChronotypePage = require("@/pages/ChronotypePage").default;
    renderWithRouter(React.createElement(ChronotypePage));

    const chips = screen.getAllByTestId("chronotype-chip");
    expect(chips).toHaveLength(25);

    for (const chip of chips) {
      const minHeight = parseInt(chip.style.minHeight || "0", 10);
      expect(minHeight).toBeGreaterThanOrEqual(44);
    }
  });

  it("AC-3[P0]: answering all questions with sum 12 diagnoses INTERMEDIATE and overwrites any previous saved result", () => {
    const ChronotypePage = require("@/pages/ChronotypePage").default;
    renderWithRouter(React.createElement(ChronotypePage));

    answerAll([3, 3, 2, 2, 2]); // sum 12 → INTERMEDIATE (12~19)

    fireEvent.click(screen.getByRole("button", { name: RESULT_BUTTON_NAME }));

    const saved = getChronotype();
    expect(saved?.type).toBe("INTERMEDIATE");
    expect(saved?.score).toBe(12);
    expect(mockNavigate).toHaveBeenCalledWith("/chronotype/result", {
      state: { result: { type: "INTERMEDIATE", score: 12, answeredAt: NOW.getTime() } },
    });
  });
});
