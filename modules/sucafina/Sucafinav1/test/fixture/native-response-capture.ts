import type { Page, Response } from "@playwright/test"

type Operation = {
  label: string
  method: string
  pathname: string
  query?: Readonly<Record<string, string>>
  body?: "bytes"
}
type Started = { kind: "start"; call: number; document: string; documentUrl: string; method: string; url: string }
type Completed = { kind: "complete"; ticket: number; document: string; url: string; status: number; body: unknown; error?: string }
type Interrupted = { kind: "interrupt"; call: number; document: string; dispatched: boolean; error: string }
type Message = { kind: "document"; document: string } | Started | Completed | Interrupted
type Ticket = { id: number; body: "none" | "json" | "bytes" }
type Captured = {
  ticket: number
  start: Started
  scope: Scope
  request?: ReturnType<Response["request"]>
  complete?: Completed
  completedAt?: number
  ready: Promise<Completed>
  deliver: (copy: Completed) => void
  consumed: boolean
  withdrawn: boolean
}
type Selection = { operation: Operation; captures: Captured[]; selected?: Captured }
type Scope = { deadline: number; timeoutMs: 5000 | 10000; selections: Selection[]; failure?: Error; closed: boolean }
type Permit = {
  ticket: number
  start: Started
  key: string
  capture?: Captured
  body: Ticket["body"]
  phase: "queued" | "permitted"
  resolve: (ticket: Ticket) => void
  reject: (error: Error) => void
  timer?: ReturnType<typeof setTimeout>
  rejected?: string
}
type Lane = { pending?: Permit; queued: Permit[] }
type HardNavigation = {
  document: string
  phase: "draining" | "navigating"
  drained: () => void
  arrived: () => void
  reject: (error: Error) => void
}

/**
 * Observe copies of real fetch responses before navigation can discard CDP's
 * response-body handle. Never replace a response, modify a request or issue GETs.
 *
 * Identical starts wait only until the previous real Request is observed, never
 * for its response. That instrumentation delay uses the scope's original budget.
 */
