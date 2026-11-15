import { expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { join } from "node:path"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { DomainProjection, PreservedReview } from "../../../product/contracts/context.ts"
import type { CapabilityResult } from "../../../product/contracts/sf-execution.ts"
import { renderPreservedReview } from "../../../product/reviews/render.ts"
import { object } from "../../../runtime/contract.ts"
import { createExportArtifactFixture, inspectOfficeBytes } from "./fixture.ts"
import { exportEvidenceDirectory, recordExportEvidence } from "./evidence.ts"

const mediaTypes = {
  docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

async function prepare(f: Awaited<ReturnType<typeof createExportArtifactFixture>>, review: PreservedReview, format: "docx" | "pptx", key: string) {
  const response = await f.request("review-report", { key, payload: { reviewRef: review.id, sectionRefs: review.sections.map((section) => section.id), format } })
  const result = await response.json() as CapabilityResult
  expect({ http: response.status, result }).toMatchObject({ http: 200, result: { status: "ok" } })
  if (result.status !== "ok" || !result.outputRef) throw new Error("Composed report did not produce an artifact reference")
  return result.outputRef
}

async function denied(response: Response) {
  expect(response.status).toBe(403)
  expect(response.headers.get("content-disposition")).toBeNull()
  expect(response.headers.get("cache-control")).toBe("no-store")
  expect(await response.text()).toBe("Access denied")
}

test("real composed DOCX and PPTX preserve content, source bindings, bytes and the original command after SQLite reopen", async () => {
  const f = await createExportArtifactFixture()
  try {
    expect(Object.keys(object((await f.productState()).reviews))).toEqual([])
    const review = await f.preserve()
    expect(review.sections.map((section) => section.count)).toEqual([1, 1])
    expect(review.sections.map((section) => section.period)).toEqual([f.period, f.period])
    const projections = review.sections.map((section) => section.content as DomainProjection)
    const forecast = projections[1]!
    expect(forecast.values.find((value) => value.id === "license:1:forecast")).toMatchObject({ value: 110, currency: "USD", period: { start: "2026-01-01", end: "2026-01-31" } })
    expect(forecast.components.reduce((total, component) => total + (component.amount ?? 0), 0)).toBe(1320)
    expect(projections[0]!.values.some((value) => value.value === f.note)).toBe(true)
    const sourceRefs = [...new Map(review.sourceRefs.map((ref) => [digestSfValue(ref), ref])).values()]
    expect(new Set(sourceRefs.map((ref) => ref.surface))).toEqual(new Set(["dashboard", "planner"]))
    for (const ref of sourceRefs) {
      expect(Number.isSafeInteger(ref.version) && ref.version > 0).toBe(true)
      expect(ref.incarnation.length).toBeGreaterThan(0)
    }
    const evidence = projections.flatMap((projection) => projection.values.flatMap((value) => value.sourceRefs))
    expect(evidence.length).toBeGreaterThan(0)
    const artifacts: { format: "docx" | "pptx"; ref: string; bytes: Uint8Array; digest: string; state: Record<string, unknown> }[] = []
    const manifests: Awaited<ReturnType<typeof recordExportEvidence>>[] = []
    for (const format of ["docx", "pptx"] as const) {
      const key = `export66-original-${format}`
      const ref = await prepare(f, review, format, key)
      const state = await f.document(ref)
      expect(state).toMatchObject({ kind: "sf-review-artifact-v1", principalRef: f.owner, installationId: "export66-installation", projectId: "export66-project",
        reviewRef: review.id, reviewDigest: digestSfValue(review), format, mediaType: mediaTypes[format], recordCount: 2 })
      expect(state.evidenceRefs).toEqual(evidence)
      expect(state.sectionRefs).toEqual(review.sections.map((section) => section.id))
      const beforeRead = await f.durable()
      const response = await f.request("review-download", { query: { artifactRef: ref } })
      expect(response.status).toBe(200)
      expect(response.headers.get("content-type")).toBe(mediaTypes[format])
      expect(response.headers.get("content-disposition")).toBe(`attachment; filename*=UTF-8''${encodeURIComponent(String(state.name))}`)
      expect(response.headers.get("x-content-type-options")).toBe("nosniff")
      expect(response.headers.get("cache-control")).toBe("no-store")
      const bytes = new Uint8Array(await response.arrayBuffer())
      expect(Buffer.from(bytes).toString("base64")).toBe(state.bytes)
      const opened = await inspectOfficeBytes(bytes, format)
      expect(opened.sha256).toBe(state.digest)
      expect(opened.bytes).toBeGreaterThan(0)
      expect(opened.contentTypes).toContain(format === "docx" ? "wordprocessingml.document.main+xml" : "presentationml.presentation.main+xml")
      const styled = opened.styles + opened.parts.map((part) => part.xml).join("")
      expect(styled).toContain("Aptos")
      expect(styled).toContain("173D2C")
      expect(opened.compact).toContain(`Review${review.id}v${review.version}`)
      expect(opened.compact).toContain(review.createdAt)
      expect(opened.compact).toContain(f.note.replace(/\s+/g, ""))
      expect(opened.text).not.toContain("SYNTHETIC_UNSELECTED_PRIVATE_66")
      for (const section of review.sections) {
        expect(opened.compact).toContain(section.title.replace(/\s+/g, ""))
        expect(opened.compact).toContain(`${section.period.start}–${section.period.end}`)
      }
      for (const value of projections.flatMap((projection) => projection.values)) {
        const displayed = `${value.id}:${value.value === null ? "unavailable" : String(value.value)}${value.unit ?? ""}${value.currency ?? ""}`.replace(/\s+/g, "")
        expect(opened.compact).toContain(displayed)
        expect(opened.compact).toContain(`${value.period.start}–${value.period.end}`)
      }
      for (const ref of [...new Set(evidence.map((reference) => reference.refId))]) expect(opened.compact).toContain(ref)
      expect(await f.durable()).toEqual(beforeRead)
      const beforeRetry = await f.durable()
      expect(await prepare(f, review, format, key)).toBe(ref)
      expect(await f.durable()).toEqual(beforeRetry)
      expect(await f.document(ref)).toEqual(state)
      const manifest = await recordExportEvidence({ caseId: `composed-${format}`, name: String(state.name), mediaType: mediaTypes[format], bytes,
        observations: { implementation: "real-C08-SQLite-Request-UI-human-review-report", corpus: "synthetic", review_ref: review.id, review_version: review.version,
          review_digest: digestSfValue(review), source_refs: sourceRefs, evidence_ref_ids: [...new Set(evidence.map((reference) => reference.refId))],
          source_version_display: "opaque-evidence-reference-only; explicit-source-version-labels-require-Reports48", record_count: 2,
          currencies: [...new Set(projections.flatMap((projection) => projection.values.flatMap((value) => value.currency ? [value.currency] : [])))],
          horizon: f.period, xml_parts: opened.paths, zip_entries: opened.zipEntries, source_note_complete: true, private_unselected_field_absent: true,
          exact_retry_unchanged: true, read_snapshot_unchanged: true, visible_style_markup: ["Aptos", "173D2C"], visual_render_qualification: "external-renderer-required" } })
      manifests.push(manifest)
      artifacts.push({ format, ref, bytes, digest: opened.sha256, state })
    }
    expect(Object.keys(object((await f.productState()).documents)).sort()).toEqual(artifacts.map((artifact) => artifact.ref).sort())
    const beforeReopen = await f.durable()
    await f.reopen()
    expect(await f.durable()).toEqual(beforeReopen)
    for (const artifact of artifacts) {
      const reopened = await f.request("review-download", { query: { artifactRef: artifact.ref } })
      expect(reopened.status).toBe(200)
      const bytes = new Uint8Array(await reopened.arrayBuffer())
      expect(Buffer.from(bytes).equals(Buffer.from(artifact.bytes))).toBe(true)
      expect((await inspectOfficeBytes(bytes, artifact.format)).sha256).toBe(artifact.digest)
      expect(await prepare(f, review, artifact.format, `export66-original-${artifact.format}`)).toBe(artifact.ref)
      expect(await f.document(artifact.ref)).toEqual(artifact.state)
    }
    expect(await f.durable()).toEqual(beforeReopen)
    const conflicting = await f.request("review-report", { key: "export66-original-docx", payload: { reviewRef: review.id, sectionRefs: review.sections.map((section) => section.id), format: "pptx" } })
    expect((await conflicting.json() as CapabilityResult).status).toBe("stale")
    expect(await f.durable()).toEqual(beforeReopen)
    // A changed current source cannot rewrite the preserved file or its original receipt.
    await f.changeCandidate(130)
    const drifted = await f.durable()
    await f.reopen()
    for (const artifact of artifacts) {
      const historical = await f.request("review-download", { query: { artifactRef: artifact.ref } })
      expect(historical.status).toBe(200)
      expect(Buffer.from(await historical.arrayBuffer()).equals(Buffer.from(artifact.bytes))).toBe(true)
      expect(await f.document(artifact.ref)).toEqual(artifact.state)
    }
    expect(await f.durable()).toEqual(drifted)
    await Bun.write(join(exportEvidenceDirectory, "composed.manifest.json"), JSON.stringify({ schema: "sf66-composed-export-proof-v1", artifacts: manifests,
      checks: { reopen_exact_bytes: true, original_retry_no_duplicate_or_effect: true, reused_key_changed_intent_rejected: true, changed_source_keeps_capture: true,
        read_side_effects: "none in complete SQLite snapshots" } }, null, 2) + "\n")
    console.log("SF66_COMPOSED_STORAGE " + JSON.stringify({ formats: artifacts.map((artifact) => ({ format: artifact.format, artifact_ref: artifact.ref, sha256: artifact.digest, bytes: artifact.bytes.length })),
      reopen_exact_bytes: true, original_retry_no_duplicate_or_effect: true, changed_source_keeps_capture: true, read_side_effects: false }))
  } finally { await f.dispose() }
}, 120000)

test("real Request authority denies foreign, read-only recipient, ungranted, expired, revoked and malformed artifact access without writes", async () => {
  const f = await createExportArtifactFixture()
  try {
    const review = await f.preserve()
    const ref = await prepare(f, review, "docx", "export66-auth-docx")
    const initial = await f.durable()
    for (const session of ["foreign", "viewer", "ungranted", "missing"]) await denied(await f.request("review-download", { session, query: { artifactRef: ref } }))
    expect(await f.durable()).toEqual(initial)
    // Source captures bind the original access revision. Downgrading the writer
    // to viewer closes that captured scope instead of recycling the old grant.
    f.sessions.owner!.memberships = ["viewers"]
    await denied(await f.request("review-download", { query: { artifactRef: ref } }))
    const deniedWrite = await f.request("review-report", { key: "export66-read-only-new-command", payload: { reviewRef: review.id, sectionRefs: review.sections.map((section) => section.id), format: "docx" } })
    expect((await deniedWrite.json() as CapabilityResult).status).not.toBe("ok")
    expect(await f.durable()).toEqual(initial)
    f.sessions.owner!.memberships = ["admins"]
    f.sessions.owner!.expiresAt = Date.parse(f.clock.at)
    await denied(await f.request("review-download", { query: { artifactRef: ref } }))
    f.sessions.owner!.expiresAt = Infinity
    f.sessions.owner!.active = false
    await denied(await f.request("review-download", { query: { artifactRef: ref } }))
    f.sessions.owner!.active = true
    const beforeExpiry = f.clock.at
    await f.withCall("sf_artifact_get", { artifactRef: ref }, async (call) => {
      f.clock.at = new Date(Date.parse(f.clock.at) + 5 * 60 * 1000 + 1).toISOString()
      await denied(await f.app.artifacts.download(ref, call))
    })
    f.clock.at = beforeExpiry
    for (const invalid of ["../private.docx", "..\\private.docx", ref + "/../secret", "report:" + "0".repeat(64)]) await denied(await f.request("review-download", { query: { artifactRef: invalid } }))
    const aborted = new AbortController()
    aborted.abort()
    const stopped = await f.request("review-download", { query: { artifactRef: ref }, signal: aborted.signal })
    expect(stopped.status).toBe(403)
    expect(await stopped.text()).not.toContain("Export66 source project")
    expect((await f.request("review-download", { method: "POST", query: { artifactRef: ref } })).status).toBe(405)
    expect(await f.durable()).toEqual(initial)
    console.log("SF66_AUTHORITY_RESULT " + JSON.stringify({ foreign: "denied", read_only_recipient: "denied", ungranted: "denied", missing_session: "denied",
      owner_downgraded_to_viewer: "denied-by-captured-source-scope", expired_session: "denied", expired_real_ui_lease: "denied", revoked_session: "denied", malformed_ref: "denied", read_side_effects: false }))
  } finally { await f.dispose() }
}, 120000)

test("real C08 corrupted or tombstoned artifacts fail closed before download without repairing durable state", async () => {
  const f = await createExportArtifactFixture()
  try {
    const review = await f.preserve()
    const ref = await prepare(f, review, "docx", "export66-corrupt-docx")
    const original = await f.document(ref)
    const jsonBytes = Buffer.from('{"not":"Office"}')
    const mutations: { label: string; record: Record<string, unknown> | null }[] = [
      { label: "traversal-name", record: { ...original, name: "../private.docx" } },
      { label: "windows-path-name", record: { ...original, name: "C:\\private\\report.docx" } },
      { label: "header-name", record: { ...original, name: "report.docx\r\nX-Injected: yes" } },
      { label: "untrusted-mime", record: { ...original, mediaType: "text/html" } },
      { label: "false-ooxml-format", record: { ...original, name: "report.pptx", mediaType: mediaTypes.pptx, format: "pptx" } },
      { label: "empty-bytes-valid-hash", record: { ...original, bytes: "", digest: createHash("sha256").update("").digest("hex") } },
      { label: "noncanonical-base64", record: { ...original, bytes: "%%%=" } },
      { label: "over-limit-base64-before-decode", record: { ...original, bytes: "A".repeat(Math.ceil(f.maxBytes / 3) * 4 + 4) } },
      { label: "non-ooxml-valid-hash", record: { ...original, bytes: jsonBytes.toString("base64"), digest: createHash("sha256").update(jsonBytes).digest("hex") } },
      { label: "wrong-digest", record: { ...original, digest: "0".repeat(64) } },
      { label: "wrong-review-digest", record: { ...original, reviewDigest: "0".repeat(64) } },
      { label: "wrong-coverage", record: { ...original, recordCount: Number(original.recordCount) + 1 } },
      { label: "missing-evidence", record: { ...original, evidenceRefs: [] } },
      { label: "foreign-principal-stamp", record: { ...original, principalRef: "synthetic-export-foreign" } },
      { label: "foreign-project-stamp", record: { ...original, projectId: "another-project" } },
      { label: "tombstoned", record: null },
    ]
    for (const mutation of mutations) {
      await f.corrupt(ref, mutation.record)
      const corrupt = await f.durable()
      await denied(await f.request("review-download", { query: { artifactRef: ref } }))
      expect(await f.durable()).toEqual(corrupt)
      await f.corrupt(ref, original)
    }
    const recovered = await f.request("review-download", { query: { artifactRef: ref } })
    expect(recovered.status).toBe(200)
    expect(Buffer.from(await recovered.arrayBuffer()).toString("base64")).toBe(original.bytes)
    console.log("SF66_CORRUPTION_RESULT " + JSON.stringify({ rejected: mutations.map((mutation) => mutation.label), denial_body: "Access denied", read_side_effects: false }))
  } finally { await f.dispose() }
}, 120000)

test("real sealed render cannot authorize a traversal name or relabel DOCX bytes as PPTX", async () => {
  const f = await createExportArtifactFixture()
  try {
    const review = await f.preserve()
    const sectionRefs = review.sections.map((section) => section.id)
    const artifact = await renderPreservedReview(review, { title: `Review ${review.id}`, format: "docx", sectionRefs })
    expect(artifact.ok).toBe(true)
    if (!artifact.ok) throw new Error("Real DOCX renderer unavailable")
    const entry = { reviewRef: review.id, sectionRefs, artifact, format: "docx", recordCount: review.sections.reduce((total, section) => total + section.count, 0),
      evidenceRefs: review.sections.flatMap((section) => (section.content as DomainProjection).values.flatMap((value) => value.sourceRefs)) }
    const payload = { reviewRef: review.id, sectionRefs, format: "docx" }
    const valid = await f.withCall("sf_report_prepare", payload, (call) => f.app.artifacts.put(entry, call), { key: "export66-sealed-positive" })
    expect(valid.status).toBe("ok")
    const before = await f.durable()
    const initialName = artifact.name
    for (const name of ["../report.docx", "..\\report.docx", "/tmp/report.docx", "report.docx\n", "report\u202E.docx"]) {
      artifact.name = name
      const rejected = await f.withCall("sf_report_prepare", payload, (call) => f.app.artifacts.put(entry, call))
      expect(rejected).toEqual({ status: "needs-input", reason: "invalid-artifact" })
      expect(await f.durable()).toEqual(before)
    }
    artifact.name = "relabeled.pptx"
    artifact.type = mediaTypes.pptx
    const relabeled = await f.withCall("sf_report_prepare", { ...payload, format: "pptx" }, (call) => f.app.artifacts.put({ ...entry, format: "pptx" }, call))
    expect(relabeled).toEqual({ status: "needs-input", reason: "invalid-artifact" })
    expect(await f.durable()).toEqual(before)
    artifact.name = initialName
    artifact.type = mediaTypes.docx
    const unsealed = await f.withCall("sf_report_prepare", payload, (call) => f.app.artifacts.put({ ...entry, artifact: { ...artifact } }, call))
    expect(unsealed).toEqual({ status: "denied", reason: "artifact-render-proof-unavailable" })
    expect(await f.durable()).toEqual(before)
    console.log("SF66_RENDER_SEAL_RESULT " + JSON.stringify({ real_seal_positive: true, traversal_rejected: true, same_sealed_object_cross_format_rejected: true,
      cloned_unsealed_object_rejected: true, invalid_put_side_effects: false }))
  } finally { await f.dispose() }
}, 120000)
