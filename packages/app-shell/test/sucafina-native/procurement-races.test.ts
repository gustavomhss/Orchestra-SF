import { expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfIntentRef, type SfOperationRef, type SfOwnerKey, type SfRef } from "@orchestra/schema/sucafina/context"
import { SfProcurementRequest } from "@orchestra/schema/sucafina/procurement"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import type { SfContextDependencies, SfOwnerIdentity } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"
import { sameRequestsDispatchFence, type RequestsDispatchFence } from "../../src/orchestra/chapters/sucafina/procurement/requests/page"
import { prFromRecord, reviewedPr } from "../../src/orchestra/chapters/sucafina/procurement/requests/model"
import {
  sourcingDraftReadAuthorized, sourcingDraftDispatchable, sourcingPendingMatches,
} from "../../src/orchestra/chapters/sucafina/procurement/sourcing"
import { editableSourcing, sourcingSourceFields, type SourcingEdit } from "../../src/orchestra/chapters/sucafina/procurement/sourcing/model"

// Source-contract fixtures. These exercise real F01 controllers, not an installed producer or a simulated controller.
const ownerKey = "owner" as SfOwnerKey
const identity: SfOwnerIdentity = {
  serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test",
  projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1,
}
const op = (operationId: string) => ({ operationId, state: "ready", operational: true, reason: null })
const stamp = {
  installationId: "install", projectId: "project", hostId: "host",
  principalRef: "actor", policyVersion: "p1", accessRevision: "a1",
}
const context = Schema.decodeUnknownSync(SfContext)({
  stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [{ capabilityId: "CAP25", surface: "procurement", page: "Requests",
    canRead: true, allowedActionIds: ["select_quote"] }],
  availability: [{ family: "procurement", resource: "CAP25", state: "partial", operations: [
    op("domain.page.CAP25"), op("domain.command.CAP25.select_quote"),
    { operationId: "domain.command.CAP25.save", state: "unavailable", operational: false, reason: "network" },
  ] }],
})
const row = Schema.decodeUnknownSync(SfProcurementRequest)({
  number: "PR-A", status: "sourcing", createdBy: "actor",
  allowedDraftActions: ["save-sourcing"],
  sourcing: { quotes: [{ id: "q-1", supplier: "Supplier", currency: "USD", total: 10 }] },
})
const selection = {
  surfaceId: "CAP25" as const,
  identity: { kind: "record" as const, recordRef: "PR-A" as SfRef },
  editScopeKey: "CAP25:sourcing" as SfEditScopeKey,
}
const deps: SfContextDependencies = {
  listInstallations: async () => { throw new Error("not used by draft registry fixture") },
  loadContext: async () => { throw new Error("not used by draft registry fixture") },
  createTransport: () => { throw new Error("not used by draft registry fixture") },
  resolveTransportIdentity: () => "transport",
  createDraft: createSfDraft,
  revalidateDraft: revalidateSfNativeDraft,
}
const registry = () => createSfOwnerDrafts(deps, { key: ownerKey, identity })
const retained = (drafts: ReturnType<typeof registry>) => {
  const value = editableSourcing(row)
  return drafts.registry.acquire<SourcingEdit>({
    ...selection, baseVersion: 7, base: value, value,
    revalidation: { operationId: "domain.page.CAP25", input: { request: "PR-A" },
      fieldPaths: sourcingSourceFields(row) ?? ["sourcing.unidentified-item"], actionIds: ["save"] },
  })
}

test("CAP25 creation accepts the reviewed PR without erasing explicit scalar values", () => {
  const codec = SfNativeOperationBindings["domain.command.CAP25.create"]!
  const draft = { ...prFromRecord(), title: "New request", estAmount: 0, estAnnual: null, recurring: false }
  const input = { page: "Requests", action: "create", version: 0, values: { pr: draft } }
  expect(codec.decodeInput(input).status).toBe("invalid")
  const reviewed = { ...input, values: { pr: reviewedPr(draft) } }
  expect(codec.decodeInput(reviewed)).toEqual({
    status: "ok", value: { ...input, values: { pr: { title: "New request", estAmount: 0, estAnnual: null, recurring: false } } },
  })
})

