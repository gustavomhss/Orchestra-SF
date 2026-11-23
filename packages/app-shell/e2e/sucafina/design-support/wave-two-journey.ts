import { expect, type Browser, type Page, type TestInfo } from "@playwright/test"
import type { SfContext, SfInstallationDescriptor } from "@orchestra/schema/sucafina/context"
import type { DesignInstallation } from "./installation"
import { ServerConnection } from "../../../src/context/server-connection"
import { originalReads, type OriginalRead } from "./original-read"
import { waveTwoTest, observePage, ready, scheme, scrollPageTop, reflow, capture } from "./wave-two"

export const screens = [
  { id: "CAP02", path: "/orchestra/sf-dashboard/hot-topics", title: "Hot Topics & Actions", br: "Hot Topics e ações" },
  { id: "CAP03", path: "/orchestra/sf-dashboard/budget", title: "Budget Overview", br: "Visão do orçamento" },
  { id: "CAP04", path: "/orchestra/sf-dashboard/opex", title: "OPEX Detail", br: "Detalhamento de OPEX" },
] as const
export const newTopic = "Dados de teste · Consolidar a previsão de despesas regionais"
export const topicNotes = "Conferir os registros de origem e registrar a decisão antes de concluir a revisão."

export function beginWaveTwoCheck(page: Page, installation: DesignInstallation, owner: SfInstallationDescriptor, info: TestInfo) {
  // Each independent source journey keeps the original deadline and fixture.
  waveTwoTest.setTimeout(240_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle, "use the existing production runner").toBe("production")
  const messages = observePage(page)
  const mutations: string[] = []
  const sourceOrigins = new Set<string>()
  const watch = (target: Page) => target.on("request", (request) => {
    const url = new URL(request.url())
    if (url.pathname.startsWith(installation.mount + "/")) sourceOrigins.add(url.origin)
    if (request.method() === "POST" && url.pathname.startsWith(installation.mount + "/"))
      mutations.push(url.pathname)
  })
  watch(page)
  const href = (pathname: string) => {
    const url = new URL(pathname, installation.origin)
    url.searchParams.set("server", ServerConnection.key({ type: "http", http: { url: installation.origin } }))
    url.searchParams.set("project", owner.projectId)
    url.searchParams.set("installation", owner.installationId)
    return url.href
  }
  const enter = async (screen: typeof screens[number], target = page, portuguese = false, topics = 3) => {
    const admitted = await originalReads(target, owner, [
      { path: "/api/ui/context" }, { path: "/api/ui/pages/" + screen.id },
    ], () => target.goto(href(screen.path)))
    const context = (admitted.receipts[0]!.body as { value: SfContext }).value
    expect(context.stamp).toMatchObject({
      installationId: owner.installationId, projectId: owner.projectId, hostId: owner.hostId,
    })
    await ready(target, portuguese ? screen.br : screen.title)
    await expect(target).toHaveURL((url) => url.origin === installation.origin && url.pathname === screen.path &&
      url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
    if (screen.id === "CAP02") {
      await expect(target.locator("[data-sf-topic-list] [data-sf-topic]")).toHaveCount(topics)
      await expect(target.locator("[data-sf-topic-list]")).toContainText(installation.topicName)
    }
    if (screen.id === "CAP03") {
      await expect(target.locator('[data-sf-surface="CAP03"] [data-sf-metric="budget"]')).toHaveAttribute("data-sf-value", "number")
      await expect(target.locator('[data-sf-surface="CAP03"] [data-sf-metric="forecast"]')).toHaveAttribute("data-sf-value", "number")
    }
    if (screen.id === "CAP04") {
      await expect(target.locator('[data-sf-budget="CAP04"] tr[data-sf-row]')).toHaveCount(3)
      await expect(target.locator('[data-sf-budget="CAP04"] tr[data-sf-row]').filter({ hasText: installation.opexName })).toHaveCount(1)
    }
    await reflow(target)
    await scrollPageTop(target)
    return context
  }
  return { messages, mutations, sourceOrigins, watch, enter }
}

export function topicReferenceReads(context: SfContext): readonly OriginalRead[] {
  // The actual F01 response decides which original catalogues the detail will read.
  const capabilities = ["CAP13", "CAP15"].filter((capability) =>
    context.destinations.some((destination) => destination.capabilityId === capability && destination.canRead) &&
    context.availability.some((resource) => resource.operations.some((operation) =>
      operation.operationId === "domain.page." + capability && operation.state === "ready" && operation.operational)))
  expect(capabilities, "the canonical fixture's seeded risk is admitted by its original owner").toContain("CAP13")
  return capabilities.map((capability) => ({ path: "/api/ui/pages/" + capability }))
}

export async function captureCollection(page: Page, info: TestInfo, screen: typeof screens[number]) {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "dark")
  await capture(page, info, screen.id + "-dark-desktop-test-data")
  await page.setViewportSize({ width: 1440, height: 800 })
  await reflow(page)
  await capture(page, info, screen.id + "-dark-1440x800-test-data")
  await page.setViewportSize({ width: 1440, height: 1100 })
  await scheme(page, "light")
  await capture(page, info, screen.id + "-light-desktop-test-data")
  await page.setViewportSize({ width: 320, height: 900 })
  await reflow(page)
  await expect(page.locator('[data-sf-source-navigation="sf-dashboard"] a[aria-current="page"]')).toBeInViewport({ ratio: 1 })
  await scrollPageTop(page)
  await capture(page, info, screen.id + "-light-320-test-data")
}

