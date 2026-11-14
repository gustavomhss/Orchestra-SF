import { expect } from "bun:test"
import { randomBytes } from "node:crypto"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { readCaseAnalysisProjection } from "../../../product/interface/case-analysis-input.ts"
import type { AssetServices } from "../../../runtime/assets.ts"
import { object } from "../../../runtime/contract.ts"
import { loadLocalConfiguration } from "../../../runtime/local-configuration.ts"
import { scanLocalFile } from "../../../runtime/local-scanner.ts"
import type { Wp12NativeMissionContext } from "./native-mission-harness.ts"

export const WP12_IMPORT_PERIOD = { start: "2027-01-01", end: "2027-12-31" }
const versionId = "wp12-import-baseline"

/** Reuse only the scanner configured by the installed application. This does not
 * prepare an installation, start a scanner, change its configuration or use its
 * identity. The isolated fixture has its own transient asset signing key. */
export async function wp12InstalledImportAssets(skillId: string): Promise<AssetServices | undefined> {
  const file = process.env.SUCAFINA_LOCAL_CONFIG
  const scanner = file ? (await loadLocalConfiguration(file)).config.scanner : null
  if (!scanner) {
    console.log("SF_WP12_NATIVE_IMPORT_AVAILABILITY:" + JSON.stringify({ scope: "existing-installation-scanner-configuration",
      githubSha: process.env.GITHUB_SHA ?? null, skillId, status: "unavailable",
      reason: file ? "installed-scanner-not-configured" : "installed-configuration-not-selected",
      fileAdmitted: false, inputPrepared: false, scanExecuted: false, inferenceExecuted: false, gnativeAccepted: false }))
    return undefined
  }
  return { signingKey: randomBytes(32), scan: (bytes) => scanLocalFile(bytes, scanner) }
}

export async function initializeWp12ImportPlanner(persistence: Wp12NativeMissionContext["persistence"]) {
  await persistence.transaction("planner", async (snapshot) => {
    snapshot.data = { versions: [{ id: versionId, name: "Selected annual plan", year: 2027, closed: 0, locked: false,
      lines: [{ id: "42", name: "Licences", sec: "opex", el: "licenses", cur: "USD",
        b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(100) }],
      fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {} }],
      officials: { "2027": versionId }, entities: [], allocations: [], roster: [] }
    return { commit: true, value: undefined }
  })
}

/** File bytes enter through the mounted multipart C04 route and its real scanner.
 * No staged-file row, preview manifest, execution receipt or source is seeded. */