test("troca de linha durante o digest invalida o fence e não anexa pending à outra linha", async () => {
  const reviewed = { action: "save-pr" }
  const oldRow = { number: "PR-A", status: "pr_rejected" }
  const otherRow = { number: "PR-B", status: "pr_rejected" }
  const a = createSfDraft({ ownerKey, surfaceId: "CAP25", editScopeKey: "pr.details" as SfEditScopeKey,
    identity: { kind: "record", recordRef: "PR-A" as SfRef },
    baseVersion: 7, base: { description: "A" }, value: { description: "A" } })
  const b = createSfDraft({ ownerKey, surfaceId: "CAP25", editScopeKey: "pr.details" as SfEditScopeKey,
    identity: { kind: "record", recordRef: "PR-B" as SfRef },
    baseVersion: 7, base: { description: "B" }, value: { description: "B" } })
  const before: RequestsDispatchFence = {
    reviewing: reviewed, mode: "pr", newIntentRef: "new-1" as SfIntentRef,
    ref: "PR-A" as SfRef, sourceRevision: "source-a", stage: "pr",
    version: 7, row: oldRow, ownerKey, epoch: 1, prController: a, poController: undefined,
    payload: JSON.stringify({ id: "PR-A", version: 7 }),
  }
  expect(sameRequestsDispatchFence(before, before)).toBe(true)
  for (const changed of [
    { ...before, reviewing: { ...reviewed } }, { ...before, mode: "po" as const },
    { ...before, newIntentRef: "new-2" as SfIntentRef }, { ...before, ref: "PR-B" as SfRef },
    { ...before, sourceRevision: "source-b" }, { ...before, stage: "po" as const },
    { ...before, version: 8 }, { ...before, row: otherRow }, { ...before, ownerKey: "other" },
    { ...before, epoch: 2 }, { ...before, prController: b },
    { ...before, payload: JSON.stringify({ id: "PR-B", version: 7 }) },
  ]) expect(sameRequestsDispatchFence(before, changed)).toBe(false)

  let resumeDigest = () => {}
  const digest = new Promise<void>((resolve) => { resumeDigest = resolve })
  let current = before
  let posts = 0
  const pending = { operationRef: "op-A" as SfOperationRef, idempotencyKey: "key-A",
    payloadDigest: "digest-A", expectedVersion: 7 }
  const dispatch = (async () => {
    await digest
    if (!sameRequestsDispatchFence(before, current)) return
    a.setPending(pending)
    posts++
  })()
  current = { ...before, ref: "PR-B" as SfRef, row: otherRow, prController: b, sourceRevision: "source-b" }
  resumeDigest()
  await dispatch
  expect(posts).toBe(0)
  expect(a.snapshot()).toMatchObject({ availability: "active", pendingOperation: null })
  expect(b.snapshot()).toMatchObject({ availability: "active", pendingOperation: null })

  const source = await Bun.file(new URL("../../src/orchestra/chapters/sucafina/procurement/requests/page.tsx", import.meta.url)).text()
  const confirm = source.slice(source.indexOf("const confirm = async"))
  expect(confirm.indexOf("const prController =")).toBeLessThan(confirm.indexOf('await crypto.subtle.digest'))
  expect(confirm.indexOf("sameRequestsDispatchFence(fence")).toBeGreaterThan(confirm.indexOf('await crypto.subtle.digest'))
  expect(confirm.indexOf("prController?.setPending(pending)")).toBeLessThan(confirm.indexOf('client["domain.command.CAP25.create"]'))
})

test("save indisponível não impede controller de select_quote e pending antecede I/O", async () => {
  expect(sourcingDraftReadAuthorized(row, context)).toBe(true)
  const resource = context.availability.find((entry) => entry.resource === "CAP25")
  expect(resource?.operations.find((entry) => entry.operationId === "domain.command.CAP25.save")?.operational).toBe(false)
  expect(resource?.operations.find((entry) => entry.operationId === "domain.command.CAP25.select_quote")?.operational).toBe(true)
  const draft = retained(registry())
  expect(sourcingDraftDispatchable(draft.snapshot(), 7, "select_quote", editableSourcing(row))).toBe(true)
  const body = { page: "Requests" as const, action: "select_quote" as const,
    id: "PR-A", version: 7, values: { quoteId: "q-1" } }
  const json = JSON.stringify(body)
  const bytes = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(json)))
  const pending = { operationRef: "op-select" as SfOperationRef, idempotencyKey: "key-select",
    payloadDigest: Array.from(bytes, (item) => item.toString(16).padStart(2, "0")).join(""), expectedVersion: 7 }
  let posted = 0
  let recordedAtIO: ReturnType<typeof draft.snapshot> | undefined
  const transport: SfTransport = { async execute(operation) {
    if (operation.operationId === "domain.command.CAP25.select_quote") {
      posted++
      recordedAtIO = draft.snapshot()
    }
    return { kind: "transport-error", reason: "network" }
  } }
  draft.setPending(pending)
  expect(sourcingPendingMatches(draft.snapshot(), pending)).toBe(true)
  draft.setPhase("submitting")
  const response = await createSfProcurementClient(transport)["domain.command.CAP25.select_quote"](
    body, { idempotencyKey: pending.idempotencyKey },
  )
  expect(response.kind).toBe("transport-error")
  expect(posted).toBe(1)
  expect(recordedAtIO).toMatchObject({ availability: "active", phase: "submitting", pendingOperation: pending })
  expect(sourcingDraftDispatchable(draft.snapshot(), 7, "select_quote", editableSourcing(row))).toBe(false)
  const source = await Bun.file(new URL("../../src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx", import.meta.url)).text()
  expect(source.indexOf("controllerDraft.setPending(pending)")).toBeLessThan(source.indexOf('await client["domain.command.CAP25.select_quote"]'))
  expect(source).toContain("if(!sourcingPendingMatches(controllerDraft.snapshot(),pending))")
})

