import { createHash, randomBytes, randomUUID } from "node:crypto"
import path from "node:path"
import { AbsolutePath } from "@orchestra/schema/schema"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { Period } from "../../../../modules/sucafina/Sucafinav1/product/contracts/context.ts"
import { createSfClawMcpHandler } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/claw-mcp.ts"
import { createSfProductAuthority } from "../../../../modules/sucafina/Sucafinav1/product/integration/product-authority.ts"
import { enumerateSfSources } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-inventory.ts"
import { createSfSourcePersistence } from "../../../../modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts"
import { projectSfProcurementScope } from "../../../../modules/sucafina/Sucafinav1/product/integration/procurement-projections.ts"
import type { LocalIdentity, LocalStore } from "../../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import { openLocalStore } from "../../../../modules/sucafina/Sucafinav1/runtime/local-store.ts"
import type { MicrosoftConfiguration } from "../../../../modules/sucafina/Sucafinav1/runtime/microsoft-configuration.ts"
import { readRequestBody } from "../../../../modules/sucafina/Sucafinav1/runtime/request-body.ts"
import type { createTeamProfileAccess } from "../../../../modules/sucafina/Sucafinav1/runtime/team-profile-access.ts"
import { emptyMap } from "../../../../modules/sucafina/Sucafinav1/src/identity.ts"
import { createSfBusinessServices } from "./business-services.ts"
import { createSfProductDispatch } from "./contribution.ts"
import { sfNativeLocationRef } from "./native-identity.ts"

type TeamAccess = ReturnType<typeof createTeamProfileAccess>
type Admission = Extract<Awaited<ReturnType<TeamAccess>>, { status: "allowed" }>

const operations = ["sf_request_read", "sf_sourcing_compare"] as const
const ttl = 60 * 60_000
const headers = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" }
const denied = () => new Response(null, { status: 403, headers })
const hash = (token: string) => createHash("sha256").update(token).digest("hex")

