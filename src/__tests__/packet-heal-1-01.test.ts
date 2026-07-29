import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import fs from "fs";
import path from "path";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";
import { STORAGE_KEYS } from "@/lib/types";
import type { UserSettings } from "@/lib/types";

/**
 * Packet heal-1-01: 라우터·Provider·온보딩 가드 단일화(0014+0016 통합)
 *
 * NOTE: react-router-dom is intentionally NOT mocked (no mockRouter()/mockAll()) —
 * these are full-App integration tests exercising real navigation/redirects, matching
 * the established convention in packet-0014.test.ts / packet-heal-1-02.test.ts.
 *
 * Requirements:
 * AC-1: 라우트 트리와 Provider가 단 한 곳에서만 정의된다(중복 라우트/Provider 0개)
 * AC-2: onboarded=false로 / 진입 시 /onboarding 리다이렉트, onboarded=true면 정상 진입
 * AC-3: SPEC의 8개 라우트가 모두 마운트되어 직접 URL 진입 시 크래시 없이 렌더된다
 * AC-4: 프로덕션 빌드에서 console.error 0개, 라우팅 관련 중복 키/경고 0개
 */

mockTds();
mockAppsInToss();
mockTossRewardAd();

import App from "@/App";

const SRC_DIR = path.resolve(__dirname, "..");

const ONBOARDED_TRUE: UserSettings = { targetMinutes: 480, aiNoticeAck: true, onboarded: true };
const ONBOARDED_FALSE: UserSettings = { targetMinutes: 480, aiNoticeAck: false, onboarded: false };

const ALL_ROUTES = [
  "/",
  "/onboarding",
  "/record",
  "/report",
  "/plan",
  "/chronotype",
  "/chronotype/result",
  "/settings",
];

function listSourceFiles(): string[] {
  const results: string[] = [];
  function walk(dir: string) {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      if (entry.name.startsWith("__tests__")) continue;
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (entry.name === "__tests__") continue;
        walk(full);
      } else if (/\.(tsx?|jsx?)$/.test(entry.name)) {
        results.push(full);
      }
    }
  }
  walk(SRC_DIR);
  return results;
}

function renderAppAt(path: string) {
  return render(
    React.createElement(MemoryRouter, { initialEntries: [path] }, React.createElement(App)),
  );
}

describe("라우터·Provider·온보딩 가드 단일화(0014+0016 통합)", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.clearAllMocks();
  });

  it("AC-1[P0]: <Routes> 라우트 트리 정의는 src 전체에서 정확히 한 파일에서만 나타난다", () => {
    const files = listSourceFiles();
    const filesWithRoutes = files.filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return /<Routes[\s>]/.test(content);
    });

    expect(filesWithRoutes.length).toBe(1);
    expect(filesWithRoutes[0].endsWith(path.join("src", "App.tsx"))).toBe(true);
  });

  it("AC-1[P0]: 최상위 Provider(TDSMobileAITProvider/BrowserRouter)는 src 전체에서 정확히 한 파일에서만 렌더된다", () => {
    const files = listSourceFiles();
    const filesWithProvider = files.filter((f) => {
      const content = fs.readFileSync(f, "utf-8");
      return /<TDSMobileAITProvider[\s>]/.test(content) || /<BrowserRouter[\s>]/.test(content);
    });

    expect(filesWithProvider.length).toBe(1);
    expect(filesWithProvider[0].endsWith(path.join("src", "main.tsx"))).toBe(true);
  });

  it("AC-2[P0]: onboarded=false 상태로 /(홈)에 진입하면 온보딩 화면으로 리다이렉트된다", () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(ONBOARDED_FALSE));
    renderAppAt("/");

    expect(screen.queryByText(/목표 수면 설정/)).toBeInTheDocument();
    expect(screen.queryByText(/수면 부채/)).not.toBeInTheDocument();
  });

  it("AC-2[P0]: onboarded=true 상태로 /(홈)에 진입하면 리다이렉트 없이 홈이 정상 렌더된다", () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(ONBOARDED_TRUE));
    renderAppAt("/");

    expect(screen.queryByText(/목표 수면 설정/)).not.toBeInTheDocument();
    expect(screen.queryByText(/수면 부채/)).toBeInTheDocument();
  });

  it("AC-3[P0]: SPEC의 8개 라우트 전부가 onboarded=true 상태에서 직접 URL 진입 시 크래시 없이 렌더된다", () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(ONBOARDED_TRUE));

    for (const route of ALL_ROUTES) {
      expect(() => {
        const { unmount } = renderAppAt(route);
        unmount();
      }).not.toThrow();
    }

    expect(ALL_ROUTES.length).toBe(8);
  });

  it("AC-4: 프로덕션 렌더 경로에서 console.error가 0회 호출된다(중복 라우트/키 경고 없음)", () => {
    localStorage.setItem(STORAGE_KEYS.settings, JSON.stringify(ONBOARDED_TRUE));
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    for (const route of ALL_ROUTES) {
      const { unmount } = renderAppAt(route);
      unmount();
    }

    expect(errorSpy).not.toHaveBeenCalled();
    errorSpy.mockRestore();
  });
});
