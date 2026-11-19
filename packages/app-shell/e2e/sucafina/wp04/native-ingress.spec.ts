import { test } from "@playwright/test"
import { procurementComparison } from "../operations-support/procurement-comparison"

// The change-scoped runner accepts exact spec filenames, not title filters.
// Exercise the original OP-PROC-01 proof through the real embedded installation.
test("OP-PROC-01 native ingress preserves the J04 values and exact C02 drilldown", async ({ page }, info) => {
  info.annotations.push({ type: "criteria-scope", description: "WP04.T03.CHK.01; WP04.T01.INV.01; WP04.T01.CMP.02" })
  await procurementComparison(page, info)
})
