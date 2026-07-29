import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { FloatingTabBar as ZzDebugTab } from "@/components/FloatingTabBar";
import { mockTds, mockAppsInToss } from "@/__tests__/__helpers__/mocks";

mockTds();
mockAppsInToss();

function PageA() {
  return (
    <div>
      PageAContent
      <ZzDebugTab items={[{ label: "A", path: "/a" }, { label: "B", path: "/b" }]} />
    </div>
  );
}
function PageB() {
  return (
    <div>
      PageBContent
      <ZzDebugTab items={[{ label: "A", path: "/a" }, { label: "B", path: "/b" }]} />
    </div>
  );
}

describe("real file tab debug", () => {
  it("navigates on click", () => {
    render(
      <MemoryRouter initialEntries={["/a"]}>
        <Routes>
          <Route path="/a" element={<PageA />} />
          <Route path="/b" element={<PageB />} />
        </Routes>
      </MemoryRouter>,
    );
    expect(screen.getByText("PageAContent")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("tab", { name: "B" }));
    console.log("body after click:", document.body.innerHTML.slice(0, 300));
    expect(screen.getByText("PageBContent")).toBeInTheDocument();
  });
});
