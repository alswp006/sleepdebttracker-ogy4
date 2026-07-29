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
import ts from "typescript";

// ── ".tsx" support for literal require() calls ──
// Node's native type-stripping (used automatically for ".ts") does NOT understand JSX,
// so a literal require() of a ".tsx" file (e.g. a page component, in TDD red-phase tests
// that require() a not-yet-created page) throws a raw SyntaxError. Register a loader that
// strips types + compiles JSX to CJS via the TypeScript compiler before Node evaluates it.
// (esbuild's sync transform is avoided here — it throws a TextEncoder/Uint8Array invariant
// error inside jsdom's globals.)
(Module as unknown as { _extensions: Record<string, (mod: unknown, filename: string) => void> })._extensions[
  ".tsx"
] = function (mod, filename) {
  const source = fs.readFileSync(filename, "utf8");
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      jsx: ts.JsxEmit.ReactJSX,
      target: ts.ScriptTarget.ES2020,
      esModuleInterop: true,
    },
    fileName: filename,
  });
  (mod as unknown as { _compile: (code: string, filename: string) => void })._compile(outputText, filename);
};

// ── "@/" alias + extensionless relative import support for literal require() calls ──
// Vite/vitest resolve the "@/" alias and extensionless imports for `import`, but a literal
// `require("@/...")` or `require("../foo")` (no ".ts"/".tsx" suffix — the codebase's normal
// style for .tsx files, see Home.tsx) bypasses vite's resolver and hits Node's real CJS
// resolution, which knows about neither. Patch it here so both work.
const projectRoot = process.cwd();
function withTsExtension(resolved: string): string {
  if (path.extname(resolved)) return resolved;
  if (fs.existsSync(resolved + ".ts")) return resolved + ".ts";
  if (fs.existsSync(resolved + ".tsx")) return resolved + ".tsx";
  return resolved;
}
const originalResolveFilename = (Module as unknown as { _resolveFilename: Function })._resolveFilename;
(Module as unknown as { _resolveFilename: Function })._resolveFilename = function (
  request: string,
  parent: { filename?: string } | undefined,
  ...rest: unknown[]
) {
  if (request.startsWith("@/")) {
    request = withTsExtension(path.resolve(projectRoot, "src", request.slice(2)));
  } else if ((request.startsWith("./") || request.startsWith("../")) && parent?.filename) {
    request = withTsExtension(path.resolve(path.dirname(parent.filename), request));
  }
  return originalResolveFilename.call(this, request, parent, ...rest);
};

// ── mock-aware require() for known SDK/router packages ──
// A literal require() (unlike a static `import`) never goes through vite-node's SSR module
// graph, so it never sees vi.mock() substitutions — a raw require("@toss/tds-mobile") loads
// the REAL package, which either crashes under jsdom or renders elements the pre-written
// tests don't expect (e.g. real Chip has no button role). __helpers__/mocks.ts stashes its
// mock singletons on globalThis specifically so this patch can hand back the exact same
// objects (same vi.fn() instances) that the test file's own top-level imports observe.
const originalRequire = (Module.prototype as unknown as { require: (id: string) => unknown }).require;
(Module.prototype as unknown as { require: (id: string) => unknown }).require = function (
  this: unknown,
  request: string,
) {
  const g = globalThis as Record<string, unknown>;
  if (request === "@toss/tds-mobile" && g.__tdsMock) return g.__tdsMock;
  if (request === "@apps-in-toss/web-framework" && g.__appsInTossMock) return g.__appsInTossMock;
  if (request === "react-router-dom" && g.__mockNavigate) {
    const actual = originalRequire.call(this, request) as Record<string, unknown>;
    // useLocation is left as the real implementation so require()'d pages read the actual
    // MemoryRouter state (initialEntries/state); only useNavigate is stubbed for assertions.
    return { ...actual, useNavigate: () => g.__mockNavigate };
  }
  return originalRequire.call(this, request);
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
