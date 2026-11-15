import { describe, expect, it } from "bun:test"
import {
  findSubmittedPr, samePrReview, sourceChangedAfterIntent,
  type Cap26PageOk, type Cap26Request,
} from "../../src/orchestra/chapters/sucafina/procurement/approvals/pr/model"

/**
 * Pure CAP26 projection regression, NOT installed authenticated web/desktop
 * approval proof. P1/M31/MI07 require the original producer, distinct actors,
 * CAS/owner fencing and the native shell in Actions.
 */
function currentRequest(): Cap26Request {
  return {
    number: "PR-2026-42", status: "pr_pending", createdBy: "requester-7",
    pr: { title: "Service contract", justification: "Operational continuity", estAmount: 1 },
    prApproval: {
      amount: 1550,
      steps: [
        { holderId: "actor-15", status: "pending", levelName: "Level 1" },
        { holderId: "actor-29", status: "queued", levelName: "Level 2" },
      ],
    },
    prApprovalBaseCurrency: "USD",
    history: [{ at: "2026-11-15", by: "requester-7", action: "Requisition submitted for approval", note: "" }],
  }
}
function page(
  request: Cap26Request = currentRequest(),
  version: number | undefined = 7,
  queue: "you" | "others" | "unassigned" = "you",
): Cap26PageOk {
  return {
    status: "ok",
    context: {
      installationId: "install-2", projectId: "project-2", hostId: "host-2",
      principalRef: "principal-9", policyVersion: "pol-2", accessRevision: "rev-3",
    },
    value: {
      capabilityId: "CAP26",
      selection: {},
      data: {
        requests: [request],
        waitingForYou: queue === "you" ? [request] : [],
        waitingForOthers: queue === "others" ? [request] : [],
        unassigned: queue === "unassigned" ? [request] : [],
        directory: [{ id: "actor-15", name: "Actual holder" }],
        formSettings: { blockSelfApproval: true },
      },
      versions: version === undefined ? {} : { ["requests:" + request.number]: { version, by: "requester-7" } },
      allowedActionIds: ["approve", "reject"],
    },
  }
}
describe("W13 P1 submitted PR projection, no authorization mocking", () => {
  it("binds the real holder, step and record CAS, not principalRef or the title", () => {
    const value = findSubmittedPr(page(), "PR-2026-42")
    expect(value.kind).toBe("submitted-pr")
    if (value.kind !== "submitted-pr") return
    expect(value.version).toBe(7)
    expect(value.holderId).toBe("actor-15")
    expect(value.holderName).toBe("Actual holder")
    expect(value.stepOrdinal).toBe(0)
    expect(value.actions).toEqual(["approve", "reject"])
    expect(value.requestRef).toBe("PR-2026-42")
    expect(value.amount).toBe(1550)
    expect(value.baseCurrency).toBe("USD")
    expect(value.request.pr?.estAmount).toBe(1)
  })
  it("does not decide when a different holder owns the pending step", () => {
    const result = findSubmittedPr(page(currentRequest(), 7, "others"), "PR-2026-42")
    expect(result.kind).toBe("submitted-pr")
    if (result.kind !== "submitted-pr") return
    expect(result.actions).toEqual([])
  })
  it("allows review of an unassigned step only as a candidate for producer admission", () => {
    const request = currentRequest()
    const result = findSubmittedPr(page({
      ...request, prApproval: { ...request.prApproval!, steps: [
        { holderId: null, status: "pending", levelName: "Unassigned" },
      ] },
    }, 7, "unassigned"), "PR-2026-42")
    expect(result.kind).toBe("submitted-pr")
    if (result.kind !== "submitted-pr") return
    expect(result.holderId).toBeNull()
    expect(result.actions).toEqual(["approve", "reject"])
  })
  it("never admits a draft or PR rejection as submitted approval", () => {
    for (const status of ["draft", "pr_rejected", "sourcing", "src_pending", "po_pending"]) {
      expect(findSubmittedPr(page({ ...currentRequest(), status }), "PR-2026-42")).toEqual({
        kind: "not-submitted", status,
      })
    }
  })
  it("blocks missing or ambiguous persisted versions and steps", () => {
    expect(findSubmittedPr(page(currentRequest(), undefined), "PR-2026-42")).toEqual({
      kind: "source-unavailable", reason: "version",
    })
    const request = currentRequest()
    expect(findSubmittedPr(page({ ...request, prApproval: { amount: 1550, steps: [] } }), "PR-2026-42")).toEqual({
      kind: "source-unavailable", reason: "step",
    })
  })
  it("rejects inconsistent queue grouping instead of inferring authorization", () => {
    const value = page()
    const conflicting = {
      ...value,
      value: { ...value.value, data: {
        ...value.value.data, waitingForOthers: [currentRequest()],
      } },
    } satisfies Cap26PageOk
    expect(findSubmittedPr(conflicting, "PR-2026-42")).toEqual({
      kind: "source-unavailable", reason: "group",
    })
  })
  it("rejects duplicate record identities from a broken producer projection", () => {
    const value = page()
    const duplicate = { ...value, value: {
      ...value.value, data: { ...value.value.data, requests: [currentRequest(), currentRequest()] },
    } } satisfies Cap26PageOk
    expect(findSubmittedPr(duplicate, "PR-2026-42")).toEqual({
      kind: "source-unavailable", reason: "duplicate",
    })
  })
  it("invalidates review after holder, version or access revision changes", () => {
    const original = findSubmittedPr(page(), "PR-2026-42")
    expect(original.kind).toBe("submitted-pr")
    if (original.kind !== "submitted-pr") return
    expect(samePrReview(original, findSubmittedPr(page(), "PR-2026-42"))).toBe(true)
    expect(samePrReview(original, findSubmittedPr(page(currentRequest(), 8), "PR-2026-42"))).toBe(false)
    const newer = page()
    expect(samePrReview(original, findSubmittedPr({
      ...newer, context: { ...newer.context, accessRevision: "rev-4" },
    }, "PR-2026-42"))).toBe(false)
  })
  it("observing a changed source never means a lost approval received a receipt", () => {
    const original = findSubmittedPr(page(), "PR-2026-42")
    if (original.kind !== "submitted-pr") throw new Error("Fixture invalid")
    expect(sourceChangedAfterIntent(original, page())).toBe(false)
    expect(sourceChangedAfterIntent(original, page({ ...currentRequest(), status: "sourcing" }, 8))).toBe(true)
  })
})
