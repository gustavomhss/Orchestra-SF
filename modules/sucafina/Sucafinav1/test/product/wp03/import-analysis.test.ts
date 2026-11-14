import { expect, test } from "bun:test"
import { randomBytes, randomUUID } from "node:crypto"
import { Workbook } from "exceljs"
import { roleMap } from "../../../runtime/admin.ts"
import { object, rows } from "../../../runtime/contract.ts"
import type { Actor, Snapshot } from "../../../runtime/contract.ts"
import { domain } from "../../../runtime/planner.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { ImportPreviewRequest } from "../../../product/contracts/operations.ts"
import type { DomainPortHost } from "../../../product/contracts/ports.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfProductState } from "../../../product/host-binding/state-provider.ts"
import { createSfImportHost } from "../../../product/imports/host.ts"
import type { ImportTarget } from "../../../product/imports/staged-files.ts"
import { verifyPlannerImportTarget } from "../../../product/imports/source-fences.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createSfPlannerSourceHost } from "../../../product/integration/planner-sources.ts"
import { createSfUiAuthority } from "../../../product/integration/ui-authority.ts"
import { createPlannerImportAnalysis } from "../../../product/planner/import-analysis.ts"
import { createPlannerSourceIssuer } from "../../../product/planner/source-issuer.ts"
import { plannerAt, plannerFixture, plannerPeriod, plannerSnapshot } from "./planner-fixture.ts"