export function createSfTeamPurchaseMcp(input: {
  config: MicrosoftConfiguration
  directory: string
  period: Readonly<Period>
  identity: Pick<LocalIdentity, "authenticate">
  authorizeTeam: TeamAccess
  now: () => Date
}) {
  const { config, identity, authorizeTeam, now } = input
  const connectPath = config.mount + "/api/claw/connect"
  const mcpPath = config.mount + "/api/claw/mcp"
  const roles = emptyMap().filter((row) => row.surface === "procurement")
    .map((row) => ({ ...row, entra: config.groups.procurement[row.role] ?? null }))
  const credentials = new Map<string, { cookie: string; expiresAt: number; principal: string; team: string; partition: string }>()
  const audience = new Map<string, string>()
  const authenticate = async (request: Request, admission: Admission) => {
    if (request.signal.aborted || !await admission.verifyCurrent()) return null
    const actor = await identity.authenticate(request, { surface: "procurement", roleMap: roles })
    return actor?.id === admission.principalObjectId && actor.roles.some((role) => role.surface === "procurement") &&
      await admission.verifyCurrent() && !request.signal.aborted ? actor : null
  }
  const verifyTeam = async (request: Request, admission: Admission) => {
    if (!await admission.verifyCurrent()) return false
    const fresh = await authorizeTeam(request, admission.profile.teamObjectId, { refreshSession: false })
    return !request.signal.aborted && fresh.status === "allowed" &&
      fresh.principalObjectId === admission.principalObjectId && digestSfValue(fresh.profile) === digestSfValue(admission.profile) &&
      await fresh.verifyCurrent() && await admission.verifyCurrent()
  }
  const granted = (principal: string) => {
    const matching = config.grants.filter((grant) => grant.principalRef === principal)
    const [grant] = matching
    const configured = grant?.operations
    return matching.length === 1 && Array.isArray(configured) && operations.every((operation) => configured.includes(operation))
  }

  return async (request: Request) => {
    const url = new URL(request.url)
    if (url.pathname !== connectPath && url.pathname !== mcpPath) return undefined
    if (url.origin !== config.origin || url.search || request.signal.aborted || request.method !== "POST" ||
      request.headers.has("origin") && request.headers.get("origin") !== config.origin ||
      request.headers.get("sec-fetch-site") === "cross-site") return denied()
    if (url.pathname === connectPath) {
      if (request.headers.has("authorization") || request.headers.get("origin") !== config.origin ||
        request.headers.get("x-sf-claw-purpose") !== "purchases") return denied()
      const cookies = (request.headers.get("cookie") ?? "").split(";").map((cookie) => cookie.trim())
        .filter((cookie) => /^__Secure-sucafina_[0-9a-f]{12}_session=[0-9a-f]{64}$/.test(cookie))
      if (cookies.length !== 1 || (await readRequestBody(request, 0).catch(() => undefined)) === undefined) return denied()
      const admission = await authorizeTeam(request)
      if (admission.status !== "allowed" || !granted(admission.principalObjectId) || !await authenticate(request, admission) || !await verifyTeam(request, admission)) return denied()
      const timestamp = now().getTime()
      const partition = digestSfValue(admission.profile)
      const key = digestSfValue([admission.principalObjectId, partition])
      for (const [digest, credential] of credentials) if (credential.expiresAt <= timestamp) credentials.delete(digest)
      for (const [owner, digest] of audience) if (!credentials.has(digest)) audience.delete(owner)
      const previous = audience.get(key)
      if (previous) credentials.delete(previous)
      const token = randomBytes(32).toString("hex")
      const digest = hash(token)
      const expiresAt = timestamp + ttl
      credentials.set(digest, { cookie: cookies[0]!, expiresAt, principal: admission.principalObjectId,
        team: admission.profile.teamObjectId, partition })
      audience.set(key, digest)
      return Response.json({ token, expiresAt, principalRef: admission.principalObjectId,
        installationId: admission.profile.installationId }, { headers })
    }

    const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1]
    if (!token || request.headers.has("cookie") || request.headers.has("x-sf-team-profile")) return denied()
    const digest = hash(token)
    const credential = credentials.get(digest)
    if (!credential || credential.expiresAt <= now().getTime()) return denied()
    // The bearer only restores the exact Entra session and Team admitted at pairing.
    const restored = new Headers(request.headers)
    restored.delete("authorization")
    restored.set("cookie", credential.cookie)
    const admitted = new Request(request.url, { method: request.method, headers: restored, body: request.body,
      signal: request.signal, redirect: "error", ...(request.body ? { duplex: "half" } : {}) })
    const team = await authorizeTeam(admitted, credential.team)
    if (team.status !== "allowed" || team.principalObjectId !== credential.principal ||
      digestSfValue(team.profile) !== credential.partition || !granted(credential.principal)) return denied()
    const active = () => !request.signal.aborted && credentials.get(digest) === credential && credential.expiresAt > now().getTime()
    const actor = await authenticate(admitted, team)
    if (!actor || !active()) return denied()
    const actorDigest = digestSfValue(actor)
    const current = async () => active() && await team.verifyCurrent() && active()
    const publishable = async () => active() && digestSfValue(await authenticate(admitted, team)) === actorDigest &&
      await verifyTeam(admitted, team) && active()
    const directory = path.join(input.directory, "business-teams", credential.partition)
    const store = await openLocalStore(directory)
    try {
      const handle = purchaseRuntime({ origin: config.origin, mount: config.mount, period: input.period,
        directory, partition: credential.partition, team: credential.team, principal: credential.principal, request: admitted, store,
        authenticate: async (original, purpose) => original === admitted && purpose?.surface === "procurement" && await current() ? actor : null, current: publishable, now })
      const response = await handle(admitted)
      if (await publishable()) return response
      void response?.body?.cancel().catch(() => undefined)
      return denied()
    } finally {
      await store.dispose()
    }
  }
}

