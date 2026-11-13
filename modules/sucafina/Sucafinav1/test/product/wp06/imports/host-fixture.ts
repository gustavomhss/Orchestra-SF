import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { openLocalStore } from "../../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../../runtime/operator-identity.ts"
import { roleMap } from "../../../../runtime/admin.ts"
import type { Snapshot } from "../../../../runtime/contract.ts"
import { createSfSourcePersistence, sfSourceIdentity } from "../../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../../product/integration/source-inventory.ts"
import { createSfProductState } from "../../../../product/host-binding/state-provider.ts"
import { createSfUiAuthority } from "../../../../product/integration/ui-authority.ts"
import { createSfHumanAuthority, sfHumanActions } from "../../../../product/integration/human-authority.ts"
import { digestSfEvidenceRef, digestSfValue } from "../../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../../product/contracts/business-context.ts"
import type { PortResult } from "../../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../../product/contracts/sf-execution.ts"
import { projectPlannerSource } from "../../../../product/planner/port.ts"
import { createSfImportHost } from "../../../../product/imports/host.ts"

/** Real signed local session, C08 provider and SQLite store. The domain role policy is
 * deliberately mutable test input; it is not a native SessionV2 or corporate identity proof. */
export async function importHostFixture(forecasts?: [number, number]) {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-import-negative-"))
  const driver = await openLocalStore(directory)
  const store = createSfSourcePersistence({ persistence: driver, enumerate: enumerateSfSources, createId: randomUUID })
  await store.initializeSources("dashboard")
  await store.initializeSources("planner")
  const operator = { installationId: randomUUID(), uid: 1000, name: "Synthetic import operator" }
  const identity = createOperatorIdentity({ origin: "http://localhost:4110", mount: "/sucafina", operator, secrets: driver.secrets, key: randomBytes(32) })
  const login = await identity.handle(new Request(`http://localhost:4110/sucafina/auth/local?code=${await identity.enroll()}`))
  const cookie = login!.headers.get("set-cookie")!.split(";")[0]!
  const request = new Request("http://localhost:4110/sucafina/dashboard", { method: "POST", headers: { cookie, origin: "http://localhost:4110" } })
  const principal = await store.transaction("planner", async (snapshot) => ({ commit: false, value: await identity.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") }) }))
  if (!principal) throw new Error("Missing signed operator session")
  const policy = { role: "finance", active: true, changeRosterOnRead: 0, rosterReads: 0 }
  const actor = () => ({ id: principal.id, roles: [policy.role], canWrite: true, assigned: [], domains: [] })
  const line = (id: string, owner: string, forecast?: number) => ({ id, sec: "opex", el: "licenses", name: id, cur: "USD", owner, b: Array(12).fill(forecasts ? 0 : 100), a: Array(12).fill(null), f: forecast === undefined ? Array(12).fill(null) : [forecast, ...Array(11).fill(null)] })
  await store.transaction("planner", async (snapshot) => {
    snapshot.data.versions = [{ id: "v1", year: 2027, closed: 0, locked: false, lines: [line("owned", principal.id, forecasts?.[0]), line("foreign", "other-principal", forecasts?.[1])], projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
    snapshot.data.roster = []
    snapshot.data.officials = {}; snapshot.data.entities = []; snapshot.data.allocations = []
    return { commit: true, value: undefined }
  })
  const access = { installationId: operator.installationId, projectId: "project", principalRef: principal.id, policyVersion: "policy", accessRevision: "access" }
  const ui = createSfUiAuthority({ privateCommands: sfHumanActions.map((action) => `sf-human:${action}`), authorize: async () => policy.active ? access : undefined, createId: randomUUID, now: () => Date.parse("2026-11-13T00:00:00Z"), commandIdentity: async (_, operation) => operation })
  const human = createSfHumanAuthority({ origin: "http://localhost:4110", ui })
  const host = { persistence: store, authenticate: async (...args: Parameters<typeof identity.authenticate>) => { const person = await identity.authenticate(...args); return person && args[1]?.surface === "planner" ? { ...person, roles: [{ surface: "planner" as const, role: policy.role }] } : person }, environment: async () => ({ at: "2026-11-13T00:00:00Z", id: randomUUID, directory: [] }), requestFor: (context: TrustedDomainContext) => context.kind === "ui" ? ui.requestFor(context) : undefined, revalidate: async (context: TrustedDomainContext) => context.kind === "ui" && await ui.revalidate(context) }
  const state = createSfProductState({ persistence: store, createId: randomUUID, authorize: async (input, snapshot) => policy.active && await identity.authenticate(input, { surface: "dashboard", roleMap: roleMap(snapshot, "dashboard") }) ? { principalRef: principal.id, accessRevision: "access", policyVersion: "policy" } : undefined, resolveTarget: async (_, __, ___, ref) => { const snapshot = (store as typeof store & { currentSnapshots?: () => { planner: Snapshot } | undefined }).currentSnapshots?.()?.planner; return snapshot ? sfSourceIdentity(snapshot, "planner-version", ref) : undefined } })
  const targetIdentity = await store.transaction("planner", async (snapshot) => ({ commit: false, value: sfSourceIdentity(snapshot, "planner-version", "v1") }))
  if (!targetIdentity) throw new Error("Missing Planner source")
  const target = { surface: "planner" as const, selectionRef: "v1", incarnation: targetIdentity.incarnation, version: targetIdentity.version, options: { newVersion: false, removeMissing: false, preview: {} } }
  const resolveTarget = async () => store.transaction<PortResult<{ versionId: string; evidence: Extract<BusinessEvidenceRef, { kind: "record" }> }>>("planner", async (snapshot) => {
    const source = sfSourceIdentity(snapshot, "planner-version", "v1")
    const projection = projectPlannerSource(snapshot, actor(), "v1")
    if (!source || !projection) return { commit: false, value: { status: "unavailable" as const, reason: "source-unavailable" } }
    const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: "source-v1", installationId: access.installationId, projectId: access.projectId, refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-version", recordId: "v1", incarnation: source.incarnation, version: source.version, fields: Object.keys(projection).sort(), period: { start: "2027-01-01", end: "2027-12-31" }, projectionDigest: digestSfValue({ versionId: "v1", projection }) } }
    evidence.refDigest = digestSfEvidenceRef(evidence)
    return { commit: false, value: { status: "ok" as const, value: { versionId: "v1", evidence } } }
  })
  const resolveRoster = async () => {
    policy.rosterReads++
    if (policy.rosterReads === policy.changeRosterOnRead) await store.transaction("planner", async (snapshot) => {
      snapshot.data.roster = [{ name: "Concurrent person", title: "Analyst", type: "Employee", leader: "Lead", location: "Geneva", start: "2027-01-01", end: "", status: "Active" }]
      return { commit: true, value: undefined }
    })
    return store.transaction<PortResult<Extract<BusinessEvidenceRef, { kind: "record" }>>>("planner", async (snapshot) => {
      const source = sfSourceIdentity(snapshot, "planner-roster", "file")
      if (!source) return { commit: false, value: { status: "unavailable" as const, reason: "roster-unavailable" } }
      const evidence: Extract<BusinessEvidenceRef, { kind: "record" }> = { schema: "sf-evidence-v1", refId: `roster:${source.incarnation}:${source.version}`, installationId: access.installationId, projectId: access.projectId, refDigest: "", evidenceLevel: "observed", kind: "record", target: { surface: "planner", recordType: "planner-roster", recordId: "file", incarnation: source.incarnation, version: source.version, fields: ["end", "leader", "location", "name", "start", "status", "title", "type"], period: { start: "2027-01-01", end: "2027-12-31" }, projectionDigest: digestSfValue(snapshot.data.roster) } }
      evidence.refDigest = digestSfEvidenceRef(evidence)
      return { commit: false, value: { status: "ok" as const, value: evidence } }
    })
  }
  const imports = createSfImportHost({ host, assets: store, services: { scan: async () => true, signingKey: randomBytes(32) }, state, operationIdentity: (context) => context.kind === "ui" ? ui.operationIdentity(context) : undefined, authorizeTarget: async () => policy.active, authorizeAdmission: (payload, context) => human.authorize(context, "imports.admit", payload), preview: { revalidate: host.revalidate }, apply: { revalidate: host.revalidate, confirm: (manifest, context) => human.authorize(context, "imports.apply", { manifestId: manifest.id, version: manifest.version }) }, planner: { resolveTarget, verifyTarget: (snapshot, selection) => { const current = sfSourceIdentity(snapshot, "planner-version", selection.selectionRef); return current?.incarnation === selection.incarnation && current.version === selection.version }, resolveRoster, verifyRoster: (snapshot, evidence) => { const current = sfSourceIdentity(snapshot, "planner-roster", "file"); return current?.incarnation === evidence.target.incarnation && current.version === evidence.target.version && digestSfValue(snapshot.data.roster) === evidence.target.projectionDigest } }, dashboard: { resolveTarget: async () => ({ status: "unavailable", reason: "not-selected" }), verifyScope: () => false } })
  return {
    store, imports, request, ui, human, policy, state, principal, target,
    close: async () => { await driver.dispose(); await rm(directory, { recursive: true, force: true }) },
    read: () => store.transaction("planner", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
    prepare: async (rows: (string | number)[][], table = { name: "OPEX", headers: ["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"] }) => {
      const book = new Workbook(); const sheet = book.addWorksheet(table.name)
      sheet.addRow(table.headers)
      rows.forEach((row) => sheet.addRow(row))
      const bytes = new Uint8Array(await book.xlsx.writeBuffer())
      const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
      const grant = await human.admit(request, "imports.admit", { target, format: "xlsx", digest })
      if (grant.status !== "ok") throw new Error(grant.reason)
      const file = await imports.admit({ target, format: "xlsx", bytes }, grant.value)
      human.finish(grant.value)
      if (file.status !== "ok") throw new Error(file.reason)
      const selection = { admittedFileRef: file.value.ref, format: "xlsx", options: {} }
      const previewGrant = await ui.admit(request, "sf_import_preview", digestSfValue(selection))
      if (previewGrant.status !== "ok" || !await ui.validate(previewGrant.value, "sf_import_preview", digestSfValue(selection))) throw new Error("Missing preview grant")
      const result = await imports.preview(selection, previewGrant.value)
      ui.finish(previewGrant.value)
      return result
    },
    apply: async (selection: { manifestId: string; version: number }) => {
      const grant = await human.admit(request, "imports.apply", selection)
      if (grant.status !== "ok") return grant
      const result = await imports.apply(selection, grant.value)
      human.finish(grant.value)
      return result
    },
  }
}
