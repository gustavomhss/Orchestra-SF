import { test } from "@playwright/test"
import { importJourney } from "./operations-support/imports"
import { documentJourney } from "./operations-support/documents"
import { exportRecordJourney } from "./operations-support/final-records-export"
import { captureRecordFailure } from "./operations-support/final-records"

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
    test.setTimeout(210_000)
    await importJourney(page, info)
  })

  test("OP-DOC-01 real schema and confirmation preserve exact evidence through source revocation", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP06.T05.CHK.02; WP06.T05.CHK.19; WP06.T05.INV.01; WP06.T05.QLT.18; WP06.T05.QLT.19; WP06.T05.CMP.19; WP06.T05.SUC.19" })
    // Download follows a fresh signed access check and the installed scanner can use most of the default budget.
    test.setTimeout(180_000)
    await documentJourney(page, info)
  })

  test("OP-EXPORT-01 UI68 delivers the exact authorized Planner file", async ({ page }, info) => {
    test.setTimeout(60_000)
    await exportRecordJourney(page, info)
  })

})
