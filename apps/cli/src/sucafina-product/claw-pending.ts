import { createHash, randomBytes } from "node:crypto"
import type { LocalIdentity } from "../../../../modules/sucafina/Sucafinav1/runtime/local-contract.ts"
import type { MicrosoftClawScope } from "../../../../modules/sucafina/Sucafinav1/runtime/microsoft-configuration.ts"
import { createSfClawMcpHandler } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/claw-mcp.ts"
import type { Inbox } from "@orchestra/schema/inbox"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { SfHostServices } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import type { WorkListRequest } from "../../../../modules/sucafina/Sucafinav1/product/contracts/operations.ts"
import { readSfWorkPresentation, readSfWorkSelection } from "./native-ui/work"

const maxItems = 100

/** The installation supplies a dedicated Inbox reader only after verifying its owner. */
export function createSfClawPendingReader(input: {
  runtime: () => Pick<SfHostServices, "ui" | "work"> | undefined
  selection: WorkListRequest | ((request: Request) => Promise<WorkListRequest | undefined>)
  inbox: {
    installationId: string
    principalRef: string
    listStored: () => Promise<readonly Inbox.Item[]>
  }
}) {
  const selection = typeof input.selection === "function" ? input.selection : structuredClone(input.selection)
  const configuredInbox = { ...input.inbox }
  return async (request: Request) => {
    const runtime = input.runtime()
    if (!runtime) return { status: "unavailable" as const }
    const selected = typeof selection === "function" ? await selection(request) : selection
    if (!selected || input.runtime() !== runtime) return { status: "unavailable" as const }
    const read = await readSfWorkPresentation(request, runtime, selected, async (binding) => {
      if (binding.installationId !== configuredInbox.installationId || binding.principalRef !== configuredInbox.principalRef) return undefined
      return configuredInbox.listStored()
    })
    if (input.runtime() !== runtime) return { status: "unavailable" as const }
    if (read.status !== "ok") {
      return { status: read.status === "denied" ? "denied" as const : "unavailable" as const }
    }
    const inbox = read.companion?.filter((item) => item.waiting)
    if (!inbox || inbox.length > maxItems || read.items.length > maxItems) return { status: "unavailable" as const }
    const pending = {
      inbox: inbox.map((item) => ({
        id: item.id, source: item.source, waiting: item.waiting,
        snippet: item.snippet.replace(/\s+/g, " ").trim().slice(0, 500),
      })).sort((left, right) => left.id.localeCompare(right.id)),
      work: read.items.map((item) => ({
        id: item.actionRef, kind: item.kind, state: item.state, due: item.due, reason: item.reason,
        title: item.title?.replace(/\s+/g, " ").trim().slice(0, 500) ?? null,
        approvalStage: item.approvalStage, sourceVersion: item.sourceVersion, observedVersion: item.observedVersion,
      })).sort((left, right) => left.id.localeCompare(right.id)),
    }
    return { status: "ok" as const, fingerprint: digestSfValue(pending), pending }
  }
}

/** A capability can read the MCP only, as long as its original Entra session remains valid. */
export function createMicrosoftClaw(input: {
  origin: string
  mount: string
  installationId: string
  identity: Pick<LocalIdentity, "person" | "prepare">
  runtime: () => SfHostServices | undefined
  scopes: readonly MicrosoftClawScope[]
  readInbox: () => Promise<readonly Inbox.Item[]>
}) {
  const path = `${input.mount}/api/claw`
  const capabilityLifetime = 60 * 60_000
  const scopes = new Map(input.scopes.map((scope) => {
    const refs = new Set(scope.inboxRefs)
    return [scope.principalRef, createSfClawPendingReader({
      runtime: input.runtime,
      selection: async (request) => {
        const runtime = input.runtime()
        if (!runtime) return undefined
        const selection = await readSfWorkSelection(request, runtime, scope.period)
        return selection.status === "ok" ? selection.value : undefined
      },
      inbox: {
        installationId: input.installationId,
        principalRef: scope.principalRef,
        listStored: async () => (await input.readInbox()).filter((item) =>
          refs.has(digestSfValue({ source: item.source, externalId: item.externalId }))),
      },
    })] as const
  }))
  const credentials = new Map<string, { digest: string; cookie: string; expiresAt: number }>()
  const audience = new Map<string, string>()
  const requests = new WeakMap<Request, string>()
  const responseHeaders = { "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff" }
  const denied = () => new Response(null, { status: 403, headers: responseHeaders })
  const handler = createSfClawMcpHandler({
    origin: input.origin,
    mount: input.mount,
    authenticate: async (request) => {
      const principal = requests.get(request)
      if (!principal) return false
      await input.identity.prepare(request)
      return (await input.identity.person(request))?.id.toLowerCase() === principal
    },
    read: async (request) => {
      const principal = requests.get(request)
      const scope = principal && scopes.get(principal)
      return scope ? scope(request) : { status: "denied" }
    },
  })
  const hash = (token: string) => createHash("sha256").update(token).digest("hex")
  const current = (principal: string) => {
    const credential = credentials.get(principal)
    if (credential && credential.expiresAt > Date.now()) return credential
    if (credential) {
      credentials.delete(principal)
      audience.delete(credential.digest)
    }
    return undefined
  }

  return async (request: Request) => {
    const url = new URL(request.url)
    if (url.pathname !== `${path}/connect` && url.pathname !== `${path}/mcp`) return undefined
    if (url.origin !== input.origin || url.search || request.signal.aborted) return denied()
    if (url.pathname === `${path}/connect`) {
      if (request.method !== "POST" || request.headers.has("authorization") ||
        request.headers.get("origin") !== input.origin || request.headers.get("sec-fetch-site") === "cross-site") return denied()
      if (request.body && (await new Response(request.body).arrayBuffer()).byteLength !== 0) return denied()
      const cookies = (request.headers.get("cookie") ?? "").split(";").map((part) => part.trim())
        .filter((part) => /^__Secure-sucafina_[0-9a-f]{12}_session=[0-9a-f]{64}$/.test(part))
      if (cookies.length !== 1) return denied()
      await input.identity.prepare(request)
      const principal = (await input.identity.person(request))?.id.toLowerCase()
      if (!principal || !scopes.has(principal) || request.signal.aborted) return denied()
      const previous = current(principal)
      if (previous) audience.delete(previous.digest)
      const token = randomBytes(32).toString("hex")
      const digest = hash(token)
      const expiresAt = Date.now() + capabilityLifetime
      credentials.set(principal, { digest, cookie: cookies[0]!, expiresAt })
      audience.set(digest, principal)
      return Response.json({ token, expiresAt }, { headers: responseHeaders })
    }

    const token = /^Bearer ([0-9a-f]{64})$/.exec(request.headers.get("authorization") ?? "")?.[1]
    if (!token || request.headers.has("cookie")) return denied()
    const digest = hash(token)
    const principal = audience.get(digest)
    if (!principal) return denied()
    const credential = current(principal)
    if (credential?.digest !== digest) return denied()
    // Native authority sees only the Entra session that commissioned this capability.
    const headers = new Headers(request.headers)
    headers.delete("authorization")
    headers.set("cookie", credential.cookie)
    const admitted = new Request(request, { headers })
    requests.set(admitted, principal)
    const response = await handler(admitted)
    return current(principal) === credential && !request.signal.aborted ? response : denied()
  }
}
