import { expect, test } from "bun:test"
import { runSfPlannerRecordWiringControl } from "../../../../../../../apps/cli/test/fixture/sucafina-planner-record-wiring.test.ts"

test("Planner record proof wiring uses the real business and outer criteria owner in an isolated process", async () => {
  const receipt = await runSfPlannerRecordWiringControl(import.meta.path)
  expect(receipt.pid).toBeGreaterThan(0)
  expect(receipt.pid).not.toBe(process.pid)
  expect(receipt.order).toEqual(["original-factories-loaded", "transparent-wrappers-installed-before-business",
    "native-business-and-atlas-ready", "all-native-wiring-period-and-source-policy-assertions-completed", "native-resources-closed"])
  expect(receipt.omniSpawns).toBe(1)
  expect(receipt.omniDelegations).toBe(0)
  expect(receipt.scalarReads).toBe(0)
  expect(receipt.batches).toBe(7)
  expect(receipt.batchReferences).toBe(14)
  expect(receipt.physicalRoots).toBe(2)
  expect(receipt.recordFrames).toBe(1)
  expect(receipt.coldReads).toBeGreaterThan(0)
  expect(receipt.hits).toBeGreaterThan(0)
  expect(receipt.innerPairs).toBeGreaterThan(0)
  expect(receipt.noPeriodResolveCalls).toBe(1)
  expect(receipt.noPeriodObserverCalls).toBe(0)
  expect(receipt.noPeriodOwnerContinued).toBe(true)
  expect(receipt.sourceScopeBefore).toEqual({ work: 1, canonicalReads: 2, admissionPolicyCalls: 0 })
  expect(receipt.sourceScopeDuring).toEqual({ canonicalReads: 1, refusedReads: 2, admissionPolicyCalls: 0, latchedAfterExit: true })
  console.info("SF_PLANNER_RECORD_WIRING_PARENT " + JSON.stringify(receipt))
}, 150_000)
