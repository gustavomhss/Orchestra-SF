import { createEntraClient } from "./entra-client.ts"
import { createMicrosoftIdentity } from "./local-identity.ts"
import { initializeConfiguredMicrosoftRoleMaps } from "./local-bootstrap.ts"
import { openLocalStore } from "./local-store.ts"
import path from "node:path"
import type { EntraOptions, LocalSecrets } from "./local-contract.ts"
import { requireLocalIsolation } from "./local-configuration.ts"
import { bindMicrosoftInstallation, loadMicrosoftConfiguration } from "./microsoft-configuration.ts"

export type MicrosoftTransport = Readonly<{ kind: "explicit-https-proxy"; listenerOrigin: string; ingressOrigin: string; publicOrigin: string }>

/** The owner chooses this profile before binding the host; no request header can enable it. */
export async function prepareMicrosoftInstallation(
  context: { origin: string },
  file: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  overrides: { fetch?: EntraOptions["fetch"]; now?: () => Date } = {},
) {
  if (!file || environment.SUCAFINA_LOCAL_CONFIG) throw new Error("One explicit Microsoft installation profile required")
  const privateConfiguration = await loadMicrosoftConfiguration(file)
  const { config, directory, keys } = privateConfiguration
  if (context.origin !== config.listenerOrigin) throw new Error("Microsoft listener origin mismatch")
  await requireLocalIsolation(directory, environment)
  await bindMicrosoftInstallation(directory, config)
  // The validated, owner-selected group mapping must exist before the first
  // authenticated HTTP request. A non-admin member cannot bootstrap an empty
  // map; previously this silently made every legitimate role a 401. Apply
  // configuration only when no map exists, preserving explicit admin edits.
  const store = await openLocalStore(path.join(directory, "business-microsoft"))
  try {
    await initializeConfiguredMicrosoftRoleMaps({ groups: config.groups, store })
  } finally {
    await store.dispose()
  }
  const client = createEntraClient({ tenantId: config.tenantId, clientId: config.clientId, profile: "web-confidential", clientSecret: privateConfiguration.clientSecret, ...overrides })
  const transport: MicrosoftTransport = Object.freeze({ kind: "explicit-https-proxy", listenerOrigin: config.listenerOrigin, ingressOrigin: config.ingressOrigin, publicOrigin: config.origin })
  return {
    loaded: { config, directory, keys }, client, grants: config.grants, workspaceDirectory: config.workspaceDirectory, transport,
    createIdentity: (secrets: LocalSecrets) => {
      const identity = createMicrosoftIdentity({ origin: config.origin, mount: config.mount, tenantId: config.tenantId, clientId: config.clientId, client, secrets, key: keys.session, sessionSeconds: config.sessionSeconds, loginSeconds: config.loginSeconds, now: overrides.now })
      return {
        ...identity,
        handle: async (request: Request) => {
          const handled = await identity.handle(request)
          if (handled) return handled
          const url = new URL(request.url)
          // Only anonymous GETs of the three exact mounted HTML destinations
          // enter the existing PKCE login flow; no API routes, POSTs, other
          // mounts, or revoked session cookies gain a new admission path.
          if (request.method !== "GET" || url.origin !== config.origin || request.headers.has("cookie") ||
            !["dashboard", "planner", "procurement"].some((name) => url.pathname === `${config.mount}/${name}`)) return undefined
          if (process.env.SF_AUTH_DIAG === "1") console.error("SF_AUTH_DIAG_LAYER", JSON.stringify({ layer: "microsoft-identity", stage: "anonymous-login-redirect", path: url.pathname }))
          return new Response(null, { status: 303, headers: {
            Location: `${config.mount}/auth/login?returnTo=${encodeURIComponent(url.pathname + url.search)}`,
            "Cache-Control": "no-store", "Referrer-Policy": "no-referrer", "X-Content-Type-Options": "nosniff",
          } })
        },
      }
    },
  }
}

/** Fixed ingress and public origins. Forwarded headers never participate in authentication. */
export function microsoftRequest(request: Request, transport: MicrosoftTransport): Request | undefined {
  const url = new URL(request.url)
  if (url.origin !== transport.ingressOrigin || request.headers.get("host")?.toLowerCase() !== new URL(transport.ingressOrigin).host.toLowerCase()) return undefined
  const headers = new Headers(request.headers)
  headers.delete("forwarded")
  for (const name of [...headers.keys()]) if (name.startsWith("x-forwarded-")) headers.delete(name)
  headers.set("host", new URL(transport.publicOrigin).host)
  return new Request(`${transport.publicOrigin}${url.pathname}${url.search}`, { method: request.method, headers, body: request.body, signal: request.signal, redirect: "error", ...(request.body ? { duplex: "half" } : {}) })
}
