import { digestSfValue } from "../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { PortResult } from "../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { CapabilityResult, TrustedExecutionBinding, TrustedUiContext } from "../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"

/**
 * Preparation adapter, with no host construction, login, provider registration or auto-run.
 * The accepted-C gate and independent reviewer belong to the caller. An HTTP response,
 * transcript, or complete capture from this adapter is not AM acceptance evidence by itself.
 *
 * Sources at 90f2c4f81f74edc26a1783bfda7891638b429fa6 (WP10 mission pin):
 * - apps/cli/src/sucafina-product/analysis-http.ts, blob 06522fa4a2eaa0841af8aabead799d9d56a8ada7:
 *   installed choices/prepare/start; reviewer author selection remains host-owned.
 * - modules/sucafina/Sucafinav1/product/interface/analysis-http.ts,
 *   blob 87b4c36950db61cdf6d7b9b0feb8ba9ebb1e8329: existing list/read/output.
 * - product/integration/human-authority.ts, blob 78529a89586ce9f22d2b2cdd2cd0b1c61d20668a,
 *   and ui-authority.ts, blob 502fb1ab3a4116a62aeb504a4bb26040c66d81b2:
 *   original Request, private consumed lease, current authority and mandatory finish.
 * - product/contracts/host-context.ts, blob 920fda293db553096f4d8ab7004fcd9652a69291:
 *   installed services and sessions.collect require live, registry-owned objects.
 * The type-only host imports and canonical helper already exist on PR20
 * 0a5ce33012d008af1f56d11596a1f1f4eaba5b9d; no WP12 test helper is imported.
 */

type Analyses = NonNullable<SfHostServices["analyses"]>
export type SfProofCaseRef = Parameters<Analyses["list"]>[1]
export type SfProofAnalysisRequest = Parameters<Analyses["start"]>[1]["request"]
export type SfProofAnalysisStart = Parameters<Analyses["start"]>[1] & {
  authorAnalysis?: { runRef: string; outputDigest: string }
}
export type SfProofSurface = "dashboard" | "planner" | "procurement"
export type SfWorkbenchAnalysisCommand =
  | { action: "choices" }
  | { action: "prepare"; input: { request: SfProofAnalysisRequest; selection: Record<string, unknown> } }
  | { action: "start"; input: SfProofAnalysisStart }
  | { action: "list"; caseRef: SfProofCaseRef }
  | { action: "read" | "output"; runRef: string }

/** No cookies, credentials, principals, grants, bindings or leases enter this descriptor. */
export type SfWorkbenchAnalysisRequest = Readonly<{
  url: string
  method: "POST"
  headers: Readonly<{ origin: string; "content-type": "application/json"; "idempotency-key": string }>
  body: string
  action: SfWorkbenchAnalysisCommand["action"]
}>

/** Supplied in memory by the owner of the already-authenticated installed application. */
export type SfInstalledRequestTransport = Readonly<{
  makeRequest: (input: SfWorkbenchAnalysisRequest) => Request | Promise<Request>
  send: (request: Request) => Promise<Response | undefined>
}>

export class SfProofNeedsHost extends Error {
  readonly status = "NEEDS_HOST"
  constructor(readonly operation: string, readonly resource: string, readonly owner = "S0-B / WP10 installed-host owner") {
    super(`NEEDS_HOST: ${operation}; resource=${resource}; owner=${owner}`)
    this.name = "SfProofNeedsHost"
  }
}

