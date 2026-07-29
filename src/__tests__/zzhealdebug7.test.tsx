import { describe, it, expect } from "vitest";
import "@testing-library/jest-dom/vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import { MemoryRouter, Routes, Route } from "react-router-dom";
import { ZzDebugNav } from "@/components/ZzDebugNav";

function PageA() {
  return (
    <div>
      PageAContent
      <ZzDebugNav to="/b" />
    </div>
  );
}
function PageB() {
  return <div>PageBContent</div>;
}

describe("real file nav debug", () => {
  it("navigates on click", () => {
    render(
      <MemoryRouter initialEntries={["/a"]}>
        <Routes>
          <Route path="/a" element={<PageA />} />
          <Route path="/b" element={<PageB />} />
        </Routes>
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByText("go"));
    console.log("body after click:", document.body.innerHTML.slice(0, 300));
    expect(screen.getByText("PageBContent")).toBeInTheDocument();
  });
});
