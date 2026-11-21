import { expect, type Locator, type Page } from "@playwright/test"
import { waveFourTest, enter, ready, observePage, scheme, reflow, capture, scrollPageTop, reviewActions } from "./design-support/wave-four"
import { waveFourProcurementData } from "./design-support/wave-four-procurement-data"

const screens = [
  { id: "CAP24", path: "/orchestra/sf-procurement/overview", title: "Dashboard", br: "Visão de Procurement" },
  { id: "CAP25", path: "/orchestra/sf-procurement/requests", title: "Requests", br: "Pedidos" },
  { id: "CAP26", path: "/orchestra/sf-procurement/approvals", title: "My approvals", br: "Minhas aprovações" },
  { id: "CAP27", path: "/orchestra/sf-procurement/suppliers", title: "Suppliers", br: "Fornecedores" },
  { id: "CAP28", path: "/orchestra/sf-procurement/settings", title: "Settings", br: "Configuração" },
] as const

waveFourTest("installed procurement wave · lists, drafts, source reviews and confirmed commands", async ({
  page, browser, installation, owner,
}, info) => {
  waveFourTest.setTimeout(420_000)
  page.setDefaultTimeout(15_000)
  expect(info.project.metadata.bundle, "maintained production browser runner").toBe("production")
  const data = waveFourProcurementData
  const messages = observePage(page)
  const posts: string[] = []
  const origins = new Set<string>()
  page.on("request", (request) => {
    const url = new URL(request.url())
    if (!url.pathname.startsWith(installation.mount + "/")) return
    origins.add(url.origin)
    if (request.method() === "POST") posts.push(url.pathname)
  })
  const go = (screen: typeof screens[number], target = page, portuguese = false) =>
    enter(target, owner, new URL(screen.path, installation.origin).href, portuguese ? screen.br : screen.title)
  const record = (path: string, title = "Requests") =>
    enter(page, owner, new URL(path, installation.origin).href, title)
  const desktop = async () => { await page.setViewportSize({ width: 1440, height: 1100 }); await reflow(page) }
  const narrow = async () => { await page.setViewportSize({ width: 320, height: 900 }); await reflow(page) }
  const review = page.locator('[data-component="sf-change-review"]')
  const reviewOverview = async () => {
    await expect(review).toBeVisible()
    await scrollPageTop(page)
    await review.evaluate((element) => element.scrollIntoView({ block: "start", inline: "nearest", behavior: "instant" }))
    await expect(review.getByRole("heading", { level: 2 })).toBeInViewport()
  }
  const references = new Map<string, string>()
  const requestRef = (name: string) => {
    const ref = references.get(name)
    if (!ref) throw new Error("Rendered producer request reference missing: " + name)
    return ref
  }
  const confirm = async (label: string) => {
    const before = posts.length
    const responsePending = page.waitForResponse((response) =>
      response.request().method() === "POST" &&
      new URL(response.url()).pathname === installation.mount + "/procurement").catch(() => null)
    await review.getByRole("button", { name: label, exact: true }).click()
    await expect.poll(() => posts.length, { message: "one explicit confirmation sends one original producer command" }).toBe(before + 1)
    const response = await responsePending
    if (!response) throw new Error("The original producer did not return a command response.")
    const body: unknown = await response.json().catch(() => null)
    const result = body && typeof body === "object" ? body as Record<string, unknown> : {}
    // Only bounded status/error enums are logged: never request values, headers,
    // source records, actor identity or opaque owner/intent credentials.
    const codes = Array.isArray(result.errors) ? result.errors.filter((value): value is string =>
      typeof value === "string" && /^[a-z][a-z0-9_-]{0,63}$/.test(value)).slice(0,8) : []
    console.info("SF_DESIGN_COMMAND " + JSON.stringify({
      ordinal: before + 1, status: response.status(), confirmed: result.ok === true, codes,
    }))
    expect(response.status(), "the original producer explicitly accepted this confirmation").toBe(200)
    expect(result.ok === true, "a successful HTTP status must include the original acknowledgement").toBe(true)
    await expect(review).toHaveCount(0)
    const host = page.locator('[data-sf-host="owner-runtime231"]')
    await expect(host).toHaveAttribute("data-sf-provider-state", "ready")
    await expect(host).toHaveAttribute("data-sf-view-state", "ready")
    await expect(host.locator('[data-sf-frame="page"]')).toHaveCount(1)
    await expect(host.locator('[aria-busy="true"]')).toHaveCount(0)
  }
  const assertRowStatus = async (name: string, status: string) => {
    await go(screens[1])
    await expect(requestRow(page, name)).toContainText(status)
  }

  await waveFourTest.step("CAP24 · source totals, one ledger, status filter and keyboard focus", async () => {
    await go(screens[0])
    await scheme(page, "dark")
    const surface = page.locator('[data-sf-surface="CAP24"]')
    await expect(surface.locator("tr[data-sf-request]").first()).toBeVisible()
    await expect(surface.locator(".sf-n21-metrics")).toContainText("14,800.00")
    await capture(page, info, "CAP24-dark-desktop-source-overview-test-data")
    await scheme(page, "light")
    await capture(page, info, "CAP24-light-desktop-source-overview-test-data")
    await surface.locator("#sf-n21-status").selectOption("po_issued")
    await expect(surface.locator("tr[data-sf-request]")).toHaveCount(1)
    await surface.locator("#sf-n21-status").focus()
    await page.keyboard.press("Tab")
    await expect(surface.getByRole("button", { name: "Clear filters", exact: true })).toBeFocused()
    await surface.getByRole("button", { name: "Clear filters", exact: true }).click()
    await narrow()
    await scrollPageTop(page)
    await capture(page, info, "CAP24-light-320-source-overview-test-data")
    await desktop()
    await scheme(page, "dark")
  })

  await waveFourTest.step("CAP25 · null and zero, create, cancel and resume, confirm and reread", async () => {
    await go(screens[1])
    const list = page.locator(".sf-u11-list")
    await expect(list.locator("tr[data-sf-row]")).toHaveCount(7)
    for (const key of ["draft", "zero", "prApproval", "sourcing", "sourceApproval", "poApproval", "issued"] as const)
      references.set(data.requests[key], await rowReference(requestRow(page, data.requests[key])))
    await capture(page, info, "CAP25-dark-desktop-request-list-test-data")
    await list.getByRole("searchbox").fill("no matching procurement request")
    await expect(list.locator("tr[data-sf-row]")).toHaveCount(0)
    await list.getByRole("button", { name: "Clear filters", exact: true }).click()

    await requestRow(page, data.requests.zero).locator('[data-sf-action="select"]').click()
    const detail = page.locator(".sf-u11-detail")
    await expect(detail.locator('input[name="pr.estAmount"]')).toHaveValue("0")
    await detail.getByRole("button", { name: "Back to requests", exact: true }).click()
    await requestRow(page, data.requests.draft).locator('[data-sf-action="select"]').click()
    await expect(detail.locator('input[name="pr.estAmount"]')).toHaveValue("")
    await detail.locator('input[name="pr.estAmount"]').fill("16500")
    await detail.locator('textarea[name="pr.description"]').fill(data.revisedDescription)
    await detail.getByRole("button", { name: "Save requisition draft", exact: true }).click()
    await expect(review).toContainText("16500")
    const beforeCancel = posts.length
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    expect(posts).toHaveLength(beforeCancel)
    await expect(detail.locator('textarea[name="pr.description"]')).toHaveValue(data.revisedDescription)
    await detail.getByRole("button", { name: "Save requisition draft", exact: true }).click()
    await reviewOverview()
    await capture(page, info, "CAP25-dark-desktop-requisition-review-overview-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP25-dark-desktop-requisition-review-actions-test-data")
    await confirm("Confirm action")
    await detail.getByRole("button", { name: "Back to requests", exact: true }).click()
    await requestRow(page, data.requests.draft).locator('[data-sf-action="select"]').click()
    await expect(detail.locator('input[name="pr.estAmount"]')).toHaveValue("16500")
    await expect(detail.locator('textarea[name="pr.description"]')).toHaveValue(data.revisedDescription)
    await detail.getByRole("button", { name: "Back to requests", exact: true }).click()

    await page.getByRole("button", { name: "Create request", exact: true }).click()
    const fields = detail.locator("[data-sf-pr-fields]")
    await fields.locator('input[name="pr.title"]').fill(data.requests.created)
    await fields.locator('select[name="pr.type"]').selectOption("service")
    await fields.locator('textarea[name="pr.description"]').fill(data.description)
    await fields.locator('input[name="pr.estAmount"]').fill("7500")
    await fields.locator('input[name="pr.costCenter"]').fill("Regional IT")
    await fields.locator('input[name="pr.needBy"]').fill(installation.year + "-12-20")
    await fields.locator('textarea[name="pr.justification"]').fill(data.justification)
    await fields.locator('input[name="pr.expenseType"]').fill("OPEX")
    await fields.locator('input[name="pr.category"]').fill("Managed services")
    await detail.getByRole("button", { name: "Back to requests", exact: true }).click()
    await expect(list).toBeVisible()
    await page.getByRole("button", { name: "Resume draft", exact: true }).click()
    await expect(fields.locator('input[name="pr.title"]')).toHaveValue(data.requests.created)
    await scrollPageTop(page)
    await capture(page, info, "CAP25-dark-desktop-create-request-test-data")
    await narrow()
    await scrollPageTop(page)
    await capture(page, info, "CAP25-dark-320-create-request-test-data")
    await detail.getByRole("button", { name: "Create request", exact: true }).click()
    await expect(review).toContainText(data.requests.created)
    await reviewActions(page)
    await capture(page, info, "CAP25-dark-320-create-review-actions-test-data")
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    await expect(fields.locator('input[name="pr.title"]')).toHaveValue(data.requests.created)
    await desktop()
    await detail.getByRole("button", { name: "Create request", exact: true }).click()
    await confirm("Confirm action")
    // The create acknowledgement is not a canonical record reference. Read the
    // refreshed source list and select the producer-issued row before continuing.
    await detail.getByRole("button", { name: "Back to requests", exact: true }).click()
    const created = requestRow(page, data.requests.created)
    await expect(created).toContainText("draft")
    references.set(data.requests.created, await rowReference(created))
    await created.locator('[data-sf-action="select"]').click()
    await expect(detail.locator('textarea[name="pr.description"]')).toHaveValue(data.description)
    await detail.getByRole("button", { name: "Submit requisition", exact: true }).click()
    await confirm("Confirm action")
    await expect(detail.locator(".sf-u11-detail-head")).toContainText("pr_pending")
    await assertRowStatus(data.requests.created, "pr_pending")
  })

  await waveFourTest.step("CAP25 · canonical sourcing comparison, retained quote metadata and one save", async () => {
    await requestRow(page, data.requests.sourcing).locator('[data-sf-action="select"]').click()
    const comparisonLink = page.locator(".sf-u11-tabs").getByRole("link", { name: "Open sourcing comparison", exact: true })
    await expect(comparisonLink).toHaveAttribute("href", /\/sourcing\/compare(?:\?|$)/)
    await comparisonLink.click()
    await ready(page, "Requests")
    await expect(page).toHaveURL((url) => url.pathname.endsWith("/sourcing/compare") &&
      url.searchParams.get("project") === owner.projectId && url.searchParams.get("installation") === owner.installationId)
    const surface = page.locator(".sf-u12-root")
    await expect(surface.locator(".sf-u12-comparison tr[data-sf-row]")).toHaveCount(3)
    await surface.locator(".sf-u12-switch").getByRole("button", { name: "Sourcing", exact: true }).click()
    const editor = surface.locator(".sf-u12-editor")
    await expect(editor.locator(".sf-u12-quote")).toHaveCount(3)
    await expect(editor.locator(".sf-u12-quote").first().getByLabel("Description", { exact: true })).toHaveValue(data.description)
    await surface.locator(".sf-u12-switch").getByRole("button", { name: "Compare quotations", exact: true }).click()
    await expect(surface.locator(".sf-u12-comparison tr[data-sf-row]")).toHaveCount(3)
    await scrollPageTop(page)
    await capture(page, info, "CAP25-dark-desktop-recorded-quote-comparison-test-data")
    await scheme(page, "light")
    await capture(page, info, "CAP25-light-desktop-recorded-quote-comparison-test-data")
    await narrow()
    await scrollPageTop(page)
    await capture(page, info, "CAP25-light-320-recorded-quote-comparison-test-data")
    await desktop()
    await scheme(page, "dark")
    await surface.locator(".sf-u12-switch").getByRole("button", { name: "Sourcing", exact: true }).click()
    const evaluator = "Design test data · Regional technical assessment"
    await editor.getByLabel("Evaluator", { exact: true }).fill(evaluator)
    await editor.getByRole("button", { name: "Save sourcing", exact: true }).click()
    await expect(editor).toHaveCount(0)
    await expect(review).toContainText(evaluator)
    const beforeCancel = posts.length
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    expect(posts).toHaveLength(beforeCancel)
    await expect(editor.getByLabel("Evaluator", { exact: true })).toHaveValue(evaluator)
    await expect(editor.locator(".sf-u12-quote").first().getByLabel("Description", { exact: true })).toHaveValue(data.description)
    await editor.getByRole("button", { name: "Save sourcing", exact: true }).click()
    await reviewOverview()
    await capture(page, info, "CAP25-dark-desktop-sourcing-review-overview-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP25-dark-desktop-sourcing-review-actions-test-data")
    await confirm("Confirm once")
    await expect(surface).toHaveAttribute("data-confirmation-phase", "producer-confirmed")
    await record("/orchestra/sf-procurement/requests/" + encodeURIComponent(requestRef(data.requests.sourcing)) + "/sourcing")
    await expect(editor.getByLabel("Evaluator", { exact: true })).toHaveValue(evaluator)
    await expect(editor.locator(".sf-u12-quote").first().getByLabel("Description", { exact: true })).toHaveValue(data.description)
    await expect(editor.locator(".sf-u12-quote").first().getByLabel("Notes", { exact: true }))
      .toHaveValue("Design test data · Recorded quotation and supporting evaluation.")
  })

  await waveFourTest.step("CAP26 · submitted PR decision, cancel and retain comment, then source readback", async () => {
    await go(screens[2])
    const surface = page.locator('[data-sf-cap26="submitted-pr"]')
    await expect(surface.locator("tr[data-sf-row]").filter({ hasText: data.requests.created })).toBeVisible()
    await scrollPageTop(page)
    await capture(page, info, "CAP26-dark-desktop-pr-approval-list-test-data")
    await scheme(page, "light")
    await capture(page, info, "CAP26-light-desktop-pr-approval-list-test-data")
    await scheme(page, "dark")
    await surface.locator("tr[data-sf-row]").filter({ hasText: data.requests.created })
      .locator('[data-sf-action="select"]').click()
    await surface.locator("[data-sf-record-detail]").getByRole("button", { name: "Review decision", exact: true }).click()
    const comment = "Design test data · Scope and estimate reviewed for sourcing."
    await surface.getByLabel("Approval comment (optional)", { exact: true }).fill(comment)
    const beforeCancel = posts.length
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    expect(posts).toHaveLength(beforeCancel)
    await surface.locator("[data-sf-record-detail]").getByRole("button", { name: "Review decision", exact: true }).click()
    await expect(surface.getByLabel("Approval comment (optional)", { exact: true })).toHaveValue(comment)
    await narrow()
    await reviewActions(page)
    await capture(page, info, "CAP26-dark-320-pr-review-actions-test-data")
    await desktop()
    await confirm("Approve PR")
    await assertRowStatus(data.requests.created, "sourcing")
  })

  await waveFourTest.step("CAP26 · original sourcing and PO decisions; rejected order remains editable", async () => {
    const sourceRef = requestRef(data.requests.sourceApproval)
    await record("/orchestra/sf-procurement/approvals/" + encodeURIComponent(sourceRef) + "/review", "My approvals")
    const surface = page.locator(".sf-u13-remaining-root")
    const detail = surface.locator(".sf-u13-remaining-detail")
    await expect(detail).toContainText(data.requests.sourceApproval)
    await expect(detail).toContainText(data.suppliers.primary)
    await scrollPageTop(page)
    await capture(page, info, "CAP26-dark-desktop-sourcing-approval-detail-test-data")
    await detail.getByLabel("Approval comment", { exact: true }).fill("Design test data · Recorded quotation reviewed.")
    await detail.getByRole("button", { name: "Approve current step", exact: true }).click()
    await expect(review).toContainText(sourceRef)
    await confirm("Confirm once")
    await assertRowStatus(data.requests.sourceApproval, "po_draft")

    const poRef = requestRef(data.requests.poApproval)
    await record("/orchestra/sf-procurement/approvals/" + encodeURIComponent(poRef) + "/review", "My approvals")
    await expect(detail).toContainText("Submitted PO terms")
    await expect(detail).toContainText("22400")
    await detail.getByLabel("Rejection reason", { exact: true })
      .fill("Design test data · Clarify delivery conditions before resubmission.")
    await detail.getByRole("button", { name: "Reject current step", exact: true }).click()
    await reviewOverview()
    await capture(page, info, "CAP26-dark-desktop-po-decision-review-overview-test-data")
    await reviewActions(page)
    await capture(page, info, "CAP26-dark-desktop-po-decision-review-actions-test-data")
    await confirm("Confirm once")
    await assertRowStatus(data.requests.poApproval, "po_rejected")
    await record("/orchestra/sf-procurement/requests/" + encodeURIComponent(poRef) + "/po")
    const po = page.locator("[data-sf-po-fields]")
    await expect(po.locator(".sf-u11-line").first().getByLabel("Unit price", { exact: true })).toHaveValue("22400")
    await po.getByLabel("Delivery conditions", { exact: true }).fill("Design test data · Regional service owner accepts delivery after review.")
    await page.locator(".sf-u11-detail").getByRole("button", { name: "Save purchase order draft", exact: true }).click()
    await confirm("Confirm action")
    await record("/orchestra/sf-procurement/requests/" + encodeURIComponent(poRef) + "/po")
    await expect(po.getByLabel("Delivery conditions", { exact: true })).toHaveValue("Design test data · Regional service owner accepts delivery after review.")
    await expect(po.locator(".sf-u11-line").first().getByLabel("Notes", { exact: true })).toHaveValue("Design test data · Recorded line detail.")
    await scrollPageTop(page)
    await capture(page, info, "CAP25-dark-desktop-confirmed-order-draft-test-data")
  })

  await waveFourTest.step("CAP27 · single supplier ledger, four field groups, resume and confirm create/edit", async () => {
    await go(screens[3])
    const surface = page.locator('[data-sf-surface="CAP27"]')
    const list = surface.locator(".sf-u14-list")
    await expect(list.locator("tr[data-sf-row]")).toHaveCount(3)
    await expect(list.getByLabel("Filter by status", { exact: true }).locator('option[value="All"]')).toHaveText("All")
    await scrollPageTop(page)
    await capture(page, info, "CAP27-dark-desktop-supplier-list-test-data")
    await scheme(page, "light")
    await capture(page, info, "CAP27-light-desktop-supplier-list-test-data")
    await narrow()
    await scrollPageTop(page)
    await capture(page, info, "CAP27-light-320-supplier-list-test-data")
    await desktop()
    await scheme(page, "dark")
    await page.getByRole("button", { name: "New supplier", exact: true }).click()
    const editor = surface.locator(".sf-u14-editor")
    await expect(editor.locator(".sf-u14-group")).toHaveCount(4)
    await editor.locator('[name="legalName"]').fill(data.suppliers.created)
    await editor.locator('[name="country"]').fill("Brazil")
    await editor.locator('[name="contactEmail"]').fill("regional@example.invalid")
    await editor.locator('[name="paymentTerms"]').fill("Net 30")
    await editor.locator('[name="currency"]').fill("USD")
    await editor.locator('[name="categories"]').fill("Managed services\nProfessional services")
    await editor.locator('[name="notes"]').fill(data.supplierNote)
    await surface.getByRole("button", { name: "Back to suppliers", exact: true }).click()
    await expect(list).toBeVisible()
    await page.getByRole("button", { name: "Resume draft", exact: true }).click()
    await expect(editor.locator('[name="legalName"]')).toHaveValue(data.suppliers.created)
    await scrollPageTop(page)
    await capture(page, info, "CAP27-dark-desktop-create-supplier-test-data")
    await editor.getByRole("button", { name: "Create supplier", exact: true }).click()
    await expect(review).toContainText(data.suppliers.created)
    const beforeCancel = posts.length
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    expect(posts).toHaveLength(beforeCancel)
    await expect(editor.locator('[name="notes"]')).toHaveValue(data.supplierNote)
    await editor.getByRole("button", { name: "Create supplier", exact: true }).click()
    await reviewOverview()
    await capture(page, info, "CAP27-dark-desktop-supplier-review-overview-test-data")
    await narrow()
    await reviewActions(page)
    await capture(page, info, "CAP27-dark-320-supplier-review-actions-test-data")
    await desktop()
    await confirm("Confirm once")
    await expect(list).toBeVisible()
    const created = list.locator("tr[data-sf-row]").filter({ hasText: data.suppliers.created })
    await expect(created).toContainText("pending")
    await created.locator('[data-sf-action="select"]').click()
    const detail = surface.locator(".sf-u14-detail")
    await expect(detail).toContainText(data.supplierNote)
    await scrollPageTop(page)
    await capture(page, info, "CAP27-dark-desktop-confirmed-supplier-detail-test-data")
    await detail.getByRole("button", { name: "Save supplier", exact: true }).click()
    const revised = "Design test data · Regional support terms and contacts confirmed."
    await editor.locator('[name="notes"]').fill(revised)
    await editor.getByRole("button", { name: "Save supplier", exact: true }).click()
    await confirm("Confirm once")
    // Reopen from the fresh list rather than mistaking the still-mounted input for readback.
    await surface.getByRole("button", { name: "Back to suppliers", exact: true }).click()
    await list.locator("tr[data-sf-row]").filter({ hasText: data.suppliers.created })
      .locator('[data-sf-action="select"]').click()
    await expect(detail).toContainText(revised)
  })

  await waveFourTest.step("CAP28 · section navigation, one policy draft, cancel/resume and confirmed readback", async () => {
    await go(screens[4])
    const surface = page.locator('[data-sf-surface="CAP28"]')
    const form = surface.locator(".sf-n21-settings-form")
    await expect(form.locator(".sf-n21-settings-nav a")).toHaveCount(7)
    await expect(form.locator("#sf-u36-field-minQuotes")).toHaveValue("3")
    await expect(form.locator("#sf-u36-field-reminderDays")).toHaveValue("7")
    await scrollPageTop(page)
    await capture(page, info, "CAP28-dark-desktop-settings-test-data")
    await scheme(page, "light")
    await capture(page, info, "CAP28-light-desktop-settings-test-data")
    await narrow()
    await scrollPageTop(page)
    await capture(page, info, "CAP28-light-320-settings-test-data")
    await desktop()
    await scheme(page, "dark")
    await form.locator("#sf-u36-field-reminderDays").fill("9")
    await form.getByRole("button", { name: "Review changes", exact: true }).click()
    await expect(form).toHaveCount(0)
    await expect(review).toContainText("Reminder after days")
    const beforeCancel = posts.length
    await review.getByRole("button", { name: "Cancel review", exact: true }).click()
    expect(posts).toHaveLength(beforeCancel)
    await expect(form.locator("#sf-u36-field-reminderDays")).toHaveValue("9")
    await form.getByRole("button", { name: "Review changes", exact: true }).click()
    await reviewOverview()
    await capture(page, info, "CAP28-dark-desktop-settings-review-overview-test-data")
    await narrow()
    await reviewActions(page)
    await capture(page, info, "CAP28-dark-320-settings-review-actions-test-data")
    await desktop()
    await confirm("Save")
    await go(screens[4])
    await expect(form.locator("#sf-u36-field-reminderDays")).toHaveValue("9")
    await expect(form.locator("#sf-u36-field-minQuotes")).toHaveValue("3")
    await expect(form.locator("#sf-u36-field-currency")).toHaveValue("USD")
  })

  await waveFourTest.step("all five areas · genuine session in Portuguese, desktop and narrow", async () => {
    const cookies = await page.context().cookies(installation.origin + installation.mount)
    expect(cookies.filter((cookie) => /^sucafina_operator_[a-f0-9]{24}$/.test(cookie.name))).toHaveLength(1)
    const portuguese = await browser.newContext({
      locale: "pt-BR", viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1,
      reducedMotion: "reduce", colorScheme: "dark",
      httpCredentials: { username: "orchestra", password: installation.serverPassword },
      storageState: { cookies, origins: [{ origin: installation.origin, localStorage: [
        { name: "orchestra.global.dat:language", value: JSON.stringify({ locale: "br" }) },
      ] }] },
    })
    try {
      const localized = await portuguese.newPage()
      localized.setDefaultTimeout(15_000)
      const localizedMessages = observePage(localized)
      for (const screen of screens) {
        await go(screen, localized, true)
        await scheme(localized, "dark")
        await expect(localized.locator('[data-sf-frame="page"]')).not.toContainText(/sf\.(?:u1[1234]|u36|n21)\./)
        await capture(localized, info, screen.id + "-pt-BR-dark-desktop-test-data")
        await localized.setViewportSize({ width: 320, height: 900 })
        await reflow(localized)
        await scrollPageTop(localized)
        await capture(localized, info, screen.id + "-pt-BR-dark-320-test-data")
        await localized.setViewportSize({ width: 1440, height: 1100 })
      }
      expect(localizedMessages.pageErrors).toEqual([])
      await info.attach("procurement-pt-BR-diagnostics", {
        body: JSON.stringify(localizedMessages, null, 2), contentType: "application/json",
      })
    } finally { await portuguese.close() }
  })

  expect([...origins]).toEqual([installation.origin])
  expect(messages.pageErrors).toEqual([])
  await info.attach("native-procurement-wave-four-evidence", {
    body: JSON.stringify({
      source: "original producers in an isolated installation; no mocked auth, grants, records, decisions or receipts",
      areas: screens.map((screen) => screen.id), widths: [1440, 320], schemes: ["dark", "light"], locales: ["en-US", "pt-BR"],
      actualBrowserZoom: "not measured",
      confirmedCommands: ["CAP25.create", "CAP25.save PR", "CAP25.submit_pr", "CAP25.save sourcing", "CAP25.save PO",
        "CAP26.approve PR", "CAP26.approve sourcing", "CAP26.reject PO", "CAP27.create", "CAP27.save", "CAP28.save"],
      sourcePostPaths: posts, ...messages,
    }, null, 2), contentType: "application/json",
  })
})

function requestRow(page: Page, name: string) {
  return page.locator(".sf-u11-list tr[data-sf-row]").filter({ hasText: name })
}

async function rowReference(row: Locator) {
  await expect(row).toHaveCount(1)
  const ref = await row.getAttribute("data-sf-row")
  if (!ref) throw new Error("The source list did not render a record reference")
  return ref
}
