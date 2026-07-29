import { describe, it, expect } from "vitest";
import fs from "fs";
import path from "path";

/**
 * Packet 0015: 검수 통과 최종 점검 (금지 패턴 제거)
 *
 * AC-1: grep 금지 패턴 매칭 0 (window.open|window.location.href|hex색상|amplitude|gtag|console.error, 정당 사유 제외)
 * AC-2: 프로덕션 빌드 성공 전제(외부화 금지 설정)·CORS 0 (외부 fetch 미사용)
 * AC-3: AdSlot/TossRewardAd env 참조 확인 (VITE_TOSS_AD_GROUP_ID/VITE_TOSS_AD_SLOT_ID)
 */

const SRC_ROOT = path.resolve(__dirname, "..");

function collectSourceFiles(dir: string, files: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__") continue;
      collectSourceFiles(fullPath, files);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      files.push(fullPath);
    }
  }
  return files;
}

const SOURCE_FILES = collectSourceFiles(SRC_ROOT);

function findMatches(pattern: RegExp): { file: string; line: number; text: string }[] {
  const matches: { file: string; line: number; text: string }[] = [];
  for (const file of SOURCE_FILES) {
    const content = fs.readFileSync(file, "utf-8");
    const lines = content.split("\n");
    lines.forEach((lineText, idx) => {
      if (pattern.test(lineText)) {
        matches.push({ file: path.relative(SRC_ROOT, file), line: idx + 1, text: lineText.trim() });
      }
      pattern.lastIndex = 0;
    });
  }
  return matches;
}

describe("검수 통과 최종 점검 (금지 패턴 제거)", () => {
  it("AC-1[P0]: 소스에 outlink/분석 금지 패턴(window.open, window.location.href, amplitude, gtag)이 없다", () => {
    const outlinkMatches = findMatches(/window\.open\s*\(|window\.location\.href/g);
    const analyticsMatches = findMatches(/\bamplitude\b|\bgtag\b/gi);

    expect(outlinkMatches).toEqual([]);
    expect(analyticsMatches).toEqual([]);
  });

  it("AC-1[P0]: 소스에 console.error 호출이 없다", () => {
    const consoleErrorMatches = findMatches(/console\.error\s*\(/g);

    expect(consoleErrorMatches).toEqual([]);
    expect(consoleErrorMatches.length).toBe(0);
  });

  it("AC-1: 소스에 하드코딩된 HEX 색상이 없다 (다크모드 필수 — TDS 토큰/CSS 변수만)", () => {
    const hexColorMatches = findMatches(/#[0-9a-fA-F]{3,8}\b/g);

    expect(hexColorMatches).toEqual([]);
  });

  it("AC-2[P0]: vite.config.ts가 SDK를 external 처리하지 않고 정적 빌드(outDir: dist)로 설정되어 있다", () => {
    const viteConfigPath = path.resolve(SRC_ROOT, "../vite.config.ts");
    const viteConfig = fs.readFileSync(viteConfigPath, "utf-8");

    expect(viteConfig).not.toMatch(/external\s*:\s*\[[^\]]*@apps-in-toss\/web-framework/);
    expect(viteConfig).toMatch(/outDir\s*:\s*['"]dist['"]/);
  });

  it("AC-2: 소스에 외부 fetch() 호출이 없다 (CORS 위험 0 — localStorage/SDK Storage만 사용)", () => {
    const fetchMatches = findMatches(/\bfetch\s*\(/g);

    expect(fetchMatches).toEqual([]);
  });

  it("AC-3[P0]: HomePage가 AdSlot을 정확히 1개 렌더하고 env 참조를 사용한다", () => {
    const adSlotMatches = findMatches(/<AdSlot\b/g);

    expect(adSlotMatches.length).toBe(1);
    expect(adSlotMatches[0].file).toBe("pages/HomePage.tsx");

    const adGroupIdEnvMatches = findMatches(/VITE_TOSS_AD_GROUP_ID/g);
    expect(adGroupIdEnvMatches.length).toBeGreaterThan(0);
  });

  it("AC-3[P0]: ReportPage/PlanPage가 TossRewardAd 슬롯 ID로 env를 참조한다", () => {
    const rewardAdFiles = new Set(findMatches(/<TossRewardAd\b|slotId\s*:/g).map((m) => m.file));

    expect(rewardAdFiles.has("pages/ReportPage.tsx")).toBe(true);
    expect(rewardAdFiles.has("pages/PlanPage.tsx")).toBe(true);

    const adSlotIdEnvMatches = findMatches(/VITE_TOSS_AD_SLOT_ID/g);
    expect(adSlotIdEnvMatches.length).toBeGreaterThan(0);
  });
});
