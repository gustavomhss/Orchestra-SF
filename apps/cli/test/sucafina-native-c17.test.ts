import { expect } from "bun:test"
import { createHash } from "node:crypto"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { AppProcess } from "@orchestra/core/process"
import { expectSpawn } from "@orchestra/core/test/fixture/omni-expect"
import { testEffect } from "@orchestra/core/test/lib/effect"
import { Effect } from "effect"
import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { PreservedReview } from "../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import type { PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { CapabilityResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
import type { ReviewAgendaCatalog } from "../../../modules/sucafina/Sucafinav1/product/reviews/agenda-picker.ts"
import type { ReviewAgendaPreview } from "../../../modules/sucafina/Sucafinav1/product/reviews/selection.ts"
import { sfReviewArtifactBlobKey, validateReportArtifact } from "../../../modules/sucafina/Sucafinav1/runtime/artifact.ts"
import { object } from "../../../modules/sucafina/Sucafinav1/runtime/contract.ts"
import { DashboardPortfolio } from "../../../modules/sucafina/Sucafinav1/runtime/dashboard-portfolio.ts"
import { openLocalStore } from "../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import { withNativeInstallation } from "./fixture/sucafina-native-installation"

const it = testEffect(LayerNode.compile(AppProcess.node))
const mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
const reportKey = "installed-c17-report"
const projectName = "Installed C17 source project"

async function responseJson<T>(response: Response, operation: string): Promise<T> {
  const body = await response.json().catch(() => undefined)
  if (!response.ok || !body || body.status !== "ok") {
    throw new Error(`${operation} failed (${response.status}): ${body?.reason ?? body?.status ?? "no JSON result"}`)
  }
  return body as T
}

async function value<T>(response: Response, operation: string): Promise<T> {
  const result = await responseJson<Extract<PortResult<T>, { status: "ok" }>>(response, operation)
  return result.value
}

