import type { Page, Request, Response } from "@playwright/test"

type RequestIdentity = { method: string; url: string; postData: string | null }

export type RetainedTarget = {
  method: "GET" | "POST"
  url: string
  query?: Record<string, string>
  absentQuery?: readonly string[]
  payload?: (value: unknown) => boolean
}

export type RetainedResponse = Pick<Response, "status" | "headers" | "url" | "request"> & {
  body(): Promise<Buffer>
  json(): Promise<unknown>
}

type CapturedBody = RequestIdentity & { networkId: string; status: number; bytes: Buffer }

export function retainedFor(url: string, mode: string, method: "GET" | "POST"): RetainedTarget {
  return { url, method, query: { sf: mode } }
}

/**
 * Read the original response while Chromium still owns its paused body. The
 * metadata oracle remains Playwright's real Response. No request is replayed,
 * fulfilled or rewritten, including the original review-download GET.
 */
export async function retainResponses<const T extends readonly [RetainedTarget, ...RetainedTarget[]]>(
  page: Page, targets: T, action: () => Promise<unknown>,
): Promise<{ [K in keyof T]: RetainedResponse }> {
  const session = await page.context().newCDPSession(page)
  const failed = Promise.withResolvers<never>()
  // Event failures may precede the Promise.race below; keep their rejection observed.
  void failed.promise.catch(() => undefined)
  let failure: Error | undefined
  let active = false
  let closing = false
  let completed = false
  const fail = (message: string) => {
    failure ??= new Error("Original response capture: " + message)
    failed.reject(failure)
  }
  const states = targets.map((target) => ({
    target, requests: [] as Request[], responses: [] as Response[], pauses: 0,
    network: new Set<string>(), captured: Promise.withResolvers<CapturedBody>(),
  }))
  const work = new Set<Promise<void>>()
  const failedNetwork = new Set<string>()
  const matching = (identity: RequestIdentity) => {
    try {
      const selected = states.filter((state) => matches(state.target, identity))
      if (selected.length > 1) fail("ambiguous target selection")
      return selected
    } catch {
      fail("invalid original request identity")
      return []
    }
  }
  const requested = (request: Request) => {
    if (!active) return
    for (const state of matching(requestIdentity(request))) {
      state.requests.push(request)
      if (state.requests.length !== 1) fail("more than one matching browser request")
      if (request.redirectedFrom() || request.redirectedTo()) fail("redirected browser request")
    }
  }
  const responded = (response: Response) => {
    if (!active) return
    for (const state of matching(requestIdentity(response.request()))) {
      state.responses.push(response)
      if (state.responses.length !== 1) fail("more than one matching browser response")
      if (response.fromServiceWorker()) fail("response bypassed the original network request")
    }
  }
  const requestfailed = (request: Request) => {
    if (active && matching(requestIdentity(request)).length) fail("matching browser request failed or was cancelled")
  }
  const closed = () => {
    if (!closing) fail("page or protocol session closed before capture completed")
  }
  page.on("request", requested)
  page.on("response", responded)
  page.on("requestfailed", requestfailed)
  page.on("close", closed)
  session.on("close", closed)
  session.on("Network.loadingFailed", (event) => {
    if (!active) return
    failedNetwork.add(event.requestId)
    if (states.some((state) => state.network.has(event.requestId))) fail("matching protocol request failed or was cancelled")
  })
  session.on("Fetch.requestPaused", (event) => {
    const operation = (async () => {
      let continuationAttempted = false
      try {
        const identity = protocolIdentity(event.request)
        const selected = active ? matching(identity) : []
        if (selected.length === 1) {
          const state = selected[0]!
          state.pauses += 1
          if (state.pauses !== 1) { fail("more than one matching paused response"); return }
          if (event.responseErrorReason || event.redirectedRequestId ||
              event.responseStatusCode === undefined || event.responseStatusCode >= 300 && event.responseStatusCode < 400) {
            fail("original paused response failed, was cancelled or redirected")
            return
          }
          if (!event.networkId || failedNetwork.has(event.networkId)) { fail("missing or failed network identity"); return }
          if (event.request.hasPostData && event.request.postData === undefined) { fail("missing original request payload"); return }
          state.network.add(event.networkId)
          // Playwright 1.59.1 types Fetch.getResponseBody/continueResponse. Finish
          // reading before continuing or disabling Fetch (the CDP lifetime rule).
          const captured = await session.send("Fetch.getResponseBody", { requestId: event.requestId })
          const bytes = Buffer.from(captured.body, captured.base64Encoded ? "base64" : "utf8")
          continuationAttempted = true
          await session.send("Fetch.continueResponse", { requestId: event.requestId })
          state.captured.resolve({ ...identity, networkId: event.networkId, status: event.responseStatusCode, bytes })
          return
        }
        continuationAttempted = true
        await session.send("Fetch.continueResponse", { requestId: event.requestId })
      } catch {
        if (!closing) fail("could not retain and continue the original response")
      } finally {
        // Release every paused response, also on failed validation. Supplying
        // only requestId preserves the server's original status/headers/body.
        if (!continuationAttempted) {
          continuationAttempted = true
          await session.send("Fetch.continueResponse", { requestId: event.requestId }).catch(() => {
            if (!closing) fail("original paused response could not be released")
          })
        }
      }
    })()
    work.add(operation)
    void operation.then(() => work.delete(operation), () => {
      work.delete(operation)
      if (!closing) fail("protocol response handling failed")
    })
  })
  try {
    await session.send("Network.enable")
    const patterns = [...new Set(targets.map((target) => {
      const url = new URL(target.url)
      return (url.origin + url.pathname).replace(/[\\*?]/g, "\\$&") + "*"
    }))].map((urlPattern) => ({ urlPattern, requestStage: "Response" as const }))
    await session.send("Fetch.enable", { patterns })
    active = true
    // Register every metadata waiter before invoking the caller's action once.
    const pending = states.map(async (state) => {
      const response = await page.waitForResponse((value) => matches(state.target, requestIdentity(value.request())))
      const captured = await state.captured.promise
      const finishedError = await response.finished()
      if (finishedError || response.request().failure() || failedNetwork.has(captured.networkId)) throw new Error("Original response capture: original request did not finish successfully")
      if (response.request().redirectedFrom() || response.request().redirectedTo()) throw new Error("Original response capture: original request redirected")
      if (!sameIdentity(requestIdentity(response.request()), captured) || response.status() !== captured.status) {
        throw new Error("Original response capture: metadata and retained bytes have different identities")
      }
      return retained(response, captured.bytes)
    })
    const [responses] = await Promise.race([Promise.all([Promise.all(pending), Promise.resolve().then(action)]), failed.promise])
    if (failure) throw failure
    for (const state of states) {
      if (state.requests.length !== 1 || state.responses.length !== 1 || state.pauses !== 1 || state.network.size !== 1 ||
          state.responses[0]!.request() !== state.requests[0]) {
        throw new Error("Original response capture: expected exactly one original request, response and body")
      }
    }
    completed = true
    return responses as { [K in keyof T]: RetainedResponse }
  } finally {
    active = false
    closing = true
    // Never disable Fetch while getResponseBody is still reading a paused body.
    await Promise.allSettled([...work])
    const disabled = await session.send("Fetch.disable").then(() => true, () => false)
    const detached = await session.detach().then(() => true, () => false)
    page.off("request", requested)
    page.off("response", responded)
    page.off("requestfailed", requestfailed)
    page.off("close", closed)
    if (completed && (!disabled || !detached)) throw new Error("Original response capture: protocol cleanup failed")
  }
}

