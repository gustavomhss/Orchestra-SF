// T2a retarget frontier: UI33/34/35/38/39/40 are mounted natively, but
// U16/U17/U18 do not yet prove all historical C10/C12 contracts end-to-end.
// Keep the original executable contracts until the same authenticated native
// host can produce an equivalent observation; a route/200 is not parity.
import { expect, test } from "@playwright/test"
import { asRecord, caseIdentity, clickCommand, draft, enterWorkbench, fillDecision, isCommand, withInstallation } from "./decisions-support/journey"
import { caseLifecycleJourney, lostCreationJourney } from "./decisions-support/case-lifecycle"
import { initialAlternativesJourney } from "./decisions-support/initial-alternatives"
import { choiceHistoryJourney } from "./decisions-support/choice-history"
import { procurementClosureJourney } from "./decisions-support/procurement-closure"

// Enrollment and the HttpOnly operator session are real. Do not retain auth in traces.
test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

test("CI-UI-DECISIONS — attach evidence, compare two alternatives and preserve the human choice after a source change", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — SEM EQUIVALENTE de contrato completo. Native UI35/UI38/UI40 (U17/U18) cobrem superficies parciais, nao attachment da evidencia + duas alternativas + escolha humana apos source change sob o mesmo owner." })
  info.annotations.push({ type: "proof-limit", description: "Human choice and historical C10 coverage with pending costs; this path has no executable Procurement operation and does not accept financial approval, C12 Apply, native model or AM proofs" })
  await withInstallation(page, info, async (installation, observations) => {
    const selection = await initialAlternativesJourney(page, installation, observations)
    await choiceHistoryJourney(page, installation, selection, observations)
  })
})

test("CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — SEM EQUIVALENTE end-to-end. UI39/UI40 + native CAP25/CAP26 (U12/U13/U18) nao demonstram proposta financeira aprovada ANTES de C12 Apply e um unico recibo recuperado." })
  info.annotations.push({ type: "dependency", description: "Public typed Procurement alternative authoring, authorized composite producer, numeric criterion rule and a domain financial approval compatible with the prepared change are mandatory. Missing controls fail; no fixture inserts them." })
  info.annotations.push({ type: "proof-limit", description: "Consumes the published C12 Apply and recovery; selection and confirmation alone do not prove financial approval, native provider/critique or restart." })
  await withInstallation(page, info, async (installation, observations) => {
    await procurementClosureJourney(page, installation, observations)
  })
})

// This selection remains red when its installed producers are missing. It does not
// seed alternatives/choices, turn a dependency into a skip, or assert an expected failure.
// The append-only coverage receipt identifies the C10/C12/critique/C17 stages that
// cannot yet be reached through this head's real UI; these tests do not accept them.

test("CI-UI-DECISIONS — create, edit and reopen the same durable case through native Decisions", async ({ page }, info) => {
  test.setTimeout(180_000)
  await withInstallation(page, info, async (installation, observations) => {
    await caseLifecycleJourney(page, installation, observations)
  })
})

test("CI-UI-DECISIONS — alternative discovery consumes a real Decisions catalog, not HTML 200", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — native UI33/UI35 U16/U17 possuem navegacao, mas nao reproduzem a consulta autorizada do catalogo vazio e suas refs exatas apos caso recem-criado." })
  info.annotations.push({ type: "dependency", description: "WP10: installed decision-list/decision-portfolio-catalog and a public UI producer for initial C09/C10 alternatives" })
  await withInstallation(page, info, async (installation, observations) => {
    await enterWorkbench(page, installation.origin)
    const form = await fillDecision(page, draft.objective)
    const created = await clickCommand(page, form.getByRole("button", { name: "Create decision", exact: true }), "workbench-command", observations)
    expect(typeof created.outputRef).toBe("string")
    const reference = created.outputRef as string
    // This test isolates discovery. Browser Back returns from the submitted case;
    // the separate case test owns assertions about successful case rendering.
    await expect(page).toHaveURL((url) => url.searchParams.get("sf") === "workbench-case" && url.searchParams.get("caseRef") === reference)
    await page.goBack()
    await expect(page.getByRole("heading", { name: "Decisions", exact: true })).toBeVisible()
    await page.getByText("Explore a portfolio", { exact: true }).click()
    const portfolio = page.locator("section[data-portfolio]")
    await expect(portfolio).toHaveCount(1)
    await expect(portfolio).toHaveAttribute("data-sf-portfolio-ready", "true")
    await test.step("bind discovery to the exact empty case without inventing alternatives", async () => {
      const listed = await clickCommand(page, portfolio.getByRole("button", { name: "Find decisions", exact: true }), "decision-list", observations, "GET")
      expect(Array.isArray(listed.value)).toBe(true)
      expect(listed.value).toHaveLength(1)
      expect(asRecord((listed.value as unknown[])[0]).caseRef).toEqual({ ...caseIdentity(reference), version: 1 })
      await expect(portfolio.locator(":scope > p[role=status]")).toHaveText("Choose decisions, then find alternatives.")
      const checkbox = portfolio.getByRole("checkbox", { name: draft.objective, exact: true })
      await expect(checkbox).toHaveCount(1)
      await checkbox.check()
      const requested = page.waitForRequest((request) => isCommand(request, "decision-portfolio-catalog"))
      const catalog = await clickCommand(page, portfolio.getByRole("button", { name: "Find alternatives", exact: true }), "decision-portfolio-catalog", observations)
      expect((await requested).postDataJSON()).toEqual({ purpose: "catalog", caseRefs: [{ ...caseIdentity(reference), version: 1 }] })
      observations.push({ stage: "alternative-catalog", caseRef: reference, catalog: catalog.value })
      const result = asRecord(catalog.value)
      expect(Array.isArray(result.cases)).toBe(true)
      expect(result.cases).toHaveLength(1)
      const current = asRecord((result.cases as unknown[])[0])
      expect(current.caseRef).toEqual({ ...caseIdentity(reference), version: 1 })
      expect(current.caseVersion).toBe(1)
      expect(current.alternatives).toEqual([])
      const candidates = portfolio.locator("fieldset[data-portfolio-candidates]")
      await expect(candidates.getByRole("checkbox")).toHaveCount(0)
      await expect(portfolio.locator(":scope > p[role=status]")).toHaveText("Choose alternatives and enter the portfolio scope.")
      await expect(portfolio.getByRole("button", { name: "Save this evaluation", exact: true })).toBeDisabled()
      // A new case correctly has no alternatives. The positive journeys
      // create their own alternatives through the composed human controls.
    })
  })
})

test("CI-UI-DECISIONS — recover a lost creation response by reading the same case without resubmitting", async ({ page }, info) => {
  test.setTimeout(180_000)
  info.annotations.push({ type: "proof-limit", description: "Creation confirmation C09 only; not a financial Apply receipt/retry proof under C12 or AM04" })
  await withInstallation(page, info, async (installation, observations) => {
    await lostCreationJourney(page, installation, observations)
  })
})
