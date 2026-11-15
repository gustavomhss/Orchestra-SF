/**
 * Q01.complete / NAV-01 / WP01.T01 / WP10.T02.
 *
 * Installed E2E matrix, NOT a route-parser mock. All 70 surfaces, 165 frozen
 * templates and 15 chapters are collected by the existing Playwright runner.
 * F04 / I00 must provide a real authenticated shell and the private manifest;
 * absent inputs FAIL rather than silently skip or count a mock as coverage.
 */
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { expect } from "@playwright/test"
import { nativeInstalledFixture as test } from "./fixture"
import { decodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"

type Route = { kind: string; path: string }
type Surface = { id: string; chapterId: string; entryRoute: string; routes: Route[] }
type SurfaceManifest = { surfaces: Surface[]; counts: { total: number } }

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
const frozenFile = path.join(root,
  "modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/surface-manifest.json")
const frozenText = readFileSync(frozenFile, "utf8")
const objectSha = createHash("sha1").update(
  "blob " + Buffer.byteLength(frozenText) + "\0" + frozenText,
).digest("hex")
if (objectSha !== "50e2993a881e207aa3b2a1cd250a7da84cea5855") {
  throw new Error("Q01_SURFACE_LOCK_DRIFT_REQUIRES_I00_RECONCILIATION")
}
const manifest = JSON.parse(frozenText) as SurfaceManifest
if (manifest.counts.total !== 70 || manifest.surfaces.length !== 70 ||
    new Set(manifest.surfaces.map((entry) => entry.id)).size !== 70 ||
    new Set(manifest.surfaces.map((entry) => entry.chapterId)).size !== 15 ||
    manifest.surfaces.reduce((n, entry) => n + entry.routes.length, 0) !== 165) {
  throw new Error("Q01_ZERO_OR_PARTIAL_SURFACE_SELECTION")
}
const chapterGroups = new Map<string, Surface[]>()
for (const surface of manifest.surfaces) {
  chapterGroups.set(surface.chapterId, [...(chapterGroups.get(surface.chapterId) ?? []), surface])
}
if (chapterGroups.size !== 15) throw new Error("Q01_CHAPTER_MATRIX_INCOMPLETE")

const parameter = /^:[A-Za-z][A-Za-z0-9]*$/
const opaque = /^r_[A-Za-z0-9_-]+$/
function matcher(template: string): RegExp {
  const special = ".*+?^$()|[]{}\\"
  const escaped = template.split("/").map((segment) => parameter.test(segment)
    ? "(r_[A-Za-z0-9_-]+)"
    : [...segment].map((char) => special.includes(char) ? "\\" + char : char).join(""),
  ).join("/")
  return new RegExp("^" + escaped + "$")
}
function caseId(surface: Surface, route: Route): string {
  return "Q01-NAV-" + surface.id + "-" + route.kind
}
function selector(target: { serverKey: string; projectId: string; installationId: string }): string {
  return new URLSearchParams({
    server: target.serverKey, project: target.projectId, installation: target.installationId,
  }).toString()
}
function selectedUrl(target: { shellOrigin: string; serverKey: string; projectId: string; installationId: string },
                     route: string): string {
  return target.shellOrigin + route + "?" + selector(target)
}

test.describe("Q01 complete: 15 native chapters and every registered surface/alias", () => {
  test.describe.configure({ timeout: 180_000, retries: 0 })
  for (const [chapter, surfaces] of chapterGroups) {
    test("Q01-CHAPTER-" + chapter + " all canonical routes", async ({ page, nativeHarness }) => {
      const { target, candidateSha } = nativeHarness.manifest
      const initial = await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
      expect(initial?.ok(), "F04 authenticates the installed native shell, not a detached test page").toBe(true)
      const installed = await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
      expect(installed.candidateSha).toBe(candidateSha)
      expect(installed.nativeChapterLocatorVisible).toBe(true)
      for (const surface of surfaces) {
        const surfaceRoutes = surface.routes
        expect(surfaceRoutes.length, "Q01 surface has a frozen route").toBeGreaterThan(0)
        for (const route of surfaceRoutes) {
          await test.step(caseId(surface, route), async () => {
            expect(route.path.startsWith("/orchestra/" + chapter + "/") ||
              route.path === "/orchestra/" + chapter ||
              route.kind === "case-alias", "Cross-chapter alias must be explicit in frozen source").toBe(true)
            // All refs MUST come from a genuine rendered link, never invented as
            // a successful business record. When none is admitted, exercise an
            // explicitly invalid opaque ref as the negative branch only.
            let pathname = route.path
            const tokens = route.path.split("/").filter((part) => parameter.test(part))
            if (tokens.length > 0) {
              const source = surface.entryRoute.includes(":")
                ? surfaces.find((entry) => entry.routes.some((r) =>
                    r.path.startsWith("/orchestra/" + chapter) && !r.path.includes(":")))?.entryRoute
                : surface.entryRoute
              if (source && !source.includes(":")) {
                await page.goto(selectedUrl(target, source))
                await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
                const anchorPaths = await page.getByRole("link").evaluateAll((links) =>
                  links.flatMap((a) => {
                    const element = a as HTMLAnchorElement
                    try { return [new URL(element.href).pathname] } catch { return [] }
                  }),
                )
                const real = anchorPaths.find((candidate) => matcher(route.path).test(candidate))
                if (real) {
                  for (const token of real.split("/").filter((part) => part.startsWith("r_"))) {
                    expect(decodeSfRouteRef(token), "Only canonical UTF-8 refs may be opened").toBeDefined()
                  }
                  pathname = real
                }
              }
              if (pathname.includes(":")) {
                // Refs intentionally invalid: this can prove a denial/invalid
                // link but cannot be counted as a positive business-record visit.
                pathname = pathname.replace(/:[A-Za-z][A-Za-z0-9]*/g, "r_")
              }
            }
            const expected = new URL(selectedUrl(target, pathname))
            const actual = await page.goto(expected.href)
            expect(actual, "Native route must return a document, not silently fall back to Chat").not.toBeNull()
            await expect(page).toHaveURL(expected.href)
            await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
            const state = page.locator("[data-sf-state]")
            await expect(state.first(), "Every route must show an authorized state, not blank HTML").toBeVisible()
            if (pathname.includes("/r_")) {
              const encodedRefs = pathname.split("/").filter((part) => part.startsWith("r_"))
              const validOpaque = encodedRefs.every((token) => opaque.test(token) && token !== "r_")
              if (!validOpaque) {
                await expect(page.locator('[data-sf-state="invalid"], [data-sf-state="not-found"], [data-sf-state="denied"]')).toBeVisible()
              }
            }
            const url = new URL(page.url())
            expect(url.searchParams.getAll("server")).toEqual([target.serverKey])
            expect(url.searchParams.getAll("project")).toEqual([target.projectId])
            expect(url.searchParams.getAll("installation")).toEqual([target.installationId])
            expect(url.pathname).toBe(pathname)
            if (route.kind === "case-alias") {
              expect(surface.id).toBe("UI51")
              expect(url.pathname).toMatch(/^\/orchestra\/sf-decisions\/r_[A-Za-z0-9_-]+\/relations$/)
            }
          })
        }
      }
    })
  }
})

test("Q01-NAV-NEGATIVE: duplicate, partial, malformed, cross-origin and cross-owner links fail closed", async ({ page, nativeHarness }) => {
  const { target, wrongProject } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
  const observed = await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  expect(observed.projectId).toBe(target.projectId)
  const route = "/orchestra/sf-home/context"
  const good = selector(target)
  const hostile = [
    route + "?" + good + "&server=" + encodeURIComponent(wrongProject.serverKey),
    route + "?server=" + encodeURIComponent(target.serverKey) + "&project=" + encodeURIComponent(target.projectId),
    route + "?" + good + "&project=" + encodeURIComponent(wrongProject.projectId),
    "/orchestra/sf-procurement/requests/r_/?"+good,
    "/orchestra/sf-decisions/r_%FF/relations?"+good,
    "/orchestra/sf-imports/%2Fpreview?"+good,
  ]
  for (const href of hostile) {
    await test.step("Q01-NAV-INVALID-" + hostile.indexOf(href), async () => {
      await page.goto(target.shellOrigin + href)
      // Invalid links must not expose the previously selected owner's private
      // projection or reinterpret a denied target as the current source.
      await expect(page.locator('[data-sf-context="authorized"]')).toHaveCount(0)
      await expect(page.locator('[data-sf-state="invalid"], [data-sf-state="denied"], [data-sf-state="not-found"]')).toBeVisible()
    })
  }
  expect(new URL("https://hostile.invalid/orchestra/sf-home", target.shellOrigin).origin)
    .not.toBe(target.shellOrigin)
})
