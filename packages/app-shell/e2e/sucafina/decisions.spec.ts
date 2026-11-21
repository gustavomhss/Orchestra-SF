// T2a retarget frontier: UI33/34/35/38/39/40 are mounted natively, but
// U16/U17/U18 do not yet prove all historical C10/C12 contracts end-to-end.
// Keep the original executable contracts until the same authenticated native
// host can produce an equivalent observation; a route/200 is not parity.
import { expect } from "@playwright/test"
import { assertCase, assertPortfolioCatalog, clickCommand, decisionsTest, draft, enterWorkbench, fillDecision, withInstallation } from "./decisions-support/journey"
import { caseLifecycleJourney, lostCreationJourney } from "./decisions-support/case-lifecycle"
import { initialAlternativesJourney } from "./decisions-support/initial-alternatives"
import { choiceHistoryJourney } from "./decisions-support/choice-history"
import { procurementClosureJourney } from "./decisions-support/procurement-closure"

// Enrollment and the HttpOnly operator session are real. Do not retain auth in traces.
decisionsTest.use({ trace: "off" })
decisionsTest.describe.configure({ retries: 0 })

decisionsTest("CI-UI-DECISIONS — attach evidence, compare two alternatives and preserve the human choice after a source change", async ({ page, installation }, info) => {
  decisionsTest.setTimeout(360_000)
  info.annotations.push({ type: "t2a-native-parity", description: "PENDENTE — SEM EQUIVALENTE de contrato completo. Native UI35/UI38/UI40 (U17/U18) cobrem superficies parciais, nao attachment da evidencia + duas alternativas + escolha humana apos source change sob o mesmo owner." })
  info.annotations.push({ type: "proof-limit", description: "Human choice and historical C10 coverage with pending costs; this path has no executable Procurement operation and does not accept financial approval, C12 Apply, native model or AM proofs" })
  await withInstallation(page, info, installation, async (installation, observations) => {
    const selection = await initialAlternativesJourney(page, installation, observations)
    await choiceHistoryJourney(page, installation, selection, observations)
  })
})

decisionsTest.describe(() => {
  decisionsTest.use({ procurementApproval: true })
  decisionsTest("CI-UI-DECISIONS — require a real Procurement proposal and approval before Apply and recover its unique receipt", async ({ page, installation }, info) => {
    decisionsTest.setTimeout(600_000)
    info.annotations.push({ type: "fixture", description: "Installed native shell with the real embedded product runtime and three distinct local operator enrollments. No case, approval, or receipt is seeded." })
    info.annotations.push({ type: "dependency", description: "Public typed Procurement alternative authoring, authorized composite producer, numeric criterion rule and a domain financial approval compatible with the prepared change are mandatory. Missing controls fail; no fixture inserts them." })
    info.annotations.push({ type: "proof-limit", description: "Consumes the published C12 Apply and recovery; selection and confirmation alone do not prove financial approval, native provider/critique or restart." })
    await withInstallation(page, info, installation, async (installation, observations) => {
      await procurementClosureJourney(page, installation, observations)
    })
  })
})

// This selection remains red when its installed producers are missing. It does not
// seed alternatives/choices, turn a dependency into a skip, or assert an expected failure.
// The append-only coverage receipt identifies the C10/C12/critique/C17 stages that
// cannot yet be reached through this head's real UI; these tests do not accept them.

decisionsTest("CI-UI-DECISIONS — create, edit and reopen the same durable case through native Decisions", async ({ page, installation }, info) => {
  decisionsTest.setTimeout(180_000)
  await withInstallation(page, info, installation, async (installation, observations) => {
    await caseLifecycleJourney(page, installation, observations)
  })
})

decisionsTest("CI-UI-DECISIONS — alternative discovery consumes a real Decisions catalog, not HTML 200", async ({ page, installation }, info) => {
  decisionsTest.setTimeout(180_000)
  info.annotations.push({ type: "proof-limit", description: "Native UI42 exact empty-case catalog only; this does not author alternatives or evaluate a portfolio." })
  await withInstallation(page, info, installation, async (installation, observations) => {
    await enterWorkbench(page, installation.origin)
    const form = await fillDecision(page, draft.objective)
    const created = await clickCommand(page, form.getByRole("button", { name: "Confirm this decision creation", exact: true }), "workbench-command", observations)
    expect(typeof created.outputRef).toBe("string")
    const reference = created.outputRef as string
    await form.getByRole("link", { name: "Open decision", exact: true }).click()
    await assertCase(page, reference, draft.objective, 1)
    await decisionsTest.step("bind discovery to the exact empty case without inventing alternatives", async () => {
      const entry = await assertPortfolioCatalog(page, installation.origin, reference, 1, observations)
      expect(entry.alternatives).toEqual([])
    })
  })
})

decisionsTest("CI-UI-DECISIONS — recover a lost creation response by reading the same case without resubmitting", async ({ page, installation }, info) => {
  decisionsTest.setTimeout(180_000)
  info.annotations.push({ type: "proof-limit", description: "Creation confirmation C09 only; not a financial Apply receipt/retry proof under C12 or AM04" })
  await withInstallation(page, info, installation, async (installation, observations) => {
    await lostCreationJourney(page, installation, observations)
  })
})
