import { expect } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult } from "@orchestra/schema/sucafina/context"
import { waveFourTest, enter, ready, scheme, reflow, scrollPageTop, observePage } from "./design-support/wave-four"
import { captureFinalSurface } from "./design-support/final-capture"
import { captureFinalRoutineGate } from "./design-support/final-routines-gate"
import { waveFourDecisionsData } from "./design-support/wave-four-decisions-data"

waveFourTest.use({ designWave: "four-decisions" })

const screens = [
  { id: "UI64", path: "/orchestra/sf-routines", en: "Routines", br: "Rotinas" },
  { id: "UI65", path: "/orchestra/sf-routines/runs", en: "Routine result", br: "Resultado da rotina" },
  { id: "UI66", path: "/orchestra/sf-routines/schedules", en: "Schedule", br: "Recorrência" },
  { id: "UI70", path: "/orchestra/sf-routines/residents", en: "Contributions", br: "Contribuições" },
] as const

waveFourTest("UI64 UI65 UI66 UI70 · installed routine inventory, read boundaries and owner-preserving navigation", async ({ page, browser, installation, owner }, info) => {
  waveFourTest.setTimeout(300_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle).toBe("production")
  const diagnostics = observePage(page)
  const writes: string[] = []
  const reads: { path: string; status: number }[] = []
  const limits: string[] = []
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (url.origin !== installation.origin || request.method() !== "POST") return
    if (/\/api\/ui\/(routines\/(prepare-admission|run)|schedules\/(create|update|pause))$/.test(url.pathname))
      writes.push(url.pathname)
  })
  page.on("response", (response) => {
    const url = new URL(response.url())
    if (url.origin === installation.origin && /\/api\/ui\/(routines|schedules|projections\/residents)/.test(url.pathname))
      reads.push({ path: url.pathname, status: response.status() })
  })
  const query = new URLSearchParams({ installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId })
  const response = await page.context().request.get(installation.origin + installation.mount + "/api/ui/context?" + query)
  expect(response.status()).toBe(200)
  const context = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(await response.json())
  expect(context.status).toBe("ok")
  if (context.status !== "ok") throw new Error("Original context did not admit the operator")
  const availability = context.value.availability.filter((entry) =>
    ["routine-admission", "routine-runs", "schedules", "residents"].includes(entry.resource))
  console.info("SF_FINAL_ROUTINES_AVAILABILITY " + JSON.stringify(availability))

  await waveFourTest.step("UI64 keeps case authority and unpublished admission visibly separate", async () => {
    await enter(page, owner, new URL(screens[0].path, installation.origin).href, screens[0].en)
    const surface = page.locator('[data-sf-surface="UI64"]')
    await expect(surface).toHaveAttribute("data-sf-wave", "six")
    await expect(surface.getByText("No published recipes were returned for this authorized case.", { exact: true })).toHaveCount(0)
    await expect(surface.locator(".sf-routine-inputs, .sf-routine-admission")).toHaveCount(0)
    await captureFinalSurface(page, info, "UI64", "en-dark-desktop-before-query", { preview: true })
    const cases = surface.getByLabel("Choose an existing authorized case", { exact: true })
    await expect(cases).toBeVisible()
    const chosenCase = cases.locator("option").filter({ hasText: waveFourDecisionsData.objective })
    await expect(chosenCase).toHaveCount(1)
    const caseValue = await chosenCase.getAttribute("value")
    if (!caseValue) throw new Error("The original decision case has no selector value")
    await cases.selectOption(caseValue)
    await expect(cases).toHaveValue(caseValue)
    await surface.getByRole("textbox", { name: "Task / purpose", exact: true }).fill("Design test data · Review the current authorized case")
    const recipes = surface.getByRole("button", { name: "Find published recipes", exact: true })
    if (await recipes.isEnabled()) {
      await recipes.click()
      await expect(surface.locator('[aria-busy="true"]')).toHaveCount(0)
      await expect(page.getByRole("button", { name: "Prepare routine", exact: true })).toBeDisabled()
      limits.push("UI64: the original catalog returned no admissible selected recipe; no preparation or execution was submitted.")
    } else {
      limits.push("UI64: the original context does not currently admit catalog discovery.")
    }
    await captureFinalSurface(page, info, "UI64", "en-dark-desktop-authorized-case", { preview: true })
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI64", "en-light-desktop-authorized-case", { preview: true })
    await page.setViewportSize({ width: 360, height: 900 })
    await reflow(page)
    await scrollPageTop(page)
    await captureFinalSurface(page, info, "UI64", "en-light-360-authorized-case")
    expect(writes).toEqual([])
  })

  await waveFourTest.step("UI65 opens the real catalog through the same owner selection", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL(screens[1].path, installation.origin).href, screens[1].en)
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI65"]')
    await expect(surface.getByText("Select an authorized routine run.", { exact: true })).toBeVisible()
    await expect(surface.getByText("Choose a routine run to inspect its status and result.", { exact: true })).toBeVisible()
    await expect(surface.getByText("No records yet.", { exact: true })).toHaveCount(0)
    const link = surface.locator("[data-sf-routine-catalog-link]")
    await expect(link).toBeVisible()
    const destination = await link.getAttribute("href")
    if (!destination) throw new Error("The catalog entry request is absent")
    const parsed = new URL(destination, installation.origin)
    expect(parsed.pathname).toBe("/orchestra/sf-routines")
    expect(parsed.searchParams.get("project")).toBe(owner.projectId)
    expect(parsed.searchParams.get("installation")).toBe(owner.installationId)
    expect(parsed.searchParams.get("server")).toBe(new URL(page.url()).searchParams.get("server"))
    await link.focus()
    await expect(link).toBeFocused()
    await captureFinalSurface(page, info, "UI65", "en-dark-desktop-no-run-return", { preview: true })
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI65", "en-light-desktop-no-run-return", { preview: true })
    await link.press("Enter")
    await ready(page, screens[0].en)
    await expect(page).toHaveURL((url) => url.pathname === screens[0].path &&
      url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
    limits.push("UI65: this original fixture has no governed C07 routine run or verified C08 output. Only the honest no-run state and real return navigation are qualified.")
    expect(writes).toEqual([])
  })

  await waveFourTest.step("UI66 preserves the original unavailable Schedule boundary", async () => {
    const source = availability.find((entry) => entry.resource === "schedules")
    expect(source?.state).toBe("unavailable")
    expect(source?.operations.every((entry) => entry.state === "unavailable" && !entry.operational)).toBe(true)
    const destination = new URL(screens[2].path, installation.origin)
    const selection = new URL(page.url()).searchParams
    for (const key of ["server", "project", "installation"]) {
      const value = selection.get(key)
      if (!value) throw new Error("The current owner selection is missing " + key)
      destination.searchParams.set(key, value)
    }
    await page.goto(destination.href)
    await scheme(page, "dark")
    await captureFinalRoutineGate(page, info, "en-dark-desktop")
    await scheme(page, "light")
    await page.setViewportSize({ width: 360, height: 900 })
    await captureFinalRoutineGate(page, info, "en-light-360")
    const explanation = page.locator('[data-sf-route-unavailable="UI66"]')
    await expect(explanation.getByRole("heading", { name: "Scheduling is unavailable", exact: true })).toBeVisible()
    const returnLink = explanation.getByRole("link", { name: "Back to routines", exact: true })
    const returnHref = await returnLink.getAttribute("href")
    if (!returnHref) throw new Error("The unavailable Schedule page has no catalog return request")
    const returnDestination = new URL(returnHref, installation.origin)
    expect(returnDestination.pathname).toBe(screens[0].path)
    for (const key of ["server", "project", "installation"])
      expect(returnDestination.searchParams.get(key)).toBe(destination.searchParams.get(key))
    await returnLink.focus()
    await expect(returnLink).toBeFocused()
    await returnLink.press("Enter")
    await ready(page, screens[0].en)
    await expect(page).toHaveURL((url) => url.pathname === screens[0].path &&
      url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
    limits.push("UI66: the real F01 gate refuses this route because no original native Schedule port is installed. These are gate captures; the leaf/editor and create/update/pause/occurrence flows are not qualified.")
    expect(writes).toEqual([])
  })

  await waveFourTest.step("UI70 reads actual resident inventory, filters it and rechecks a real decision case", async () => {
    await page.setViewportSize({ width: 1440, height: 1100 })
    await enter(page, owner, new URL(screens[3].path, installation.origin).href, screens[3].en)
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="UI70"]')
    await expect(surface).toHaveAttribute("data-state", "ready")
    const profiles = surface.locator(".sf-n29-resident-list > article")
    const maestro = profiles.filter({ has: page.getByRole("heading", { level: 2, name: "sf_maestro", exact: true }) })
    await expect(maestro).toHaveCount(1)
    await expect(maestro).toBeVisible()
    await captureFinalSurface(page, info, "UI70", "en-dark-desktop-resident-inventory", { preview: true })
    const filter = surface.getByLabel("Filter residents and skills", { exact: true })
    await filter.fill("No matching resident design test data")
    await expect(surface).toHaveAttribute("data-state", "filtered-empty")
    await filter.fill("")
    await expect(surface).toHaveAttribute("data-state", "ready")
    await maestro.getByRole("button", { name: "Open resident details", exact: true }).click()
    const detail = surface.locator(".sf-n29-resident-detail")
    await expect(detail).toBeVisible()
    const cases = surface.getByLabel("Authorized decision case", { exact: true })
    await expect(cases).toBeEnabled()
    const chosenCase = cases.locator("option").filter({ hasText: waveFourDecisionsData.objective })
    await expect(chosenCase).toHaveCount(1)
    const caseValue = await chosenCase.getAttribute("value")
    if (!caseValue) throw new Error("The original decision case has no selector value")
    await cases.selectOption(caseValue)
    await expect(cases).toHaveValue(caseValue)
    await expect(detail.locator('[aria-busy="true"]')).toHaveCount(0)
    await expect(detail.locator("[data-sf-contribution-proof]")).not.toHaveAttribute("data-state", "loading")
    await expect(detail.getByText("No currently verified contribution is available.", { exact: true })).toBeVisible()
    await expect(detail.getByRole("heading", { name: "Latest human decision", exact: true })).toBeVisible()
    await detail.scrollIntoViewIfNeeded()
    await captureFinalSurface(page, info, "UI70", "en-dark-desktop-resident-case-detail", { preview: true })
    await scheme(page, "light")
    await captureFinalSurface(page, info, "UI70", "en-light-desktop-resident-case-detail", { preview: true })
    await page.setViewportSize({ width: 360, height: 900 })
    await reflow(page)
    await detail.scrollIntoViewIfNeeded()
    await captureFinalSurface(page, info, "UI70", "en-light-360-resident-case-detail")
    limits.push("UI70: actual installed inventory and case-scoped reads are qualified; no attributed model execution or verified contribution is invented.")
    expect(writes).toEqual([])
  })

  const cookies = await page.context().cookies(installation.origin + installation.mount)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 360, height: 900 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    localized.setDefaultTimeout(15_000)
    const localizedDiagnostics = observePage(localized)
    for (const screen of screens) {
      await localized.setViewportSize({ width: 1440, height: 1100 })
      if (screen.id === "UI66") {
        const destination = new URL(screen.path, installation.origin)
        const selection = new URL(localized.url()).searchParams
        for (const key of ["server", "project", "installation"]) {
          const value = selection.get(key)
          if (!value) throw new Error("The original localized owner selection is missing " + key)
          destination.searchParams.set(key, value)
        }
        await localized.goto(destination.href)
        await scheme(localized, "dark")
        await localized.setViewportSize({ width: 360, height: 900 })
        await reflow(localized)
        await captureFinalRoutineGate(localized, info, "pt-br-dark-360")
        await localized.setViewportSize({ width: 1440, height: 1100 })
        await scheme(localized, "light")
        await captureFinalRoutineGate(localized, info, "pt-br-light-desktop")
        await localized.setViewportSize({ width: 360, height: 900 })
        continue
      }
      await enter(localized, owner, new URL(screen.path, installation.origin).href, screen.br)
      await scheme(localized, "dark")
      if (screen.id === "UI65") {
        await expect(localized.getByText("Escolha uma execução de rotina para consultar o estado e o resultado.", { exact: true })).toBeVisible()
      }
      await localized.setViewportSize({ width: 360, height: 900 })
      await reflow(localized)
      await captureFinalSurface(localized, info, screen.id, "pt-br-dark-360-installed-state", { preview: true })
      await localized.setViewportSize({ width: 1440, height: 1100 })
      await scheme(localized, "light")
      await reflow(localized)
      await captureFinalSurface(localized, info, screen.id, "pt-br-light-desktop-installed-state", { preview: true })
      await localized.setViewportSize({ width: 360, height: 900 })
    }
    expect(localizedDiagnostics.pageErrors).toEqual([])
  } finally {
    await portuguese.close()
  }
  expect(diagnostics.pageErrors).toEqual([])
  expect(writes).toEqual([])
  for (const description of limits) info.annotations.push({ type: "producer-boundary", description })
  console.info("SF_FINAL_ROUTINES_EVIDENCE " + JSON.stringify({ reads, writes, limits, ...diagnostics }))
  await info.attach("final-routines-installed-evidence", {
    contentType: "application/json",
    body: JSON.stringify({ availability, reads, writes, limits, ...diagnostics }, null, 2),
  })
})
