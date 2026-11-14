import { expect, test } from "bun:test"
import { realpathSync, statSync } from "node:fs"
import path from "node:path"
import { locateTestPackage } from "../../../../../../script/test-ci-location.ts"
import { playwrightArgs, validateRequest } from "../../../../../../script/test-ci-request.ts"
import { wp04BrowserSelected } from "../../../../../../packages/app-shell/e2e/sucafina/wp04/selection.ts"

// Run this regression only after session23 applies the shared selector postimage.
// Fixture prerequisite recognition does not execute or qualify a browser journey.
test("Operations fixture recognizes the canonical dispatcher arguments without changing selection", () => {
  const root = realpathSync(path.resolve(import.meta.dirname, "../../../../../.."))
  const request = validateRequest({
    package: "app",
    packageSelector: "packages/app",
    directory: "packages/app-shell",
    runner: "playwright",
    args: ["e2e/sucafina/operations.spec.ts"],
    env: { ORCHESTRA_CHANNEL: "prod" },
    config: "e2e/playwright.production.config.ts",
  }, (file) => {
    const absolute = path.resolve(root, file)
    return (statSync(absolute, { throwIfNoEntry: false })?.isFile() ?? false) &&
      realpathSync(absolute).startsWith(root + path.sep)
  }, (selector) => locateTestPackage(root, selector))
  const before = structuredClone(request)
  const args = playwrightArgs(request)
  const argumentsBefore = [...args]

  expect(request.directory).toBe("packages/app-shell")
  expect(request.args).toEqual(["e2e/sucafina/operations.spec.ts"])
  expect(wp04BrowserSelected(args)).toBe(true)
  expect(args).toEqual(argumentsBefore)
  expect(request).toEqual(before)
})

test("Operations fixture keeps Procurement support and excludes unrelated selections", () => {
  for (const spec of ["e2e/sucafina/operations.spec.ts", "e2e/sucafina/wp04/procurement.spec.ts"]) {
    for (const selected of [spec, "packages/app-shell/" + spec, spec + ":12:3", spec.replaceAll("/", "\\")]) {
      const args = Object.freeze([selected])
      expect(wp04BrowserSelected(args)).toBe(true)
      expect(args).toEqual([selected])
    }
  }
  for (const selected of [
    "e2e/sucafina/",
    "e2e/sucafina/operations.spec.ts.bak",
    "e2e/sucafina/operations-other.spec.ts",
    "e2e/sucafina/wp04/procurement.spec.ts.bak",
    "e2e/example.spec.ts",
  ]) expect(wp04BrowserSelected([selected])).toBe(false)
  expect(wp04BrowserSelected([])).toBe(false)
})
