import { expect, test } from "bun:test"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createSfHumanAuthority } from "../../../product/integration/human-authority.ts"
import { createReviewCapabilities } from "../../../product/reviews/capabilities.ts"
import { createReviewHumanPort } from "../../../product/reviews/human.ts"
import { createReviewHttp } from "../../../product/reviews/http.ts"
import { createReviewArtifactStorage } from "../../../product/reports/storage.ts"
import { createReviewDownloadHandler } from "../../../product/reports/download.ts"
import { createReviewReadBoundaryFixture } from "./review-read-boundary-fixture.ts"

// Real review rendering and storage, with a fault after the actual put. The
// fixture's key-to-operation mapping mirrors host-context; this is not installed proof.
test("a 503 after real artifact persistence is not proof of no commit; exact retry keeps the first bytes", async () => {
  const f = await createReviewReadBoundaryFixture()
  try {
    const storage = createReviewArtifactStorage({ state: f.fixture.state, host: f.fixture.host,
      reviews: f.services.reviews, creationTarget: f.fixture.creationTarget, maxBytes: 5_000_000,
      operationIdentity: (context) => {
        const key = context.kind === "ui" ? f.fixture.ui.requestFor(context)?.headers.get("Idempotency-Key") : undefined
        return key ? digestSfValue({ operation: "sf_report_prepare", key }) : undefined
      } })
    let storedRef = ""
    let fault = true
    const artifacts = { ...storage, put: async (...args: Parameters<typeof storage.put>) => {
      const result = await storage.put(...args)
      if (result.status !== "ok") return result
      storedRef = result.value.artifactRef
      if (fault) { fault = false; return { status: "unavailable" as const, reason: "after-persist" } }
      return result
    } }
    const humanAuthority = createSfHumanAuthority({ origin: "https://example.test", ui: f.fixture.ui })
    const http = createReviewHttp({ origin: "https://example.test", ui: f.fixture.ui,
      authority: f.fixture.domainAuthority, reviews: f.services.reviews,
      descriptors: createReviewCapabilities({ reviews: f.services.reviews, artifacts,
        authority: f.fixture.domainAuthority, requiredAuthority: [] }),
      human: createReviewHumanPort({ state: f.fixture.state, reviews: f.services.reviews,
        human: humanAuthority, ui: f.fixture.ui, creationTarget: f.fixture.creationTarget }),
      download: createReviewDownloadHandler({ authority: f.fixture.ui, storage }), maxBodyBytes: 65536 })
    const key = "123e4567-e89b-42d3-a456-426614174000"
    const body = JSON.stringify({ reviewRef: f.fixture.review.id, sectionRefs: ["project"], format: "docx" })
    const prepare = () => http(new Request("https://example.test/product?sf=review-report", { method: "POST",
      headers: { actor: "person", origin: "https://example.test", "content-type": "application/json", "Idempotency-Key": key }, body }), "dashboard")
    const download = () => http(new Request("https://example.test/product?sf=review-download&artifactRef=" + encodeURIComponent(storedRef),
      { headers: { actor: "person" } }), "dashboard")
    const first = await prepare()
    expect(first?.status).toBe(503)
    expect(storedRef).toMatch(/^report:[a-f0-9]{64}$/)
    const before = await download()
    expect(before?.status).toBe(200)
    const bytes = new Uint8Array(await before!.arrayBuffer())
    const retry = await prepare()
    expect(retry?.status).toBe(200)
    const result = await retry!.json() as { outputRef: string }
    expect(result.outputRef).toBe(storedRef)
    const after = await download()
    expect(after?.status).toBe(200)
    expect(new Uint8Array(await after!.arrayBuffer())).toEqual(bytes)
  } finally { await f.dispose() }
})
