import { expect } from "bun:test"
import { randomUUID } from "node:crypto"
import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { Schema } from "effect"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import type { SfTransport } from "../../../../../../../packages/client/src/sucafina/transport.ts"
import { SfCollaboration } from "@orchestra/schema/sucafina/collaboration"
import { SfContext } from "@orchestra/schema/sucafina/context"
import { createCollaborationHttp } from "../../../../product/collaboration/http.ts"
import { createSfBusinessServices } from "../../../../../../../apps/cli/src/sucafina-product/business-services.ts"
import { createSfProductAuthority } from "../../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../../product/integration/source-projections.ts"
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { ConfirmationCommand, ConfirmationScope } from "../../../../product/contracts/context.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { SfStateResult } from "../../../../product/contracts/state.ts"
import type { TrustedUiContext } from "../../../../product/contracts/sf-execution.ts"
import { DashboardPortfolio } from "../../../../runtime/dashboard-portfolio.ts"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { resolve } from "../../../../src/identity.ts"

const at = "2026-11-22T08:00:00.000Z"
const period = { start: "2026-01-01", end: "2026-12-31" }
const values = { name: "Reviewed project", budget: 100, spent: 20, status: "In Progress", risk: "Low", notes: "" }
function ok<Value>(result: PortResult<Value> | SfStateResult<Value>): Value {
  if (result.status !== "ok") throw new Error(JSON.stringify(result))
  return result.value
}

/** Shipped authority/business factories, canonical Dashboard edits, source receipts,
 * C06 and SQLite are real. Authentication/directory and the F01 owner are explicit
 * fixture boundaries. The original collaboration HTTP adapter is exercised;
 * this is not an installed Entra/Teams deployment claim. */
