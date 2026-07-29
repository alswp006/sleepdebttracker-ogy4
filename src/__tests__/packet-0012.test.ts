import { describe, it, expect, beforeEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { fireEvent, screen } from "@testing-library/react";
import { mockAll, mockNavigate } from "@/__tests__/__helpers__/mocks";
import { renderWithRouter } from "@/__tests__/__helpers__/test-utils";
import { writeChronotype } from "@/lib/storage";
import type { ChronotypeResult } from "@/lib/types";

/**
 * Packet 0012: 진단 결과 페이지 /chronotype/result
 *
 * Tests for:
 * - ChronotypeResultPage (default export): ScreenScaffold + chronotype-card + '다시 진단' 버튼
 *
 * Requirements:
 * AC-1: state 또는 저장된 결과로 chronotype-card 렌더(유형명 t2)
 * AC-2: 결과 없이 직접 진입 시 안내 + 진단하러 가기 버튼(→/chronotype)
 * AC-3: '다시 진단' 버튼 → navigate('/chronotype')
 */

mockAll();

// NOTE: src/pages/ChronotypeResultPage.tsx does not exist yet (TDD red phase).
// Loaded via require() inside each test — see packet-0011.test.ts convention.

const EVENING_RESULT: ChronotypeResult = {
  type: "EVENING",
  score: 21,
  answeredAt: new Date("2026-07-30T09:00:00").getTime(),
};

const MORNING_RESULT: ChronotypeResult = {
  type: "MORNING",
  score: 8,
  answeredAt: new Date("2026-07-29T09:00:00").getTime(),
};

describe("ChronotypeResultPage /chronotype/result", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-1[P0]: renders chronotype-card with type name and score from location.state", () => {
    const ChronotypeResultPage = require("@/pages/ChronotypeResultPage").default;
    renderWithRouter(React.createElement(ChronotypeResultPage), {
      initialEntries: [{ pathname: "/chronotype/result", state: { result: EVENING_RESULT } }],
    });

    const card = screen.getByTestId("chronotype-card");
    expect(card).toBeInTheDocument();
    expect(card.textContent).toMatch(/저녁형/);
    expect(card.textContent).toMatch(/21/);
  });

  it("AC-1[P0]: falls back to getChronotype() from storage when location.state is missing", () => {
    writeChronotype(MORNING_RESULT);

    const ChronotypeResultPage = require("@/pages/ChronotypeResultPage").default;
    renderWithRouter(React.createElement(ChronotypeResultPage), {
      initialEntries: ["/chronotype/result"],
    });

    const card = screen.getByTestId("chronotype-card");
    expect(card).toBeInTheDocument();
    expect(card.textContent).toMatch(/아침형/);
    expect(card.textContent).toMatch(/8/);
  });

  it("AC-2[P0]: shows guidance and a 진단하러 가기 button when no state and no saved result exist", () => {
    const ChronotypeResultPage = require("@/pages/ChronotypeResultPage").default;
    renderWithRouter(React.createElement(ChronotypeResultPage), {
      initialEntries: ["/chronotype/result"],
    });

    expect(screen.queryByTestId("chronotype-card")).not.toBeInTheDocument();
    expect(screen.getByText("진단 결과가 없어요")).toBeInTheDocument();

    const goDiagnoseButton = screen.getByRole("button", { name: "진단하러 가기" });
    fireEvent.click(goDiagnoseButton);
    expect(mockNavigate).toHaveBeenCalledWith("/chronotype");
  });

  it("AC-3[P0]: clicking 다시 진단 navigates to /chronotype", () => {
    const ChronotypeResultPage = require("@/pages/ChronotypeResultPage").default;
    renderWithRouter(React.createElement(ChronotypeResultPage), {
      initialEntries: [{ pathname: "/chronotype/result", state: { result: EVENING_RESULT } }],
    });

    fireEvent.click(screen.getByRole("button", { name: "다시 진단" }));
    expect(mockNavigate).toHaveBeenCalledWith("/chronotype");
  });

  it("AC-1[P1]: renders 중간형 label and description for INTERMEDIATE type", () => {
    const INTERMEDIATE_RESULT: ChronotypeResult = {
      type: "INTERMEDIATE",
      score: 15,
      answeredAt: new Date("2026-07-28T09:00:00").getTime(),
    };

    const ChronotypeResultPage = require("@/pages/ChronotypeResultPage").default;
    renderWithRouter(React.createElement(ChronotypeResultPage), {
      initialEntries: [{ pathname: "/chronotype/result", state: { result: INTERMEDIATE_RESULT } }],
    });

    const card = screen.getByTestId("chronotype-card");
    expect(card.textContent).toMatch(/중간형/);
    expect(card.textContent).toMatch(/15/);
  });
});
