import { expect, test } from "bun:test"
import { plannerRecordAdmissionModes, runSfPlannerRecordAdmissionControl } from "../../../../../../../apps/cli/test/fixture/sucafina-planner-record-admission.test.ts"

for (const mode of plannerRecordAdmissionModes) {
  test("Planner record admission keeps original callbacks and bootstrap order: " + mode, async () => {
    const receipt = await runSfPlannerRecordAdmissionControl(import.meta.path, mode)
    expect(receipt.pid).toBeGreaterThan(0)
    expect(receipt.pid).not.toBe(process.pid)
    expect(receipt.mode).toBe(mode)
    expect(receipt.omniSpawns).toBe(1)
    expect(receipt.omniDelegations).toBe(0)
    expect(receipt.order).toEqual(["runtime-producer-loaded",
      ...(mode === "runtime-before-factory" ? ["stateful-view-installed-before-factory-import"] : []),
      "factory-loaded-and-input-capture-installed", "native-fixture-ready", "all-admission-assertions-completed", "native-resources-closed"])
    expect(receipt.bootstrapCurrent).toBe(mode !== "runtime-before-factory")
    expect(receipt.projectorMarked).toBe(mode === "canonical" || mode === "custom-enumerate")
    expect(receipt.proofIssued).toBe(mode === "canonical")
    expect(receipt.canonicalReads).toBe(mode === "canonical" ? 1 : 2)
    expect(receipt.opaqueWork).toBe(1)
    expect(receipt.phases).toEqual({ entered: true, cold: true, assertions: true })
    if (mode === "canonical") expect(receipt.rootEgress).toBe("ok")
    if (mode !== "canonical") expect(receipt.rootEgress).toBe(receipt.directRootEgress)
    expect(receipt.coldAndHit).toBe(mode === "canonical")
    expect(receipt.opaqueOriginalIdentity).toBe(mode !== "canonical")
    expect(receipt.directRootParity).toBe(mode !== "canonical")
    expect(receipt.lateViewCompleted).toBe(mode === "canonical")
    if (mode !== "canonical" && mode !== "custom-enumerate") expect(receipt.statefulCallsAfterChange).toBeGreaterThan(0)
    if (mode === "custom-enumerate") expect(receipt.statefulCallsAfterChange).toBe(0)
    if (mode === "custom-clock" || mode === "runtime-before-factory") expect(receipt.statefulThrowsAfterChange).toBeGreaterThan(0)
    if (mode === "canonical") {
      expect(receipt.lateInputs).toEqual([
        { name: "enumerate", proofInvalidBeforeFrame: true, noReplayAfterFrame: true, replacementCalls: 0 },
        { name: "projectScope", proofInvalidBeforeFrame: true, noReplayAfterFrame: true, replacementCalls: 0 },
      ])
      expect(receipt.portCases).toEqual(["same-factory-spread", "different-factory-same-store", "mixed-factory-readers",
        "wrapper-not-invoked", "accessor-not-invoked", "proxy-not-inspected", "raw-local-store-no-planner-proof"])
      expect(receipt.intrinsicCases).toEqual(["Date.UTC", "Date.getUTCDate", "Date.toISOString", "Number.isSafeInteger", "Object.entries",
        "Math.round", "String.normalize", "RegExp.replace", "Map.get", "Set.has", "Array.iterator.next", "Set.iterator.next", "JSON.parse",
        "Promise.catch", "structuredClone", "producer.domain.view", "PLANNER_TABS.literal"])
    }
    console.info("SF_PLANNER_RECORD_ADMISSION_PARENT " + JSON.stringify(receipt))
  }, 150_000)
}
