import { test } from "@playwright/test"
import { withInstallation } from "./decisions-support/journey"
import { caseLifecycleJourney, lostCreationJourney } from "./decisions-support/case-lifecycle"

test.use({ trace: "off" })
test.describe.configure({ retries: 0 })

test("native Decisions preserves a created and edited case through reload and reopen", async ({ page }, info) => {
  test.setTimeout(180_000)
  await withInstallation(page, info, (installation, observations) => caseLifecycleJourney(page, installation, observations))
})

test("native Decisions reconciles one lost creation response by authorized reads", async ({ page }, info) => {
  test.setTimeout(180_000)
  await withInstallation(page, info, (installation, observations) => lostCreationJourney(page, installation, observations))
})
