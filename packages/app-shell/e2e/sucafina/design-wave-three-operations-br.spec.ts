import { expect, type Locator, type Page, type TestInfo } from "@playwright/test"
import { waveThreeTest, scheme, capture, reflow, reviewActions, scrollPageTop, observePage, enter } from "./design-support/wave-three"
import { waveThreeData } from "./design-support/wave-three-data"

const screens = [
  { id: "CAP11", path: "/orchestra/sf-operations/service", title: "IT Operations", br: "Serviço de TI" },
  { id: "CAP12", path: "/orchestra/sf-operations/security", title: "IT Security KPIs", br: "Segurança de TI" },
  { id: "CAP13", path: "/orchestra/sf-operations/risks", title: "IT Risks", br: "Riscos de TI" },
  { id: "CAP15", path: "/orchestra/sf-operations/stakeholders", title: "Stakeholder Management", br: "Relacionamento" },
  { id: "CAP16", path: "/orchestra/sf-operations/performance", title: "IT Performance Contract", br: "Contrato de performance" },
] as const
waveThreeTest("installed native operations · Portuguese desktop and 390px editors and reviews", async ({ browser, context, installation, owner }, info) => {
  waveThreeTest.setTimeout(240_000)
  expect(info.project.metadata.bundle).toBe("production")
  const cookies = await context.cookies(installation.origin + installation.mount)
  expect(cookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name))).toHaveLength(1)
  const localized = await browser.newContext({
    locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
    reducedMotion: "reduce", colorScheme: "dark",
    httpCredentials: { username: "orchestra", password: installation.serverPassword },
    storageState: { cookies, origins: [{ origin: installation.origin,
      localStorage: [{ name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) }] }] },
  })
  try {
    const page = await localized.newPage()
    page.setDefaultTimeout(15_000)
    const messages = observePage(page)
    const writes: string[] = []
    page.on("request", (request) => {
      const url = new URL(request.url())
      if (request.method() === "POST" && url.pathname.startsWith(installation.mount + "/")) writes.push(url.pathname)
    })
    for (const screen of screens) {
      await page.setViewportSize({ width: 1440, height: 1100 })
      await enter(page, owner, periodURL(screen, installation.origin, installation.year, installation.month), screen.br)
      await loaded(page, screen.id)
      await scheme(page, "dark")
      await capture(page, info, screen.id + "-operations-pt-BR-dark-desktop-test-data")
      await page.setViewportSize({ width: 390, height: 900 })
      await reflow(page)
      await scrollPageTop(page)
      await capture(page, info, screen.id + "-operations-pt-BR-dark-390-test-data")
      const surface = page.locator('[data-sf-surface="' + screen.id + '"]')
      if (screen.id === "CAP11") {
        await surface.getByRole("button", { name: "Editar níveis de serviço", exact: true }).click()
        await surface.getByLabel("SLA de incidentes", { exact: true }).fill("98.5")
      } else if (screen.id === "CAP12") {
        await surface.locator("[data-sf-security-campaign]").getByRole("button", { name: "Editar", exact: true }).click()
        await surface.getByLabel("Observações", { exact: true }).fill("Dados de teste · Revisão da campanha regional.")
      } else if (screen.id === "CAP13" || screen.id === "CAP15") {
        const name = screen.id === "CAP13" ? waveThreeData.operations.risk : waveThreeData.operations.stakeholder
        await surface.locator("tr[data-sf-row]").filter({ hasText: name })
          .getByRole("button", { name: "Abrir registro", exact: true }).click()
        await scrollPageTop(page)
        await capture(page, info, screen.id + "-detail-pt-BR-dark-390-test-data")
        await surface.locator("[data-sf-record-detail]").getByRole("button", { name: "Editar", exact: true }).click()
        await surface.getByLabel("Observações", { exact: true }).fill("Dados de teste · Rascunho em português.")
      } else {
        await surface.locator(".sf-u31-open").filter({ hasText: waveThreeData.operations.subitem }).click()
        await scrollPageTop(page)
        await capture(page, info, "CAP16-subitem-detail-pt-BR-dark-390-test-data")
        await surface.getByRole("button", { name: "Editar subitem", exact: true }).click()
        await surface.getByLabel("Observações", { exact: true }).fill("Dados de teste · Evidência trimestral.")
      }
      const editor = surface.locator("[data-sf-editor]")
      if (screen.id === "CAP13" || screen.id === "CAP15" || screen.id === "CAP16") await scrollableEditor(page)
      await editorGeometry(editor)
      await reflow(page)
      await scrollPageTop(page)
      await capture(page, info, screen.id + "-editor-pt-BR-dark-390-test-data")
      if (screen.id === "CAP12") {
        await panelCapture(page, info, "CAP12-departments-pt-BR-dark-390-test-data", editor.locator(".sf-security-departments"))
        await expect(editor.locator('input[name="department.0.users"]')).toHaveValue("70")
      }
      if (screen.id === "CAP16") {
        const quarters = editor.getByRole("group", { name: "Progresso por trimestre", exact: true })
        await expect(quarters.getByLabel("Q1", { exact: true })).toHaveValue("3")
        await expect(quarters.getByLabel("Status do 1º trimestre", { exact: true })).toHaveValue("on")
        await panelCapture(page, info, "CAP16-quarter-editor-pt-BR-dark-390-test-data", quarters)
      }
      await editor.getByRole("button", { name: "Revisar alterações", exact: true }).click()
      await reflow(page)
      await reviewActions(page)
      await capture(page, info, screen.id + "-review-pt-BR-dark-390-test-data")
      const review = surface.locator('[data-component="sf-change-review"]')
      if (screen.id === "CAP13") await expect(review).toContainText("Em acompanhamento")
      if (screen.id === "CAP15") await expect(review).toContainText("Requer plano de ação")
      await review.getByRole("button", { name: "Revisar", exact: true }).click()
      await expect(editor).toBeVisible()
      if (screen.id === "CAP11")
        await expect(editor.getByLabel("SLA de incidentes", { exact: true })).toHaveValue("98.5")
      else await expect(editor.getByLabel("Observações", { exact: true })).toHaveValue(/Dados de teste/)
    }
    expect(writes).toHaveLength(0)
    expect(messages.pageErrors).toEqual([])
    expect(messages.consoleErrors).toEqual([])
    await info.attach("native-operations-localized-evidence", {
      body: JSON.stringify({ areas: screens.map((screen) => screen.id), locale: "pt-BR",
        widths: [1440, 390], writes: writes.length, actualBrowserZoom: "not measured", ...messages }, null, 2),
      contentType: "application/json",
    })
  } finally {
    await localized.close()
  }
})

