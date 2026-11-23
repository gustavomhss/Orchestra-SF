import { expect, type Page, type Request, type Response } from "@playwright/test"
import { Schema } from "effect"
import { SfContextResult, type SfContext, type SfContextStamp } from "@orchestra/schema/sucafina/context"
import { ServerConnection } from "../../../src/context/server-connection"
import { ready, reflow, scrollPageTop } from "./wave-four"

const originalReadDeadline = 40_000

function boundedOriginalRead<T>(value: Promise<T>, label: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(label + " exceeded the original 40s read deadline")), originalReadDeadline)
    value.then((result) => { clearTimeout(timer); resolve(result) },
      (error: unknown) => { clearTimeout(timer); reject(error) })
  })
}

export type FinalOriginalGet = Readonly<{
  request: Request
  response: Response
  url: string
  status: number
  body: unknown
}>

/** Observe distinct original JSON GET requests. This never sends, retries,
 * intercepts, fulfills or cancels a request. Non-200 bodies remain original. */
export function observeFinalGet(page: Page, origin: string, pathname: string, count: 1 | 2 = 1) {
  const slots = Array.from({ length: count }, () => {
    let resolve!: (value: FinalOriginalGet | PromiseLike<FinalOriginalGet>) => void
    let reject!: (error: unknown) => void
    const promise = new Promise<FinalOriginalGet>((accept, refuse) => { resolve = accept; reject = refuse })
    void promise.catch(() => undefined)
    return { promise, resolve, reject }
  })
  const identities = new Set<Request>()
  let received = 0
  let consumed = 0
  let closed = false
  const capture = (request: Request) => {
    const url = new URL(request.url())
    if (closed || received >= count || identities.has(request) || request.method() !== "GET" ||
        url.origin !== origin || url.pathname !== pathname) return
    identities.add(request)
    const slot = slots[received++]
    if (!slot) throw new Error("The original GET observation has no slot")
    const read = boundedOriginalRead((async () => {
      const response = await request.response()
      if (!response) throw new Error("The original GET had no response: " + pathname)
      const body: unknown = await response.json()
      console.info("SF_FINAL14_ORIGINAL_GET " + JSON.stringify({
        pathname, status: response.status(),
      }))
      return { request, response, url: response.url(), status: response.status(), body }
    })(), "Original GET " + pathname)
    slot.resolve(read)
  }
  page.on("request", capture)
  return {
    next(): Promise<FinalOriginalGet> {
      if (closed) return Promise.reject(new Error("The original GET observer is closed"))
      const slot = slots[consumed++]
      if (!slot) return Promise.reject(new Error("No additional original GET was requested by this observation"))
      return boundedOriginalRead(slot.promise, "Observed GET " + pathname)
    },
    close() {
      if (closed) return
      closed = true
      page.off("request", capture)
      for (const slot of slots) slot.reject(new Error("The original GET observation ended"))
    },
  }
}

type FinalNavigationBase = Readonly<{
  page: Page
  installation: Readonly<{ origin: string; mount: string; actorId: string }>
  owner: Readonly<{ hostId: string; projectId: string; installationId: string }>
  stamp?: SfContextStamp
}>

/** A fresh page has the original provider read followed by route admission.
 * A same-owner internal transition has route admission only. The caller names
 * the source-backed count; two simultaneous waitForResponse calls are not used. */
export async function observeFinalNavigation(input: FinalNavigationBase & Readonly<{
  contextReads: 1 | 2
  action: () => Promise<unknown>
}>): Promise<SfContext> {
  const observed = observeFinalGet(input.page, input.installation.origin,
    input.installation.mount + "/api/ui/context", input.contextReads)
  const completed = (async () => {
    const requests = new Set<Request>()
    let currentStamp = input.stamp
    let latest: SfContext | undefined
    for (let index = 0; index < input.contextReads; index += 1) {
      const original = await observed.next()
      expect(requests.has(original.request)).toBe(false)
      requests.add(original.request)
      expect(original.status).toBe(200)
      const query = new URL(original.request.url()).searchParams
      expect([...query.keys()].sort()).toEqual(["hostId", "installationId", "projectId"])
      for (const key of ["hostId", "installationId", "projectId"] as const)
        expect(query.getAll(key)).toEqual([input.owner[key]])
      const body = Schema.decodeUnknownSync(SfContextResult, { onExcessProperty: "error" })(original.body)
      expect(body.status).toBe("ok")
      if (body.status !== "ok") throw new Error("The original F01 context did not admit the installed operator")
      expect(body.value.stamp.hostId).toBe(input.owner.hostId)
      expect(body.value.stamp.projectId).toBe(input.owner.projectId)
      expect(body.value.stamp.installationId).toBe(input.owner.installationId)
      expect(body.value.stamp.principalRef).toBe(input.installation.actorId)
      if (currentStamp) expect(body.value.stamp).toEqual(currentStamp)
      currentStamp = body.value.stamp
      latest = body.value
    }
    expect(requests.size).toBe(input.contextReads)
    if (!latest) throw new Error("No original context was observed")
    return latest
  })()
  void completed.catch(() => undefined)
  try {
    await input.action()
    return await completed
  } finally {
    observed.close()
  }
}

/** Same URL construction and final DOM/overflow checks as the original enter.
 * Domain readers are registered by the caller before this function and awaited
 * in beforeReady; the original ready() DOM deadline remains 10 seconds. */
export async function navigateFinalSurface(input: FinalNavigationBase & Readonly<{
  href: string
  title: string
  beforeReady?: (context: SfContext) => Promise<void>
}>): Promise<SfContext> {
  const destination = new URL(input.href)
  expect(destination.origin).toBe(input.installation.origin)
  destination.searchParams.set("server", ServerConnection.key({
    type: "http", http: { url: destination.origin },
  }))
  destination.searchParams.set("project", input.owner.projectId)
  destination.searchParams.set("installation", input.owner.installationId)
  const context = await observeFinalNavigation({
    ...input, contextReads: 2, action: () => input.page.goto(destination.href),
  })
  await input.beforeReady?.(context)
  await ready(input.page, input.title)
  await expect(input.page).toHaveURL((url) => url.origin === destination.origin && url.pathname === destination.pathname &&
    ["server", "project", "installation"].every((key) => url.searchParams.get(key) === destination.searchParams.get(key)))
  await reflow(input.page)
  await scrollPageTop(input.page)
  return context
}
