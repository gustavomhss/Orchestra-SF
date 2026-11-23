import { expect, type Request } from "@playwright/test"
import { createServer } from "node:http"
import { analyticsTest, captureOriginalBiData, type AnalyticsOwner } from "./design-support/wave-five-analytics"

type BiControl = {
  owner: AnalyticsOwner
  target: string
  payload: string
  requests: { method: string; path: string }[]
}

// A real loopback response tests the acquisition helper, not installed BI authority
// or business results. No route fulfillment, secondary GET, readback or replay.
const controlTest = analyticsTest.extend<{ biControl: BiControl }>({
  context: async ({ browser }, use) => {
    const context = await browser.newContext({ serviceWorkers: "block" })
    try { await use(context) } finally { await context.close() }
  },
  biControl: async ({}, use) => {
    const route = "/sucafina/dashboard?sf=bi-data&viewId=BI06"
    const payload = JSON.stringify({ control: "native-bi-acquisition", value: 0.125, unit: "days" })
    const requests: BiControl["requests"] = []
    const server = createServer((request, response) => {
      if (request.url?.startsWith("/sucafina/dashboard")) {
        requests.push({ method: request.method ?? "", path: request.url })
        if (request.method === "GET" && request.url === route) {
          response.writeHead(200, {
            "content-type": "application/json", "cache-control": "no-store", connection: "close",
          })
          response.end(payload)
          return
        }
      }
      if (request.method === "GET" && request.url === "/") {
        response.writeHead(200, { "content-type": "text/html", connection: "close" })
        response.end('<!doctype html><html><head><link rel="icon" href="data:,"></head><body><main><h1>BI acquisition control</h1></main></body></html>')
        return
      }
      response.writeHead(404, { connection: "close" })
      response.end()
    })
    await new Promise<void>((resolve, reject) => {
      server.once("error", reject)
      server.listen(0, "127.0.0.1", () => {
        server.off("error", reject)
        resolve()
      })
    })
    try {
      const address = server.address()
      if (!address || typeof address === "string") throw new Error("Expected a real loopback TCP listener")
      const origin = "http://127.0.0.1:" + address.port
      const owner: AnalyticsOwner = {
        installationId: "bi-control-installation", projectId: "bi-control-project", hostId: "bi-control-host",
        publicOrigin: origin, mount: "/sucafina", contractRevision: "sf-native-ui/1", authMode: "local-operator",
      }
      await use({ owner, target: origin + route, payload, requests })
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((error) => { if (error) reject(error); else resolve() })
      })
    }
  },
})
controlTest.describe.configure({ retries: 0 })

