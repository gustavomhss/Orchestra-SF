/** Bounded UTF-8 JSON with complete EOF, duplicate-key and abort checks. */
export async function readPersonalConnectionCommand(request: Request): Promise<
  { status: "parsed"; value: unknown } | { status: 400 | 408 | 413 | 415 }
> {
  const maximumBytes = 32768
  if (!/^application\/json(?:\s*;\s*charset=(?:"utf-8"|utf-8))?$/i.test(request.headers.get("content-type") ?? "") ||
      request.headers.has("content-encoding") && request.headers.get("content-encoding") !== "identity")
    return { status: 415 }
  const contentLength = request.headers.get("content-length")
  if (contentLength !== null && (!/^\d+$/.test(contentLength) || !Number.isSafeInteger(Number(contentLength))))
    return { status: 400 }
  if (contentLength !== null && Number(contentLength) > maximumBytes) return { status: 413 }
  if (!request.body || request.bodyUsed || request.body.locked || request.signal.aborted) return { status: 400 }
  const reader = request.body.getReader()
  const stopped = Promise.withResolvers<never>()
  const failure: { status: 400 | 408 | 413; stopped: boolean } = { status: 400, stopped: false }
  const stop = (status: 400 | 408 | 413) => {
    if (failure.stopped) return
    failure.status = status
    failure.stopped = true
    stopped.reject(new Error("Personal connection command body unavailable"))
    void reader.cancel().catch(() => undefined)
  }
  const aborted = () => stop(400)
  request.signal.addEventListener("abort", aborted, { once: true })
  const timeout = setTimeout(() => stop(408), 5000)
  const chunks: Uint8Array[] = []
  let size = 0
  try {
    while (true) {
      const next = await Promise.race([reader.read(), stopped.promise])
      if (failure.stopped || request.signal.aborted) return { status: failure.status }
      if (next.done) break
      size += next.value.byteLength
      if (size > maximumBytes) { stop(413); return { status: 413 } }
      chunks.push(next.value)
    }
    if (contentLength !== null && Number(contentLength) !== size) return { status: 400 }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) { bytes.set(chunk, offset); offset += chunk.byteLength }
    const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes)
    const value: unknown = JSON.parse(text)
    const frames: { object: boolean; key: boolean; keys: Set<string> }[] = []
    for (const match of text.matchAll(/"(?:\\.|[^"\\])*"|[{}\[\],:]/g)) {
      const token = match[0]
      if (token === "{" || token === "[") {
        if (frames.length >= 8) return { status: 400 }
        frames.push({ object: token === "{", key: token === "{", keys: new Set() })
        continue
      }
      if (token === "}" || token === "]") { frames.pop(); continue }
      const frame = frames.at(-1)
      if (!frame?.object) continue
      if (token === ",") { frame.key = true; continue }
      if (!frame.key || !token.startsWith('"')) continue
      const key: string = JSON.parse(token)
      if (["__proto__", "prototype", "constructor"].includes(key) || frame.keys.has(key)) return { status: 400 }
      frame.keys.add(key)
      frame.key = false
    }
    if (failure.stopped || request.signal.aborted) return { status: failure.status }
    return { status: "parsed", value }
  } catch { return { status: failure.status } }
  finally {
    clearTimeout(timeout)
    request.signal.removeEventListener("abort", aborted)
    void reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
