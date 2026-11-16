import { expect, test } from "bun:test"
import type { SfContext, SfContextDependencies, SfDraftRevalidationInput, SfOwnerIdentity } from "../../src/orchestra/chapters/sucafina/context/contracts"
import type { SfOwnerKey } from "@orchestra/schema/sucafina/context"
import { createSfContextClient } from "@orchestra/client/sucafina/context"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { createSfTransport, type SfDesktopCapability, type SfDesktopInvocation } from "@orchestra/client/sucafina/transport"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { beginReportRecovery, readReportRecovery, reportMarkerScope, revalidateReportRecovery,
  runReportRecovery } from "../../src/orchestra/chapters/sucafina/reviews/reports/recovery"

// F01 and transport are real; the desktop source responses are synthetic and
// do not claim an installed principal, grant, or successful Office export.
function fixture() {
  const descriptor = { installationId: "installation", projectId: "project", hostId: "host",
    publicOrigin: "https://installation.example", mount: "/sucafina", authMode: "microsoft" as const,
    contractRevision: "sf-native-ui/1" as const }
  const context: SfContext = { stamp: { installationId: "installation", projectId: "project", hostId: "host",
    principalRef: "person", policyVersion: "policy", accessRevision: "revision" },
    contractRevision: "sf-native-ui/1", authMode: "microsoft", destinations: [], availability: [
      { family: "reviews", resource: "preserved", state: "ready", operations: [
        { operationId: "dashboard.dashboard-review", state: "ready", operational: true, reason: null } ] },
      { family: "reviews", resource: "report-export", state: "ready", operations: [
        { operationId: "reviews.report.prepare", state: "ready", operational: true, reason: null } ] },
      { family: "files", resource: "exports", state: "ready", operations: [
        { operationId: "files.export.review", state: "ready", operational: true, reason: null } ] },
    ] }
  const source = { context, sections: ["section-2", "section-1"], calls: [] as SfDesktopInvocation[], readDenied: false }
  const desktop: SfDesktopCapability = {
    registerConnection: async () => ({ status: "cancelled" }), bind: async () => ({ status: "denied" }),
    abort: async () => {}, login: async () => ({ status: "denied" }),
    logout: async () => ({ status: "cleared", remote: "unavailable" }), release: async () => {},
    invoke: async (request) => {
      source.calls.push(request)
      if (request.kind !== "request") throw new Error("unexpected byte request")
      if (request.operationId === "ctx.context") return { kind: "json-response", status: 200,
        headers: { "content-type": "application/json" }, body: { status: "ok", value: source.context } }
      if (request.operationId === "dashboard.dashboard-review") return source.readDenied
        ? { kind: "json-response", status: 403, headers: { "content-type": "application/json" }, body: { status: "denied" } }
        : { kind: "json-response", status: 200, headers: { "content-type": "application/json" }, body: { status: "ok", value: {
          id: "review-1", version: 1, createdAt: "2026-01-01", sourceRefs: [], comments: [],
          sections: source.sections.map((id) => ({ id, title: id, period: { start: "2026-01-01", end: "2026-12-31" },
            content: {}, count: 1, sourceRefs: [] })) } } }
      return { kind: "json-response", status: 503, headers: { "content-type": "application/json" },
        body: { status: "unavailable", reason: "after-persist" } }
    },
  }
  const transport = createSfTransport({ binding: descriptor, generation: 1, currentGeneration: () => 1,
    fetch: async () => { throw new Error("desktop only") }, operations: SfNativeOperationBindings, desktop,
    desktopBinding: { bindingHandle: "binding", descriptor, generation: 1 } })
  const identity: SfOwnerIdentity = { serverKey: "server", transportIdentity: "transport", publicOrigin: descriptor.publicOrigin,
    installationId: "installation", projectId: "project", principalRef: "person", authEpoch: 1 }
  let captured: SfDraftRevalidationInput | undefined
  const deps: SfContextDependencies = {
    createDraft: createSfDraft, createTransport: () => transport, resolveTransportIdentity: () => "transport",
    listInstallations: async () => ({ installations: [] }),
    loadContext: async () => ({ status: "unavailable", reason: "host-unavailable" }),
    revalidateDraft: (input, fresh, caller, signal) => { captured = input; return revalidateReportRecovery(input, fresh, caller, signal) },
  }
  const owner = createSfOwnerDrafts(deps, { key: "owner-1" as SfOwnerKey, identity })
  return { source, transport, context, owner, identity, captured: () => captured }
}