controlTest("BI acquisition rejects a controlled requestfailed callback after the original observation", async ({ page, biControl }, info) => {
  expect(info.project.metadata.bundle).toBe("production")
  await page.goto(biControl.owner.publicOrigin)
  await expect(page.getByRole("heading", { name: "BI acquisition control", exact: true })).toBeVisible()
  const nativeFailures: Request[] = []
  const finished: Request[] = []
  const selected: Request[] = []
  const onNativeFailure = (request: Request) => { if (request.url() === biControl.target) nativeFailures.push(request) }
  const onFinished = (request: Request) => { if (request.url() === biControl.target) finished.push(request) }
  page.on("requestfailed", onNativeFailure)
  page.on("requestfinished", onFinished)
  const subscribe = page.on
  const descriptor = Object.getOwnPropertyDescriptor(page, "on")
  const failureListeners: ((request: Request) => void)[] = []
  let injected = false
  // Page.emit is not in Playwright 1.59.1's public Page type. Delegate the public
  // subscription unchanged and retain the helper's actual callback for one fault.
  Object.defineProperty(page, "on", {
    configurable: true, writable: true,
    value(event: string, listener: unknown) {
      if (event === "requestfailed") {
        if (typeof listener !== "function") throw new Error("Expected the original failure listener")
        failureListeners.push((request) => { Reflect.apply(listener, page, [request]) })
      }
      return Reflect.apply(subscribe, page, [event, listener])
    },
  })
  try {
    const acquisition = captureOriginalBiData(page, biControl.owner, "BI06", async (observe) => {
      const responsePromise = page.waitForResponse(async (response) => {
        if (response.url() !== biControl.target || response.request().method() !== "GET") return false
        await observe(response)
        expect(response.status()).toBe(200)
        expect(response.request().failure()).toBeNull()
        expect(failureListeners).toHaveLength(1)
        const listener = failureListeners[0]
        if (!listener) throw new Error("The helper did not register its failure listener")
        selected.push(response.request())
        // This is an injected listener event, not a reproduced transport failure.
        // The actual Request/Response and the successful CDP observation are real.
        injected = true
        listener(response.request())
        return true
      }, { timeout: 60_000 })
      void responsePromise.catch(() => undefined)
      const delivered = await page.evaluate(async (url) => {
        const response = await fetch(url)
        return { status: response.status, body: await response.text() }
      }, biControl.target)
      expect(delivered).toEqual({ status: 200, body: biControl.payload })
      return responsePromise
    })
    await expect(acquisition).rejects.toThrow("Original BI request failed")
    expect(injected).toBe(true)
    expect(selected).toHaveLength(1)
    expect(finished).toHaveLength(1)
    expect(finished[0]).toBe(selected[0])
    expect(nativeFailures).toEqual([])
    expect(biControl.requests).toEqual([{ method: "GET", path: "/sucafina/dashboard?sf=bi-data&viewId=BI06" }])
    console.info("SF_BI_ACQUISITION_CONTROL " + JSON.stringify({
      control: "failure-after-observe", failureSource: "controlled-listener-invocation",
      sameNativeRequest: true, nativeRequestFinished: true, nativeTransportFailures: 0,
      biGets: 1, rejected: true, qualifiesInstalledBI: false,
    }))
  } finally {
    if (descriptor) Object.defineProperty(page, "on", descriptor)
    else Reflect.deleteProperty(page, "on")
    page.off("requestfailed", onNativeFailure)
    page.off("requestfinished", onFinished)
  }
  expect(page.on).toBe(subscribe)
})

controlTest("BI acquisition preserves its primary error when a delegated real detach then fails", async ({ page, biControl }, info) => {
  expect(info.project.metadata.bundle).toBe("production")
  await page.goto(biControl.owner.publicOrigin)
  await expect(page.getByRole("heading", { name: "BI acquisition control", exact: true })).toBeVisible()
  const primary = new Error("BI acquisition primary sentinel")
  const secondary = new Error("BI detach secondary sentinel")
  const context = page.context()
  const createSession = context.newCDPSession
  const descriptor = Object.getOwnPropertyDescriptor(context, "newCDPSession")
  let sessions = 0, detachCompleted = 0
  context.newCDPSession = async (target) => {
    const session = await createSession.call(context, target)
    sessions++
    const detach = session.detach
    const detachDescriptor = Object.getOwnPropertyDescriptor(session, "detach")
    session.detach = async () => {
      try {
        await detach.call(session)
        detachCompleted++
        // The real detach completed; only this secondary error is injected.
        throw secondary
      } finally {
        if (detachDescriptor) Object.defineProperty(session, "detach", detachDescriptor)
        else Reflect.deleteProperty(session, "detach")
      }
    }
    return session
  }
  try {
    await expect(captureOriginalBiData(page, biControl.owner, "BI06", async () => {
      throw primary
    })).rejects.toBe(primary)
    expect(sessions).toBe(1)
    expect(detachCompleted).toBe(1)
    expect(biControl.requests).toEqual([])
    console.info("SF_BI_ACQUISITION_CONTROL " + JSON.stringify({
      control: "primary-before-secondary-detach", primaryIdentityPreserved: true,
      realSessions: sessions, realDetachesCompleted: detachCompleted, biGets: 0,
      secondaryFailureSource: "controlled-after-real-detach", qualifiesInstalledBI: false,
    }))
  } finally {
    if (descriptor) Object.defineProperty(context, "newCDPSession", descriptor)
    else Reflect.deleteProperty(context, "newCDPSession")
  }
  expect(context.newCDPSession).toBe(createSession)
})