export async function prepareWp12ImportCase(context: Wp12NativeMissionContext, objective: string) {
  const http = context.services.productHttp
  if (!http) throw new Error("The real import HTTP services are missing")
  const before = await wp12ImportDomainDigest(context)
  const issued = await context.ui("sf_case_draft", { purpose: "import-case-source-selection", versionId },
    (call) => context.business.plannerProduct.issueSource(versionId, call))
  if (issued.status !== "ok") throw new Error(`The real import case source was refused: ${issued.reason}`)
  const targetsResponse = await http(context.request(undefined, "/sucafina/planner?sf=import-targets&surface=planner", "GET"), "planner")
  if (!targetsResponse) throw new Error("The real import target discovery route is missing")
  const targets = object(await targetsResponse.json())
  expect(targetsResponse.status).toBe(200)
  expect(targets.status).toBe("ok")
  if (!Array.isArray(targets.value)) throw new Error("The import target discovery did not return choices")
  const selected = targets.value.map(object).find((target) => target.selectionRef === issued.value.evidence.refId)
  if (!selected || selected.surface !== "planner" || !Array.isArray(selected.formats) || !selected.formats.includes("xlsx"))
    throw new Error("The human-selected Planner source is not an admitted import target")

  const { Workbook } = await import("exceljs")
  const workbook = new Workbook()
  const sheet = workbook.addWorksheet("OPEX")
  sheet.addRow(["Line ID", "Cost element", "Vendor / item", "Currency", "Measure", "Jan"])
  sheet.addRow(["42", "Licenses", "Licences", "USD", "Forecast", 80])
  const bytes = new Uint8Array(await workbook.xlsx.writeBuffer())
  const sourceDigest = new Bun.CryptoHasher("sha256").update(bytes).digest("hex")
  // The checksum identifies these actual bytes but has not admitted them to C04.
  const unadmittedResponse = await http(context.request({ admittedFileRef: sourceDigest, format: "xlsx", options: {} },
    "/sucafina/planner?sf=import-preview"), "planner")
  if (!unadmittedResponse) throw new Error("The real import preview route is missing")
  const unadmitted = object(await unadmittedResponse.json())
  expect(unadmittedResponse.status).toBe(503)
  expect(unadmitted.status).toBe("unavailable")
  expect(await wp12ImportDomainDigest(context)).toBe(before)
  const form = new FormData()
  form.set("file", new File([bytes], "selected-plan.xlsx", { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }))
  form.set("surface", "planner")
  form.set("selectionRef", issued.value.evidence.refId)
  form.set("options", JSON.stringify({ newVersion: false, removeMissing: false, preview: {} }))
  const admissionRequest = context.request(form, "/sucafina/planner?sf=import-admit")
  expect(admissionRequest.headers.get("content-type")).toContain("multipart/form-data; boundary=")
  const admittedResponse = await http(admissionRequest, "planner")
  if (!admittedResponse) throw new Error("The real import file admission route is missing")
  const admitted = object(await admittedResponse.json())
  if (admittedResponse.status !== 200 || admitted.status !== "ok")
    throw new Error(`The configured scanner/import admission did not admit the workbook: HTTP ${admittedResponse.status}, ${String(admitted.status)}`)
  const file = object(admitted.value)
  if (typeof file.ref !== "string" || !file.ref.trim() || typeof file.expiresAt !== "string")
    throw new Error("The C04 file admission omitted its public reference")
  expect(file.digest).toBe(sourceDigest)
  const decoded = decodeSfOperationInput("sf_import_preview", { admittedFileRef: file.ref, format: "xlsx", options: {} })
  if (!decoded.ok) throw new Error("The admitted C04 file cannot form the canonical preview request")
  const importRequest = decoded.value
  const previewResponse = await http(context.request(importRequest, "/sucafina/planner?sf=import-preview"), "planner")
  if (!previewResponse) throw new Error("The real import preview route is missing")
  const preview = object(await previewResponse.json())
  expect(previewResponse.status).toBe(200)
  expect(preview.status).toBe("ok")
  const manifest = decodeSfOperationOutput("sf_import_preview", preview.value)
  if (!manifest.ok) throw new Error("The C04 preview failed its canonical output contract")
  expect(manifest.value.sourceDigest).toBe(sourceDigest)
  expect(manifest.value.state).toBe("preview")
  expect(manifest.value.domainApplied).toBe(false)
  expect(manifest.value.receipts).toHaveLength(0)
  expect(manifest.value.baseIdentity).toHaveLength(1)
  expect(manifest.value.baseIdentity[0]!.id).toBe(versionId)
  expect(manifest.value.baseIdentity[0]!.incarnation).toBe(issued.value.evidence.target.incarnation)
  expect(manifest.value.baseIdentity[0]!.version).toBe(issued.value.evidence.target.version)
  expect(manifest.value.commands).toHaveLength(1)
  expect(manifest.value.commands.every((command) => !("command" in command))).toBe(true)
  expect(object(preview.receipt).kind).toBe("ui")
  const draft = { objective, horizon: WP12_IMPORT_PERIOD, currency: "USD",
    criteria: ["Explain the selected authorized analysis and its current evidence without applying domain changes"],
    sourceRefs: [issued.value.evidence] }
  const decision = await context.ui("sf_case_draft", draft, (call) => context.business.cases.draft(draft, call))
  if (decision.status !== "ok") throw new Error(`The real import case could not be created: ${decision.reason}`)
  const caseRef = { id: decision.value.id, incarnation: decision.value.incarnation, version: decision.value.version }
  const consumer = await readWp12ImportConsumer(context, manifest.value.id)
  expect(consumer.manifest).toEqual(manifest.value)
  expect(await wp12ImportDomainDigest(context)).toBe(before)

  const changedOptions = { ...importRequest, options: { headerRow: 2 } }
  const refusedResponse = await http(context.request(changedOptions, "/sucafina/planner?sf=import-preview"), "planner")
  if (!refusedResponse) throw new Error("The real import preview route disappeared")
  const refused = object(await refusedResponse.json())
  expect(refusedResponse.status).toBe(409)
  expect(refused.status).toBe("stale")
  expect(await wp12ImportDomainDigest(context)).toBe(before)
  console.log("SF_WP12_NATIVE_IMPORT_PREPARED:" + JSON.stringify({ scope: "real-configured-scanner-C04-and-domain-case",
    githubSha: process.env.GITHUB_SHA ?? null, caseRef, admittedFileRef: importRequest.admittedFileRef,
    sourceDigest, previewRef: manifest.value.id, previewDigest: consumer.digest,
    unadmittedFileStatus: unadmitted.status, changedOptionsStatus: refused.status,
    domainApplied: false, inferenceExecuted: false, gnativeAccepted: false }))
  return { caseRef, caseDigest: digestSfValue(decision.value), sourceRef: issued.value.evidence,
    importRequest, previewRef: manifest.value.id, consumer, domainDigest: before }
}

