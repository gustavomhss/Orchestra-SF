import { expect, test } from "bun:test"
import { createCaseWorkSelection } from "../../../product/collaboration/case-selection.ts"
import type { SfProductState } from "../../../product/contracts/state.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"

const context = { kind: "ui", binding: { installationId: "i", projectId: "p", principalRef: "u", accessRevision: "a", policyVersion: "v" } } as unknown as TrustedDomainContext
const period = { start: "2026-03-01", end: "2026-03-31" }

function fixture() {
  const state = { versions: { preferences: 0, cases: 2 }, preferences: {}, cases: { c1: { id: "c1", incarnation: "inc", version: 1, horizon: { start: "2026-01-01", end: "2026-12-31" } } } } as unknown as SfProductState
  const writes = new WeakSet<object>()
  let allowed = true
  let reads = 0
  let mutateOnPreferenceReread = false
  let preferenceReadsAfterMutationArmed = 0
  let caseChangeBeforeCommit = false
  const port = createCaseWorkSelection({
    host: { requestFor: () => allowed ? new Request("https://local.invalid") : undefined, revalidate: async () => allowed },
    state: {
      read: async (_request: Request, namespace: string, read: (value: SfProductState, authority: unknown) => unknown) => {
        if (namespace === "preferences" && mutateOnPreferenceReread && ++preferenceReadsAfterMutationArmed === 2) {
          mutateOnPreferenceReread = false
          state.preferences["sf:case-work-selection:selection-1"] = { id: "sf:case-work-selection:selection-1", changed: true }
        }
        return { status: "ok" as const, storageVersion: namespace === "cases" ? 2 : mutateOnPreferenceReread ? 0 : reads > 1 ? 1 : 0, aggregateRevision: 2, incarnation: "store", value: read(state, { principalRef: "u", accessRevision: "a", policyVersion: "v" }) }
      },
      transaction: async (_request: Request, _command: unknown, work: (value: SfProductState, authority: { principalRef: string; accessRevision: string; policyVersion: string }) => Promise<{ commit: boolean; value: string }>) => {
        if (caseChangeBeforeCommit) state.versions.cases += 1
        const result = await work(state, { principalRef: "u", accessRevision: "a", policyVersion: "v" })
        if (!result.commit) return { status: "conflict" as const, reason: "not-committed" }
        reads++
        return { status: "ok" as const, storageVersion: reads, aggregateRevision: reads, incarnation: "store", value: result.value }
      },
    } as never,
    cases: { read: async () => ({ status: "ok" as const, value: { case: state.cases.c1 } as never) },
    authority: { sources: async () => allowed } as never,
    human: { authorize: async () => allowed } as never,
    fence: { prepare: async () => allowed ? "fence" : undefined, check: () => allowed },
    fallback: { resolve: async () => ({ status: "unavailable" as const, reason: "not-used" }), contains: async () => ({ status: "ok" as const, value: false }) },
    target: { ref: "state", incarnation: "state-inc" },
    caseSelectionWrites: writes,
    createId: () => "selection-1",
  })
  return { port, state, writes, revoke: () => { allowed = false }, changeDuringList: () => { mutateOnPreferenceReread = true }, changeBeforeCommit: () => { caseChangeBeforeCommit = true } }
}

test("creates and resolves an explicit empty-source case selection", async () => {
  const { port } = fixture()
  const created = await port.create({ caseRef: "case:c1:inc", period, sourceRefs: [] }, { expectedStorageVersion: 0, idempotencyKey: "create-1" }, context)
  expect(created).toMatchObject({ status: "ok", value: { selectionRef: "sf:case-work-selection:selection-1" } })
  if (created.status !== "ok") return
  expect(await port.list("case:c1:inc", context)).toMatchObject({ status: "ok", value: [{ selectionRef: created.value.selectionRef, period, state: "active" }] })
  expect(await port.resolveCase(created.value.selectionRef, period, context)).toMatchObject({ status: "ok", caseRef: { id: "c1", incarnation: "inc", version: 1 } })
})

test("rejects forged selection refs and fails closed after revocation", async () => {
  const { port, revoke } = fixture()
  expect(await port.resolveCase("sf:case-work-selection:forged", period, context)).toMatchObject({ status: "unavailable" })
  const created = await port.create({ caseRef: "case:c1:inc", period, sourceRefs: [] }, { expectedStorageVersion: 0, idempotencyKey: "create-1" }, context)
  expect(created.status).toBe("ok")
  revoke()
  if (created.status === "ok") expect(await port.resolveCase(created.value.selectionRef, period, context)).toMatchObject({ status: "unavailable" })
})

test("listing fails closed when protected selection changes between reads", async () => {
  const { port, changeDuringList } = fixture()
  const created = await port.create({ caseRef: "case:c1:inc", period, sourceRefs: [] }, { expectedStorageVersion: 0, idempotencyKey: "create-1" }, context)
  expect(created.status).toBe("ok")
  changeDuringList()
  expect(await port.list("case:c1:inc", context)).toMatchObject({ status: "stale", reason: "selection-changed" })
})

test("case changes invalidate the selected case version", async () => {
  const { port, state } = fixture()
  const created = await port.create({ caseRef: "case:c1:inc", period, sourceRefs: [] }, { expectedStorageVersion: 0, idempotencyKey: "create-1" }, context)
  if (created.status !== "ok") throw new Error("selection failed")
  state.cases.c1!.version = 2
  expect(await port.resolveCase(created.value.selectionRef, period, context)).toMatchObject({ status: "unavailable" })
})

test("case namespace change before commit refuses selection without persisting it", async () => {
  const { port, state, changeBeforeCommit } = fixture()
  changeBeforeCommit()
  const result = await port.create({ caseRef: "case:c1:inc", period, sourceRefs: [] }, { expectedStorageVersion: 0, idempotencyKey: "create-1" }, context)
  expect(result.status).not.toBe("ok")
  expect(state.preferences).toEqual({})
})
