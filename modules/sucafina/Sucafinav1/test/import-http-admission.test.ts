import { expect, test } from "bun:test"
import { createSfImportHttp, type ImportHttpLimits, type ImportService } from "../product/interface/import-http.ts"
import { createSfUiAuthority } from "../product/integration/ui-authority.ts"
import { createSfHumanAuthority } from "../product/integration/human-authority.ts"

const origin = "https://sf.example.test"
const mount = "/sucafina"
const boundary = "sf-boundary"
const unreachable = async (): Promise<never> => { throw new Error("unreachable import service") }
const service: ImportService = {
  discover: unreachable,
  prepareTarget: unreachable,
  dispatch: unreachable,
  imports: {
    admit: unreachable,
    readPreviewReference: unreachable,
    detail: unreachable,
    apply: unreachable,
  },
}

function runtime(authorized: boolean) {
  const ui = createSfUiAuthority({
    authorize: async () => authorized ? {
      installationId: "installation",
      projectId: "project",
      principalRef: "person",
      policyVersion: "policy",
      accessRevision: "revision",
    } : undefined,
    commandIdentity: async () => "command",
    createId: () => crypto.randomUUID(),
    now: () => Date.now(),
    privateCommands: ["sf-human:imports.admit"],
  })
  return { ui, human: createSfHumanAuthority({ origin, ui }), service }
}

function handler(authorized: boolean, limits?: ImportHttpLimits) {
  const shared = runtime(authorized)
  return createSfImportHttp({ origin, mount, runtime: () => shared, ...(limits ? { limits } : {}) })
}

function request(body: BodyInit, signal?: AbortSignal) {
  return new Request(`${origin}${mount}/planner?sf=import-admit`, {
    method: "POST",
    headers: {
      origin,
      "sec-fetch-site": "same-origin",
      "content-type": `multipart/form-data; boundary=${boundary}`,
    },
    body,
    ...(signal ? { signal } : {}),
  })
}

function multipartParts(count: number) {
  return `${Array.from({ length: count }, (_, index) => `--${boundary}\r\nContent-Disposition: form-data; name="field-${index}"\r\n\r\nvalue\r\n`).join("")}--${boundary}--\r\n`
}

function stalledBody(onBlocked?: () => void) {
  let pulls = 0
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      pulls += 1
      if (pulls === 1) {
        controller.enqueue(new TextEncoder().encode(`--${boundary}\r\n`))
        return
      }
      onBlocked?.()
      return new Promise<void>(() => {})
    },
  })
}

test("import admission rejects unavailable authority before consuming multipart bytes", async () => {
  const body = `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="payload.json"\r\nContent-Type: application/json\r\n\r\n{}\r\n--${boundary}--\r\n`
  const incoming = request(body)
  expect((await handler(false)(incoming, "planner"))?.status).toBe(403)
  expect(incoming.bodyUsed).toBe(false)
})

test("authorized import admission still consumes and rejects a malformed multipart envelope", async () => {
  const incoming = request("not-a-valid-multipart-body")
  expect((await handler(true)(incoming, "planner"))?.status).toBe(400)
  expect(incoming.bodyUsed).toBe(true)
})

test("multipart part budget rejects an authenticated part fanout before form parsing", async () => {
  const incoming = request(multipartParts(5))
  expect((await handler(true, { maxMultipartParts: 4 })(incoming, "planner"))?.status).toBe(400)
  expect(incoming.bodyUsed).toBe(true)
})

test("concurrent intake budget rejects excess work before consuming its body and releases after abort", async () => {
  let blocked: (() => void) | undefined
  const bodyBlocked = new Promise<void>((resolve) => { blocked = resolve })
  const abort = new AbortController()
  const firstRequest = request(stalledBody(() => blocked?.()), abort.signal)
  const importHttp = handler(true, { maxConcurrentIntakes: 1, intakeTimeoutMs: 5_000 })
  const first = importHttp(firstRequest, "planner")
  await bodyBlocked

  const excess = request("not-a-valid-multipart-body")
  const busy = await importHttp(excess, "planner")
  expect(busy?.status).toBe(503)
  expect(busy?.headers.get("retry-after")).toBe("1")
  expect(excess.bodyUsed).toBe(false)

  abort.abort()
  expect((await first)?.status).toBe(400)
  const afterAbort = request("not-a-valid-multipart-body")
  expect((await importHttp(afterAbort, "planner"))?.status).toBe(400)
})

test("slow multipart intake reaches a bounded deadline and returns its concurrency slot", async () => {
  const importHttp = handler(true, { maxConcurrentIntakes: 1, intakeTimeoutMs: 20 })
  const timed = request(stalledBody())
  expect((await importHttp(timed, "planner"))?.status).toBe(408)
  const afterTimeout = request("not-a-valid-multipart-body")
  expect((await importHttp(afterTimeout, "planner"))?.status).toBe(400)
})
