import { expect, test } from "bun:test"
import { playwrightArgs } from "../../../../../../script/test-ci-request.ts"
import { wp04BrowserSelected } from "../../../../../../packages/app-shell/e2e/sucafina/wp04/selection.ts"

test("the real canonical Playwright selector enables the Procurement fixture without changing the selector", () => {
  const file = "e2e/sucafina/wp04/procurement.spec.ts"
  const args = playwrightArgs({ package: "app", runner: "playwright", args: [file], env: {}, config: "e2e/playwright.production.config.ts", benchmarkRenderer: undefined })
  const before = structuredClone(args)
  expect(wp04BrowserSelected(args)).toBe(true)
  expect(args).toEqual(before)
  expect(wp04BrowserSelected([...args, "--list"])).toBe(true)
  expect(wp04BrowserSelected([file])).toBe(true)
  expect(wp04BrowserSelected(["/workspace/project/packages/app-shell/" + file])).toBe(true)
  expect(wp04BrowserSelected(["C:\\project\\packages\\app-shell\\" + file.replaceAll("/", "\\")])).toBe(true)
  expect(wp04BrowserSelected(["--config", "e2e/playwright.production.config.ts", "e2e/regression/other.spec.ts"])).toBe(false)
})
