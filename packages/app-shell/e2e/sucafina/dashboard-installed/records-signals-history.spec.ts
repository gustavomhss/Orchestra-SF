import { expect, test } from "@playwright/test"
import { Schema } from "effect"
import { SfProjectionReview, SfDashboardDashboardAgenda, SfReviewsReviewRead, SfDashboardDashboardReviewPreserve } from "@orchestra/schema/sucafina/reviews"
import { responseFor } from "../reports-support/model"
import { startPlannerInstallation } from "../wp03/installation-fixture"
import { addTopic, command, dashboardUrl, observeDashboardRequests, openTopic, topicRow, topicsPage } from "./support"

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
  const dashboard = installation.origin + "/sucafina/dashboard"
  let preserved: Extract<typeof SfReviewsReviewRead.output.Type, { status: "ok" }>["value"] | undefined
  try {
    await test.step("create durable Hot Topics through the mounted Dashboard", async () => {
      await installation.signIn(page)
      await page.goto(topics)
      await expect(page.getByRole("button", { name: "Sign out", exact: true })).toBeEnabled()
      topic = await addTopic(page, original, "2000-01-01")
      unrelated = await addTopic(page, survivor, "2099-12-31")
      await page.reload()
      await expect(topicRow(page, topic).getByRole("rowheader", { name: original, exact: true })).toBeVisible()
      await expect(topicRow(page, unrelated).getByRole("rowheader", { name: survivor, exact: true })).toBeVisible()
    })

    await test.step("preserve exactly the authorized record through a real native agenda", async () => {
      await page.goto("/orchestra/sf-reviews/agenda?year=2026")
      const agenda = page.locator('[data-sf-surface="UI47"]')
      await expect(agenda).toBeVisible()
      await agenda.getByLabel(/Source dashboard page|Página de origem do dashboard/).fill(topicsPage)
      const found = page.waitForResponse((response) => {
        const url = new URL(response.url())
        return response.request().method() === "GET" && url.pathname.endsWith("/api/ui/projections/review") &&
          url.searchParams.get("page") === topicsPage
      })
      await agenda.getByRole("button", { name: /Find authorized sections|Buscar seções autorizadas/ }).click()
      const discovery = await found
      expect(discovery.status()).toBe(200)
      const discovered = Schema.decodeUnknownSync(SfProjectionReview.output)(await discovery.json())
      if (discovered.status !== "ok" || !("items" in discovered.value)) throw new Error("Authorized review records were not provided")
      expect(discovered.value.items).toHaveLength(1)
      const item = discovered.value.items[0]!
      expect(item.topic).toBe("hot-topics")
      expect(item.recordOptions).toHaveLength(2)
      const choices = item.recordOptions?.filter((record) => record.recordId === topic) ?? []
      expect(choices).toHaveLength(1)
      const selected = choices[0]!
      expect(selected.label).toBe(original)
      expect(item.recordRefs).toContain(selected.recordRef)
      await agenda.getByRole("button", { name: /Add to agenda|Adicionar à pauta/ }).click()
      const section = agenda.locator("[data-sf-agenda-order] > li")
      await expect(section).toHaveCount(1)
      await expect(section).toHaveAttribute("data-section-id", item.id)
      for (const record of item.recordOptions ?? []) {
        if (record.recordId !== topic)
          await section.getByRole("button", { name: "Remove record " + record.recordRef, exact: true }).click()
      }
      await expect(section.locator("[data-sf-record-ref]")).toHaveCount(1)
      await expect(section.locator("[data-sf-record-ref]")).toHaveAttribute("data-sf-record-id", topic)
      await expect(section.locator("[data-sf-record-ref]")).toContainText(original)
      const pendingAgenda = page.waitForResponse(responseFor(dashboard, "dashboard-agenda", "POST"))
      await agenda.getByRole("button", { name: /Review selected sections|Revisar seções selecionadas/ }).click()
      const previewResponse = await pendingAgenda
      expect(previewResponse.status()).toBe(200)
      const request = Schema.decodeUnknownSync(SfDashboardDashboardAgenda.input)(previewResponse.request().postDataJSON())
      expect(request.sections).toHaveLength(1)
      expect(request.sections[0]!.recordRefs).toEqual([selected.recordRef])
      const preview = Schema.decodeUnknownSync(SfDashboardDashboardAgenda.output)(await previewResponse.json())
      if (preview.status !== "ok") throw new Error("The original agenda was not admitted")
      expect(preview.value.sections).toHaveLength(1)
      const captured = preview.value.sections[0]!
      expect(captured.id).toBe(item.id)
      expect(captured.recordCount).toBe(1)
      expect(captured.projection.context.sourceRefs.filter((source) => source.id === topic)).toHaveLength(1)
      expect(captured.projection.context.sourceRefs.some((source) => source.id === unrelated)).toBe(false)
      expect(captured.projection.values.some((value) => value.value === original)).toBe(true)
      expect(captured.projection.values.some((value) => value.value === survivor)).toBe(false)
      const shown = agenda.locator("[data-sf-agenda-preview]")
      await expect(shown).toContainText(original)
      await expect(shown.getByRole("table").getByRole("cell")).toHaveText(captured.projection.values.flatMap((value) => [
        value.id, `${value.value === null ? "Unavailable" : String(value.value)} ${value.currency ?? value.unit ?? ""}`.trim(),
        `${value.period.start} – ${value.period.end}`,
      ]))
      const saving = page.waitForResponse(responseFor(dashboard, "dashboard-review-preserve", "POST"))
      await agenda.getByRole("button", { name: /Confirm preservation|Confirmar preservação/ }).click()
      const savedResponse = await saving
      expect(savedResponse.status()).toBe(200)
      expect(savedResponse.request().postDataJSON()).toEqual({ selectionRef: preview.value.selectionRef, sectionRefs: [item.id] })
      const saved = Schema.decodeUnknownSync(SfDashboardDashboardReviewPreserve.output)(await savedResponse.json())
      if (saved.status !== "ok") throw new Error("The original producer did not preserve the selected record")
      preserved = saved.value
      expect(preserved.sections).toHaveLength(1)
      expect(preserved.sections[0]).toMatchObject({ id: item.id, count: 1, content: captured.projection })
      await expect(agenda.locator("[data-sf-preserved-confirmed]").locator("dd").first()).toHaveText(preserved.id)
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
      await competingEditor.getByRole("button", { name: "Review save", exact: true }).click()
      await command(other, competingEditor.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm save", exact: true }), "save")
      await expect(topicRow(other, topic).getByRole("rowheader", { name: competing, exact: true })).toBeVisible()
      await editor.getByRole("button", { name: "Review save", exact: true }).click()
      await command(page, editor.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm save", exact: true }), "save", 409)
      await expect(editor.locator("[data-topic-feedback]")).toHaveAttribute("data-topic-feedback", "conflict")
      await expect(editor.locator("[data-current-revision]")).toContainText("This topic changed. Review the current version before saving.")
      await expect(editor.getByLabel("Action", { exact: true })).toHaveValue(edited)
      await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue("Local edits survive the conflict")
      await editor.getByRole("button", { name: "Load current version and keep my edits", exact: true }).click()
      await expect(editor.locator("[data-current-revision]")).toContainText(competing)
      await expect(editor.locator("[data-current-revision]")).toContainText("Committed in the other page")
      await expect(editor.getByLabel("Action", { exact: true })).toHaveValue(edited)
      await editor.getByRole("button", { name: "Review save", exact: true }).click()
      await command(page, editor.locator('[data-component="sf-change-review"]').getByRole("button", { name: "Confirm save", exact: true }), "save")
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
      await topicRow(page, topic).getByRole("button", { name: "View details", exact: true }).click()
      const detail = page.locator("[data-sf-topic-detail]")
      await detail.getByRole("button", { name: "Delete topic", exact: true }).click()
      const review = detail.locator('[data-component="sf-change-review"]')
      await expect(review).toContainText(edited)
      await review.getByRole("button", { name: "Cancel review", exact: true }).click()
      await expect(review).toBeHidden()
      await page.goto(topics)
      await other.reload()
      await expect(topicRow(other, topic).getByRole("rowheader", { name: edited, exact: true })).toBeVisible()
      expect(deletes).toBe(0)
      page.off("request", countDelete)
      const editor = await openTopic(page, topic)
      await editor.getByLabel("Notes", { exact: true }).fill("This unsaved note must be discarded")
      await editor.getByRole("button", { name: "Back to topics", exact: true }).click()
      const discard = editor.getByRole("group", { name: "Discard these unsaved edits?", exact: true })
      await expect(discard).toBeVisible()
      await discard.getByRole("button", { name: "Cancel", exact: true }).click()
      await expect(editor.getByLabel("Notes", { exact: true })).toHaveValue("This unsaved note must be discarded")
      await editor.getByRole("button", { name: "Back to topics", exact: true }).click()
      await expect(discard).toBeVisible()
      await discard.getByRole("button", { name: "Discard draft", exact: true }).click()
      await expect(editor).toBeHidden()
      await page.reload()
      const reopened = await openTopic(page, topic)
      await expect(reopened.getByLabel("Notes", { exact: true })).toHaveValue("Local edits survive the conflict")
      await reopened.getByRole("button", { name: "Back to topics", exact: true }).click()
    })

    await test.step("reopen the preserved values after the source changes and a full reload", async () => {
      if (!preserved) throw new Error("The record was not preserved by its original producer")
      const reopened = page.waitForResponse(responseFor(dashboard, "review-read", "GET"))
      await page.goto("/orchestra/sf-reviews/reviews/r_" + Buffer.from(preserved.id).toString("base64url"))
      const response = await reopened
      expect(response.status()).toBe(200)
      const read = Schema.decodeUnknownSync(SfReviewsReviewRead.output)(await response.json())
      expect(read).toEqual({ status: "ok", value: preserved })
      const article = page.locator('[data-sf-surface="UI48"]').locator('article[data-review-ref="' + preserved.id + '"]')
      await expect(article).toHaveAttribute("data-review-version", String(preserved.version))
      await expect(article).toContainText(original)
      await expect(article).not.toContainText(edited)
      const pendingReload = page.waitForResponse(responseFor(dashboard, "review-read", "GET"))
      await page.reload()
      const reloaded = await pendingReload
      expect(reloaded.status()).toBe(200)
      expect(Schema.decodeUnknownSync(SfReviewsReviewRead.output)(await reloaded.json()))
        .toEqual({ status: "ok", value: preserved })
      await expect(article).toHaveAttribute("data-review-version", String(preserved.version))
      await expect(article).toContainText(original)
      await expect(article).not.toContainText(edited)
      await info.attach("dashboard-installed-history.png", { body: await page.screenshot({ fullPage: true }), contentType: "image/png" })
    })

    await test.step("prioritize real signals and follow record and application links", async () => {
      await page.goto(dashboardUrl(installation.origin, "IT Risks"))
      await page.getByRole("button", { name: "New risk", exact: true }).click()
      const risk = page.locator('[data-sf-surface="CAP13"] form.sf-u30-editor')
      await risk.getByLabel("Risk title", { exact: true }).fill("M67 Installed high risk")
      await risk.getByLabel("Risk description", { exact: true }).fill("Installed operational risk")
      await risk.getByRole("combobox", { name: "Impact", exact: true }).selectOption("4")
      await risk.getByRole("combobox", { name: "Probability", exact: true }).selectOption("4")
      await risk.getByRole("combobox", { name: "Status", exact: true }).selectOption("open")
      await risk.getByRole("button", { name: "Review changes", exact: true }).click()
      const riskReview = page.locator('[data-sf-surface="CAP13"] [data-component="sf-change-review"]')
      await expect(riskReview).toContainText("M67 Installed high risk")
      await command(page, riskReview.getByRole("button", { name: "Save", exact: true }), "save")
      await expect(page.getByRole("cell", { name: "M67 Installed high risk", exact: true })).toBeVisible()
      const executive = dashboardUrl(installation.origin, "Executive Dashboard", { execYear: "2026", executiveMonth: "11" })
      await page.goto(executive)
      const signals = page.locator("[data-dashboard-signals]")
      const signalRow = signals.getByRole("row").filter({ has: signals.getByRole("rowheader", { name: edited, exact: true }) })
      await expect(signalRow).toBeVisible()
      await expect(signals.getByRole("rowheader", { name: "M67 Installed high risk", exact: true })).toBeVisible()
      await signalRow.getByRole("button", { name: "Prioritize", exact: true }).click()
      expect(new URL(page.url()).searchParams.getAll("signalPriority")).toEqual([`hotTopics:${topic}`])
      await page.reload()
      await expect(signalRow.getByRole("button", { name: "Remove priority", exact: true })).toHaveAttribute("aria-pressed", "true")
      await signalRow.getByRole("button", { name: "Open record", exact: true }).click()
      await expect(page.locator("[data-sf-topic-detail]").getByRole("heading", { name: edited, exact: true })).toBeVisible()
      const linked = new URL(page.url())
      expect(linked.pathname).toBe("/orchestra/sf-dashboard/hot-topics/r_" + Buffer.from(topic).toString("base64url"))
      expect(linked.searchParams.get("year")).toBe("2026")
      expect(linked.searchParams.get("month")).toBe("11")
      const navigation = page.locator('aside[data-component="orchestra-sidebar"]')
      const advanced = navigation.locator('button[aria-controls="orchestra-advanced-navigation"]')
      if (await advanced.getAttribute("aria-expanded") !== "true") await advanced.click()
      await navigation.locator('button[data-nav-id="sf-planner"]').click()
      await expect(page.locator('[data-sf-surface="CAP17"]')).toBeVisible()
      expect(new URL(page.url()).pathname).toBe("/orchestra/sf-planner/overview")
      await navigation.locator('button[data-nav-id="sf-procurement"]').click()
      await expect(page.locator('[data-sf-surface="CAP25"]')).toBeVisible()
      expect(new URL(page.url()).pathname).toBe("/orchestra/sf-procurement/requests")
      await navigation.locator('button[data-nav-id="sf-dashboard"]').click()
      await expect(page.locator('[data-sf-surface="CAP01"]')).toBeVisible()
      expect(new URL(page.url()).pathname).toBe("/orchestra/sf-dashboard/executive")
    })

    await test.step("withdraw the confirmed record and preserve unrelated records after reload", async () => {
      await page.goto(topics)
      await topicRow(page, topic).getByRole("button", { name: "View details", exact: true }).click()
      const detail = page.locator("[data-sf-topic-detail]")
      await detail.getByRole("button", { name: "Delete topic", exact: true }).click()
      const review = detail.locator('[data-component="sf-change-review"]')
      await expect(review).toContainText(edited)
      await command(page, review.getByRole("button", { name: "Confirm deletion", exact: true }), "delete")
      await page.goto(topics)
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
