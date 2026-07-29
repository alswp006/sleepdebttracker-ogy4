import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";
import { vi } from "vitest";

mockTds();
mockAppsInToss();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => vi.fn(), useLocation: () => ({ pathname: "/", search: "", state: null, key: "default" }) };
});

import RecordPage from "@/pages/RecordPage";

describe("repro", () => {
  it("renders RecordPage inside real MemoryRouter", () => {
    render(React.createElement(MemoryRouter, { initialEntries: ["/record"] }, React.createElement(RecordPage)));
    expect(screen.getByText("오늘 수면 기록")).toBeInTheDocument();
  });
});
