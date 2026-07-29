import { describe, it, expect } from "vitest";
import { mockTds, mockAppsInToss, mockTossRewardAd } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();
mockTossRewardAd();

import { useNavigate } from "react-router-dom";

describe("debug2", () => {
  it("checks useNavigate identity", () => {
    console.log("useNavigate typeof:", typeof useNavigate, (useNavigate as any).mock ? "IS MOCK" : "real");
  });
});
