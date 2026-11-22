import { expect } from "@playwright/test"
import type { APIResponse, Locator, Page } from "@playwright/test"
import { SfFiles, type SfFilesOperationOutput } from "@orchestra/schema/sucafina/files"
import { SfNativeOperationBindings } from "@orchestra/client/sucafina/bindings"
import { Schema } from "effect"
import { forwardOnce } from "../operations-support/runtime"

type Manifest = Extract<SfFilesOperationOutput<"files.import-preview">, { status: "ok" }>["value"]
type Reference = Extract<SfFilesOperationOutput<"files.import-reference">, { status: "ok" }>["value"]
type Admission = Extract<SfFilesOperationOutput<"files.import-admit">, { status: "ok" }>["value"]

async function originalValue<Value>(response: APIResponse): Promise<Value> {
  expect(response.status()).toBe(200)
  const body = await response.json() as { status: string; value: Value }
  expect(body.status).toBe("ok")
  return body.value
}

/** Response-stage observation preserves Chromium's native multipart bytes. */
async function captureOriginalAdmission(page: Page, endpoint: string) {
  const session = await page.context().newCDPSession(page)
  const producer = Promise.withResolvers<{ status: number; body: { status?: string; value?: Admission } }>()
  void producer.promise.catch(() => undefined)
  let posts = 0
  session.on("Fetch.requestPaused", async (event) => {
    const { requestId, responseStatusCode: status } = event
    try {
      if (event.request.url !== endpoint || event.request.method !== "POST") {
        await session.send("Fetch.continueRequest", { requestId })
        return
      }
      expect(++posts, "one original multipart admission").toBe(1)
      if (status === undefined) throw new Error("Original import admission failed before HTTP response")
      const raw = await session.send("Fetch.getResponseBody", { requestId })
      const text = raw.base64Encoded ? Buffer.from(raw.body, "base64").toString("utf8") : raw.body
      const body = JSON.parse(text) as { status?: string; value?: Admission }
      await session.send("Fetch.continueResponse", { requestId })
      producer.resolve({ status, body })
    } catch (error) {
      producer.reject(error)
      await session.send("Fetch.continueRequest", { requestId }).catch(() => undefined)
    }
  })
  try {
    await session.send("Fetch.enable", { patterns: [{
      urlPattern: endpoint.replace(/[\\*?]/g, "\\$&"), requestStage: "Response",
    }] })
  } catch (error) {
    await session.detach()
    throw error
  }
  return { completed: producer.promise, close: () => session.detach() }
}

/**
 * Reuse the repository's original-response capture. Each JSON request executes
 * exactly once with maxRedirects:0 / maxRetries:0; forwardOnce fulfills the same
 * status, headers and bytes. No producer data, acknowledgement or receipt is
 * synthesized. The response-stage admission probe never replays file bytes.
 */
export async function captureOriginalImportPreview(page: Page, input: {
  origin: string; mount: string; sourceDigest: string; generate: Locator
  observe: (facts: Readonly<Record<string, unknown>>) => Promise<void>
}) {
  const endpoint = (mode: string, query: Record<string, string> = {}) =>
    input.origin + input.mount + "/planner?" + new URLSearchParams({ sf: mode, ...query })
  const close: (() => Promise<void>)[] = []
  let prepared: { manifest: Manifest; referenceURL: string } | undefined
  try {
    const admission = await captureOriginalAdmission(page, endpoint("import-admit"))
    close.push(admission.close)
    const reference = await forwardOnce(page, () => prepared?.referenceURL, "GET")
    close.push(reference.close)
    const preview = await forwardOnce(page, endpoint("import-preview"), "POST", async (response) => {
      const wire = await response.json()
      const decoded = SfNativeOperationBindings["files.import-preview"]!.decodeOutput(wire)
      const typed = Schema.decodeUnknownOption(Schema.toType(SfFiles.operations["files.import-preview"].output),
        { onExcessProperty: "error" })(wire)
      await input.observe({ stage: "preview-producer-response", httpStatus: response.status(),
        producerStatus: wire.status, codecStatus: decoded.status, typed: typed._tag })
      const manifest = await originalValue<Manifest>(response)
      prepared = { manifest, referenceURL: endpoint("import-reference", { importPreviewRef: manifest.id }) }
      console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({ kind: "original-import-preview",
        manifestId: manifest.id, state: manifest.state, sourceDigest: manifest.sourceDigest, domainApplied: manifest.domainApplied }))
    })
    close.push(preview.close)
    const [admitted, previewTransport, referenceTransport] = await Promise.all([
      admission.completed.then(({ status, body }) => {
        console.info("SF_DESIGN_DIAGNOSTICS " + JSON.stringify({
          kind: "original-import-admission", httpStatus: status, producerStatus: body.status,
          instrumentation: "CDP response-stage observation; no replay",
        }))
        expect(status).toBe(200)
        expect(body.status).toBe("ok")
        expect(body.value).toMatchObject({ ref: expect.stringMatching(/^[a-f0-9]{64}$/), digest: input.sourceDigest })
        return body.value!
      }),
      preview.completed.then(async (transport) => {
        if (!prepared) throw new Error("Original preview source reference missing")
        const started = Date.now()
        await input.observe({ stage: "preview-delivered" })
        const fresh = await page.context().request.get(prepared.referenceURL, { maxRetries: 0, timeout: 40_000 })
        const body = await fresh.json()
        await input.observe({ stage: "independent-reference-read", elapsedMs: Date.now() - started,
          httpStatus: fresh.status(), producerStatus: body.status,
          reason: typeof body.reason === "string" ? body.reason : undefined })
        expect(fresh.status()).toBe(200)
        expect(body).toMatchObject({ status: "ok", value: { manifest: { id: prepared.manifest.id,
          sourceDigest: input.sourceDigest, domainApplied: false, state: "preview" } } })
        return transport
      }), reference.completed, input.generate.click(),
    ])
    if (!prepared) throw new Error("Original producer returned no import preview")
    expect(previewTransport.request.postDataJSON()).toEqual({
      admittedFileRef: admitted.ref, format: "xlsx", options: {},
    })
    expect(referenceTransport.response.url()).toBe(prepared.referenceURL)
    const readback = await originalValue<Reference>(referenceTransport.response)
    expect(readback.manifest).toMatchObject({
      id: prepared.manifest.id, sourceDigest: input.sourceDigest, state: "preview", domainApplied: false,
    })
    return { ...prepared, readback }
  } finally {
    for (const release of close.reverse()) await release()
  }
}