/** Builds the existing product route; the owner attaches authority in makeRequest(). */
export function buildWorkbenchAnalysisRequest(input: {
  origin: string
  mount: string
  surface: SfProofSurface
  idempotencyKey: string
  body: SfWorkbenchAnalysisCommand
}): SfWorkbenchAnalysisRequest {
  const origin = new URL(input.origin)
  if (origin.origin !== input.origin || !["http:", "https:"].includes(origin.protocol) || origin.username || origin.password)
    throw new Error("SF_PROOF_ORIGIN_INVALID")
  if (input.mount !== "" && (!input.mount.startsWith("/") || input.mount.endsWith("/") || /[?#\\]|%2e|%2f|%5c/i.test(input.mount) || input.mount.split("/").some((part) => part === "." || part === "..")))
    throw new Error("SF_PROOF_MOUNT_INVALID")
  if (!["dashboard", "planner", "procurement"].includes(input.surface) || !/^[A-Za-z0-9._:-]{8,128}$/.test(input.idempotencyKey))
    throw new Error("SF_PROOF_REQUEST_INVALID")
  if (!["choices", "prepare", "start", "list", "read", "output"].includes(input.body.action))
    throw new Error("SF_PROOF_ACTION_INVALID")
  // Business schemas, model availability, selected scopes and reviewer separation are
  // checked by the real product. This boundary only enforces lossless JSON transport.
  const body = JSON.stringify(input.body)
  if (typeof body !== "string" || new TextEncoder().encode(body).byteLength > 65536 || digestSfValue(JSON.parse(body)) !== digestSfValue(input.body))
    throw new Error("SF_PROOF_JSON_NOT_LOSSLESS_OR_TOO_LARGE")
  return Object.freeze({
    url: `${input.origin}${input.mount}/${input.surface}?sf=workbench-analysis`,
    method: "POST",
    headers: Object.freeze({ origin: input.origin, "content-type": "application/json", "idempotency-key": input.idempotencyKey }),
    body,
    action: input.body.action,
  })
}

/**
 * Bind this to the installed SfHostRuntime.services callback, never a fixture factory.
 * No serialized configuration is accepted as authority. Host methods authenticate the
 * actual Request and registry-check bindings. This module cannot certify its owner.
 * Keep one adapter for the proof attempt; mutation attempts remain consumed on errors.
 */
export function createInstalledSfProofAdapter(input: {
  services: () => SfHostServices | undefined
  transport?: SfInstalledRequestTransport
}) {
  const attemptedCommands = new Set<string>()
  const submittedRequests = new WeakSet<Request>()
  const servicesFor = (operation: string) => {
    const services = input.services()
    if (!services) throw new SfProofNeedsHost(operation, "live installed SfHostRuntime.services()")
    return services
  }
  const consumeCommand = (request: Request) => {
    const key = request.headers.get("idempotency-key")
    if (!key || !/^[A-Za-z0-9._:-]{8,128}$/.test(key)) throw new Error("SF_PROOF_IDEMPOTENCY_KEY_REQUIRED")
    if (attemptedCommands.has(key)) throw new Error("SF_PROOF_MUTATION_RETRY_FORBIDDEN")
    attemptedCommands.add(key)
  }
  const read = async <T>(request: Request, payload: { runRef: string } | { caseRef: SfProofCaseRef },
    call: (analyses: Analyses, context: TrustedUiContext) => Promise<PortResult<T>>): Promise<PortResult<T>> => {
    const services = servicesFor("analysis.read")
    if (!services.analyses) throw new SfProofNeedsHost("analysis.read", "installed SfHostServices.analyses")
    const admitted = await services.human.admit(request, "analysis.read", payload)
    if (admitted.status !== "ok") return admitted
    try {
      const result = await call(services.analyses, admitted.value)
      if (!await services.human.authorize(admitted.value, "analysis.read", payload) || input.services() !== services)
        return { status: "denied", reason: "proof-analysis-authority-changed" }
      return result
    } finally { services.human.finish(admitted.value) }
  }
  return {
    /** Discovery reports configured live values, not proof that any skill executed. */
    async discover() {
      const services = servicesFor("discover selected profiles and available models")
      const models = await services.models()
      if (input.services() !== services) throw new SfProofNeedsHost("discover", "stable installed SfHostServices lifetime")
      return { selected: services.selected, models, analysesAvailable: !!services.analyses, httpTransportAvailable: !!input.transport }
    },

    /**
     * Real UI parity call. Dispatch consumes the admitted UI lease itself; validating
     * it here first would consume it twice. The inner receipt is returned unchanged.
     * The outer PortResult describes this adapter boundary, never AM acceptance.
     * Every dispatch is one command attempt, including artifact-producing reads.
     */
    async dispatch(request: Request, operation: string, payload: unknown): Promise<PortResult<CapabilityResult>> {
      const services = servicesFor(operation)
      consumeCommand(request)
      const admitted = await services.ui.admit(request, operation, digestSfValue(payload))
      if (admitted.status !== "ok") return admitted
      try {
        const result = await services.dispatch(operation, payload, admitted.value)
        if (!await services.ui.revalidate(admitted.value) || input.services() !== services)
          return { status: "denied", reason: "proof-dispatch-authority-changed" }
        return { status: "ok", value: result }
      } finally { services.ui.finish(admitted.value) }
    },

    listAnalyses(request: Request, caseRef: SfProofCaseRef) {
      return read(request, { caseRef }, (analyses, context) => analyses.list(context, caseRef))
    },
    readAnalysis(request: Request, runRef: string) {
      return read(request, { runRef }, (analyses, context) => analyses.read(context, runRef))
    },
    /** Full real envelope; HTTP output below is the product's HTML projection. */
    readOutput(request: Request, runRef: string) {
      return read(request, { runRef }, (analyses, context) => analyses.output(context, runRef))
    },
    /** One observation only. The host rejects a cloned/JSON-restored binding. */
    async collectSession(binding: TrustedExecutionBinding): ReturnType<SfHostServices["sessions"]["collect"]> {
      const services = servicesFor("sessions.collect")
      const result = await services.sessions.collect(binding)
      if (input.services() !== services) return { status: "denied", reason: "proof-session-host-changed" }
      return result
    },

    /**
     * Calls the actual installed application route exactly once. No fetch fallback,
     * retries, polling, sleeps or manufactured transport response. Owner can observe
     * native events and later issue a separate read/output with a fresh Request.
     * sf-revisar-evidencias must retain the real authorAnalysis selection; the WP10
     * handler privately derives a distinct reviewer session and checks its output.
     */
    async callWorkbenchAnalysis(spec: SfWorkbenchAnalysisRequest): Promise<Response> {
      if (!input.transport) throw new SfProofNeedsHost("workbench-analysis HTTP", "owner-authenticated in-memory Request transport to the installed application")
      if (JSON.parse(spec.body).action !== spec.action) throw new Error("SF_PROOF_ACTION_BODY_MISMATCH")
      const request = await input.transport.makeRequest(spec)
      if (!(request instanceof Request) || request.bodyUsed || request.signal.aborted || request.method !== spec.method || request.url !== spec.url ||
        request.headers.get("origin") !== spec.headers.origin || request.headers.get("content-type") !== spec.headers["content-type"] ||
        request.headers.get("idempotency-key") !== spec.headers["idempotency-key"] || request.headers.get("sec-fetch-site") === "cross-site")
        throw new Error("SF_PROOF_OWNER_REQUEST_MISMATCH")
      if (await request.clone().text() !== spec.body) throw new Error("SF_PROOF_OWNER_BODY_MISMATCH")
      if (submittedRequests.has(request)) throw new Error("SF_PROOF_REQUEST_REUSE_FORBIDDEN")
      submittedRequests.add(request)
      if (spec.action === "prepare" || spec.action === "start") consumeCommand(request)
      // Do not clone, rebuild or serialize this Request: host private authority keeps it.
      const response = await input.transport.send(request)
      if (!response) throw new SfProofNeedsHost(`workbench-analysis ${spec.action}`, "mounted WP10 analysis HTTP adapter and WP01 product analysis routes")
      return response
    },
  }
}
