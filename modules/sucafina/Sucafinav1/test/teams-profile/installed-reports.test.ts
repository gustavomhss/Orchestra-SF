import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import JSZip from "jszip"
import { SfReviewsReviewAgenda, SfReviewsReviewAgendaOptions, SfReviewsReviewPreserve, SfReviewsReviewRead } from "@orchestra/schema/sucafina/reviews"
import { decodeSfOperationOutput } from "../../product/contracts/schema-admission.ts"
import { DashboardPortfolio } from "../../runtime/dashboard-portfolio.ts"
import { group, oid } from "../microsoft-login/oidc-fixture.ts"
import { publicOrigin } from "../microsoft-login/private-fixture.ts"
import { openInstalledTeamFixture } from "./installed-team-fixture.ts"

test("installed Microsoft Team preserves a Dashboard review and downloads its original DOCX", async () => {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const title = "Isolated Teams report source"
  const note = "Persist this exact original project note"
  await using fixture = await openInstalledTeamFixture({
    additionalTeamIds: ["88888888-8888-4888-8888-888888888888"],
    groups: { dashboard: { admin: "group:" + group }, planner: {}, procurement: {} },
    grants: [{ principalRef: oid, namespaces: ["reviews", "documents"],
      operations: ["sf_review_prepare", "sf_report_prepare", "sf_artifact_get"], humanActions: ["reviews.preserve"] }],
    seed: (store) => store.transaction("dashboard", async (snapshot) => {
      const project = DashboardPortfolio.domain.execute(snapshot, { id: oid, roles: ["admin"], canWrite: true }, {
        page: "All Projects", action: "save", version: 0,
        values: { name: title, budget: 1250, spent: 320, status: "In Progress", risk: "Low",
          start: period.start, end: period.end, notes: note },
      }, { at: "2026-11-13T04:01:10Z", id: () => "installed-reports-project", directory: [] })
      if (!project.ok) throw new Error("The canonical Dashboard project seed was rejected")
      return { commit: true, value: undefined }
    }),
  })
  const cookie = await fixture.login()
  const send = (mode: string, options: { payload?: unknown; query?: Record<string, string>; selector?: string | null } = {}) => {
    const selector = options.selector === undefined ? fixture.team.selector : options.selector
    const headers = { cookie, ...(selector ? { "x-sf-team-profile": selector } : {}) }
    const url = fixture.mount + "/dashboard?" + new URLSearchParams({ sf: mode, ...options.query })
    if (options.payload === undefined) return fixture.request(url, { headers })
    return fixture.request(url, { method: "POST",
      headers: { ...headers, origin: publicOrigin, "content-type": "application/json", "idempotency-key": randomUUID() },
      body: JSON.stringify(options.payload) })
  }
  const catalogResponse = await send("review-agenda", { query: { ...period, domain: "dashboard" } })
  const catalog = Schema.decodeUnknownSync(SfReviewsReviewAgendaOptions.output)(await successfulJson(catalogResponse, "agenda catalog"))
  if (catalog.status !== "ok") throw new Error("Installed Team agenda catalog unavailable")
  const project = catalog.value.options.find((option) => option.item.kind === "dashboard" && option.item.topic === "all-projects")
  if (!project) throw new Error("Installed Team agenda did not issue the live Dashboard project source")
  const previewResponse = await send("review-agenda", { payload: { items: [project.item] } })
  const preview = Schema.decodeUnknownSync(SfReviewsReviewAgenda.output)(await successfulJson(previewResponse, "agenda preview"))
  if (preview.status !== "ok") throw new Error("Installed Team agenda preview unavailable")
  expect(preview.value.sectionRefs).toHaveLength(1)
  const preservedResponse = await send("review-preserve", { payload: {
    selectionRef: preview.value.selectionRef, sectionRefs: preview.value.sectionRefs,
  } })
  const preserved = Schema.decodeUnknownSync(SfReviewsReviewPreserve.output)(await successfulJson(preservedResponse, "preserve review"))
  if (preserved.status !== "ok") throw new Error("Installed Team review preservation unavailable")
  const reviewRef = preserved.value.id
  const reopened = await send("review-read", { query: { reviewRef } })
  expect(Schema.decodeUnknownSync(SfReviewsReviewRead.output)(await successfulJson(reopened, "reopen review"))).toEqual(preserved)

  const reportResponse = await send("review-report", { payload: { reviewRef, format: "docx", sectionRefs: preview.value.sectionRefs } })
  const report = Schema.decodeUnknownSync(Schema.Struct({
    status: Schema.Literal("ok"),
    outputRef: Schema.String.check(Schema.isPattern(/^report:[a-f0-9]{64}$/)),
    result: Schema.Unknown,
  }))(await successfulJson(reportResponse, "prepare DOCX"))
  const material = decodeSfOperationOutput("sf_report_prepare", report.result)
  if (!material.ok) throw new Error("Installed Team report producer returned invalid material")
  expect(material.value.reviewSelectionRef).toBe(reviewRef)
  const artifactRef = report.outputRef
  const foreign = fixture.team.additionalTeams[0]
  if (!foreign) throw new Error("Installed administration did not enable the second Team")
  const foreignRead = await send("review-read", { query: { reviewRef }, selector: foreign.selector })
  const refusedReview = await deniedBody(foreignRead, "other eligible Team reopen")
  const deniedReview = await parseResponseJson(refusedReview)
  expect(!!deniedReview && typeof deniedReview === "object" && "status" in deniedReview &&
    deniedReview.status === "denied" && !("value" in deniedReview)).toBe(true)
  expect(refusedReview.includes(title)).toBe(false)
  for (const [stage, selector] of [["missing-Team download", null], ["other eligible Team download", foreign.selector]] as const) {
    const denied = await send("review-download", { query: { artifactRef }, selector })
    const body = await deniedBody(denied, stage)
    expect(denied.headers.get("content-disposition")).toBeNull()
    expect(body.includes(note)).toBe(false)
  }
  const download = await send("review-download", { query: { artifactRef } })
  if (download.status !== 200) await successfulJson(download, "download original DOCX")
  expect(download.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  const office = await JSZip.loadAsync(await download.arrayBuffer())
  const document = await office.file("word/document.xml")?.async("string")
  if (!document) throw new Error("Installed Teams report has no Word document body")
  // Table cells can split a source value into multiple Word text runs.
  const content = Array.from(document.matchAll(/<w:t(?:\s[^>]*)?>([^<]*)<\/w:t>/g), (run) => run[1]).join("")
  expect(content.includes(title)).toBe(true)
  expect(content.includes(note)).toBe(true)
}, 300_000)

async function successfulJson(response: Response, stage: string): Promise<unknown> {
  const value: unknown = await response.json().catch(() => undefined)
  if (response.status !== 200) throw responseError(response, stage, value)
  return value
}

async function deniedBody(response: Response, stage: string) {
  const body = await response.text()
  if (response.status !== 403) {
    const value: unknown = response.headers.get("content-type")?.includes("application/json")
      ? await parseResponseJson(body) : undefined
    throw responseError(response, stage, value)
  }
  return body
}

function parseResponseJson(body: string): Promise<unknown> {
  return Promise.resolve().then(() => JSON.parse(body)).catch(() => undefined)
}

function responseError(response: Response, stage: string, value: unknown) {
  const reason = value && typeof value === "object" && "reason" in value && typeof value.reason === "string" &&
    /^[a-z][a-z0-9-]{0,79}$/.test(value.reason) ? " (" + value.reason + ")" : ""
  return new Error("Installed Reports " + stage + " returned HTTP " + response.status + reason)
}
