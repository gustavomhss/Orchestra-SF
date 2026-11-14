import { expect, test } from "@playwright/test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { release, tmpdir } from "node:os"
import path from "node:path"

test.describe.configure({ timeout: 180000, retries: 0 })

test("WP00 proves real browser zoom independently of Sucafina bootstrap", async ({ baseURL }, testInfo) => {
  expect(process.env.GITHUB_ACTIONS).toBe("true")
  if (!baseURL) throw new Error("The existing production Playwright configuration must supply its server")
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "wp00-zoom-"))
  const { Effect } = await import("effect")
  const { AppProcess } = await import("@orchestra/core/process")
  const { LayerNode } = await import("@orchestra/core/effect/layer-node")
  const { Omni } = await import("@orchestra/core/omni")
  const { scopedWp00Browser, setBrowserZoom } = await import("./browser.ts")
  const before = Omni.snapshot()
  try {
    await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const { browser, page, worker, extensionObservation } = yield* scopedWp00Browser(directory)
      yield* Effect.promise(async () => {
        await page.setViewportSize({ width: 1440, height: 900 })
        expect((await page.goto(baseURL))?.status()).toBe(200)
        await expect(page.locator("body")).toBeVisible()
        const normal = await setBrowserZoom(page, worker, 100)
        await setBrowserZoom(page, worker, 200)
        await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBe(normal.devicePixelRatio * 2)
        const enlarged = await setBrowserZoom(page, worker, 200)
        expect(enlarged.cssViewportWidth).toBeLessThan(normal.cssViewportWidth)
        expect(Math.abs(enlarged.cssViewportWidth * 2 - normal.cssViewportWidth)).toBeLessThanOrEqual(2)
        await setBrowserZoom(page, worker, 100)
        await expect.poll(() => page.evaluate(() => window.devicePixelRatio)).toBe(normal.devicePixelRatio)
        const restored = await setBrowserZoom(page, worker, 100)
        expect(restored.cssViewportWidth).toBe(normal.cssViewportWidth)
        const after = Omni.snapshot()
        expect(after.spawns - before.spawns).toBe(1)
        expect(after.delegations - before.delegations).toBe(0)
        await testInfo.attach("wp00-browser-zoom", { body: JSON.stringify({
          schema: "wp00-browser-zoom-observation-v1", executedSnapshotCommit: process.env.GITHUB_SHA,
          operatingSystem: `${process.platform} ${release()}`, browserVersion: browser.version(),
          scope: "Browser instrumentation against the existing production server; not Sucafina authentication, business flow or GNATIVE proof",
          viewport: { width: 1440, height: 900 }, normal, enlarged, restored, extensionObservation,
          processObservation: { spawns: after.spawns - before.spawns, delegations: after.delegations - before.delegations },
        }, null, 2), contentType: "application/json" })
      })
    })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))), { signal: AbortSignal.timeout(120_000) })
  } finally { await rm(directory, { recursive: true, force: true }) }
})
