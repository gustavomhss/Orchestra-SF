import { decisionsTest, withInstallation } from "./decisions-support/journey"
import { caseLifecycleJourney, lostCreationJourney } from "./decisions-support/case-lifecycle"

decisionsTest.use({ trace: "off" })
decisionsTest.describe.configure({ retries: 0 })

decisionsTest("native Decisions preserves a created and edited case through reload and reopen", async ({ page, installation }, info) => {
  decisionsTest.setTimeout(180_000)
  await withInstallation(page, info, installation, (installation, observations) => caseLifecycleJourney(page, installation, observations))
})

decisionsTest("native Decisions reconciles one lost creation response by authorized reads", async ({ page, installation }, info) => {
  decisionsTest.setTimeout(180_000)
  await withInstallation(page, info, installation, (installation, observations) => lostCreationJourney(page, installation, observations))
})
