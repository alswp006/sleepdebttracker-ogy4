/**
 * Vitest setup — runs before each test file.
 *
 * Handles:
 *  - localStorage isolation between tests (prevents cross-test pollution)
 *  - requestAnimationFrame shim for jsdom (needed for animate/countup utilities)
 *  - sessionStorage isolation
 *  - console.error filtering (React Router warnings etc.)
 */

import { beforeEach, afterEach, vi } from "vitest";
import "@testing-library/jest-dom/vitest";

// ── force UTC ──
// Date-based fixtures (e.g. `new Date(2026, 6, 30).toISOString().split("T")[0]`)
// shift to the wrong calendar day under non-UTC system timezones. Run tests in UTC
// so date-only strings stay deterministic regardless of the host machine's TZ.
process.env.TZ = "UTC";

import Module from "node:module";
import path from "node:path";
import fs from "node:fs";

// ── "@/" alias support for literal require() calls in test files ──
// Vite/vitest resolve the "@/" alias for `import`, but a literal `require("@/...")`
// bypasses vite's resolver and hits Node's real CJS resolution, which knows nothing
// about the alias or extensionless .ts files. Patch it here so both work.
const projectRoot = process.cwd();
const originalResolveFilename = (Module as unknown as { _resolveFilename: Function })._resolveFilename;
(Module as unknown as { _resolveFilename: Function })._resolveFilename = function (
  request: string,
  ...rest: unknown[]
) {
  if (request.startsWith("@/")) {
    const resolved = path.resolve(projectRoot, "src", request.slice(2));
    request = fs.existsSync(resolved + ".ts") ? resolved + ".ts" : resolved;
  }
  return originalResolveFilename.call(this, request, ...rest);
};

// ── localStorage / sessionStorage isolation ──
// jsdom's storage persists between tests by default. Clear it to prevent pollution.
beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
});

// ── requestAnimationFrame shim for jsdom ──
// jsdom does NOT implement rAF natively, so animate/countup code hangs forever.
// Shim that immediately invokes callback with a monotonic timestamp.
if (typeof globalThis.requestAnimationFrame !== "function") {
  let now = 0;
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    now += 16;
    return setTimeout(() => cb(now), 0) as unknown as number;
  }) as typeof globalThis.requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => clearTimeout(id)) as typeof globalThis.cancelAnimationFrame;
}

// ── afterEach reset ──
afterEach(() => {
  vi.clearAllMocks();
  vi.useRealTimers(); // in case a test used fake timers
});
