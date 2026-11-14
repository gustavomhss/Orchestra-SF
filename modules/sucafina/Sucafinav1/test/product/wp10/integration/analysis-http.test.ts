import { expect, test } from "bun:test"
import { createSfAnalysisHttp } from "../../../../../../../apps/cli/src/sucafina-product/analysis-http.ts"

const origin = "https://example.test"
const post = (body: unknown, headers: Record<string, string> = {}) => new Request(`${origin}/sf/dashboard?sf=workbench-analysis`, {
  method: "POST", headers: { origin, "content-type": "application/json", "idempotency-key": "analysis-request-0001", ...headers }, body: JSON.stringify(body),
})

test("analysis composition rejects cross-origin work before obtaining the runtime", async () => {
  let reads = 0
  const http = createSfAnalysisHttp({ origin, mount: "/sf", runtime: () => { reads += 1; return undefined } })
  const result = await http(post({ action: "start", input: {} }, { origin: "https://foreign.test" }), "dashboard")
  expect(result?.status).toBe(403)
  expect(reads).toBe(0)
})

test("history remains delegated with the original request body readable", async () => {
  const http = createSfAnalysisHttp({ origin, mount: "/sf", runtime: () => { throw new Error("history must keep its own authorization") } })
  const body = { action: "read", runRef: "run" }
  const request = post(body)
  expect(await http(request, "dashboard")).toBeUndefined()
  expect(await request.json()).toEqual(body)
})

test("missing runtime never yields a prepared analysis or a native start receipt", async () => {
  const http = createSfAnalysisHttp({ origin, mount: "/sf", runtime: () => undefined })
  for (const action of ["prepare", "start"]) {
    const result = await http(post({ action, input: {} }), "dashboard")
    expect(result?.status).toBe(503)
    expect(await result?.json()).toEqual({ status: "unavailable", reason: "analysis-runtime-unavailable" })
  }
})

test("analysis body limits finish without waiting for an unread tee branch", async () => {
  const http = createSfAnalysisHttp({ origin, mount: "/sf", runtime: () => { throw new Error("oversize input must not reach runtime") } })
  const result = await http(post({ action: "prepare", input: { selection: "x".repeat(65536) } }), "dashboard")
  expect(result?.status).toBe(413)
})

test("import choices are recognized and never fall through to an incompatible foreign action handler", async () => {
  const http = createSfAnalysisHttp({ origin, mount: "/sf", runtime: () => undefined })
  const response = await http(post({ action: "choices" }), "planner")
  // The pathname must agree with the routed surface.
  expect(response?.status).toBe(403)
  const acceptedRoute = await http(post({ action: "choices" }), "dashboard")
  expect(acceptedRoute?.status).toBe(503)
  expect(await acceptedRoute?.json()).toEqual({ status: "unavailable", reason: "analysis-choices-unavailable" })
  expect((await http(post({ action: "choices", input: {} }), "dashboard"))?.status).toBe(400)
})
