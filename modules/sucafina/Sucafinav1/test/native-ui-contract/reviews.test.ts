/**
 * A07 native reviews contract tests. Synthetic inputs only: these assertions
 * NEVER claim to exercise an authenticated installation, Microsoft identity,
 * installed desktop broker or a successful Office download.
 *
 * Execution is reserved for GitHub Actions dispatcher 120 on the integrated
 * candidate. Do not run this file locally in the A07 authoring session.
 */
import { describe, expect, test } from "bun:test"
import { Option, Schema } from "effect"
import {
  SfDashboardDashboardAgenda, SfDashboardDashboardCapture,
  SfDashboardDashboardReview, SfDashboardDashboardReviewPreserve,
  SfProjectionReview, SfReviewsExportDocx, SfReviewsExportPptx, SfReviewsReportPrepare,
  SfReviewsReviewSource, SfReviewsReviewUpdate, SfReviews,
} from "../../../../../packages/schema/src/sucafina/reviews.ts"
import { createSfReviewsClient } from "../../../../../packages/client/src/sucafina/reviews.ts"
import type { SfOperation, SfTransportResult } from "../../../../../packages/schema/src/sucafina/common.ts"
import type { SfCallOptions, SfTransport } from "../../../../../packages/client/src/sucafina/transport.ts"

const accepts = <A>(schema: Schema.Decoder<A, never>, value: unknown): boolean =>
  Option.isSome(Schema.decodeUnknownOption(schema)(value))

// Schema.toType verifies decoded values without claiming the wire's erased
// DecodingServices (including Receipt/EvidenceRef) are context-free.
const acceptsDecoded = <S extends Schema.Top>(schema: S, value: unknown): boolean =>
  Option.isSome(Schema.decodeUnknownOption(Schema.toType(schema), { onExcessProperty: "error" })(value))
const section = {
  id: "line-one", title: "Current agenda", selectionRef: "scoped-selection",
  topic: "budget", period: { start: "2026-01-01", end: "2026-12-31" },
}

describe("A07 closed schema / source equivalence", () => {
  test("frozen operations and the source-backed prepare extension, no generic dispatcher", () => {
    expect(Object.keys(SfReviews).sort()).toEqual([
      "dashboard.dashboard-agenda", "dashboard.dashboard-capture",
      "dashboard.dashboard-history", "dashboard.dashboard-review",
      "dashboard.dashboard-review-preserve", "projection.review",
      "reviews.export.docx", "reviews.export.pptx", "reviews.report.prepare", "reviews.review-source",
      "reviews.review-thread-context", "reviews.review-update",
    ].sort())
  })

  test("agenda accepts original authorized selection shape, rejects extras", () => {
    expect(accepts(SfDashboardDashboardAgenda.input, { sections: [section] })).toBe(true)
    expect(accepts(SfDashboardDashboardAgenda.input, { sections: [section], actorId: "self-granted" })).toBe(false)
    expect(accepts(SfDashboardDashboardAgenda.input, { sections: [{ ...section, grants: ["admin"] }] })).toBe(false)
    expect(accepts(SfDashboardDashboardAgenda.input, { sections: [{ ...section, period: null }] })).toBe(false)
  })

  test("capture, history, preserve, source lookup reject input privilege injection", () => {
    expect(accepts(SfDashboardDashboardCapture.input, { sourceRef: "record:23" })).toBe(true)
    expect(accepts(SfDashboardDashboardCapture.input, { sourceRef: "record:23", principalRef: "other" })).toBe(false)
    expect(accepts(SfDashboardDashboardReview.input, { id: "review:1", expectedVersion: 2 })).toBe(false)
    expect(accepts(SfDashboardDashboardReviewPreserve.input, {
      selectionRef: "scoped", sectionRefs: ["one"], approval: true,
    })).toBe(false)
    expect(accepts(SfReviewsReviewSource.input, {
      reviewRef: "review:1", referenceId: "source:1", origin: "https://attacker.example",
    })).toBe(false)
  })

  test("projection query is closed, no private snapshot/role overrides", () => {
    expect(accepts(SfProjectionReview.input, {
      reviewRef: "review:2", sectionId: "line-one",
    })).toBe(true)
    expect(accepts(SfProjectionReview.input, {
      reviewRef: "review:2", principalRef: "other",
    })).toBe(false)
    expect(accepts(SfProjectionReview.input, {
      reviewRef: "review:2", data: { privateSnapshot: true },
    })).toBe(false)
  })

  test("preserves source 503/unavailable rather than falsely revoking access", () => {
    const bad = { status: "unavailable" }
    expect(accepts(SfDashboardDashboardReview.output, bad)).toBe(true)
    expect(accepts(SfReviewsReviewUpdate.output, { status: "stale", reason: "source-changed" })).toBe(true)
    expect(accepts(SfReviewsReviewUpdate.output, { status: "ok", value: { arbitrary: true } })).toBe(false)
    expect(accepts(SfReviewsReviewSource.output, { links: [{ label: "source", url: "/dashboard?page=IT" }] })).toBe(true)
    expect(accepts(SfReviewsReviewSource.output, { links: [{ label: "source", url: "/dashboard", auth: "token" }] })).toBe(false)
  })

  test("review-source JSON closes nested links and both outer envelopes", () => {
    const link = { label: "source", url: "/dashboard?page=IT" }
    expect(accepts(SfReviewsReviewSource.output, {
      links: [link, { label: "secondary", url: "/dashboard?page=Finance" }],
    })).toBe(true)
    expect(accepts(SfReviewsReviewSource.output, {
      links: [{ ...link, auth: "token" }],
    })).toBe(false)
    expect(accepts(SfReviewsReviewSource.output, {
      links: [{ ...link, headers: { Authorization: "token" } }],
    })).toBe(false)
    expect(accepts(SfReviewsReviewSource.output, {
      links: [link], principalRef: "someone-else",
    })).toBe(false)
    expect(accepts(SfReviewsReviewSource.output, { status: "unavailable" })).toBe(true)
    expect(accepts(SfReviewsReviewSource.output, {
      status: "denied", reason: "source-outside-preserved-review",
    })).toBe(true)
    expect(accepts(SfReviewsReviewSource.output, {
      status: "unavailable", auth: "token",
    })).toBe(false)
    expect(accepts(SfReviewsReviewSource.output, {
      status: "ok", value: { links: [link] },
    })).toBe(false)
  })

  test("Office form selection remains format-specific and never decodes HTML/bytes", () => {
    const input = { year: "2026", topic: ["Executive Summary"], title: "Quarterly" }
    expect(accepts(SfReviewsExportDocx.input, input)).toBe(true)
    expect(accepts(SfReviewsExportPptx.input, input)).toBe(true)
    expect(accepts(SfReviewsExportDocx.output, "<html>review workspace</html>")).toBe(false)
    expect(accepts(SfReviewsExportPptx.output, { receipt: "invented" })).toBe(false)
  })

  test("report prepare uses the closed source request and preserves failures", () => {
    const input = { reviewRef: "review:1", sectionRefs: ["section-id"], format: "docx" }
    expect(accepts(SfReviewsReportPrepare.input, input)).toBe(true)
    expect(accepts(SfReviewsReportPrepare.input, { ...input, title: "invented" })).toBe(false)
    expect(accepts(SfReviewsReportPrepare.input, { ...input, format: "html" })).toBe(false)
    expect(acceptsDecoded(SfReviewsReportPrepare.output, { status: "stale", reason: "review-changed",
      receipt: { kind: "unbound", operation: "sf_report_prepare", code: "unavailable", at: "now" } })).toBe(true)
    expect(acceptsDecoded(SfReviewsReportPrepare.output, { status: "ok", result: {}, outputRef: "https://example.test" })).toBe(false)
  })
})