const key = "123e4567-e89b-42d3-a456-426614174000"
const payload = { reviewRef: "review-1", sectionRefs: ["section-2", "section-1"], format: "docx" as const }

test("real F01 quarantine restores the intent under a new owner key and retries the same key and payload", async () => {
  const f = fixture(), signal = new AbortController().signal
  const scope = await reportMarkerScope(f.identity)
  await createSfContextClient(f.transport)["ctx.context"]({ installationId: "installation", projectId: "project", hostId: "host" }, { signal })
  beginReportRecovery(f.owner.registry, { ownerScope: scope, idempotencyKey: key, payload })
  const run = () => runReportRecovery({ drafts: f.owner.registry, transport: f.transport, signal, current: () => true,
    principalRef: "person", accessRevision: "revision", onDownloaded: () => true })
  await run()
  f.owner.quarantine()
  expect(readReportRecovery(f.owner.registry)).toBeUndefined()
  const restoredIdentity = { ...f.identity, authEpoch: 2 }
  expect(await f.owner.revalidate({ key: "owner-2" as SfOwnerKey, identity: restoredIdentity }, f.context, f.transport, signal)).toBe(true)
  expect(await reportMarkerScope(restoredIdentity)).toBe(scope)
  expect(readReportRecovery(f.owner.registry)).toMatchObject({ ownerScope: scope, idempotencyKey: key, payload })
  expect(f.captured()?.read).toEqual({ operationId: "dashboard.dashboard-review", input: { id: "review-1" },
    fieldPaths: ["section:section-2", "section:section-1"], actionIds: ["reviews.report.prepare", "files.export.review"] })
  await run()
  const submissions = f.source.calls.filter((item) => item.kind === "request" && item.operationId === "reviews.report.prepare")
  expect(submissions).toHaveLength(2)
  for (const request of submissions) {
    if (request.kind !== "request") throw new Error("request expected")
    expect(request.idempotencyKey).toBe(key)
    expect(request.input).toEqual(payload)
  }
})

test("a foreign F01 identity revokes the private intent without a replay", async () => {
  const f = fixture(), signal = new AbortController().signal
  beginReportRecovery(f.owner.registry, { ownerScope: await reportMarkerScope(f.identity), idempotencyKey: key, payload })
  f.owner.quarantine()
  expect(await f.owner.revalidate({ key: "owner-foreign" as SfOwnerKey,
    identity: { ...f.identity, principalRef: "foreign", authEpoch: 2 } }, f.context, f.transport, signal)).toBe(false)
  expect(readReportRecovery(f.owner.registry)).toBeUndefined()
  expect(f.source.calls).toEqual([])
})

test("revalidation refuses changed selectors, missing sections and explicit action loss", async () => {
  const f = fixture(), signal = new AbortController().signal
  beginReportRecovery(f.owner.registry, { ownerScope: await reportMarkerScope(f.identity), idempotencyKey: key, payload })
  f.owner.quarantine()
  expect(await f.owner.revalidate({ key: "owner-2" as SfOwnerKey, identity: { ...f.identity, authEpoch: 2 } }, f.context, f.transport, signal)).toBe(true)
  const input = f.captured()
  if (!input) throw new Error("real F01 did not request source revalidation")
  expect(await revalidateReportRecovery({ ...input, read: { ...input.read, fieldPaths: ["unknown:section-1"] } }, f.context, f.transport, signal)).toEqual({ status: "unavailable" })
  f.source.sections = ["section-1"]
  expect(await revalidateReportRecovery(input, f.context, f.transport, signal)).toEqual({ status: "denied" })
  const denied: SfContext = { ...f.context, availability: f.context.availability.map((item) => item.family === "files" && item.resource === "exports"
    ? { ...item, operations: [{ operationId: "files.export.review", state: "denied", operational: false, reason: "revoked" }] } : item) }
  expect(await revalidateReportRecovery(input, denied, f.transport, signal)).toEqual({ status: "denied" })
  expect(await revalidateReportRecovery(input, { ...f.context, availability: [] }, f.transport, signal)).toEqual({ status: "unavailable" })
  expect(await revalidateReportRecovery({ ...input, read: { ...input.read, input: { id: "review-1", actor: "foreign" } } },
    f.context, f.transport, signal)).toEqual({ status: "unavailable" })
  f.source.sections = ["section-2", "section-1"]
  f.source.context = { ...f.context, stamp: { ...f.context.stamp, accessRevision: "different" } }
  expect(await revalidateReportRecovery(input, f.context, f.transport, signal)).toEqual({ status: "unavailable" })
})