function requestIdentity(request: Request): RequestIdentity {
  return { method: request.method(), url: request.url(), postData: request.postData() }
}

function protocolIdentity(request: { method: string; url: string; postData?: string; hasPostData?: boolean }): RequestIdentity {
  return { method: request.method, url: request.url, postData: request.postData ?? null }
}

function matches(target: RetainedTarget, identity: RequestIdentity) {
  const expected = new URL(target.url)
  const actual = new URL(identity.url)
  if (identity.method !== target.method || actual.origin !== expected.origin || actual.pathname !== expected.pathname) return false
  if (Object.entries(target.query ?? {}).some(([key, value]) => actual.searchParams.getAll(key).length !== 1 || actual.searchParams.get(key) !== value)) return false
  if (target.absentQuery?.some((key) => actual.searchParams.has(key))) return false
  if (!target.payload) return true
  if (identity.postData === null) return false
  let payload: unknown
  try { payload = JSON.parse(identity.postData) as unknown }
  catch { throw new Error("Original response capture: request payload is not valid JSON") }
  return target.payload(payload)
}

function sameIdentity(left: RequestIdentity, right: RequestIdentity) {
  return left.method === right.method && left.url === right.url && left.postData === right.postData
}

function retained(response: Response, bytes: Buffer): RetainedResponse {
  return {
    status: () => response.status(), headers: () => response.headers(), url: () => response.url(), request: () => response.request(),
    body: async () => Buffer.from(bytes),
    json: async () => {
      try { return JSON.parse(bytes.toString("utf8")) as unknown }
      catch { throw new Error("Original response capture: original body is not valid JSON") }
    },
  }
}
