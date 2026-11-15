import { chmod, mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { randomBytes, randomUUID } from "node:crypto"
import { Location } from "@orchestra/core/location"
import { AbsolutePath } from "@orchestra/core/schema"
import { createModule } from "../../../index.ts"
import { openLocalStore } from "../../../runtime/local-store.ts"
import { createOperatorIdentity } from "../../../runtime/operator-identity.ts"
import { createSfProductAuthority } from "../../../product/integration/product-authority.ts"
import { createSfSourcePersistence } from "../../../product/integration/source-lifecycle.ts"
import { enumerateSfSources } from "../../../product/integration/source-inventory.ts"
import { createSfSourceScopeProjector } from "../../../product/integration/source-projections.ts"
import { createDecisionCapabilities } from "../../../product/decisions/capabilities.ts"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import type { SfHostServices } from "../../../product/contracts/host-context.ts"
import type { TrustedDomainContext } from "../../../product/contracts/sf-execution.ts"
import { createSfWorkbenchHttp } from "../../../product/interface/http.ts"
import { createFixtureBusiness } from "../wp02/business-services-fixture.ts"

/** Actual operator authentication, SQLite, C08 authority and case dispatcher. No native/Microsoft claim. */
export async function workbenchFixture(origin = "http://localhost:43174") {
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-http-body-74-"))
  await chmod(directory, 0o700)
  const store = await openLocalStore(directory)
  const observed = {
    authentication: [] as Request[],
    commands: [] as { request: Request; operation: string; inputDigest: string; commandId: string }[],
    admissions: [] as Request[],
    dispatches: [] as { context: TrustedDomainContext; request: Request | undefined; operation: string; input: unknown }[],
  }
  const persistence = { ...store, ...createSfSourcePersistence({ persistence: store, enumerate: enumerateSfSources, projectScope: createSfSourceScopeProjector(() => "2026-11-13T08:00:00Z"), createId: randomUUID }) }
  const operator = { installationId: randomUUID(), uid: 1000, name: "Body limit test operator" }
  const identity = createOperatorIdentity({ origin, mount: "/sucafina", operator, secrets: store.secrets, key: randomBytes(32) })
  const location = Location.Ref.make({ directory: AbsolutePath.make(directory) })
  const environment = async (request: Request) => ({ at: "2026-11-13T08:00:00Z", id: randomUUID, directory: await identity.directory(request) })
  const proposalCoverageWrites = new WeakSet<object>(), dashboardHostWrites = new WeakSet<object>()
  const authenticate: typeof identity.authenticate = (request, context) => {
    observed.authentication.push(request)
    return identity.authenticate(request, context)
  }
  const authority = createSfProductAuthority({
    identity: () => ({ installationId: operator.installationId, projectId: "body-limit-project", hostId: "body-limit-host", location }),
    installationId: operator.installationId, origin, policyVersion: "body-limit-policy", persistence,
    proposalCoverageWrites, dashboardHostWrites, authenticate, environment,
    grants: [{ principalRef: `macos:${operator.installationId}:${operator.uid}`, namespaces: ["cases"], operations: ["sf_case_draft", "sf_case_read"] }],
    createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation, inputDigest) => {
      const key = request.headers.get("idempotency-key")
      if (!key) return undefined
      const commandId = digestSfValue({ operation, key })
      observed.commands.push({ request, operation, inputDigest, commandId })
      return commandId
    },
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  try {
    for (const surface of ["dashboard", "planner", "procurement"] as const) await persistence.initializeSources(surface)
    const business = await createFixtureBusiness({ authority, persistence, proposalCoverageWrites, dashboardHostWrites })
    try {
      const descriptors = createDecisionCapabilities({ cases: business.cases, requiredAuthority: { read: [], draft: [], receipt: [], alternative: [], change: [] }, createReceipt: authority.authority.receiptFor })
      const dispatch: SfHostServices["dispatch"] = async (operation, payload, context) => {
        const result = await dispatchSfCapability({ operation, payload, context, descriptors, authority: authority.authority,
          validateInput: (_descriptor, value) => operation === "sf_case_read" ? decodeSfOperationInput("sf_case_read", value).ok : operation === "sf_case_draft" && decodeSfOperationInput("sf_case_draft", value).ok,
          validateOutput: (_descriptor, result) => result.status !== "ok" || (operation === "sf_case_read" ? decodeSfOperationOutput("sf_case_read", result.result).ok : operation === "sf_case_draft" && decodeSfOperationOutput("sf_case_draft", result.result).ok),
        })
        observed.dispatches.push({ context, request: authority.authority.requestFor(context), operation, input: structuredClone(payload) })
        return result
      }
      const services = { ...authority, ui: { ...authority.ui, admit: (...args: Parameters<typeof authority.ui.admit>) => {
        observed.admissions.push(args[0])
        return authority.ui.admit(...args)
      } }, dispatch } as SfHostServices
      const product = createSfWorkbenchHttp({ origin, mount: "/sucafina", runtime: () => services })
      const app = createModule("/sucafina", { persistence, authenticate, environment, product, maxJsonBytes: 100000 })
      const enrolled = await identity.handle(new Request(`${origin}/sucafina/auth/local?code=${await identity.enroll()}`))
      const cookie = enrolled?.headers.get("set-cookie")?.split(";")[0]
      if (enrolled?.status !== 303 || !cookie) throw new Error("Body fixture enrollment failed")
      return {
        origin, cookie, observed, authority, product, app,
        request: (body: BodyInit | null, options: { headers?: HeadersInit; signal?: AbortSignal } = {}) => new Request(`${origin}/sucafina/dashboard?sf=workbench-command`, {
          method: "POST", headers: { cookie, origin, "content-type": "application/json", "idempotency-key": randomUUID(), ...Object.fromEntries(new Headers(options.headers)) },
          body, signal: options.signal, ...(body instanceof ReadableStream ? { duplex: "half" } : {}),
        }),
        snapshot: () => store.transaction("dashboard", async (snapshot) => ({ commit: false, value: structuredClone(snapshot) })),
        logout: () => identity.handle(new Request(`${origin}/sucafina/auth/logout`, { method: "POST", headers: { cookie, origin } })),
        async close() { business.dispose(); await store.dispose(); await rm(directory, { recursive: true, force: true }) },
      }
    } catch (error) { business.dispose(); throw error }
  } catch (error) { await store.dispose(); await rm(directory, { recursive: true, force: true }); throw error }
}

export function draftBody(objective = "Review renewal") {
  return { operation: "sf_case_draft", input: { objective, horizon: { start: "2027-01-01", end: "2027-12-31" }, currency: "USD", criteria: ["Cost"], sourceRefs: [] } }
}

/** Explicitly pull-driven, so over-budget tests observe whether the producer was stopped early. */
export function streamedBody(bytes: Uint8Array, chunkSize = 4096) {
  const observed = { pulls: 0, bytes: 0, cancelled: 0, ended: false }
  const stream = new ReadableStream<Uint8Array>({
    pull(controller) {
      observed.pulls++
      const chunk = bytes.slice(observed.bytes, observed.bytes + chunkSize)
      observed.bytes += chunk.byteLength
      controller.enqueue(chunk)
      if (observed.bytes === bytes.byteLength) { observed.ended = true; controller.close() }
    },
    cancel() { observed.cancelled++ },
  }, { highWaterMark: 0 })
  return { stream, observed }
}