export async function withPortuguese(
  page: Page, browser: Browser, installation: DesignInstallation, info: TestInfo,
  check: ReturnType<typeof beginWaveTwoCheck>, action: (localized: Page) => Promise<void>,
) {
  const localizedCookies = await page.context().cookies(installation.origin + installation.mount)
  expect(localizedCookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name)).length).toBe(1)
  const portuguese = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies: localizedCookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const localized = await portuguese.newPage()
    localized.setDefaultTimeout(15_000)
    const localizedMessages = observePage(localized)
    check.watch(localized)
    await action(localized)
    expect(localizedMessages.pageErrors).toEqual([])
    await info.attach("native-wave-two-localized-diagnostics", { body: JSON.stringify(localizedMessages, null, 2), contentType: "application/json" })
  } finally {
    await portuguese.close()
  }
}

export async function finishWaveTwoCheck(
  info: TestInfo, check: ReturnType<typeof beginWaveTwoCheck>, installation: DesignInstallation,
  views: readonly string[], writes: number, locales: readonly string[],
) {
  expect([...check.sourceOrigins]).toEqual([installation.origin])
  expect(check.mutations).toHaveLength(writes)
  expect(check.messages.pageErrors).toEqual([])
  await info.attach("native-wave-two-evidence", {
    body: JSON.stringify({ source: "isolated canonical producer data and original browser-confirmed commands",
      views, widths: [1440, 320], heights: [1100, 800, 900],
      schemes: ["dark", "light"], locales, actualBrowserZoom: "not measured",
      writes: check.mutations.length, ...check.messages }, null, 2),
    contentType: "application/json",
  })
}

export async function readablePeriods(page: Page, info: TestInfo, year: number, br: boolean) {
  const months = [
    { month: 1, label: br ? "janeiro de " : "January " },
    { month: 9, label: br ? "setembro de " : "September " },
    { month: 12, label: br ? "dezembro de " : "December " },
  ]
  for (const period of months) {
    await page.locator('tr[data-sf-month="' + period.month + '"]')
      .getByRole("button", { name: br ? "Salvar mês" : "Save month", exact: true }).click()
    const editor = page.locator('.sf-budget-editor[data-sf-action="save-entry"]')
    const field = editor.getByLabel(br ? "Mês" : "Month", { exact: true })
    await expect(field).toHaveValue(period.label + year)
    for (const width of [1440, 320]) {
      await page.setViewportSize({ width, height: width === 320 ? 900 : 1100 })
      await reflow(page)
      await field.scrollIntoViewIfNeeded()
      await expect(field).toBeInViewport()
      await expect.poll(() => field.evaluate((input) => input.scrollWidth - input.clientWidth), {
        message: "the complete read-only month and year fit at " + width + "px",
      }).toBeLessThanOrEqual(1)
      if (period.month === 9)
        await capture(page, info, "CAP04-" + (br ? "pt-BR" : "en-US") + "-dark-" + width + "-complete-period-test-data")
    }
    await editor.getByRole("button", { name: br ? "Cancelar" : "Cancel", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await page.setViewportSize({ width: 1440, height: 1100 })
  }
}

export async function fillTopic(page: Page, year: number, br: boolean) {
  const editor = page.locator("[data-sf-topic-editor]")
  await editor.getByLabel(br ? "Ação" : "Action", { exact: true }).fill(newTopic)
  await editor.getByLabel(br ? "Responsável" : "Owner", { exact: true }).fill("Operações regionais")
  await editor.getByLabel(br ? "Prazo" : "Due date", { exact: true }).fill(year + "-12-22")
  await editor.getByLabel(br ? "Situação" : "Status", { exact: true }).selectOption("open")
  await editor.getByLabel(br ? "Prioridade" : "Priority", { exact: true }).selectOption("high")
  await editor.getByLabel(br ? "Notas" : "Notes", { exact: true }).fill(topicNotes)
}
