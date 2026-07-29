import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useNavigate, useLocation } from "react-router-dom";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

import { FloatingTabBar as InlineTabBar } from "@/components/FloatingTabBar";

function PageA() {
  return (
    <div>
      PageAContent
      <InlineTabBar items={[{ label: "A", path: "/a" }, { label: "B", path: "/b" }]} />
    </div>
  );
}
function PageB() {
  return (
    <div>
      PageBContent
      <InlineTabBar items={[{ label: "A", path: "/a" }, { label: "B", path: "/b" }]} />
    </div>
  );
}

describe("inline tabbar debug", () => {
  it("navigates on tab click", () => {
    render(
      <MemoryRouter initialEntries={["/a"]}>
        <Routes>
          <Route path="/a" element={<PageA />} />
          <Route path="/b" element={<PageB />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    console.log("body after click:", document.body.innerHTML.slice(0, 300));
    expect(screen.getByText("PageBContent")).toBeInTheDocument();
  });
});
