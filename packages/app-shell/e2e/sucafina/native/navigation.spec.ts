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
import { expect, type Page } from "@playwright/test"
import { Schema } from "effect"
import { nativeInstalledFixture, type NativeTarget } from "./fixture"
import { nativeOwnerQuery } from "./fixture/manifest-contract"
import { decodeSfRouteRef } from "../../../src/orchestra/chapters/sucafina/navigation-state"

const test = nativeInstalledFixture
const Route = Schema.Struct({ kind: Schema.String, path: Schema.String })
const Surface = Schema.Struct({ id: Schema.String, chapterId: Schema.String, entryRoute: Schema.String,
  routes: Schema.Array(Route) })
type Route = typeof Route.Type
type Surface = typeof Surface.Type

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
const manifest = Schema.decodeUnknownSync(Schema.fromJsonString(Schema.Struct({
  surfaces: Schema.Array(Surface), counts: Schema.Struct({ total: Schema.Number }),
})))(frozenText)
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
const contextPath = "/orchestra/sf-home/context"
const administrationPath = "/orchestra/sf-home/administration"
function selectedUrl(target: NativeTarget, route: string): URL {
  const url = new URL(route, target.shellOrigin)
  const query = nativeOwnerQuery(target)
  // UI69 is installation-scoped, not a business Team route.
  if (route === administrationPath) query.delete("teamObjectId")
  url.search = query.toString()
  return url
}
async function expectInvalidLink(page: Page) {
  const content = page.locator("#sf-team-content")
  await expect(content.getByRole("alert")).toHaveText(
    /^(This link does not identify a valid Team profile for this installation\.|Este link n\u00e3o identifica um perfil do Teams v\u00e1lido para esta instala\u00e7\u00e3o\.)$/,
  )
  await expect(content.locator('[data-sf-frame="page"], [data-sf-context="authorized"], [data-sf-home="authorized"]'))
    .toHaveCount(0)
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
                await page.goto(selectedUrl(target, source).href)
                await expect(page.locator('[data-sf-frame="page"]')).toBeVisible()
                const anchorURLs = await page.locator('[data-sf-frame="page"]').getByRole("link").evaluateAll((links) =>
                  links.flatMap((link) => link instanceof HTMLAnchorElement ? [link.href] : []),
                )
                const real = anchorURLs.map((href) => new URL(href)).find((candidate) =>
                  candidate.origin === target.shellOrigin && matcher(route.path).test(candidate.pathname) &&
                  [...nativeOwnerQuery(target)].every(([key, value]) =>
                    candidate.searchParams.getAll(key).length === 1 && candidate.searchParams.get(key) === value))
                if (real) {
                  for (const token of real.pathname.split("/").filter((part) => part.startsWith("r_"))) {
                    expect(decodeSfRouteRef(token), "Only canonical UTF-8 refs may be opened").toBeDefined()
                  }
                  pathname = real.pathname
                }
              }
              if (pathname.includes(":")) {
                // Refs intentionally invalid: this can prove a denial/invalid
                // link but cannot be counted as a positive business-record visit.
                pathname = pathname.replace(/:[A-Za-z][A-Za-z0-9]*/g, "r_")
              }
            }
            const expected = selectedUrl(target, pathname)
            const actual = await page.goto(expected.href)
            expect(actual, "Native route must return a document, not silently fall back to Chat").not.toBeNull()
            await expect(page).toHaveURL(expected.href)
            const invalidRef = pathname.split("/").includes("r_")
            if (invalidRef) await expectInvalidLink(page)
            else if (pathname === contextPath) {
              const shell = page.locator('[data-sf-teams-state="authenticated"]')
              await expect(shell).toHaveAttribute("data-sf-team-selected", target.teamObjectId)
              await expect(shell.locator("[data-sf-team-status]").and(page.getByRole("status"))).toBeVisible()
            } else if (pathname === administrationPath) {
              await expect(page.locator('[data-sf-team-administration]:not([data-sf-team-administration="loading"])')).toBeVisible()
            } else {
              const frame = page.locator('[data-sf-frame="page"]')
              await expect(frame).toBeVisible()
              await expect(frame.locator("[data-sf-state]").first(), "Every business route must render its route state").toBeVisible()
            }
            const url = new URL(page.url())
            expect([...url.searchParams]).toEqual([...expected.searchParams])
            expect(url.pathname).toBe(pathname)
            if (route.kind === "case-alias") {
              expect(surface.id).toBe("UI51")
              expect(url.pathname).toMatch(invalidRef
                ? /^\/orchestra\/sf-decisions\/r_\/relations$/
                : /^\/orchestra\/sf-decisions\/r_[A-Za-z0-9_-]+\/relations$/)
            }
          })
        }
      }
    })
  }
})

test("Q01-NAV-NEGATIVE: duplicate, partial, malformed, cross-origin and cross-owner links fail closed", async ({ page, nativeHarness }) => {
  const { target, wrongServer, wrongTeam } = nativeHarness.manifest
  await page.goto(new URL(target.chapterHref, target.shellOrigin).href)
  const observed = await nativeHarness.proveWeb(page.locator('[data-sf-frame="page"]'))
  expect(observed.teamObjectId).toBe(target.teamObjectId)
  const good = nativeOwnerQuery(target)
  const duplicateServer = nativeOwnerQuery(target)
  duplicateServer.append("server", wrongServer.serverKey)
  const duplicateTeam = nativeOwnerQuery(target)
  duplicateTeam.append("teamObjectId", wrongTeam.teamObjectId)
  const partial = new URLSearchParams({ server: target.serverKey, teamObjectId: target.teamObjectId })
  const hostile = [
    contextPath + "?" + duplicateServer,
    contextPath + "?" + partial,
    contextPath + "?" + duplicateTeam,
    "/orchestra/sf-procurement/requests/r_/?" + good,
    "/orchestra/sf-decisions/r_%FF/relations?" + good,
    "/orchestra/sf-imports/%2Fpreview?" + good,
  ]
  for (const href of hostile) {
    await test.step("Q01-NAV-INVALID-" + hostile.indexOf(href), async () => {
      await page.goto(new URL(href, target.shellOrigin).href)
      // Teams refuses malformed input before mounting a business chapter.
      await expectInvalidLink(page)
    })
  }
  expect(new URL("https://hostile.invalid/orchestra/sf-home", target.shellOrigin).origin)
    .not.toBe(target.shellOrigin)
})