it.live.skipIf(process.platform === "win32")(
  "installed C17 preserves an authorized review and commits and delivers its DOCX report",
  () => Effect.scoped(Effect.gen(function* () {
    expectSpawn(import.meta.path)
    const installation = yield* withNativeInstallation({
      seed: async ({ store, actorId }) => {
        await store.transaction("dashboard", async (snapshot) => {
          snapshot.data.summaries = ["All Projects", "Portfolio Dashboard"]
          snapshot.data.access = { [actorId]: { assigned: [], domains: [] } }
          const project = DashboardPortfolio.domain.execute(snapshot, { id: actorId, roles: ["admin"], canWrite: true }, {
            page: "All Projects",
            action: "save",
            version: 0,
            values: { name: projectName, budget: 1250, spent: 320, status: "In Progress", risk: "Low" },
          }, {
            at: new Date().toISOString(), id: () => "installed-c17-project", directory: [],
          })
          if (!project.ok) throw new Error("Canonical C17 project seed was rejected")
          return { commit: true, value: undefined }
        })
      },
    })
    yield* Effect.promise(async () => {
      const year = new Date().getUTCFullYear()
      const period = { start: `${year}-01-01`, end: `${year}-12-31` }
      const post = (mode: string, body: unknown, key: string) => installation.request(`/dashboard?sf=${mode}`, {
        method: "POST",
        headers: { "content-type": "application/json", "idempotency-key": key },
        body: JSON.stringify(body),
      })
      const query = new URLSearchParams({ sf: "review-agenda", ...period, domain: "dashboard" })
      const catalog = await value<ReviewAgendaCatalog>(await installation.request(`/dashboard?${query}`), "discover C17 sources")
      const source = catalog.options.find((option) => option.item.kind === "dashboard" && option.item.topic === "all-projects")
      if (!source) throw new Error("Installed C17 project source was omitted")

      const preview = await value<ReviewAgendaPreview>(
        await post("review-agenda", { items: [source.item] }, "installed-c17-agenda"), "preview C17 review",
      )
      const review = await value<PreservedReview>(
        await post("review-preserve", { selectionRef: preview.selectionRef, sectionRefs: preview.sectionRefs }, "installed-c17-preserve"),
        "preserve C17 review",
      )
      expect(review.sections).toHaveLength(1)
      expect(review.sections[0]?.period).toEqual(period)
      expect(JSON.stringify(review.sections[0]?.content)).toContain(projectName)

      const payload = { reviewRef: review.id, sectionRefs: review.sections.map((section) => section.id), format: "docx" }
      const prepared = await responseJson<Extract<CapabilityResult, { status: "ok" }>>(
        await post("review-report", payload, reportKey), "prepare C17 report",
      )
      if (!prepared.outputRef) throw new Error("Installed C17 omitted the artifact reference")
      const artifactRef = prepared.outputRef
      expect(artifactRef).toMatch(/^report:[a-f0-9]{64}$/)
      expect(prepared.receipt).toMatchObject({
        kind: "ui",
        operation: "sf_report_prepare",
        handlerExport: "prepareReport",
        principalRef: installation.actorId,
        inputDigest: digestSfValue(payload),
        resultDigest: digestSfValue(prepared.result),
      })

      const downloadPath = `/dashboard?${new URLSearchParams({ sf: "review-download", artifactRef })}`
      const download = await installation.request(downloadPath)
      expect(download.status).toBe(200)
      expect(download.headers.get("content-type")).toBe(mime)
      expect(download.headers.get("content-disposition")).toMatch(/^attachment; filename\*=UTF-8''.+\.docx$/)
      expect(download.headers.get("cache-control")).toBe("no-store")
      const bytes = new Uint8Array(await download.arrayBuffer())

      const store = await openLocalStore(installation.businessDirectory)
      try {
        const blobKey = sfReviewArtifactBlobKey(artifactRef)
        const persisted = await store.transaction("dashboard", async (snapshot, blobs) => {
          const state = object(snapshot.data.__sfProductV1)
          const command = digestSfValue({ operation: "sf_report_prepare", key: reportKey })
          return {
            commit: false,
            value: {
              review: object(state.reviews)[review.id],
              report: object(object(state.documents)[artifactRef]),
              bytes: await blobs.get(blobKey),
              receipt: object(state.transactions)[JSON.stringify([
                installation.actorId, "documents", `sf-workspace:${encodeURIComponent(installation.actorId.split(":")[1]!)}`, command,
              ])],
            },
          }
        })
        expect(persisted.review).toMatchObject({ id: review.id, version: review.version })
        const digest = createHash("sha256").update(bytes).digest("hex")
        expect(persisted.report).toMatchObject({
          kind: "sf-review-artifact-v2", principalRef: installation.actorId, reviewRef: review.id, format: "docx", mediaType: mime,
          sectionRefs: payload.sectionRefs, byteLength: bytes.byteLength, digest,
        })
        expect(Object.hasOwn(persisted.report, "bytes")).toBe(false)
        if (!persisted.bytes) throw new Error("Installed C17 omitted the artifact blob")
        expect(persisted.bytes).toEqual(bytes)
        expect(createHash("sha256").update(persisted.bytes).digest("hex")).toBe(digest)
        expect(persisted.receipt).toMatchObject({
          namespace: "documents", principalRef: installation.actorId, storageVersion: expect.any(Number),
          commandDigest: expect.stringMatching(/^[a-f0-9]{64}$/), value: true,
        })
        expect(await validateReportArtifact({ name: String(persisted.report.name), type: mime, bytes }, "docx", 8 * 1024 * 1024)).toBe(true)

        // Reopen the same artifact through production after installing the
        // historical inline representation with the original receipt intact.
        await store.transaction("dashboard", async (snapshot, blobs) => {
          const documents = object(object(snapshot.data.__sfProductV1).documents)
          const inline = object(documents[artifactRef])
          delete inline.byteLength
          inline.kind = "sf-review-artifact-v1"
          inline.bytes = Buffer.from(bytes).toString("base64")
          await blobs.remove(blobKey)
          return { commit: true, value: undefined }
        })
        const legacy = await installation.request(downloadPath)
        expect(legacy.status).toBe(200)
        expect(legacy.headers.get("content-type")).toBe(mime)
        expect(new Uint8Array(await legacy.arrayBuffer())).toEqual(bytes)
      } finally {
        await store.dispose()
      }
    })
  })),
  { timeout: 150_000 },
)