function periodURL(screen: typeof screens[number], origin: string, year: number, month: number) {
  const url = new URL(screen.path, origin)
  if (screen.id === "CAP11" || screen.id === "CAP12") {
    url.searchParams.set("year", String(year))
    url.searchParams.set("month", String(month))
  }
  return url.href
}

async function loaded(page: Page, id: typeof screens[number]["id"]) {
  const surface = page.locator('[data-sf-surface="' + id + '"]')
  await expect(surface).toBeVisible()
  await expect(surface).toHaveAttribute("data-sf-wave", "three")
  if (id === "CAP11") await expect(surface.locator(".sf-ops-metrics")).toBeVisible()
  else if (id === "CAP12") await expect(surface.locator("[data-sf-security-campaign]")).toHaveCount(1)
  else if (id === "CAP16") await expect(surface.locator("[data-sf-performance-item]")).toHaveCount(2)
  else await expect(surface.locator("tr[data-sf-row]").first()).toBeVisible()
  await reflow(page)
  await scrollPageTop(page)
}

async function scrollableEditor(page: Page) {
  const scroller = page.locator('[data-sf-frame="page"] .mx-page')
  const sizes = await scroller.evaluate((element) => ({ client: element.clientHeight, content: element.scrollHeight }))
  expect(sizes.client, "the frame receives bounded height through the native view wrapper").toBeGreaterThan(0)
  expect(sizes.content, "the long editor stays inside the native scroll region").toBeGreaterThan(sizes.client)
  await scroller.evaluate((element) => element.scrollTo({ top: element.scrollHeight, behavior: "instant" }))
  await expect.poll(() => scroller.evaluate((element) => element.scrollTop)).toBeGreaterThan(0)
  await scrollPageTop(page)
}

async function editorGeometry(editor: Locator) {
  await expect(editor).toBeVisible()
  const bounds = await editor.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.width).toBeLessThanOrEqual(760)
}

async function panelCapture(page: Page, info: TestInfo, name: string, panel: Locator) {
  await panel.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" }))
  await reflow(page)
  await capture(page, info, name)
}
