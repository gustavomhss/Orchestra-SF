import { expect, test } from "bun:test"
import { randomUUID } from "node:crypto"
import { Schema } from "effect"
import JSZip from "jszip"
import { SfReviewsReportPrepare, SfReviewsReviewAgenda, SfReviewsReviewAgendaOptions, SfReviewsReviewPreserve, SfReviewsReviewRead } from "@orchestra/schema/sucafina/reviews"
import { DashboardPortfolio } from "../../runtime/dashboard-portfolio.ts"
import { group, oid } from "../microsoft-login/oidc-fixture.ts"
import { publicOrigin } from "../microsoft-login/private-fixture.ts"
import { openInstalledTeamFixture } from "./installed-team-fixture.ts"

test("installed Microsoft Team preserves a Dashboard review and downloads its original DOCX", async () => {
  const period = { start: "2026-01-01", end: "2026-12-31" }
  const title = "Isolated Teams report source"
  const note = "Persist this exact original project note"
  await using fixture = await openInstalledTeamFixture({
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
  const catalog = Schema.decodeUnknownSync(SfReviewsReviewAgendaOptions.output)(await catalogResponse.json())
  expect(catalogResponse.status).toBe(200)
  if (catalog.status !== "ok") throw new Error("Installed Team agenda catalog unavailable")
  const project = catalog.value.options.find((option) => option.item.kind === "dashboard" && option.item.topic === "all-projects")
  if (!project) throw new Error("Installed Team agenda did not issue the live Dashboard project source")
  const previewResponse = await send("review-agenda", { payload: { items: [project.item] } })
  const preview = Schema.decodeUnknownSync(SfReviewsReviewAgenda.output)(await previewResponse.json())
  expect(previewResponse.status).toBe(200)
  if (preview.status !== "ok") throw new Error("Installed Team agenda preview unavailable")
  expect(preview.value.sectionRefs).toHaveLength(1)
  const preservedResponse = await send("review-preserve", { payload: {
    selectionRef: preview.value.selectionRef, sectionRefs: preview.value.sectionRefs,
  } })
  const preserved = Schema.decodeUnknownSync(SfReviewsReviewPreserve.output)(await preservedResponse.json())
  expect(preservedResponse.status).toBe(200)
  if (preserved.status !== "ok") throw new Error("Installed Team review preservation unavailable")
  const reviewRef = preserved.value.id
  const reopened = await send("review-read", { query: { reviewRef } })
  expect(reopened.status).toBe(200)
  expect(Schema.decodeUnknownSync(SfReviewsReviewRead.output)(await reopened.json())).toEqual(preserved)

  const reportResponse = await send("review-report", { payload: { reviewRef, format: "docx", sectionRefs: preview.value.sectionRefs } })
  const report = Schema.decodeUnknownSync(SfReviewsReportPrepare.output)(await reportResponse.json())
  expect(reportResponse.status).toBe(200)
  if (report.status !== "ok") throw new Error("Installed Team report preparation unavailable")
  const artifactRef = report.outputRef
  const foreign = JSON.stringify({ contractRevision: "sf-team-profile/1", kind: "team",
    profile: { ...fixture.team.profile, teamObjectId: "88888888-8888-4888-8888-888888888888" } })
  for (const selector of [null, foreign]) {
    const denied = await send("review-download", { query: { artifactRef }, selector })
    expect(denied.status).toBe(403)
    expect(denied.headers.get("content-disposition")).toBeNull()
    expect(await denied.text()).not.toContain(note)
  }
  const download = await send("review-download", { query: { artifactRef } })
  expect(download.status).toBe(200)
  expect(download.headers.get("content-type")).toBe("application/vnd.openxmlformats-officedocument.wordprocessingml.document")
  const office = await JSZip.loadAsync(await download.arrayBuffer())
  const document = await office.file("word/document.xml")?.async("string")
  expect(document).toContain(title)
  expect(document).toContain(note)
}, 180_000)
