import { expect, test } from "@playwright/test"
import { startPlannerInstallation } from "../wp03/installation-fixture"
import { addTopic, command, confirmDialog, dashboardUrl, hostCommand, observeDashboardRequests, openTopic, topicRow, topicsPage } from "./support"

// The existing production fixture enrolls an operator, runs the installed CLI and
// owns an isolated durable store. Never retain the session cookie in a trace.
test.use({ trace: "off" })

test("installed Dashboard preserves records, conflicts, signals and authorized history", async ({ page }, info) => {
  test.setTimeout(180_000)
  const installation = await startPlannerInstallation(info)
  const errors: string[] = []
  page.on("pageerror", (error) => errors.push(error.message))
  const other = await page.context().newPage()
  other.on("pageerror", (error) => errors.push(error.message))
  const transport = observeDashboardRequests(info, [{ page, label: "primary" }, { page: other, label: "other" }])
  const topics = dashboardUrl(installation.origin, topicsPage)
  const original = "M67 Installed original action"
  const edited = "M67 Installed reviewed action"
  const competing = "M67 Installed competing action"
  const survivor = "M67 Installed unrelated action"
  let topic = "", unrelated = ""
  try {
    await test.step("create durable Hot Topics through the mounted Dashboard", async () => {
      await page.context().addCookies([installation.cookie])
      await page.goto(topics)
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
      topic = await addTopic(page, original, "2000-01-01")
      unrelated = await addTopic(page, survivor, "2099-12-31")
      await page.reload()
      await expect(topicRow(page, topic).getByRole("rowheader", { name: original, exact: true })).toBeVisible()
      await expect(topicRow(page, unrelated).getByRole("rowheader", { name: survivor, exact: true })).toBeVisible()
    })

    await test.step("preserve a real record and preview a real agenda", async () => {
      await page.locator("[data-dashboard-workbench-panel] > summary").click()
      const workbench = page.getByRole("region", { name: "Revisão e ações do Dashboard", exact: true })
      await hostCommand(page, workbench.getByRole("button", { name: "Carregar opções", exact: true }), "dashboard-workbench")
      await expect(workbench.locator("[data-dashboard-status]")).toContainText("Opções carregadas.")
      await hostCommand(page, workbench.getByRole("button", { name: "Pré-visualizar pauta", exact: true }), "dashboard-agenda")
      await expect(workbench.locator("[data-dashboard-agenda-view]")).toContainText(original)
      await workbench.getByRole("combobox", { name: "Registro para preservar", exact: true }).selectOption({ label: original })
      await hostCommand(page, workbench.getByRole("button", { name: "Preservar retrato", exact: true }), "dashboard-capture")
      await expect(workbench.locator("[data-dashboard-status]")).toHaveText("Retrato do registro preservado.")
      await page.goto(topics)
    })

    await test.step("retain a dirty editor through a real competing write and explicit conflict review", async () => {
      const editor = await openTopic(page, topic)
      await editor.getByLabel("Action", { exact: true }).fill(edited)
      await editor.getByLabel("Notes", { exact: true }).fill("Local edits survive the conflict")
      await other.goto(topics)
      const competingEditor = await openTopic(other, topic)
      await competingEditor.getByLabel("Action", { exact: true }).fill(competing)
      await competingEditor.getByLabel("Notes", { exact: true }).fill("Committed in the other page")
      await command(other, competingEditor.getByRole("button", { name: "Save", exact: true }), "save")
      await expect(topicRow(other, topic).getByRole("rowheader", { name: competing, exact: true })).toBeVisible()
      await command(page, editor.getByRole("button", { name: "Save", exact: true }), "save", 409)
      await expect(editor.getByRole("status")).toContainText("This record changed since you opened it.")
      await expect(editor.getByLabel("Action", { exact: true })).toHaveValue(edited)
      await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue("Local edits survive the conflict")
      await editor.getByRole("button", { name: "Load current version and keep my edits", exact: true }).click()
      await expect(editor.locator("[data-current-revision]")).toContainText(competing)
      await expect(editor.locator("[data-current-revision]")).toContainText("Committed in the other page")
      await expect(editor.getByLabel("Action", { exact: true })).toHaveValue(edited)
      await command(page, editor.getByRole("button", { name: "Save", exact: true }), "save")
      await expect(editor).toBeHidden()
      await page.reload()
      await expect(topicRow(page, topic).getByRole("rowheader", { name: edited, exact: true })).toBeVisible()
      await other.reload()
      await expect(topicRow(other, topic).getByRole("rowheader", { name: edited, exact: true })).toBeVisible()
    })

    await test.step("cancel withdrawal and discard only the unsaved editor", async () => {
      let deletes = 0
      const countDelete = (request: import("@playwright/test").Request) => {
        if (request.method() === "POST" && new URL(request.url()).pathname === "/sucafina/dashboard" && request.postDataJSON()?.action === "delete") deletes++
      }
      page.on("request", countDelete)
      await confirmDialog(page, topicRow(page, topic).getByRole("button", { name: "Delete", exact: true }), "Confirm this change?", false)
      await other.reload()
      await expect(topicRow(other, topic).getByRole("rowheader", { name: edited, exact: true })).toBeVisible()
      expect(deletes).toBe(0)
      page.off("request", countDelete)
      const editor = await openTopic(page, topic)
      await editor.getByLabel("Notes", { exact: true }).fill("This unsaved note must be discarded")
      await confirmDialog(page, editor.getByRole("button", { name: "Close editor", exact: true }), "Discard unsaved changes?", false)
      await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue("This unsaved note must be discarded")
      await confirmDialog(page, editor.getByRole("button", { name: "Close editor", exact: true }), "Discard unsaved changes?", true)
      await expect(editor).toBeHidden()
      await page.reload()
      const reopened = await openTopic(page, topic)
      await expect(reopened.getByLabel("Notes", { exact: true })).toHaveValue("Local edits survive the conflict")
      await reopened.getByRole("button", { name: "Close editor", exact: true }).click()
    })

    await test.step("reopen the preserved values after the source changes and a full reload", async () => {
      await page.reload()
      await page.locator("[data-dashboard-workbench-panel] > summary").click()
      const workbench = page.getByRole("region", { name: "Revisão e ações do Dashboard", exact: true })
      await hostCommand(page, workbench.getByRole("button", { name: "Carregar opções", exact: true }), "dashboard-workbench")
      await expect(workbench.locator("[data-dashboard-status]")).toContainText("Opções carregadas.")
      const history = workbench.getByRole("combobox", { name: "Reunião ou retrato preservado", exact: true })
      const option = history.locator("option").filter({ hasText: original })
      await expect(option).toHaveCount(1)
      const value = await option.getAttribute("value")
      if (!value) throw new Error("The preserved record is absent from authorized history")
      await history.selectOption(value)
      await hostCommand(page, workbench.getByRole("button", { name: "Abrir histórico", exact: true }), "dashboard-history")
      await expect(workbench.locator("[data-dashboard-history-view]")).toContainText(original)
      await expect(workbench.locator("[data-dashboard-history-view]")).not.toContainText(edited)
      await expect(workbench.locator("[data-dashboard-status]")).toHaveText("Histórico aberto com seu acesso atual.")
      await info.attach("dashboard-installed-history.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
    })

    await test.step("prioritize real signals and follow record and application links", async () => {
      await page.goto(dashboardUrl(installation.origin, "IT Risks"))
      await page.getByText("Add risk", { exact: true }).click()
      const risk = page.locator('form[data-page="IT Risks"][data-command="save"][data-record=""]')
      await risk.getByLabel("Risk title", { exact: true }).fill("M67 Installed high risk")
      await risk.getByLabel("Risk description", { exact: true }).fill("Installed operational risk")
      await risk.getByRole("combobox", { name: "Impact", exact: true }).selectOption("4")
      await risk.getByRole("combobox", { name: "Probability", exact: true }).selectOption("4")
      await risk.getByRole("combobox", { name: "Status", exact: true }).selectOption("open")
      await command(page, risk.getByRole("button", { name: "Add record", exact: true }), "save")
      await expect(page.getByRole("cell", { name: "M67 Installed high risk", exact: true })).toBeVisible()
      const executive = dashboardUrl(installation.origin, "Executive Dashboard", { execYear: "2026", executiveMonth: "11" })
      await page.goto(executive)
      const signals = page.locator("[data-dashboard-signals]")
      const signalRow = signals.getByRole("row").filter({ has: signals.getByRole("cell", { name: edited, exact: true }) })
      await expect(signalRow).toBeVisible()
      await expect(signals.getByRole("cell", { name: "M67 Installed high risk", exact: true })).toBeVisible()
      await signalRow.getByRole("button", { name: `Prioritize ${edited}`, exact: true }).click()
      expect(new URL(page.url()).searchParams.getAll("signalPriority")).toEqual([`hotTopics:${topic}`])
      await page.reload()
      await expect(signalRow.getByRole("button", { name: `Remove priority for ${edited}`, exact: true })).toHaveAttribute("aria-pressed", "true")
      await signalRow.getByRole("link", { name: "Open record", exact: true }).click()
      await expect(topicRow(page, topic)).toBeVisible()
      const linked = new URL(page.url())
      expect(linked.searchParams.get("page")).toBe(topicsPage)
      expect(linked.searchParams.get("year")).toBe("2026")
      expect(linked.searchParams.get("execYear")).toBe("2026")
      expect(linked.searchParams.get("executiveMonth")).toBe("11")
      expect(linked.hash).toBe(`#record-${topic}`)
      const applications = page.getByRole("navigation", { name: "Applications", exact: true })
      await applications.getByRole("link", { name: "Budget Planner", exact: true }).click()
      await expect(page.locator("body")).toHaveAttribute("data-surface", "planner")
      expect(new URL(page.url()).pathname).toBe("/sucafina/planner")
      await applications.getByRole("link", { name: "Procurement", exact: true }).click()
      await expect(page.locator("body")).toHaveAttribute("data-surface", "procurement")
      expect(new URL(page.url()).pathname).toBe("/sucafina/procurement")
      await applications.getByRole("link", { name: "Dashboard", exact: true }).click()
      await expect(page.locator("body")).toHaveAttribute("data-surface", "dashboard")
    })

    await test.step("withdraw the confirmed record and preserve unrelated records after reload", async () => {
      await page.goto(topics)
      const pending = page.waitForResponse((response) => response.request().method() === "POST" &&
        new URL(response.url()).pathname === "/sucafina/dashboard" && response.request().postDataJSON()?.action === "delete", { timeout: 15_000 })
      await confirmDialog(page, topicRow(page, topic).getByRole("button", { name: "Delete", exact: true }), "Confirm this change?", true)
      const response = await pending
      expect(response.status()).toBe(200)
      expect(await response.json()).toMatchObject({ ok: true })
      await expect(topicRow(page, topic)).toHaveCount(0)
      await page.reload()
      await expect(topicRow(page, topic)).toHaveCount(0)
      await expect(topicRow(page, unrelated).getByRole("rowheader", { name: survivor, exact: true })).toBeVisible()
      await page.goto(dashboardUrl(installation.origin, "Executive Dashboard"))
      await expect(page.locator("[data-dashboard-signals]")).not.toContainText(edited)
      await expect(page.locator("[data-dashboard-signals]")).toContainText("M67 Installed high risk")
      await info.attach("dashboard-installed-withdrawal.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
    })
    expect(errors).toEqual([])
  } finally {
    try { await transport() } finally { try { await other.close() } finally { await installation.stop() } }
  }
})
