import type { Page, Response } from "@playwright/test"

type Operation = {
  label: string
  method: string
  pathname: string
  query?: Readonly<Record<string, string>>
  body?: "bytes"
}
type Started = { kind: "start"; document: string; documentUrl: string; method: string; url: string }
type Completed = { kind: "complete"; ticket: number; document: string; url: string; status: number; body: unknown; error?: string }
type Message = { kind: "document"; document: string } | Started | Completed
type Ticket = { id: number; body: "json" | "bytes" }
type Captured = {
  ticket: number
  start: Started
  request?: ReturnType<Response["request"]>
  complete?: Completed
  completedAt?: number
  ready: Promise<Completed>
  deliver: (copy: Completed) => void
  consumed: boolean
}
type Selection = { operation: Operation; captures: Captured[]; selected?: Captured }
type Scope = { deadline: number; timeoutMs: 5000 | 10000; selections: Selection[]; failure?: Error }

/**
 * Observe copies of real fetch responses before navigation can discard CDP's
 * response-body handle. Never replace a response, modify a request or issue GETs.
 */
export async function observeNativeResponses(page: Page, origin: string) {
  let active: Scope | undefined
  let document = ""
  let nextTicket = 0
  const tickets = new Map<number, Captured>()
  const matches = (operation: Operation, method: string, href: string) => {
    const url = new URL(href)
    return method === operation.method && url.origin === origin && url.pathname === operation.pathname &&
      Object.entries(operation.query ?? {}).every(([key, value]) =>
        url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value)
  }
  await page.exposeBinding("__sfNativeResponseCopy", (source, message: Message): Ticket | null => {
    if (source.page !== page || source.frame !== page.mainFrame()) return null
    if (message.kind === "document") {
      document = message.document
      return null
    }
    if (message.kind === "complete") {
      const capture = tickets.get(message.ticket)
      if (!capture) return null
      if (capture.complete || message.document !== capture.start.document) {
        if (active) active.failure = new Error("Native response copy has duplicate or foreign document identity")
        return null
      }
      capture.complete = message
      capture.completedAt = Date.now()
      capture.deliver(message)
      return null
    }
    if (!active || message.document !== document) return null
    const selected = active.selections.filter((entry) => matches(entry.operation, message.method, message.url))
    if (selected.length === 0) return null
    if (selected.length !== 1) {
      active.failure = new Error("Native response capture has overlapping operation selectors")
      return null
    }
    let deliver!: (copy: Completed) => void
    const ready = new Promise<Completed>((resolve) => { deliver = resolve })
    const capture: Captured = { ticket: ++nextTicket, start: message, ready, deliver, consumed: false }
    selected[0]!.captures.push(capture)
    tickets.set(capture.ticket, capture)
    return { id: capture.ticket, body: selected[0]!.operation.body ?? "json" }
  })
  const onRequest = (request: ReturnType<Response["request"]>) => {
    if (!active || request.resourceType() !== "fetch") return
    // A service worker request may have no frame; it cannot be this page's fetch.
    let frame: ReturnType<Response["frame"]> | undefined
    try { frame = request.frame() } catch { return }
    if (frame !== page.mainFrame()) return
    // The owner can publish its query via same-document history while fetch is
    // pending. Bind by document ticket and frame, never by the mutable route URL.
    const candidates = active.selections.flatMap((entry) => entry.captures).filter((capture) =>
      !capture.request && capture.start.document === document &&
      capture.start.method === request.method() && capture.start.url === request.url())
    if (candidates.length === 0) return // e.g. a request already started before this scope
    if (candidates.length !== 1) {
      active.failure = new Error("Native response Request identity is ambiguous; no copy was selected")
      return
    }
    candidates[0]!.request = request
  }
  page.on("request", onRequest)
  await page.addInitScript(installCapture, { origin })
  await page.evaluate(installCapture, { origin })

  const begin = (operations: readonly Operation[], timeoutMs: 5000 | 10000 = 10000) => {
    if (timeoutMs !== 5000 && timeoutMs !== 10000) throw new Error("Native response capture timeout must be 5000ms or 10000ms")
    if (active) throw new Error("Finish the previous native response scope before starting another")
    if (operations.length === 0) throw new Error("Native response capture needs an explicit operation")
    const scope: Scope = {
      deadline: Date.now() + timeoutMs,
      timeoutMs,
      selections: operations.map((operation) => ({ operation, captures: [] })),
    }
    active = scope
    const requireUnique = (selection: Selection, capture: Captured) => {
      if (active !== scope) throw new Error("Native response scope is no longer active")
      if (scope.failure) throw scope.failure
      if (!capture.request || capture.start.document !== document ||
        capture.request.frame() !== page.mainFrame())
        throw new Error(selection.operation.label + ": selected response is not bound to the current frame/document")
      const identical = scope.selections.flatMap((entry) => entry.captures)
        .filter((entry) => entry.request === capture.request)
      if (identical.length !== 1 || identical[0] !== capture)
        throw new Error(selection.operation.label + ": original Request does not identify exactly one fetch copy")
    }
    const read = async (response: Response, body: "json" | "bytes") => {
      const selected = scope.selections.filter((entry) => matches(entry.operation, response.request().method(), response.request().url()))
      if (selected.length !== 1) throw new Error("Response does not identify one selected native operation")
      const selection = selected[0]!
      if ((selection.operation.body ?? "json") !== body) throw new Error(selection.operation.label + ": wrong response body reader")
      const bound = selection.captures.filter((capture) => capture.request === response.request())
      if (bound.length !== 1) throw new Error(selection.operation.label + ": response has no unique original fetch/Request binding")
      const capture = bound[0]!
      requireUnique(selection, capture)
      if (capture.consumed || selection.selected) throw new Error(selection.operation.label + ": response body was already consumed")
      let timer: ReturnType<typeof setTimeout> | undefined
      const copy = await Promise.race([
        capture.ready,
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => reject(new Error(selection.operation.label + ": real response copy exceeded the original " + scope.timeoutMs + "ms deadline")),
            Math.max(0, scope.deadline - Date.now()))
        }),
      ]).finally(() => clearTimeout(timer))
      requireUnique(selection, capture)
      if (capture.completedAt! > scope.deadline) throw new Error(selection.operation.label + ": real response copy exceeded the original " + scope.timeoutMs + "ms deadline")
      if (copy.error) throw new Error(selection.operation.label + ": real fetch clone failed: " + copy.error)
      if (copy.document !== capture.start.document || copy.url !== response.url() || copy.status !== response.status())
        throw new Error(selection.operation.label + ": copied body does not match the original Response URL/status/document")
      capture.consumed = true
      selection.selected = capture
      return copy.body
    }
    return {
      json: (response: Response) => read(response, "json"),
      body: async (response: Response) => {
        const bytes = await read(response, "bytes")
        if (!Array.isArray(bytes) || !bytes.every((byte) => Number.isInteger(byte) && byte >= 0 && byte <= 255))
          throw new Error("Native response copy did not contain exact bytes")
        return Buffer.from(bytes)
      },
      finish: () => {
        if (active !== scope) throw new Error("Native response scope is no longer active")
        if (scope.failure) throw scope.failure
        for (const selection of scope.selections) {
          if (!selection.selected) throw new Error(selection.operation.label + ": selected response body was not verified")
          requireUnique(selection, selection.selected)
        }
        for (const selection of scope.selections)
          for (const capture of selection.captures) tickets.delete(capture.ticket)
        active = undefined
      },
    }
  }
  return {
    begin,
    dispose: () => {
      active = undefined
      tickets.clear()
      page.off("request", onRequest)
    },
  }
}