test("C04 real staged workbook preview feeds Planner analysis without applying and rejects digest, scope and source changes", async () => {
  const initial = plannerSnapshot()
  initial.data.versions = [{ id: "v0", name: "Import baseline", year: 2027, closed: 0, locked: false,
    lines: [{ id: "line", name: "Licences", sec: "opex", el: "licenses", cur: "USD", b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(null) }],
    projects: [], fx: [], hc: { positions: [], rates: [], hrAF: {} }, lists: {} }]
  initial.data.officials = {}
  const fixture = await plannerFixture(initial)
  try {
    // C04 stores private staged bytes and previews in Dashboard/C08 while the
    // Planner remains unchanged. Initialize the same three surfaces as production.
    for (const surface of ["dashboard", "procurement"] as const) await fixture.persistence.initializeSources(surface)
    const identity = (request: Request) => fixture.access.allowed && request.headers.get("authorization") === "finance"
      ? { installationId: "i", projectId: "p", principalRef: "finance", policyVersion: "1", accessRevision: fixture.access.revision }
      : undefined
    const ui = createSfUiAuthority({ authorize: async (request) => identity(request),
      commandIdentity: async (_request, operation, digest) => `${operation}:${digest}`, createId: randomUUID, now: () => fixture.access.now,
      privateCommands: ["sf-human:planner.read", "sf-human:imports.admit", "sf-human:imports.apply"] })
    const human = createSfHumanAuthority({ origin: "https://example.test", ui })
    const host: DomainPortHost = { ...fixture.host,
      requestFor: (context) => context.kind === "ui" ? ui.requestFor(context) : undefined,
      revalidate: async (context) => context.kind === "ui" && await ui.revalidate(context) }
    const http = () => new Request("https://example.test/sucafina/planner", { method: "POST", headers: { authorization: "finance", origin: "https://example.test" } })
    const admit = async (operation: string, payload: unknown) => {
      const digest = digestSfValue(payload)
      const result = await ui.admit(http(), operation, digest)
      if (result.status !== "ok" || !await ui.validate(result.value, operation, digest)) throw new Error("private UI admission unavailable")
      return result.value
    }
    const context = await admit("sf-human:planner.read", {})
    const sources = createSfPlannerSourceHost({ host, scopedSources: fixture.persistence, coverageFor: async () => ({ status: "unavailable", reason: "preview-has-no-complete-coverage" }) })
    const issueSource = createPlannerSourceIssuer({ host, scopedSources: fixture.persistence, sources })
    const source = await issueSource("v0", context)
    expect(source.status).toBe("ok")
    if (source.status !== "ok") throw new Error(source.reason)
    const target: ImportTarget = { surface: "planner", selectionRef: source.value.evidence.refId,
      incarnation: source.value.evidence.target.incarnation, version: source.value.evidence.target.version,
      options: { newVersion: false, removeMissing: false, preview: {} } }
    const actorFor = async (snapshot: Snapshot, request: Request): Promise<Actor | undefined> => {
      const principal = await host.authenticate(request, { surface: "planner", roleMap: roleMap(snapshot, "planner") })
      if (!principal) return undefined
      return { id: principal.id, roles: principal.roles.filter((entry) => entry.surface === "planner").map((entry) => entry.role), canWrite: principal.canWrite, assigned: [], domains: [] }
    }
    const state = createSfProductState({ persistence: fixture.persistence, createId: randomUUID,
      authorize: async (request) => { const current = identity(request); return current ? { principalRef: current.principalRef, accessRevision: current.accessRevision, policyVersion: current.policyVersion } : undefined },
      resolveTarget: async (request, _snapshot, _namespace, reference) => {
        const current = fixture.persistence.currentSnapshots?.()?.planner
        const actor = current && await actorFor(current, request)
        return current && actor && reference === target.selectionRef && verifyPlannerImportTarget(current, target, actor, context)
          ? { incarnation: target.incarnation } : undefined
      } })
    const authorizeTarget = async (selected: ImportTarget, trusted: TrustedDomainContext) => {
      const request = host.requestFor(trusted)
      if (!request || !await host.revalidate(trusted)) return false
      return fixture.persistence.transaction("planner", async (snapshot) => {
        const actor = await actorFor(snapshot, request)
        return { commit: false, value: !!actor && verifyPlannerImportTarget(snapshot, selected, actor, trusted) }
      })
    }
    const book = new Workbook()
    const sheet = book.addWorksheet("OPEX")
    sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"])
    sheet.addRow(["line", "Licenses", "Licences", "USD", "Forecast", 0])
    const bytes = new Uint8Array(await book.xlsx.writeBuffer())
    const digest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
    const scan = { calls: 0 }
    const imports = createSfImportHost({ host, assets: fixture.persistence, state,
      // Deterministic scanner admission is a fixture boundary; workbook parsing,
      // staged bytes, C08, source fences, domain preview and analysis are real.
      services: { signingKey: randomBytes(32), scan: async (input, mediaType) => { scan.calls++; return mediaType === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" && new Bun.CryptoHasher("sha256").update(input).digest("hex") === digest } },
      operationIdentity: (trusted, operation) => trusted.kind === "ui" && (!operation || ui.matchesIntent(trusted, operation.name, operation.digest)) ? ui.operationIdentity(trusted) : undefined,
      authorizeTarget, authorizeAdmission: (payload, trusted) => human.authorize(trusted, "imports.admit", payload),
      preview: { revalidate: host.revalidate }, apply: { revalidate: host.revalidate, confirm: (manifest, trusted) => human.authorize(trusted, "imports.apply", { manifestId: manifest.id, version: manifest.version }) },
      planner: { resolveTarget: (selected, trusted) => sources.resolveForecastSource(selected.selectionRef, trusted), verifyTarget: verifyPlannerImportTarget },
      dashboard: { resolveTarget: async () => ({ status: "unavailable", reason: "dashboard-import-not-selected" }), verifyScope: () => false } })
    const admission = await human.admit(http(), "imports.admit", { target, format: "xlsx", digest })
    expect(admission.status).toBe("ok")
    if (admission.status !== "ok") throw new Error(admission.reason)
    const admitted = await imports.admit({ target, format: "xlsx", bytes }, admission.value)
    human.finish(admission.value)
    expect(admitted.status).toBe("ok")
    if (admitted.status !== "ok") throw new Error(admitted.reason)
    expect(scan.calls).toBe(1)
    const selection: ImportPreviewRequest = { admittedFileRef: admitted.value.ref, format: "xlsx", options: {} }
    const previewContext = await admit("sf_import_preview", selection)
    const preview = await imports.preview(selection, previewContext)
    expect(preview.status).toBe("ok")
    if (preview.status !== "ok") throw new Error(preview.reason)
    expect(preview.value).toMatchObject({ state: "preview", domainApplied: false, receipts: [], sourceDigest: digest, version: 1 })
    const prepared = await imports.readPreparedPreviewForAnalysis({ previewRef: preview.value.id, request: selection }, previewContext)
    expect(prepared.status).toBe("ok")
    if (prepared.status !== "ok") throw new Error(prepared.reason)
    expect(prepared.value.digest).toMatch(/^[a-f0-9]{64}$/)
    expect(prepared.value.execution?.commandDigest).toBe(prepared.value.manifest.commands[0]?.commandDigest)
    expect(prepared.value.execution?.previewDigest).toMatch(/^[a-f0-9]{64}$/)
    const before = await fixture.readSnapshot()
    const beforeC08 = await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))
    const analyze = createPlannerImportAnalysis({ host, issueSource, readPreview: imports.readPreparedPreviewForAnalysis,
      verifyTarget: (snapshot, manifest, actor, trusted) => {
        const base = manifest.baseIdentity[0]
        return !!base && base.surface === "planner" && base.type === "planner-version" && verifyPlannerImportTarget(snapshot, {
          ...target, selectionRef: `planner-version:${encodeURIComponent(base.id)}:${encodeURIComponent(base.incarnation)}:${base.version}`,
          incarnation: base.incarnation, version: base.version,
        }, actor, trusted)
      } })
    const request = { previewRef: preview.value.id, importRequest: selection, period: plannerPeriod, currency: "USD" }
    const result = await analyze(request, previewContext)
    expect(result.status).toBe("ok")
    if (result.status !== "ok") throw new Error(result.reason)
    expect(result.value).toMatchObject({ analysisBasis: "import-preview", importPreviewRef: preview.value.id, domainApplied: false, knownDifference: -100, completeDifference: null,
      comparison: { comparisonStatus: "conditioned", knownDifference: -100, completeDifference: null, costCoverageRefs: [] } })
    expect(result.value.baseline.values.find((value) => value.id === "line:1:outlook-usd")?.value).toBe(100)
    expect(result.value.candidate.values.find((value) => value.id === "line:1:outlook-usd")).toMatchObject({ value: 0, evidenceState: "hypothetical" })
    expect(result.value.candidate.values.every((value) => ["absent", "hypothetical"].includes(value.evidenceState))).toBe(true)
    expect(result.value.gaps).toContain("import-preview-not-applied")
    expect(result.value.gaps).toContain("import-preview-coverage-unresolved")
    expect(JSON.stringify(result.value)).not.toContain("import-workbook")
    expect(await fixture.readSnapshot()).toEqual(before)
    expect(await fixture.persistence.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) }))).toEqual(beforeC08)
    const unchanged = await imports.readPreparedPreviewForAnalysis({ previewRef: preview.value.id, request: selection }, previewContext)
    expect(unchanged.status).toBe("ok")
    if (unchanged.status !== "ok") throw new Error(unchanged.reason)
    expect(unchanged.value.digest).toBe(prepared.value.digest)
    expect(unchanged.value.manifest).toEqual(prepared.value.manifest)
    expect(await analyze(request, previewContext)).toEqual(result)
    expect(await analyze({ ...request, currency: "EUR" }, previewContext)).toMatchObject({ status: "needs-input", reason: "invalid-import-analysis-scope" })
    expect(await analyze({ ...request, importRequest: { ...selection, options: { sheet: "Other" } } }, previewContext)).toMatchObject({ status: "stale", reason: "preview-input-changed" })
    await fixture.persistence.transaction("dashboard", async (_snapshot, blobs) => { await blobs.put(`sf-import/${admitted.value.ref}`, new Uint8Array([1, 2, 3]), "application/octet-stream"); return { commit: true, value: undefined } })
    expect((await analyze(request, previewContext)).status).not.toBe("ok")
    expect(await fixture.readSnapshot()).toEqual(before)
    await fixture.persistence.transaction("dashboard", async (_snapshot, blobs) => { await blobs.put(`sf-import/${admitted.value.ref}`, bytes, "application/octet-stream"); return { commit: true, value: undefined } })
    expect((await analyze(request, previewContext)).status).toBe("ok")
    const changed = await fixture.persistence.transaction("planner", async (snapshot) => {
      const actor = await actorFor(snapshot, http())
      if (!actor) throw new Error("authenticated Planner actor unavailable")
      const edit = domain.execute(snapshot, actor, { page: "OPEX", action: "save", id: "line", version: 0, values: { versionId: "v0", f0: 50 } }, { at: plannerAt, id: randomUUID, directory: [] })
      return { commit: edit.ok, value: edit }
    })
    expect(changed.ok).toBe(true)
    const newer = await issueSource("v0", context)
    expect(newer.status).toBe("ok")
    if (newer.status !== "ok") throw new Error(newer.reason)
    expect(newer.value.evidence.target.incarnation).toBe(target.incarnation)
    expect(newer.value.evidence.target.version).toBeGreaterThan(target.version)
    const changedSnapshot = await fixture.readSnapshot()
    expect((await analyze(request, previewContext)).status).not.toBe("ok")
    expect(await fixture.readSnapshot()).toEqual(changedSnapshot)
    expect(rows(object(rows(changedSnapshot.data.versions)[0]).lines)[0]?.f).toEqual([50, ...Array(11).fill(null)])
    fixture.access.allowed = false
    expect(await analyze(request, previewContext)).toMatchObject({ status: "denied", reason: "import-analysis-access-unavailable" })
    ui.finish(context)
    ui.finish(previewContext)
  } finally { await fixture.close() }
})
