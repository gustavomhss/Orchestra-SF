import type { Session, net } from "electron"
import { RESPONSE_DOWNLOAD_CHUNK_BYTES } from "../../preload/response-download"

/** Keep response headers closed: Electron's Set-Cookie and auth headers never enter IPC. */
export type SfWireHeaders = Readonly<{
  "content-type"?: string
  "content-disposition"?: string
  "x-sf-access-revision"?: string
  "x-sf-review-binding"?: string
  "x-sf-contract-revision"?: string
}>
export type SfByteSource = Readonly<{
  next(): Promise<Uint8Array | undefined>
  cancel(): void
}>
export type SfWireReply =
  | Readonly<{ kind: "buffer"; status: number; headers: SfWireHeaders; bytes: Uint8Array }>
  | Readonly<{ kind: "stream"; status: number; headers: SfWireHeaders; source: SfByteSource }>

const PUBLIC_HEADERS = [
  "content-type", "content-disposition", "x-sf-access-revision", "x-sf-review-binding", "x-sf-contract-revision",
] as const

export function publicSfHeaders(headers: Record<string, string | string[] | undefined>): SfWireHeaders {
  const result: Record<string, string> = {}
  for (const name of PUBLIC_HEADERS) {
    const raw = headers[name]
    const value = Array.isArray(raw) ? raw[0] : raw
    if (typeof value !== "string" || !value || value.length > 2048 || /[\x00-\x1f\x7f]/.test(value)) continue
    if (name === "content-disposition" && !/^attachment;\s*filename="[^\\/\r\n"]{1,160}"$/i.test(value)) continue
    result[name] = value
  }
  return result
}

/** Electron net.request, not renderer fetch or session.fetch. All URL/header inputs are main-owned. */
export function requestSfHttp(deps: Readonly<{
  net: Pick<typeof net, "request">
  session: Session
  origin: string
  url: string
  method: "GET" | "POST"
  headers?: Readonly<Record<string, string>>
  body?: Uint8Array
  mode: "json" | "bytes" | "empty"
  maxResponseBytes?: number
  signal?: AbortSignal
}>): Promise<SfWireReply> {
  return new Promise((resolve, reject) => {
    if (deps.signal?.aborted) return reject(new Error("aborted"))
    const request = deps.net.request({
      session: deps.session,
      credentials: "same-origin",
      origin: deps.origin,
      url: deps.url,
      method: deps.method,
      redirect: "error",
      cache: "no-store",
    })
    let settled = false
    let source: SfByteSource | undefined
    const abort = () => {
      source?.cancel()
      request.abort()
      if (!settled) {
        settled = true
        reject(new Error("aborted"))
      }
    }
    const cleanup = () => deps.signal?.removeEventListener("abort", abort)
    deps.signal?.addEventListener("abort", abort, { once: true })
    request.on("error", () => {
      if (!settled) {
        settled = true
        cleanup()
        reject(new Error("network"))
      }
    })
    request.on("abort", () => {
      if (!settled) {
        settled = true
        cleanup()
        reject(new Error("aborted"))
      }
    })
    request.on("response", (response) => {
      if (settled) return
      const headers = publicSfHeaders(response.headers)
      if (deps.mode === "bytes" && response.statusCode >= 200 && response.statusCode < 300) {
        // Pull one bounded chunk per IPC round trip. Never accumulate an unbounded response.
        let buffered: Uint8Array | undefined
        let offset = 0
        let ended = false
        let failed = false
        let pending: { resolve: (bytes: Uint8Array | undefined) => void; reject: (reason: Error) => void } | undefined
        const drain = () => {
          if (!pending) return
          if (buffered && offset < buffered.byteLength) {
            const bytes = buffered.subarray(offset, offset + RESPONSE_DOWNLOAD_CHUNK_BYTES)
            offset += bytes.byteLength
            if (offset >= buffered.byteLength) {
              buffered = undefined
              offset = 0
            }
            const wait = pending
            pending = undefined
            wait.resolve(bytes)
            return
          }
          if (failed || ended) {
            const wait = pending
            pending = undefined
            if (failed) wait.reject(new Error("network"))
            else wait.resolve(undefined)
            return
          }
          response.resume()
        }
        response.pause()
        response.on("data", (chunk: Buffer) => {
          response.pause()
          if (failed || ended) return
          // Pause synchronously; only the current producer chunk is held until consumed.
          buffered = new Uint8Array(chunk)
          offset = 0
          drain()
        })
        response.on("end", () => { ended = true; cleanup(); drain() })
        response.on("error", () => { failed = true; cleanup(); drain() })
        source = {
          next() {
            if (pending) return Promise.reject(new Error("overlapping byte pulls"))
            return new Promise<Uint8Array | undefined>((ok, fail) => {
              pending = { resolve: ok, reject: fail }
              drain()
            })
          },
          cancel() {
            failed = true
            buffered = undefined
            request.abort()
            cleanup()
            drain()
          },
        }
        settled = true
        resolve({ kind: "stream", status: response.statusCode, headers, source })
        return
      }
      const chunks: Buffer[] = []
      let total = 0
      const limit = deps.maxResponseBytes ?? 4 * 1024 * 1024
      response.on("data", (chunk: Buffer) => {
        total += chunk.byteLength
        if (total > limit) {
          request.abort()
          if (!settled) {
            settled = true
            cleanup()
            reject(new Error("invalid-response"))
          }
          return
        }
        chunks.push(chunk)
      })
      response.once("end", () => {
        if (settled) return
        settled = true
        cleanup()
        resolve({ kind: "buffer", status: response.statusCode, headers, bytes: Buffer.concat(chunks, total) })
      })
      response.once("error", () => {
        if (settled) return
        settled = true
        cleanup()
        reject(new Error("network"))
      })
    })
    for (const [name, value] of Object.entries(deps.headers ?? {})) request.setHeader(name, value)
    if (deps.body?.byteLength) request.write(Buffer.from(deps.body))
    request.end()
  })
}