function purchaseRuntime(input: {
  origin: string; mount: string; period: Readonly<Period>; directory: string; partition: string; team: string; principal: string
  request: Request; store: LocalStore; authenticate: Parameters<typeof createSfProductAuthority>[0]["authenticate"]
  current: () => Promise<boolean>; now: () => Date
}) {
  const identity = Object.freeze({ installationId: input.partition, projectId: input.partition,
    hostId: digestSfValue({ partition: input.partition, capability: "purchase-mcp" }),
    location: sfNativeLocationRef({ directory: AbsolutePath.make(input.directory) }) })
  const persistence = createSfSourcePersistence({
    persistence: {
      ...input.store,
      transaction: (surface, work, options) => input.store.transaction(surface, async (snapshot, blobs) => {
        const result = await work(snapshot, blobs)
        // Only scoped source observations can write, and only under the live pairing.
        if (result.commit && !await input.current()) throw new Error("Purchase MCP authority changed")
        return result
      }, options),
    },
    enumerate: enumerateSfSources, projectScope: projectSfProcurementScope,
    createId: randomUUID,
  })
  const authority = createSfProductAuthority({
    identity: () => identity, installationId: input.partition, origin: input.origin, policyVersion: "sf-product-v1",
    persistence: input.store, authenticate: input.authenticate,
    environment: async () => ({ at: input.now().toISOString(), id: randomUUID, directory: [] }),
    grants: [{ principalRef: input.principal, namespaces: [], operations }],
    createId: randomUUID, now: Date.now,
    commandIdentity: async (request, operation) => request === input.request && operations.some((allowed) => allowed === operation)
      ? randomUUID() : undefined,
    inspectSession: async () => undefined, verifySelection: async () => false, verifySkillReceipt: async () => false,
    providerGeneration: async () => undefined, authorizeDocument: async () => undefined,
  })
  const business = createSfBusinessServices({ authority, persistence, proposalCoverageWrites: new WeakSet(),
    procurementRequest: { request: input.request, period: input.period } })
  const services = { ui: authority.ui, dispatch: createSfProductDispatch({ authority: authority.authority,
    descriptors: business.descriptors.filter((descriptor) => operations.some((operation) => operation === descriptor.id)) }) }
  return createSfClawMcpHandler({
    origin: input.origin, mount: input.mount, procurement: { identity: () => identity, services: () => services },
    authenticate: async (request) => request === input.request && await input.current(),
    purchaseReviewUrl: (recordId) => {
      const url = new URL(input.mount + "/teams/" + input.team + "/procurement", input.origin)
      url.search = new URLSearchParams({ page: "Requests", request: recordId, q: recordId }).toString()
      url.hash = encodeURIComponent(recordId)
      return url.href
    },
    withPurchaseReference: async (request, requested, compare) => {
      await persistence.initializeSources("procurement")
      if (!/^PR-\d+(?:-\d+)?$/.test(requested)) return compare(requested)
      const digest = digestSfValue({ requestRef: requested })
      const admission = await authority.ui.admit(request, "sf_request_read", digest)
      if (admission.status !== "ok") return { status: admission.status }
      try {
        if (!await authority.ui.validate(admission.value, "sf_request_read", digest)) return { status: "denied" }
        const selected = await business.registry.createSelection(admission.value)
        if (selected.status !== "ok") return { status: selected.status }
        try {
          const records = await business.registry.resolveRequestCollection(selected.value, admission.value)
          if (records.status !== "ok") return { status: records.status }
          const matching = records.value.requests.filter((entry) => entry.target.recordId === requested)
          return matching.length === 1 && matching[0] ? await compare(matching[0].refId) : { status: "denied" }
        } finally {
          business.registry.releaseSelection(selected.value)
        }
      } finally {
        authority.ui.finish(admission.value)
      }
    },
  })
}
