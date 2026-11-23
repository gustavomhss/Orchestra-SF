import { test } from "@playwright/test"
import { importJourney } from "./operations-support/imports"
import { documentJourney, documentUploadJourney } from "./operations-support/documents"
import { exportRecordJourney } from "./operations-support/final-records-export"
import { nativeRecordScenarioJourney } from "./operations-support/final-records-native-scenario"
import { captureRecordFailure } from "./operations-support/final-records"
import type { WorkflowCapture } from "./design-support/workflow-polish-capture"

// The optional upstream capture suite registers hooks during module loading.
// Keep those hooks scoped to its existing opt-in mode.
const captureWorkflows: WorkflowCapture | undefined = process.env.SF_WORKFLOW_VISUAL_CAPTURE === "1"
  ? (await import("./design-support/workflow-polish-capture")).captureWorkflowState
  : undefined

test.describe("CI-UI-OPERATIONS", () => {
  test.describe.configure({ retries: 0 })
  test.beforeEach(async ({ page }) => {
    page.on("pageerror", (error) => console.info("SF_FINAL_RECORDS_BROWSER_ERROR " + JSON.stringify({
      name: error.name, message: error.message.slice(0, 2000),
    })))
  })
  test.afterEach(async ({ page }, info) => {
    if (info.status !== info.expectedStatus) await captureRecordFailure(page, info)
  })

  test("OP-IMPORT-01 real preview and one Apply recover the same receipt without duplicate effects", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP06.T01.INV.01; WP06.T01.QLT.01; WP06.T02.INV.01; WP06.T02.INV.02; WP06.T02.QLT.18; WP06.T03.CHK.04; WP06.T03.INV.01; WP06.T03.INV.03; WP06.T03.QLT.02; WP06.T03.SUC.02; WP06.T04.CHK.02; WP06.T04.INV.01; WP06.T04.QLT.01" })
    // The installed journey includes independent receipt, logout and foreign-owner reads after the Apply.
    test.setTimeout(captureWorkflows ? 420_000 : 210_000)
    await importJourney(page, info, captureWorkflows)
  })

  test("OP-DOC-01 real schema and confirmation preserve exact evidence through source revocation", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP06.T05.CHK.02; WP06.T05.CHK.19; WP06.T05.INV.01; WP06.T05.QLT.18; WP06.T05.QLT.19; WP06.T05.CMP.19; WP06.T05.SUC.19" })
    // Native schema/confirmation and source revocation retain the original bounded deadline.
    test.setTimeout(captureWorkflows ? 420_000 : 180_000)
    await documentJourney(page, info, captureWorkflows)
  })

  test("OP-DOC-UPLOAD-01 authorized record upload preserves scanned bytes, CAS and signed access", async ({ page }, info) => {
    info.annotations.push({ type: "audit-scope", description: "SUP-03; original OP-DOC-01 scanned uploads, signed download and asset-revocation oracles" })
    // Independent native source/data; no deadline or retry increase for either document journey.
    test.setTimeout(captureWorkflows ? 420_000 : 180_000)
    await documentUploadJourney(page, info, captureWorkflows)
  })

  test("OP-EXPORT-01 UI68 delivers the exact authorized Planner file", async ({ page }, info) => {
    test.setTimeout(60_000)
    await exportRecordJourney(page, info)
  })

  test("OP-SCENARIO-01 UI60 previews confirmed evidence through the original native installation", async ({ browser }, info) => {
    // Includes the unchanged 180s native build/setup scope plus the qualified scanner and original UI journey.
    test.setTimeout(300_000)
    await nativeRecordScenarioJourney(browser, info)
  })

})
