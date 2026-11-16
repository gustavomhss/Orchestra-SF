import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { SfContext, type SfEditScopeKey, type SfOwnerKey, type SfRef } from "@orchestra/schema/sucafina/context"
import type { SfTransport } from "@orchestra/client/sucafina/transport"
import { createSfOwnerDrafts } from "../../src/orchestra/chapters/sucafina/context/drafts"
import type { SfContextDependencies, SfDraftReadBinding, SfOwnerIdentity } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { createSfDraft } from "../../src/orchestra/chapters/sucafina/shared/draft"
import { draftAvailability } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation-availability"
import { revalidateSfNativeDraft } from "../../src/orchestra/chapters/sucafina/host/draft-revalidation"

// Real typed clients and registry with injected producer envelopes; not an installed-host proof.
const stamp = { installationId: "install", projectId: "project", hostId: "host", principalRef: "actor", policyVersion: "p1", accessRevision: "a1" }
const identity: SfOwnerIdentity = { serverKey: "server", transportIdentity: "transport", publicOrigin: "https://sf.test", projectId: "project", installationId: "install", principalRef: "actor", authEpoch: 1 }
const op = (operationId: string) => ({ operationId, state: "ready", operational: true, reason: null })
const ready = Schema.decodeUnknownSync(SfContext)({ stamp, contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [
    { capabilityId: "CAP08", surface: "dashboard", page: "Talent Review", canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP25", surface: "procurement", page: "Requests", canRead: true, allowedActionIds: ["save"] },
  ], availability: [
    { family: "domain-read", resource: "CAP08", state: "ready", operations: [op("domain.page.CAP08"), op("domain.command.CAP08.save")] },
    { family: "procurement", resource: "CAP25", state: "ready", operations: [op("domain.page.CAP25"), op("domain.command.CAP25.save")] },
    { family: "decisions", resource: "cases", state: "ready", operations: [op("projection.case")] },
  ] })
const caseProjection = { context: { ...stamp, kind: "ui" }, case: { id: "internal", incarnation: "inc", version: 2,
  alternatives: [], criteria: [], state: "draft", objective: "objective", horizon: { start: "2026-01-01", end: "2026-12-31" },
  currency: "USD", participants: [], sourceRefs: [], costCoverageBases: [], assumptions: [], questions: [], choices: [], ledger: [], preparedChanges: [], receipts: [] },
  events: [], evidenceRefs: [], checkedAt: "now" }
const bodies: Readonly<Record<string, unknown>> = {
  "domain.page.CAP08": { status: "ok", context: stamp, value: { capabilityId: "CAP08", selection: { year: 2026, month: 1 },
    data: { members: [{ id: "m1", name: "Person" }] }, versions: { "members:m1": 2 }, allowedActionIds: ["save"] } },
  "domain.page.CAP25": { status: "ok", context: stamp, value: { capabilityId: "CAP25", selection: { request: "PR-1" },
    data: { requests: [{ number: "PR-1", status: "draft", createdBy: "actor", allowedDraftActions: ["save-pr"], pr: { description: "visible" } }],
      suppliers: [], directory: [], formSettings: {}, bankVerificationAvailable: false },
    versions: { "requests:PR-1": { version: 2, by: "actor" } }, allowedActionIds: ["save"] } },
  "projection.case": { status: "ok", context: stamp, value: { projection: caseProjection } },
}
const transport: SfTransport = { async execute(operation) {
  return { kind: "response", status: 200, headers: {}, body: Schema.decodeUnknownSync(Schema.toType(operation.output))(bodies[operation.operationId]) }
} }
const deps = { createDraft: createSfDraft, revalidateDraft: revalidateSfNativeDraft } as unknown as SfContextDependencies
const selections: readonly { surfaceId: "CAP08" | "CAP25" | "UI29"; ref: string; scope: string; read: SfDraftReadBinding; resource: string }[] = [
  { surfaceId: "CAP08", ref: "m1", scope: "people:talent:current:talent", resource: "CAP08",
    read: { operationId: "domain.page.CAP08", input: {}, fieldPaths: ["name"], actionIds: ["save"] } },
  { surfaceId: "CAP25", ref: "PR-1", scope: "pr.details", resource: "CAP25",
    read: { operationId: "domain.page.CAP25", input: { request: "PR-1" }, fieldPaths: ["pr.description"], actionIds: ["save"] } },
  { surfaceId: "UI29", ref: "opaque", scope: "case", resource: "cases",
    read: { operationId: "projection.case", input: { caseRef: "opaque" }, fieldPaths: [], actionIds: [] } },
]

describe("source readiness is not access revocation", () => {
  test("unavailable, partial and missing observations retain dirty People, request and case drafts until recovery", async () => {
    for (const selected of selections) {
      const drafts = createSfOwnerDrafts(deps, { key: "old" as SfOwnerKey, identity })
      const draft = drafts.registry.acquire({ surfaceId: selected.surfaceId, identity: { kind: "record", recordRef: selected.ref as SfRef },
        editScopeKey: selected.scope as SfEditScopeKey, baseVersion: 2, base: { text: "base" }, value: { text: "base" }, revalidation: selected.read })
      draft.edit({ text: "private" }); drafts.quarantine()
      for (const kind of ["unavailable", "partial", "missing"] as const) {
        const unavailable = Schema.decodeUnknownSync(SfContext)({ ...ready,
          destinations: ready.destinations.map((destination) => ({ ...destination, allowedActionIds: [] })),
          availability: ready.availability.flatMap((resource) => resource.resource !== selected.resource ? [resource] :
            kind === "missing" ? [] : [{ ...resource, state: kind, operations: [] }]),
        })
        expect(await drafts.revalidate({ key: "new" as SfOwnerKey, identity }, unavailable, transport, new AbortController().signal)).toBe(false)
        expect(drafts.state()).toBe("quarantined")
        expect(draft.snapshot()).toEqual({ availability: "quarantined", reason: "session-expired", dirty: true })
      }
      expect(await drafts.revalidate({ key: "new" as SfOwnerKey, identity }, ready, transport, new AbortController().signal)).toBe(true)
      expect(draft.snapshot()).toMatchObject({ availability: "active", value: { text: "private" } })
    }
  })

  test("missing operations and unavailable observations are retryable, explicit denial is not", () => {
    const get = (state: "ready" | "denied" | "unavailable", operations: unknown[]) => Schema.decodeUnknownSync(SfContext)({ ...ready,
      availability: [{ family: "domain-read", resource: "CAP08", state, operations }] })
    expect(draftAvailability(get("ready", [op("domain.page.CAP08")]), "domain-read", "CAP08", ["domain.page.CAP08", "domain.command.CAP08.save"]))
      .toEqual({ status: "unavailable" })
    expect(draftAvailability(get("ready", [op("domain.page.CAP08"), { operationId: "domain.command.CAP08.save", state: "unavailable", operational: false, reason: "network" }]), "domain-read", "CAP08", ["domain.page.CAP08", "domain.command.CAP08.save"]))
      .toEqual({ status: "unavailable" })
    expect(draftAvailability(get("denied", []), "domain-read", "CAP08", ["domain.page.CAP08"]))
      .toEqual({ status: "denied" })
    expect(draftAvailability(get("ready", [{ operationId: "domain.page.CAP08", state: "denied", operational: false, reason: "revoked" }]), "domain-read", "CAP08", ["domain.page.CAP08"]))
      .toEqual({ status: "denied" })
  })
})
