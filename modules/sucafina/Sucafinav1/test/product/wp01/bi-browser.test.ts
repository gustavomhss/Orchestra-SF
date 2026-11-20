import { expect } from "bun:test"
import { closeWp01Browser, launchWp01Browser } from "./browser-fixture.ts"
import { createMicrosoftComponentFixture } from "./microsoft-component-fixture.ts"
import { createSfBiHttp } from "../../../product/integration/bi-http.ts"
import biBrowser from "../../../product/integration/generated/bi-entry.txt" with { type: "text" }

// Registered once by browser-selection.test.ts; importing this source registers no tests.
export function registerPoolTests(test: typeof import("bun:test").test) {
  test("authenticated BI renders, filters and fails closed after session revocation", async () => {
    const host = await createMicrosoftComponentFixture({ names: ["BI reviewer", "Other reviewer"] })
    const { origin, persistence, environment } = host
    let failure: unknown
    try {
      await persistence.initializeSources("dashboard")
      await persistence.transaction("dashboard", async (snapshot) => {
        snapshot.data.opexOwners = [{ id: "owner", name: "Owner", budget: 1200 }]
        snapshot.data.opexEntries = [{ id: "jan", ownerId: "owner", year: 2026, month: 1, budget: 100, actual: 50, forecast: 0 }]
        snapshot.data.projects = [{ id: "project", name: "Project", notes: "private project note", milestones: [{ id: "launch", name: "Launch", date: "2026-03-05", status: "done", notes: "private milestone note" }, { id: "later", name: "Later", date: "2026-09-01", status: "late" }] }]
        return { commit: true, value: undefined }
      })
      const product = createSfBiHttp({ installationId: host.technical.installationId, projectId: host.technical.projectId, policyVersion: "sf-product-v1", origin, mount: "/sucafina", persistence, authenticate: host.boundary.identity.authenticate, environment, browserScript: async () => biBrowser })
      host.mount({ product })
      const browser = await launchWp01Browser()
      let browserFailure: unknown
      try {
        const context = await host.newContext(browser)
        const page = await context.newPage()
        const pageErrors: string[] = []
        page.on("pageerror", (error) => { pageErrors.push(error.message) })
        await host.loginPage(page)
        await page.goto(`${origin}/sucafina/dashboard?sf=bi&viewId=BI01&start=2026-01-01&end=2026-12-31`)
        await page.getByText("Visualização atualizada para 2026-01-01 – 2026-12-31 (meses completos).").waitFor()
        expect(await page.locator("[data-sf-bi] table").count()).toBeGreaterThan(0)
        expect(await page.locator("[data-sf-bi] svg").count()).toBeGreaterThan(0)
        const source = page.locator("[data-sf-bi] [data-bi-focus]").first()
        const focused = await source.getAttribute("data-bi-focus")
        expect(focused).toBeTruthy()
        await source.click()
        await page.waitForURL((value) => value.searchParams.has("page") && !value.searchParams.has("sf"))
        const fresh = page.waitForResponse((response) => new URL(response.url()).searchParams.get("sf") === "bi-data")
        await page.goBack()
        expect((await fresh).status()).toBe(200)
        await page.waitForFunction((id) => document.activeElement?.getAttribute("data-bi-focus") === id, focused)
        await page.getByLabel("Visualização", { exact: true }).selectOption("BI08")
        await page.getByLabel("Início", { exact: true }).fill("2026-02-15")
        await page.getByLabel("Fim", { exact: true }).fill("2026-05-15")
        const filtered = page.waitForResponse((response) => {
          const url = new URL(response.url())
          return url.searchParams.get("sf") === "bi-data" && url.searchParams.get("viewId") === "BI08"
        })
        await page.getByRole("button", { name: "Atualizar visualização" }).click()
        const response = await filtered
        if (!response.ok()) {
          await page.getByText("Visualização indisponível. Verifique o período e tente novamente.").waitFor()
          throw new Error(`BI08 filter HTTP ${response.status()}: ${await response.text()}; UI: ${await page.locator("[data-sf-bi] [role=status]").first().textContent()}; page errors: ${pageErrors.join("; ")}`)
        }
        await page.getByText("Visualização atualizada para 2026-02-15 – 2026-05-15.").waitFor()
        await page.getByRole("button", { name: "Abrir Launch" }).waitFor()
        expect(await page.getByText("Later", { exact: true }).count()).toBe(0)
        expect(await page.getByText("private milestone note", { exact: true }).count()).toBe(0)
        expect(await page.getByText("done", { exact: true }).count()).toBe(0)
        await page.getByLabel("Arrastar início do período").evaluate((node: HTMLInputElement) => { node.value = "5"; node.dispatchEvent(new Event("input", { bubbles: true })) })
        const brushed = page.waitForResponse((response) => {
          const url = new URL(response.url())
          return url.searchParams.get("sf") === "bi-data" && url.searchParams.get("viewId") === "BI08" && url.searchParams.get("start") === "2026-02-20"
        })
        await page.getByRole("button", { name: "Aplicar filtro" }).click()
        expect((await brushed).status()).toBe(200)
        await page.getByText("Visualização atualizada para 2026-02-20 – 2026-05-15.").waitFor()
        await page.getByRole("button", { name: "Abrir Launch" }).waitFor()
        expect(await page.evaluate(async () => (await fetch("/sucafina/auth/logout", { method: "POST", credentials: "same-origin" })).status)).toBe(204)
        await page.getByRole("button", { name: "Atualizar visualização" }).click()
        await page.getByText("Visualização indisponível. Verifique o período e tente novamente.").waitFor()
        expect(await page.locator("[data-sf-bi] table").count()).toBe(0)
        expect(pageErrors).toEqual([])
      } catch (error) { browserFailure = error; throw error }
      finally {
        try { await closeWp01Browser(browser) } catch (error) { throw new AggregateError([...(browserFailure ? [browserFailure] : []), error], "BI browser cleanup failed") }
      }
    } catch (error) { failure = error; throw error }
    finally {
      try { await host.close() } catch (error) { throw new AggregateError([...(failure ? [failure] : []), error], "BI component cleanup failed") }
    }
  }, 60000)
}
