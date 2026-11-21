/**
 * Q01 F02 pure metadata and route contract (no live host).
 * Public I00 metadata is compared to the pinned 305-operation catalog and the
 * explicit source-backed file downloads. This file does not claim installed host admission or authorization.
 */
import { describe, expect, test } from "bun:test"
import { createHash } from "node:crypto"
import { readFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { SfOperationIds } from "@orchestra/schema/sucafina/common"
import { SfOperationExtensions, SfOperationRegistry } from "@orchestra/schema/sucafina/operation-registry"
import type { SfNativeOperationRoute } from "@orchestra/schema/sucafina/operation-registry"

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../..")
const catalogPath = path.join(root, "modules/sucafina/Sucafinav1/docs/sf2h/native-ui/execution/contract-catalog.json")
const catalogText = readFileSync(catalogPath, "utf8")
const sourceBlob = createHash("sha1").update(
  "blob " + Buffer.byteLength(catalogText) + "\0" + catalogText,
).digest("hex")
if (sourceBlob !== "31dbec1726fd8147156b01dc545726650ffd49e1") {
  throw new Error("Q01_TRANSPORT_CATALOG_DRIFT_REQUIRES_I00")
}
const catalog = JSON.parse(catalogText) as {
  operations: Record<string, { method: string; pathTemplate: string; effect: string; responseMode?: string;
    fixedQuery?: Record<string, string>; fixedBodyDiscriminator?: Record<string, string>; maxRequestBytes?: number }>
}

// These closed inputs omit surface. Bind only to the verified original adapters;
// the immutable I00 catalog remains the source for every other metadata field.
const surfaceBindings: Readonly<Record<string, "dashboard" | "procurement">> = {
  "collaboration.answer-confirm": "dashboard",
  "collaboration.answer-prepare": "dashboard",
  "collaboration.answer-prepare-message": "dashboard",
  "collaboration.answer-read": "dashboard",
  "collaboration.confirmation-confirm": "dashboard",
  "collaboration.confirmation-prepare": "dashboard",
  "collaboration.confirmation-project": "dashboard",
  "collaboration.cycle-read": "dashboard",
  "collaboration.handoff-create": "dashboard",
  "collaboration.handoff-link": "dashboard",
  "collaboration.handoff-update": "dashboard",
  "collaboration.question-consume": "dashboard",
  "collaboration.question-output": "dashboard",
  "collaboration.recipients": "dashboard",
  "collaboration.relation-create": "dashboard",
  "collaboration.relation-read": "dashboard",
  "collaboration.relation-remove": "dashboard",
  "collaboration.selection-create": "dashboard",
  "collaboration.selection-list": "dashboard",
  "collaboration.selection-version": "dashboard",
  "collaboration.storage-version": "dashboard",
  "collaboration.thread-create": "dashboard",
  "collaboration.thread-edit": "dashboard",
  "collaboration.thread-history": "dashboard",
  "collaboration.thread-read": "dashboard",
  "collaboration.thread-reply": "dashboard",
  "collaboration.thread-resolve": "dashboard",
  "collaboration.work-destination": "dashboard",
  "collaboration.work-list": "dashboard",
  "decisions.choice.read": "dashboard",
  "decisions.command.sf_case_draft": "dashboard",
  "decisions.command.sf_change_prepare": "dashboard",
  "decisions.command.sf_question_prepare": "dashboard",
  "decisions.controls.read": "dashboard",
  "decisions.current-choice-prepare": "dashboard",
  "decisions.current-choice-promote": "dashboard",
  "decisions.decision-add-question": "dashboard",
  "decisions.decision-answer-question": "dashboard",
  "decisions.decision-apply": "procurement",
  "decisions.decision-choose": "dashboard",
  "decisions.decision-condition": "dashboard",
  "decisions.decision-coverage": "dashboard",
  "decisions.decision-criteria": "dashboard",
  "decisions.decision-prepare-changes": "procurement",
  "decisions.decision-promote": "dashboard",
  "decisions.decision-recover": "procurement",
  "decisions.decision-review": "procurement",
  "decisions.decision-select-portfolio": "dashboard",
}

describe("Q01 integrated transport contract / original producer", () => {
  test("Q01-TRANSPORT-REGISTRY preserves the frozen catalog and its explicit source extension", () => {
    expect(Object.keys(catalog.operations)).toHaveLength(305)
    const expectedExtensions = {
      // Original runtime/admin.ts configure-summaries, exposed by the bounded native port.
      "local-admin.summary-read": { method: "GET", pathTemplate: "{mount}/api/ui/local-admin/summary-settings", effect: "read", responseMode: "json" },
      "local-admin.summary-configure": { method: "POST", pathTemplate: "{mount}/api/ui/local-admin/configure-summaries", effect: "mutation", responseMode: "json", maxRequestBytes: 16384 },
      "dashboard.dashboard-draft-read": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "read",
        responseMode: "json", fixedQuery: { sf: "dashboard-draft-read" } },
      "dashboard.dashboard-hot-topic-draft-outcome": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "read",
        responseMode: "json", fixedQuery: { sf: "dashboard-hot-topic-draft-outcome" } },
      "decisions.decision-edit": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "mutation",
        responseMode: "json", fixedQuery: { sf: "decision-edit" }, maxRequestBytes: 262144 },
      "decisions.decision-compare": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "read",
        responseMode: "json", fixedQuery: { sf: "decision-compare" }, maxRequestBytes: 262144 },
      "decisions.portfolio.catalog": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "read",
        responseMode: "json", fixedQuery: { sf: "decision-portfolio-catalog" }, fixedBodyDiscriminator: { purpose: "catalog" }, maxRequestBytes: 262144 },
      "reviews.review-read": { method: "GET", pathTemplate: "{mount}/dashboard", effect: "read",
        responseMode: "json", fixedQuery: { sf: "review-read" } },
      "reviews.review-agenda-options": { method: "GET", pathTemplate: "{mount}/dashboard", effect: "read",
        responseMode: "json", fixedQuery: { sf: "review-agenda" } },
      "reviews.review-agenda": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "preview",
        responseMode: "json", fixedQuery: { sf: "review-agenda" }, maxRequestBytes: 262144 },
      "reviews.review-preserve": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "mutation",
        responseMode: "json", fixedQuery: { sf: "review-preserve" }, maxRequestBytes: 262144 },
      "files.export.members": { method: "GET", pathTemplate: "{mount}/{surface}", effect: "read",
        responseMode: "bytes", fixedQuery: { download: "members" } },
      "files.export.po": { method: "GET", pathTemplate: "{mount}/{surface}", effect: "read",
        responseMode: "bytes", fixedQuery: { download: "po" } },
      "files.export.review": { method: "GET", pathTemplate: "{mount}/{surface}", effect: "read",
        responseMode: "bytes", fixedQuery: { sf: "review-download" } },
      "reviews.report.prepare": { method: "POST", pathTemplate: "{mount}/dashboard", effect: "prepare",
        responseMode: "json", fixedQuery: { sf: "review-report" }, maxRequestBytes: 65536 },
    }
    expect(Object.keys(SfOperationExtensions).sort()).toEqual([...Object.keys(expectedExtensions), ...Object.keys(surfaceBindings)].sort())
    for (const [id, expected] of Object.entries(expectedExtensions))
      expect(SfOperationExtensions[id as keyof typeof SfOperationExtensions]).toEqual(expected)
    for (const [id, surface] of Object.entries(surfaceBindings)) {
      const source = catalog.operations[id]
      if (!source) throw new Error("Original bound operation is absent from the frozen catalog: " + id)
      expect(source.pathTemplate).toBe("{mount}/{surface}")
      expect(SfOperationExtensions[id as keyof typeof SfOperationExtensions]).toEqual({
        method: source.method, pathTemplate: "{mount}/" + surface, effect: source.effect,
        responseMode: source.responseMode ?? "json",
        ...(source.fixedQuery ? { fixedQuery: source.fixedQuery } : {}),
        ...(source.fixedBodyDiscriminator ? { fixedBodyDiscriminator: source.fixedBodyDiscriminator } : {}),
        ...(source.maxRequestBytes !== undefined ? { maxRequestBytes: source.maxRequestBytes } : {}),
      })
    }
    // Explicit original producers added after I00; do not rewrite its pinned 305 IDs.
    // decision-domain-http.ts owns edit CAS; product/reviews/http.ts owns read/agenda/preserve.
    for (const id of ["dashboard.dashboard-draft-read", "dashboard.dashboard-hot-topic-draft-outcome", "decisions.decision-edit", "reviews.review-read", "reviews.review-agenda-options", "reviews.review-agenda", "reviews.review-preserve"] as const)
      expect(Object.hasOwn(catalog.operations, id)).toBe(false)
    expect(Object.hasOwn(catalog.operations, "local-admin.summary-read")).toBe(false)
    expect(Object.hasOwn(catalog.operations, "local-admin.summary-configure")).toBe(false)
    expect(Object.hasOwn(catalog.operations, "files.export.members")).toBe(false)
    expect(Object.hasOwn(catalog.operations, "files.export.po")).toBe(false)
    expect(Object.hasOwn(catalog.operations, "files.export.review")).toBe(false)
    expect(Object.hasOwn(catalog.operations, "reviews.report.prepare")).toBe(false)
    // U26/UI62 added a real, separately authorized producer *after* the frozen I00 catalog.
    // The original 305-operation blob and 3 declared exports are unchanged:
    // apps/cli/src/sucafina-product/memory-http.ts binds POST, bounded JSON
    // and current UI authority to product/memory/similarity217.ts.
    const similarCases = "intelligence.memory-similar-cases"
    expect(Object.hasOwn(catalog.operations, similarCases)).toBe(false)
    expect(Object.hasOwn(SfOperationExtensions, similarCases)).toBe(false)
    expect(SfOperationRegistry[similarCases]).toEqual({
      method: "POST", pathTemplate: "{mount}/dashboard", effect: "read",
      responseMode: "json", fixedQuery: { sf: "memory-similar-cases" }, maxRequestBytes: 65536,
    })
    // C05 pin stays outside the frozen 305 catalog. The installed producer is
    // product/reviews/http.ts review-thread-context; this route only names it.
    const reviewThreadContext = "reviews.review-thread-context"
    expect(Object.hasOwn(catalog.operations, reviewThreadContext)).toBe(false)
    expect(Object.hasOwn(SfOperationExtensions, reviewThreadContext)).toBe(false)
    expect(SfOperationRegistry[reviewThreadContext]).toEqual({
      method: "POST", pathTemplate: "{mount}/dashboard", effect: "read",
      responseMode: "json", fixedQuery: { sf: "review-thread-context" }, maxRequestBytes: 65536,
    })
    // NAV-01 deliberately replaced private-search GET with bounded POST to
    // avoid exposing the search text in URLs. Preserve the frozen source fact
    // and pin the installed original router's *different* method explicitly.
    // Source: apps/cli/src/sucafina-product/native-ui/router.ts.
    const privateSearch = "projection.search"
    expect(catalog.operations[privateSearch]?.method).toBe("GET")
    expect(SfOperationRegistry[privateSearch]).toEqual({
      method: "POST", pathTemplate: "{mount}/api/ui/projections/search", effect: "read",
      responseMode: "json", maxRequestBytes: 4096,
    })
    const expected = [...new Set([...Object.keys(catalog.operations), ...Object.keys(SfOperationExtensions), similarCases, reviewThreadContext])].sort()
    expect(Object.keys(SfOperationRegistry).sort()).toEqual(expected)
    expect([...SfOperationIds].sort()).toEqual(expected)
    expect(SfOperationRegistry["files.export.members"]).toEqual(SfOperationExtensions["files.export.members"])
    expect(SfOperationRegistry["files.export.po"]).toEqual(SfOperationExtensions["files.export.po"])
    expect(SfOperationRegistry["files.export.review"]).toEqual(SfOperationExtensions["files.export.review"])
    expect(SfOperationRegistry["reviews.report.prepare"]).toEqual(SfOperationExtensions["reviews.report.prepare"])
    for (const [id, source] of Object.entries(catalog.operations)) {
      const actual: SfNativeOperationRoute = SfOperationRegistry[id as keyof typeof SfOperationRegistry]
      expect(actual, "Q01 integrated metadata missing " + id).toBeDefined()
      expect(actual.method, "Q01 producer method " + id).toBe(id === privateSearch ? "POST" : source.method)
      expect(actual.pathTemplate).toBe(surfaceBindings[id] ? "{mount}/" + surfaceBindings[id] : source.pathTemplate)
      expect(actual.effect).toBe(source.effect)
      // The pinned 305 records do not encode responseMode; verify only claims
      // actually in the frozen source, and validate the normalized enum otherwise.
      if (source.responseMode !== undefined) expect(actual.responseMode).toBe(source.responseMode)
      else expect(["json", "bytes", "empty", "navigation"]).toContain(actual.responseMode)
      expect(actual.fixedQuery ?? {}).toEqual(source.fixedQuery ?? {})
      expect(actual.fixedBodyDiscriminator ?? {}).toEqual(source.fixedBodyDiscriminator ?? {})
    }
  })

  test("Q01-TRANSPORT-PILOT-ROUTES preserve mutation and response-loss policy", () => {
    const save = catalog.operations["domain.command.CAP25.save"]
    const approve = catalog.operations["domain.command.CAP26.approve"]
    expect(save?.method).toBe("POST")
    expect(approve?.method).toBe("POST")
    expect(save?.effect).toBe("mutation")
    expect(approve?.effect).toBe("mutation")
    expect(save?.pathTemplate).toBe("{mount}/procurement")
    expect(approve?.pathTemplate).toBe("{mount}/procurement")
    expect(save?.fixedBodyDiscriminator).toEqual({ page: "Requests", action: "save" })
    expect(approve?.fixedBodyDiscriminator).toEqual({ page: "My approvals", action: "approve" })
    // An operation table alone NEVER proves that a command was committed.
    // P0/P1 require native browser + original transaction/CAS + holder receipt.
  })
})
