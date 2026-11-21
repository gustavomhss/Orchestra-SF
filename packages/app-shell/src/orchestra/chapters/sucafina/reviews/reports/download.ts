import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfTransport } from "@orchestra/client/sucafina/transport"

/** Only the original artifact bytes, under the same live owner through platform egress. */
export async function downloadReviewReport(input: Readonly<{
  transport: SfTransport
  artifactRef: string
  format: "docx" | "pptx"
  signal: AbortSignal
  current: () => boolean
  downloadResponse?: (response: Response, filename: string) => Promise<void>
}>): Promise<void> {
  const result = await createSfFilesClient(input.transport)["files.export.review"](
    { surface: "dashboard", artifactRef: input.artifactRef }, { signal: input.signal },
  )
  if (input.signal.aborted || !input.current()) return
  if (result.kind !== "response" || result.status !== 200 || !(result.body instanceof Uint8Array))
    throw new Error("SF_REVIEW_REPORT_DOWNLOAD_UNAVAILABLE")
  const type = result.headers["content-type"]
  const expected = input.format === "docx"
    ? "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
    : "application/vnd.openxmlformats-officedocument.presentationml.presentation"
  if (type?.split(";")[0]?.trim().toLowerCase() !== expected) throw new Error("SF_REVIEW_REPORT_DOWNLOAD_INVALID")
  const filename = `review.${input.format}`
  const bytes = new Uint8Array(result.body)
  if (input.signal.aborted || !input.current()) return
  if (input.downloadResponse) {
    let offset = 0
    let sink: ReadableStreamDefaultController<Uint8Array> | undefined
    const revoke = () => {
      try { sink?.error(new DOMException("Report owner changed", "AbortError")) }
      catch { /* stream already closed */ }
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) { sink = controller; input.signal.addEventListener("abort", revoke, { once: true }) },
      pull(controller) {
        if (input.signal.aborted || !input.current()) { revoke(); return }
        if (offset === bytes.byteLength) { controller.close(); return }
        const end = Math.min(offset + 64 * 1024, bytes.byteLength)
        controller.enqueue(new Uint8Array(bytes.subarray(offset, end)))
        offset = end
      },
      cancel() { input.signal.removeEventListener("abort", revoke) },
    }, { highWaterMark: 0 })
    try { await input.downloadResponse(new Response(stream as BodyInit, { headers: { "Content-Type": type } }), filename) }
    finally { input.signal.removeEventListener("abort", revoke); sink = undefined }
    return
  }
  const url = URL.createObjectURL(new Blob([bytes], { type }))
  try {
    if (input.signal.aborted || !input.current()) return
    const anchor = document.createElement("a")
    anchor.href = url
    anchor.download = filename
    anchor.rel = "noopener"
    document.body.append(anchor)
    try { anchor.click() } finally { anchor.remove() }
  } finally { setTimeout(() => URL.revokeObjectURL(url), 10_000) }
}