export async function observeNativeResponses(page: Page, origin: string) {
  const frame = page.mainFrame()
  let active: Scope | undefined
  let document = ""
  let nextTicket = 0
  let disposed = false
  let navigation: HardNavigation | undefined
  let navigationFailure: Error | undefined
  const tickets = new Map<number, Captured>()
  const starts = new Map<string, Permit>()
  // The frame is fixed above. Document is deliberately NOT part of this key:
  // an old dispatched start must not be mistaken for a new document's Request.
  const lanes = new Map<string, Lane>()
  const observed = new WeakSet<ReturnType<Response["request"]>>()
  const callKey = (start: Pick<Started, "document" | "call">) => JSON.stringify([start.document, start.call])
  const laneKey = (method: string, url: string) => JSON.stringify([method, url])
  const fail = (scope: Scope | undefined, error: Error) => {
    if (scope && !scope.closed) scope.failure ??= error
  }
  const deadlineError = (capture: Captured) =>
    new Error("Native response start exceeded the original " + capture.scope.timeoutMs + "ms deadline")
  const matches = (operation: Operation, method: string, href: string) => {
    const url = new URL(href)
    return method === operation.method && url.origin === origin && url.pathname === operation.pathname &&
      Object.entries(operation.query ?? {}).every(([key, value]) =>
        url.searchParams.getAll(key).length === 1 && url.searchParams.get(key) === value)
  }
  const checkNavigationDrain = () => {
    if (!navigation || navigation.phase !== "draining") return
    const permitted = [...starts.values()].filter((permit) => permit.phase === "permitted")
    const rejected = permitted.find((permit) => permit.rejected !== undefined)
    if (rejected) {
      navigation.reject(new Error("Native hard navigation cannot abandon a rejected fetch without its original Request"))
      return
    }
    const expired = permitted.find((permit) => permit.capture && Date.now() >= permit.capture.scope.deadline)
    if (expired?.capture) {
      navigation.reject(deadlineError(expired.capture))
      return
    }
    if (permitted.length === 0) navigation.drained()
  }
  const forget = (permit: Permit) => {
    clearTimeout(permit.timer)
    starts.delete(callKey(permit.start))
    checkNavigationDrain()
  }
  const pump = (key: string, lane: Lane) => {
    if (lane.pending?.rejected !== undefined) {
      // End waits behind a known rejection, including pass-through starts.
      // Keep only the uncertain dispatched permit: a late Request must still
      // bind to it, never to a newly admitted fetch at the same URL.
      const error = new Error("Native response start is blocked by a rejected fetch without its original Request")
      for (const permit of lane.queued.splice(0)) {
        if (permit.capture) {
          permit.capture.withdrawn = true
          tickets.delete(permit.ticket)
          fail(permit.capture.scope, error)
        }
        forget(permit)
        permit.reject(error)
      }
      return
    }
    while (!lane.pending && lane.queued.length) {
      const permit = lane.queued[0]!
      if (!starts.has(callKey(permit.start))) { lane.queued.shift(); continue }
      const capture = permit.capture
      const error = disposed ? new Error("Native response observer was disposed before fetch")
        : navigationFailure
        ?? (permit.start.document !== document ? new Error("Native response document ended before fetch")
          : capture && Date.now() >= capture.scope.deadline ? deadlineError(capture)
          : capture?.scope.failure)
      // An explicit hard navigation first drains granted starts in the living
      // document. Later starts stay queued, so they cannot lose an issued permit.
      if (!error && navigation?.document === permit.start.document) return
      lane.queued.shift()
      if (error) {
        if (capture) {
          capture.withdrawn = true
          if (Date.now() >= capture.scope.deadline) fail(capture.scope, error)
        }
        forget(permit)
        permit.reject(error)
        continue
      }
      // Reserve before resolving exactly one waiter. A shared wake-up promise
      // would let several identical starts recreate the original ambiguity.
      lane.pending = permit
      permit.phase = "permitted"
      permit.resolve({ id: permit.ticket, body: capture?.scope.closed ? "none" : permit.body })
    }
    if (!lane.pending && lane.queued.length === 0) lanes.delete(key)
  }
  const withdraw = (permit: Permit, error: Error) => {
    if (starts.get(callKey(permit.start)) !== permit) return
    const lane = lanes.get(permit.key)
    if (!lane) throw new Error("Native response start lost its reservation")
    if (permit.capture) {
      permit.capture.withdrawn = true
      tickets.delete(permit.ticket)
    }
    forget(permit)
    if (lane.pending === permit) lane.pending = undefined
    else lane.queued = lane.queued.filter((entry) => entry !== permit)
    permit.reject(error)
    pump(permit.key, lane)
  }

  await page.exposeBinding("__sfNativeResponseCopy", (source, message: Message): Ticket | null | Promise<Ticket> => {
    if (source.page !== page || source.frame !== frame) return null
    if (disposed) return null
    if (message.kind === "document") {
      if (navigation && message.document !== navigation.document) {
        if (navigation.phase === "draining")
          navigation.reject(new Error("Native response document changed before hard navigation drained its starts"))
        else navigation.arrived()
      }
      document = message.document
      // Queued starts have not received permission and therefore cannot have
      // called fetch. Already-permitted old starts remain reserved until their
      // Request arrives or the browser proves that fetch was never called.
      for (const permit of [...starts.values()])
        if (permit.phase === "queued" && permit.start.document !== document)
          withdraw(permit, new Error("Native response document ended before fetch"))
      return null
    }
    if (message.kind === "interrupt") {
      const permit = starts.get(callKey(message))
      if (!permit) return null
      if (!message.dispatched) {
        withdraw(permit, new Error("Native response start was aborted before fetch"))
        return null
      }
      // A rejected fetch may still have a Request event in transit. Retain the
      // reservation across scopes/documents; never lend it to the next start.
      permit.rejected = message.error
      checkNavigationDrain()
      if (permit.phase !== "permitted")
        fail(permit.capture?.scope, new Error("Native fetch was dispatched without its start permit"))
      const lane = lanes.get(permit.key)
      if (lane) pump(permit.key, lane)
      return null
    }
    if (message.kind === "complete") {
      const capture = tickets.get(message.ticket)
      if (!capture) return null
      if (capture.complete || message.document !== capture.start.document) {
        fail(capture.scope, new Error("Native response copy has duplicate or foreign document identity"))
        return null
      }
      capture.complete = message
      capture.completedAt = Date.now()
      capture.deliver(message)
      return null
    }
    if (navigationFailure) throw navigationFailure
    if (message.document !== document) throw new Error("Native response start belongs to an inactive document")
    if (starts.has(callKey(message))) throw new Error("Native response start identity was reused")
    const url = new URL(message.url)
    if (url.origin !== origin || !url.pathname.startsWith("/sucafina/")) return null
    const scope = active
    const selected = scope?.selections.filter((entry) => matches(entry.operation, message.method, message.url)) ?? []
    if (selected.length > 1) {
      const error = new Error("Native response capture has overlapping operation selectors")
      fail(scope, error)
      throw error
    }
    let capture: Captured | undefined
    if (scope && selected.length === 1) {
      let deliver!: (copy: Completed) => void
      const ready = new Promise<Completed>((resolve) => { deliver = resolve })
      capture = { ticket: ++nextTicket, start: message, scope, ready, deliver, consumed: false, withdrawn: false }
      selected[0]!.captures.push(capture)
      tickets.set(capture.ticket, capture)
    }
    const ticket = capture?.ticket ?? ++nextTicket
    const key = laneKey(message.method, message.url)
    const lane: Lane = lanes.get(key) ?? { queued: [] }
    lanes.set(key, lane)
    return new Promise<Ticket>((resolve, reject) => {
      const permit: Permit = {
        ticket, start: message, key, capture, phase: "queued", resolve, reject,
        body: selected[0]?.operation.body ?? (capture ? "json" : "none"),
      }
      // Pass-through starts get only this small reservation, never a body copy.
      // Keeping them prevents an event from before begin() occupying a new ticket.
      starts.set(callKey(message), permit)
      lane.queued.push(permit)
      const ownedCapture = capture
      if (ownedCapture) {
        permit.timer = setTimeout(() => {
          if (starts.get(callKey(message)) !== permit) return
          const error = deadlineError(ownedCapture)
          fail(ownedCapture.scope, error)
          if (permit.phase === "queued") withdraw(permit, error)
          else checkNavigationDrain()
          // A granted start may already be on the wire. Keep its identity even
          // after its budget expires; only Request/pre-fetch withdrawal releases it.
        }, Math.max(0, ownedCapture.scope.deadline - Date.now()))
      }
      pump(key, lane)
    })
  })
  const onRequest = (request: ReturnType<Response["request"]>) => {
    if (disposed || request.resourceType() !== "fetch" ||
      request.redirectedFrom() !== null || observed.has(request)) return
    // A service worker request may have no frame; it cannot be this page's fetch.
    try { if (request.frame() !== frame) return } catch { return }
    const key = laneKey(request.method(), request.url())
    const lane = lanes.get(key)
    const permit = lane?.pending
    if (!lane || !permit) return
    const candidates = [...starts.values()].filter((entry) => entry.key === key && entry.phase === "permitted")
    if (candidates.length !== 1 || candidates[0] !== permit) {
      for (const candidate of candidates)
        fail(candidate.capture?.scope, new Error("Native response Request identity is ambiguous; no copy was selected"))
      return
    }
    observed.add(request)
    if (permit.capture) permit.capture.request = request
    forget(permit)
    lane.pending = undefined
    pump(key, lane)
  }
  page.on("request", onRequest)
  await page.addInitScript(installCapture, { origin })
  await page.evaluate(installCapture, { origin })

  const navigate = async <T>(operation: () => Promise<T>, timeoutMs?: 5000 | 10000): Promise<T> => {
    if (disposed) throw new Error("Native response observer is disposed")
    if (navigationFailure) throw navigationFailure
    if (navigation) throw new Error("Finish the previous native hard navigation first")
    if (timeoutMs !== undefined && timeoutMs !== 5000 && timeoutMs !== 10000)
      throw new Error("Native hard navigation timeout must be 5000ms or 10000ms")
    const scope = active
    const budget = scope?.timeoutMs ?? timeoutMs
    if (budget === undefined)
      throw new Error("Native hard navigation outside a capture needs its explicit original timeout")
    if (scope && timeoutMs !== undefined && timeoutMs !== scope.timeoutMs)
      throw new Error("Native hard navigation must retain the active capture timeout")
    if (scope?.failure) throw scope.failure
    const deadline = scope?.deadline ?? Date.now() + budget
    const expired = () => new Error("Native hard navigation exceeded the original " + budget + "ms deadline")
    if (Date.now() >= deadline) throw expired()
    let drained!: () => void
    let arrived!: () => void
    let reject!: (error: Error) => void
    const ready = new Promise<void>((resolve) => { drained = resolve })
    const changed = new Promise<void>((resolve) => { arrived = resolve })
    const failure = new Promise<never>((_, fail) => { reject = fail })
    const barrier: HardNavigation = {
      document,
      phase: "draining",
      drained,
      arrived,
      reject: (error) => { fail(scope, error); reject(error) },
    }
    // Pause pump synchronously before checking or awaiting any granted start.
    navigation = barrier
    const timer = setTimeout(() => barrier.reject(expired()), Math.max(0, deadline - Date.now()))
    try {
      checkNavigationDrain()
      await Promise.race([ready, failure])
      if (disposed) throw new Error("Native response observer was disposed before hard navigation")
      if (document !== barrier.document)
        throw new Error("Native response document changed before hard navigation")
      if (scope?.failure) throw scope.failure
      if (Date.now() >= deadline) throw expired()
      barrier.phase = "navigating"
      // Delegate unchanged arguments/return through the caller. The same timer
      // covers draining, navigation and the new document's binding handshake.
      const result = await Promise.race([operation(), failure])
      await Promise.race([changed, failure])
      if (Date.now() >= deadline) throw expired()
      return result
    } catch (error) {
      if (barrier.phase === "navigating" && document === barrier.document) {
        // A failed navigation may have destroyed the old world without running
        // its successor's init script. Never grant old queued starts blindly.
        navigationFailure = new Error("Native hard navigation ended without a new document")
        fail(scope, navigationFailure)
      }
      throw error
    } finally {
      clearTimeout(timer)
      if (navigation === barrier) navigation = undefined
      for (const [key, lane] of lanes) pump(key, lane)
    }
  }

  const begin = (operations: readonly Operation[], timeoutMs: 5000 | 10000 = 10000) => {
    if (disposed) throw new Error("Native response observer is disposed")
    if (navigationFailure) throw navigationFailure
    if (timeoutMs !== 5000 && timeoutMs !== 10000) throw new Error("Native response capture timeout must be 5000ms or 10000ms")
    if (active) throw new Error("Finish the previous native response scope before starting another")
    if (operations.length === 0) throw new Error("Native response capture needs an explicit operation")
    const scope: Scope = {
      deadline: Date.now() + timeoutMs,
      timeoutMs,
      selections: operations.map((operation) => ({ operation, captures: [] })),
      closed: false,
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
      if (scope.failure) throw scope.failure
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
          for (const capture of selection.captures)
            if (!capture.request && !capture.withdrawn && starts.get(callKey(capture.start))?.capture !== capture)
              throw new Error(selection.operation.label + ": scope would abandon a start without its original Request")
        }
        // Finish releases copies, not dispatch reservations. A late old Request
        // still belongs to its old permit, even if a new scope/document opens.
        scope.closed = true
        for (const selection of scope.selections)
          for (const capture of selection.captures) tickets.delete(capture.ticket)
        active = undefined
      },
    }
  }
  return {
    begin,
    navigate,
    dispose: () => {
      if (disposed) return
      disposed = true
      navigation?.reject(new Error("Native response observer was disposed during hard navigation"))
      if (active) active.closed = true
      active = undefined
      for (const permit of starts.values()) {
        clearTimeout(permit.timer)
        permit.reject(new Error("Native response observer was disposed before fetch"))
      }
      starts.clear()
      lanes.clear()
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
  let nextCall = 0
  const registered = bridge({ kind: "document", document })
  const originalFetch = globalThis.fetch
  const observedFetch = async function (this: unknown, ...args: Parameters<typeof fetch>) {
    const [input, init] = args
    const url = new URL(input instanceof globalThis.Request ? input.url : String(input), location.href)
    const method = (init?.method ?? (input instanceof globalThis.Request ? input.method : "GET")).toUpperCase()
    if (url.origin !== origin || !url.pathname.startsWith("/sucafina/"))
      return Reflect.apply(originalFetch, this, args)
    // Explicit null overrides Request.signal; undefined keeps the Request's signal.
    const signal = init?.signal === undefined
      ? input instanceof globalThis.Request ? input.signal : undefined
      : init.signal
    if (signal?.aborted) throw signal.reason
    const call = ++nextCall
    let dispatched = false
    let cancelWait!: () => void
    const aborted = new Promise<never>((_, reject) => {
      cancelWait = () => reject(signal?.reason)
    })
    const abort = () => {
      if (dispatched) return
      // The signal is checked again after the permit. No native fetch has run.
      void bridge({ kind: "interrupt", call, document, dispatched: false, error: "AbortSignal before fetch" }).catch(() => {})
      cancelWait()
    }
    const permit = bridge({ kind: "start", call, document, documentUrl: location.href, method, url: url.href })
    signal?.addEventListener("abort", abort, { once: true })
    if (signal?.aborted) abort()
    try {
      let ticket: Ticket | null
      try { ticket = await Promise.race([permit, aborted]) }
      catch (error) {
        if (signal?.aborted) throw signal.reason
        throw error
      }
      if (signal?.aborted) {
        abort()
        throw signal.reason
      }
      dispatched = true
      let response: Awaited<ReturnType<typeof fetch>>
      try { response = await Reflect.apply(originalFetch, this, args) }
      catch (error) {
        // Preserve the actual rejection; it is never a successful body copy.
        // Without a Request event, the host retains this dispatch's reservation.
        void bridge({ kind: "interrupt", call, document, dispatched: true,
          error: error instanceof Error ? error.name : "fetch rejected" }).catch(() => {})
        throw error
      }
      if (!ticket || ticket.body === "none") return response
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
    } finally {
      signal?.removeEventListener("abort", abort)
    }
  }
  if (!Reflect.set(globalThis, "fetch", observedFetch)) throw new Error("Native response observer installation was rejected")
  return registered
}