describe("A07 fail-closed client (no fake authorization)", () => {
  let calls = 0
  const transport: SfTransport = {
    execute: async <Input, Output>(
      _operation: SfOperation<Input, Output>, _input: Input, _options: SfCallOptions,
    ): Promise<SfTransportResult<Output>> => {
      calls += 1
      return { kind: "transport-error", reason: "contract-unavailable" }
    },
  }
  const client = createSfReviewsClient(transport)
  const read = { signal: new AbortController().signal }
  const mutate = { ...read, idempotencyKey: "intent-0000001" }

  test("invalid, duplicated or empty agenda cannot reach transport", async () => {
    calls = 0
    const bad = { sections: [section, section] }
    expect(await client["dashboard.dashboard-agenda"](bad, read)).toEqual({
      kind: "transport-error", reason: "contract-mismatch",
    })
    expect(calls).toBe(0)
    expect(await client["dashboard.dashboard-agenda"]({ sections: [section] }, read))
      .toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    expect(calls).toBe(1)
  })

  test("mutation intent requires explicit key, never retries after unknown result", async () => {
    calls = 0
    expect(await client["dashboard.dashboard-capture"]({ sourceRef: "record:one" }, read))
      .toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(calls).toBe(0)
    await client["dashboard.dashboard-capture"]({ sourceRef: "record:one" }, mutate)
    expect(calls).toBe(1)
  })

  test("new JSON projection refuses mixed review identities", async () => {
    calls = 0
    expect(await client["projection.review"]({
      reviewRef: "review:1", previousReviewRef: "review:2",
    }, read)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(calls).toBe(0)
  })

  test("DOCX/PPTX never pretend the current HTML producer generated a file", async () => {
    calls = 0
    const request = { year: "2026" as const, topic: ["Budget Overview"] }
    expect(await client["reviews.export.docx"](request, read))
      .toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    expect(await client["reviews.export.pptx"](request, read))
      .toEqual({ kind: "transport-error", reason: "contract-unavailable" })
    expect(calls).toBe(0)
  })

  test("report prepare requires a unique section selection and explicit intent", async () => {
    calls = 0
    const input = { reviewRef: "review:1", sectionRefs: ["section-id"], format: "docx" as const }
    expect(await client["reviews.report.prepare"](input, read)).toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(await client["reviews.report.prepare"]({ ...input, sectionRefs: ["section-id", "section-id"] }, mutate))
      .toEqual({ kind: "transport-error", reason: "contract-mismatch" })
    expect(calls).toBe(0)
    await client["reviews.report.prepare"](input, mutate)
    expect(calls).toBe(1)
  })
})
