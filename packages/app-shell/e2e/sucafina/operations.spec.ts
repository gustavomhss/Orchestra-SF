import { test } from "@playwright/test"
import { procurementComparison } from "./operations-support/procurement-comparison"
import { sourcingSnapshot } from "./operations-support/procurement-snapshot"
import { missingFxRefusal } from "./operations-support/procurement-refusal"
import { importJourney } from "./operations-support/imports"
import { documentJourney } from "./operations-support/documents"

// Each annotation identifies a criterion slice, not a claim of complete or executed acceptance.
// Full coverage, source pins and unresolved C06/host dependencies live in final-e2e/operations/.
test.describe("CI-UI-OPERATIONS", () => {
  test.describe.configure({ retries: 0 })

  test("OP-PROC-01 real comparison preserves the J04 values and exact C02 drilldown", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP04.T03.CHK.01; WP04.T01.INV.01; WP04.T01.CMP.02" })
    await procurementComparison(page, info)
  })

  test("OP-PROC-02 pending sourcing keeps its submitted FX while the future PO changes", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP04.T03.CHK.02; WP04.T03.CHK.03; WP04.T03.INV.02" })
    await sourcingSnapshot(page, info)
  })

  test("OP-PROC-03 missing FX stays unavailable and refuses submission without a new version", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP04.T03.CHK.03; WP04.T03.CMP.01; WP04.CMP.02" })
    await missingFxRefusal(page, info)
  })

  test("OP-IMPORT-01 real preview and one Apply recover the same receipt without duplicate effects", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP06.T01.INV.01; WP06.T01.QLT.01; WP06.T02.INV.01; WP06.T02.INV.02; WP06.T02.QLT.18; WP06.T03.CHK.04; WP06.T03.INV.01; WP06.T03.INV.03; WP06.T03.QLT.02; WP06.T03.SUC.02; WP06.T04.CHK.02; WP06.T04.INV.01; WP06.T04.QLT.01" })
    await importJourney(page, info)
  })

  test("OP-DOC-01 real schema and confirmation preserve exact evidence through source revocation", async ({ page }, info) => {
    info.annotations.push({ type: "criteria-scope", description: "WP06.T05.CHK.02; WP06.T05.CHK.19; WP06.T05.INV.01; WP06.T05.QLT.18; WP06.T05.QLT.19; WP06.T05.CMP.19; WP06.T05.SUC.19" })
    await documentJourney(page, info)
  })
})