function installCapture({ origin }: { origin: string }) {
  const bridge = (globalThis as unknown as {
    __sfNativeResponseCopy: (message: Message) => Promise<Ticket | null>
  }).__sfNativeResponseCopy
  const document = crypto.randomUUID()
  void bridge({ kind: "document", document })
  const originalFetch = globalThis.fetch
  const observedFetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
    const [input, init] = args
    const url = new URL(input instanceof globalThis.Request ? input.url : String(input), location.href)
    const method = (init?.method ?? (input instanceof globalThis.Request ? input.method : "GET")).toUpperCase()
    if (url.origin !== origin || !url.pathname.startsWith("/sucafina/"))
      return Reflect.apply(originalFetch, this, args)
    const ticket = await bridge({ kind: "start", document, documentUrl: location.href, method, url: url.href })
    const response: Awaited<ReturnType<typeof fetch>> = await Reflect.apply(originalFetch, this, args)
    if (!ticket) return response
    try {
      const copy = response.clone()
      const body: unknown = ticket.body === "bytes" ? Array.from(new Uint8Array(await copy.arrayBuffer())) : await copy.json()
      // Deliver the copy before returning the original response to its consumer.
      await bridge({ kind: "complete", ticket: ticket.id, document, url: response.url, status: response.status, body })
    } catch (error) {
      await bridge({ kind: "complete", ticket: ticket.id, document, url: response.url, status: response.status,
        body: undefined, error: error instanceof Error ? error.message : String(error) }).catch(() => {})
    }
    return response
  }
  if (!Reflect.set(globalThis, "fetch", observedFetch)) throw new Error("Native response observer installation was rejected")
}
