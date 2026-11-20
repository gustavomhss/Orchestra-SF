import { teamConnectionKey } from "./team-connection-crypto.ts"
import { createEntraClient } from "./entra-client.ts"
import { createMicrosoftIdentity } from "./local-identity.ts"
import type { EntraOptions, LocalSecrets } from "./local-contract.ts"
import type { TeamProfilePolicySource } from "./team-profile-policy.ts"
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
  const client = createEntraClient({
    tenantId: config.tenantId, clientId: config.clientId, profile: "web-confidential", clientSecret: privateConfiguration.clientSecret,
    ...(config.teams === "direct" ? { teams: config.teams } : {}),
    fetch: overrides.fetch, now: overrides.now,
  })
  const readCurrentConfiguration = async () => {
    const current = await loadMicrosoftConfiguration(file)
    // Current policy may change; a running instance must never retarget its tenant, transport or private keys.
    for (const field of ["deployment", "authentication", "origin", "listenerOrigin", "ingressOrigin", "mount", "tenantId", "clientId", "workspaceDirectory"] as const)
      if (current.config[field] !== config[field]) throw new Error("Microsoft installation binding changed; explicit reconfiguration required")
    for (const name of ["session", "bank", "assets"] as const)
      if (!Bun.deepEquals(current.keys[name], keys[name])) throw new Error("Microsoft installation keys changed; explicit reconfiguration required")
    return current.config
  }
  const readConnectionKey = async () => {
    await readCurrentConfiguration()
    return teamConnectionKey(keys.session)
  }
  const readGrants = async () => (await readCurrentConfiguration()).grants
  const readTeamProfilePolicy = async (): Promise<TeamProfilePolicySource> => {
    const current = await readCurrentConfiguration()
    return Object.freeze({
      ...(current.teams === "direct" ? { teams: current.teams } : {}),
      ...(current.supremeAdminGroupId === undefined ? {} : { supremeAdminGroupId: current.supremeAdminGroupId }),
    })
  }
  const transport: MicrosoftTransport = Object.freeze({ kind: "explicit-https-proxy", listenerOrigin: config.listenerOrigin, ingressOrigin: config.ingressOrigin, publicOrigin: config.origin })
  return {
    loaded: { config, directory, keys }, client, readTeamProfilePolicy, readGrants, readConnectionKey, grants: config.grants, workspaceDirectory: config.workspaceDirectory, transport,
    createIdentity: (secrets: LocalSecrets) => createMicrosoftIdentity({ origin: config.origin, mount: config.mount, tenantId: config.tenantId, clientId: config.clientId, client, secrets, key: keys.session, sessionSeconds: config.sessionSeconds, loginSeconds: config.loginSeconds, now: overrides.now }),
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
