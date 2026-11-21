import { createSfFilesClient } from "@orchestra/client/sucafina/files"
import type { SfTransport } from "@orchestra/client/sucafina/transport"

/** Download only the original, bounded producer bytes under the current owner. */
export async function downloadTalentMembers(input: Readonly<{
  transport: SfTransport
  signal: AbortSignal
  current: () => boolean
  downloadResponse?: (response: Response, filename: string) => Promise<void>
}>): Promise<void> {
  const result = await createSfFilesClient(input.transport)["files.export.members"](
    { surface: "dashboard" }, { signal: input.signal },
  )
  if (input.signal.aborted || !input.current()) return
  if (result.kind !== "response" || result.status !== 200 || !(result.body instanceof Uint8Array))
    throw new Error("SF_TALENT_MEMBERS_EXPORT_UNAVAILABLE")
  const type = result.headers["content-type"]
  if (type?.split(";")[0]?.trim().toLowerCase() !== "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")
    throw new Error("SF_TALENT_MEMBERS_EXPORT_INVALID")
  const encoded = /filename\*=UTF-8''([^;\r\n]+)/i.exec(result.headers["content-disposition"] ?? "")?.[1]
  const name = encoded ? decodeURIComponent(encoded) : "members.xlsx"
  const filename = /^[a-zA-Z0-9_ .-]+\.xlsx$/i.test(name) && !name.startsWith(".") ? name : "members.xlsx"
  const bytes = new Uint8Array(result.body)
  if (!input.current() || input.signal.aborted) return
  if (input.downloadResponse) {
    let offset = 0
    let sink: ReadableStreamDefaultController<Uint8Array> | undefined
    const revoke = () => {
      try { sink?.error(new DOMException("Talent export owner changed", "AbortError")) }
      catch { /* stream already closed */ }
    }
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        sink = controller
        input.signal.addEventListener("abort", revoke, { once: true })
      },
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
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  }
}