export async function readWp12ImportConsumer(context: Wp12NativeMissionContext, previewRef: string) {
  const http = context.services.productHttp
  if (!http) throw new Error("The real import reader is missing")
  const response = await http(context.request(undefined,
    `/sucafina/planner?sf=import-reference&importPreviewRef=${encodeURIComponent(previewRef)}`, "GET"), "planner")
  if (!response) throw new Error("The import reference consumer is missing")
  const body = object(await response.json())
  expect(response.status).toBe(200)
  expect(body.status).toBe("ok")
  const value = object(body.value)
  const manifest = decodeSfOperationOutput("sf_import_preview", value.manifest)
  if (!manifest.ok || typeof value.digest !== "string" || !/^[a-f0-9]{64}$/.test(value.digest))
    throw new Error("The import reference consumer returned an invalid manifest or digest")
  expect(manifest.value.id).toBe(previewRef)
  expect(manifest.value.state).toBe("preview")
  expect(manifest.value.domainApplied).toBe(false)
  expect(manifest.value.receipts).toHaveLength(0)
  expect(manifest.value.commands.every((command) => !("command" in command))).toBe(true)
  const detail = object(value.detail)
  expect(detail.manifestId).toBe(previewRef)
  expect(detail.version).toBe(manifest.value.version)
  expect(detail.sourceDigest).toBe(manifest.value.sourceDigest)
  if (!Array.isArray(detail.changes) || !detail.changes.length) throw new Error("The workbook preview has no actual detailed changes")
  expect(detail.changes.map(object).some((change) => object(change.source).kind === "file" && object(change.source).address === "F2")).toBe(true)
  const detailResponse = await http(context.request(undefined,
    `/sucafina/planner?sf=import-detail&manifestId=${encodeURIComponent(previewRef)}&version=${manifest.value.version}`, "GET"), "planner")
  if (!detailResponse) throw new Error("The import detail consumer is missing")
  const detailed = object(await detailResponse.json())
  expect(detailResponse.status).toBe(200)
  expect(detailed.status).toBe("ok")
  expect(object(detailed.value).digest).toBe(value.digest)
  expect(digestSfValue(object(detailed.value).detail)).toBe(digestSfValue(detail))
  return { manifest: manifest.value, digest: value.digest, detailDigest: digestSfValue(detail) }
}

export async function assertWp12ImportCaseUnchanged(context: Wp12NativeMissionContext, prepared: Awaited<ReturnType<typeof prepareWp12ImportCase>>) {
  expect(await wp12ImportDomainDigest(context)).toBe(prepared.domainDigest)
  const current = await readCaseAnalysisProjection(context.request(), context.services, prepared.caseRef)
  if (current.status !== "ok") throw new Error("The selected import case could not be read under the current grant")
  expect(digestSfValue(current.value.case)).toBe(prepared.caseDigest)
  expect(await readWp12ImportConsumer(context, prepared.previewRef)).toEqual(prepared.consumer)
}

/** Change the actual selected domain base only after the positive readers ran. */
export async function assertWp12ChangedImportBaseRefused(context: Wp12NativeMissionContext,
  prepared: Awaited<ReturnType<typeof prepareWp12ImportCase>>, runRef?: string) {
  await context.persistence.transaction("planner", async (snapshot) => {
    if (!Array.isArray(snapshot.data.versions)) throw new Error("The selected Planner base is missing")
    const version = snapshot.data.versions.map(object).find((row) => row.id === versionId)
    if (!version || !Array.isArray(version.lines)) throw new Error("The selected Planner version has no lines")
    const line = version.lines.map(object).find((row) => row.id === "42")
    if (!line || !Array.isArray(line.f) || line.f[0] !== 100) throw new Error("The selected Planner base unexpectedly changed")
    line.f = [90, ...line.f.slice(1)]
    return { commit: true, value: undefined }
  })
  const changed = await wp12ImportDomainDigest(context)
  expect(changed).not.toBe(prepared.domainDigest)
  const response = await context.services.productHttp?.(context.request(undefined,
    `/sucafina/planner?sf=import-reference&importPreviewRef=${encodeURIComponent(prepared.previewRef)}`, "GET"), "planner")
  if (!response) throw new Error("The C04 reference reader disappeared after the source change")
  const body = object(await response.json())
  expect(response.status).not.toBe(200)
  expect(body.status).not.toBe("ok")
  expect(body.value).toBeUndefined()
  const output = runRef ? await context.human("analysis.read", { runRef }, (call) => {
    if (!context.services.analyses) throw new Error("The analysis output reader disappeared")
    return context.services.analyses.output(call, runRef)
  }) : undefined
  if (output) expect(output.status).not.toBe("ok")
  expect(await wp12ImportDomainDigest(context)).toBe(changed)
  console.log("SF_WP12_NATIVE_IMPORT_BASE_CHANGED:" + JSON.stringify({ scope: "actual-source-change-after-positive-consumers",
    githubSha: process.env.GITHUB_SHA ?? null, caseRef: prepared.caseRef, previewRef: prepared.previewRef,
    previewStatus: body.status, currentNativeOutputStatus: output?.status ?? null, oldPreviewExposed: false,
    previewAppliedToDomain: false, inferenceExecuted: false, gnativeAccepted: false }))
}

async function wp12ImportDomainDigest(context: Wp12NativeMissionContext) {
  return context.persistence.transaction("planner", async (snapshot) => ({ commit: false, value: digestSfValue(snapshot.data) }))
}