test("resposta perdida + remount retêm a mesma correlação, sem segundo POST nem descarte", async () => {
  const drafts = registry()
  const first = retained(drafts)
  const pending = { operationRef: "op-remount" as SfOperationRef, idempotencyKey: "key-remount",
    payloadDigest: "sha256-payload", expectedVersion: 7 }
  first.setPending(pending)
  first.setPhase("submitting")
  first.setPhase("outcome-unknown")
  expect(first.snapshot()).toMatchObject({ availability: "active", phase: "outcome-unknown", pendingOperation: pending })

  // The component remount retains the F01 owner registry, rather than inventing a new controller/UUID.
  const mountedAgain = retained(drafts)
  expect(mountedAgain).toBe(first)
  expect(sourcingPendingMatches(mountedAgain.snapshot(), pending)).toBe(true)
  expect(sourcingDraftDispatchable(mountedAgain.snapshot(), 7, "select_quote", editableSourcing(row))).toBe(false)
  drafts.registry.discard(selection)
  expect(drafts.registry.peek(selection)).toBe(first)
  expect(mountedAgain.snapshot()).toMatchObject({ availability: "active", pendingOperation: pending })
  let secondPosts = 0
  if (sourcingDraftDispatchable(mountedAgain.snapshot(), 7, "select_quote", editableSourcing(row))) secondPosts++
  expect(secondPosts).toBe(0)
  const source = await Bun.file(new URL("../../src/orchestra/chapters/sucafina/procurement/sourcing/index.tsx", import.meta.url)).text()
  const begin = source.slice(source.indexOf("  const begin="), source.indexOf("  const fields="))
  expect(begin.indexOf("draftPending()")).toBeLessThan(begin.indexOf("crypto.randomUUID()"))
  expect(source).toContain('if(ui.phase==="outcome-unknown"||draftPending())return "outcome-unknown"')
})

test("flag allowedDraftActions ausente falha fechada, sem controller ou POST", async () => {
  const { allowedDraftActions, ...withoutFlag } = row
  expect(allowedDraftActions).toContain("save-sourcing")
  expect(sourcingDraftReadAuthorized(withoutFlag, context)).toBe(false)
  expect(sourcingDraftReadAuthorized({ ...row, allowedDraftActions: [] }, context)).toBe(false)
  expect(sourcingDraftReadAuthorized(row, { ...context, destinations: [] })).toBe(false)
  const unavailableRead = { ...context, availability: [{ family: "procurement" as const, resource: "CAP25",
    state: "partial" as const, operations: [
      { operationId: "domain.page.CAP25", state: "unavailable" as const, operational: false, reason: "network" as const },
    ] }] }
  expect(sourcingDraftReadAuthorized(row, unavailableRead)).toBe(false)
  const drafts = registry()
  const controller = sourcingDraftReadAuthorized(withoutFlag, context) ? retained(drafts) : undefined
  const posts: string[] = []
  const transport: SfTransport = { async execute(operation) {
    posts.push(operation.operationId)
    return { kind: "transport-error", reason: "network" }
  } }
  if(controller && sourcingDraftDispatchable(controller.snapshot(),7,"select_quote",editableSourcing(row)))
    await createSfProcurementClient(transport)["domain.command.CAP25.select_quote"]({
      page:"Requests",id:"PR-A",version:7,action:"select_quote",values:{quoteId:"q-1"},
    },{idempotencyKey:"must-not-send"})
  expect(posts).toEqual([])
  expect(controller).toBeUndefined()
  expect(drafts.registry.peek(selection)).toBeUndefined()
})