export async function confirmationSelectionFixture(dependency = true) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-confirmation-payload-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  let disposeBusiness = () => {}
  try {
    const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, createId: randomUUID,
      enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => at) }) }
    const people = [{ id: "person", name: "Authorized reviewer" }]
    const control = { active: true }
    for (const surface of ["dashboard", "planner", "procurement"] as const) {
      await persistence.initializeSources(surface)
      await persistence.transaction(surface, async (snapshot) => {
        snapshot.data.roleMap = [{ surface, role: "admin", entra: "admins", version: 1, by: "person" }]
        snapshot.data.access = { person: { assigned: [], domains: [] } }
        return { commit: true, value: undefined }
      })
    }
    const save = (id: string, budget: number, version: number) => persistence.transaction("dashboard", async (snapshot) => {
      const result = DashboardPortfolio.domain.execute(snapshot, { id: "person", roles: ["admin"], canWrite: true },
        { page: "All Projects", action: "save", ...(version ? { id } : {}), version, values: { ...values, name: id, budget } },
        { at, id: () => id, directory: people })
      if (!result.ok) throw new Error("Canonical Dashboard mutation failed: " + JSON.stringify(result))
      return { commit: true, value: result }
    })
    await save("project", 100, 0)
    if (dependency) await save("dependency", 200, 0)
    const identity = { installationId: "confirmation-installation", hostId: "host", projectId: "project",
      location: Location.Ref.make({ directory: AbsolutePath.make(directory) }) }
    const request = () => new Request("https://example.test/product", {
      method: "POST", headers: { origin: "https://example.test", actor: "person" },
    })
    const authority = createSfProductAuthority({
      identity: () => identity, installationId: identity.installationId, origin: "https://example.test",
      policyVersion: "policy", persistence,
      authenticate: async (candidate, scope) => control.active && candidate.headers.get("actor") === "person" && scope
        ? resolve("person", [...scope.roleMap], (group) => group === "admins") : null,
      environment: async () => ({ at, id: randomUUID, directory: people }),
      grants: [{ principalRef: "person", namespaces: ["confirmations", "threads", "relations", "cases", "preferences"],
        operations: ["sf_work_list"], humanActions: ["collaboration.confirmation.confirm"] }],
      createId: randomUUID, now: Date.now, commandIdentity: async () => randomUUID(),
      inspectSession: async () => undefined, verifySelection: async () => false,
      verifySkillReceipt: async () => false, providerGeneration: async () => 1, authorizeDocument: async () => undefined,
    })
    const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet<object>() })
    disposeBusiness = business.dispose
    business.initializeAtlas(undefined, { boundaryVersion: "fixture", schemaVersion: "fixture",
      manifestVersion: "fixture", skillVersion: "fixture" })
    const confirmation = business.collaboration.confirmation
    if (!confirmation) throw new Error("Native C06 composition is unavailable")
    const read = async <Value>(payload: unknown, work: (call: TrustedUiContext) => Promise<Value>) => {
      const digest = digestSfValue(payload)
      const call = ok(await authority.ui.admit(request(), "sf_work_list", digest))
      try {
        expect(await authority.ui.validate(call, "sf_work_list", digest)).toBe(true)
        return await work(call)
      } finally { authority.ui.finish(call) }
    }
    const prepared = await read({ purpose: "prepare-material" }, async (call) => {
      const issue = async (id: string) => ok(await business.dashboardRecords.issue({
        page: "All Projects", recordType: "projects", recordId: id, fields: ["name", "budget", "spent", "status"], period,
      }, call))
      const source = await issue("project")
      const material = dependency ? await issue("dependency") : undefined
      const scope: ConfirmationScope = {
        sourceRef: { surface: "dashboard", type: "projects", id: "project", incarnation: source.target.incarnation },
        fields: source.target.fields, period, scopeDefinitionVersion: "dashboard-c06-v1",
        materialDependencies: material ? [{
          surface: "dashboard", type: "projects", id: "dependency", incarnation: material.target.incarnation,
          version: material.target.version, fields: material.target.fields, period, observedAt: at,
        }] : [],
      }
      const observation = ok(await confirmation.prepare(scope, call))
      expect(observation.projection.missing).toEqual([])
      if (!observation.selectionRef) throw new Error("Native selection receipt missing")
      const admitted = await authority.readContextAdmission(request())
      if (admitted.status !== "ok") throw new Error("Native F01 context unavailable: " + JSON.stringify(admitted))
      return { scope, observation, context: Schema.decodeUnknownSync(SfContext)({
        stamp: admitted.stamp,
        contractRevision: "sf-native-ui/1", authMode: "local-operator", destinations: [],
        availability: [{ family: "domain-read", resource: "confirmations", state: "ready", operations: [
          "collaboration.confirmation-prepare", "collaboration.confirmation-project",
          "collaboration.confirmation-confirm", "collaboration.storage-version",
        ].map((operationId) => ({ operationId, state: "ready", reason: null, operational: true })) }],
      }) }
    })
    const events: { operation: string; result?: unknown; error?: string }[] = []
    const commands: ConfirmationCommand[] = []
    const outcomes: Awaited<ReturnType<typeof confirmation.confirm>>[] = []
    const commit = async (command: ConfirmationCommand) => {
      const admitted = await authority.human.admit(request(), "collaboration.confirmation.confirm", command)
      if (admitted.status !== "ok") return admitted
      try { return await confirmation.confirm(command, admitted.value) }
      finally { authority.human.finish(admitted.value) }
    }
    const http = createCollaborationHttp({
      origin: "https://example.test", mount: "/sf", host: business.collaboration, human: authority.human,
      admitRead: async (request, action, payload) => {
        const operation = "sf-read:" + action
        const digest = digestSfValue(payload)
        const admitted = await authority.ui.admit(request, operation, digest)
        if (admitted.status !== "ok") return admitted
        if (!await authority.ui.validate(admitted.value, operation, digest)) {
          authority.ui.finish(admitted.value)
          return { status: "denied", reason: "read-authority-unavailable" }
        }
        return admitted
      },
      finishRead: authority.ui.finish,
    })
    const transport: SfTransport = {
      async execute(operation, input, options) {
        const event: { operation: string; result?: unknown; error?: string } = { operation: operation.operationId }
        events.push(event)
        try {
          const command = operation.operationId === "collaboration.confirmation-confirm"
            ? Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-confirm"].input)(input) : undefined
          if (command) commands.push(structuredClone(command))
          const response = await http(new Request("https://example.test/sf?sf=" + operation.operationId.replace("collaboration.", "collaboration-"), {
            method: "POST", signal: options.signal, body: JSON.stringify(input),
            headers: { origin: "https://example.test", actor: "person", "content-type": "application/json",
              ...(options.idempotencyKey ? { "Idempotency-Key": options.idempotencyKey } : {}) },
          }))
          if (!response) throw new Error("Native collaboration route unavailable")
          const result: unknown = await response.json()
          event.result = result
          if (command) outcomes.push(Schema.decodeUnknownSync(SfCollaboration.operations["collaboration.confirmation-confirm"].output)(result))
          return { kind: "response", status: response.status, headers: {}, body: Schema.decodeUnknownSync(operation.output)(result) }
        } catch (error) { event.error = String(error); throw error }
      },
    }
    return { ...prepared, transport, commands, outcomes, commit, save, control, events,
      sourceSnapshot: () => persistence.transaction("dashboard", async (snapshot) => ({ commit: false,
        value: structuredClone({ data: snapshot.data, versions: snapshot.versions, audit: snapshot.audit }) })),
      storage: () => read({ purpose: "read-version" }, (call) => business.collaboration.storageVersion("confirmations", call)).then(ok),
      close: async () => { business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
    }
  } catch (error) {
    disposeBusiness(); await store.dispose(); await rm(directory, { recursive: true, force: true }); throw error
  }
}
