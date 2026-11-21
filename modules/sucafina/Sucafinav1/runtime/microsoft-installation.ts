import { createEntraClient } from "./entra-client.ts"
import { requireLocalIsolation } from "./local-configuration.ts"
import type { CorporateLocalSecrets, EntraOptions } from "./local-contract.ts"
import { createMicrosoftIdentity } from "./local-identity.ts"
import { bindMicrosoftInstallation, loadMicrosoftConfiguration } from "./microsoft-configuration.ts"

export type MicrosoftTransport = Readonly<{
  kind: "explicit-https-proxy"
  listenerOrigin: string
  ingressOrigin: string
  publicOrigin: string
}>

/** Compose server-side identity from the private descriptor before opening business data. */
export async function prepareMicrosoftInstallation(
  context: { origin: string },
  file: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  overrides: Pick<EntraOptions, "fetch" | "now"> = {},
) {
  if (!file || environment.SUCAFINA_LOCAL_CONFIG) throw new Error("One explicit Microsoft installation profile required")
  const { config, directory, keys, clientSecret } = await loadMicrosoftConfiguration(file)
  if (context.origin !== config.listenerOrigin) throw new Error("Microsoft listener origin mismatch")
  await requireLocalIsolation(directory, environment)
  await bindMicrosoftInstallation(directory, config)
  const client = createEntraClient({
    tenantId: config.tenantId, clientId: config.clientId, profile: "web-confidential", clientSecret,
    ...(config.teams === "direct" ? { teams: config.teams } : {}),
    fetch: overrides.fetch, now: overrides.now,
  })
  const transport: MicrosoftTransport = Object.freeze({
    kind: "explicit-https-proxy",
    listenerOrigin: config.listenerOrigin, ingressOrigin: config.ingressOrigin, publicOrigin: config.origin,
  })
  return {
    loaded: { config, directory, keys }, transport,
    createIdentity(secrets: CorporateLocalSecrets) {
      const identity = createMicrosoftIdentity({
        origin: config.origin, mount: config.mount, tenantId: config.tenantId, clientId: config.clientId,
        client, secrets, key: keys.session, sessionSeconds: config.sessionSeconds, loginSeconds: config.loginSeconds,
        now: overrides.now,
      })
      if (config.teams === "direct" && !identity.teamDirectory) throw new Error("Microsoft Teams session reader unavailable")
      return identity
    },
  }
}

/** Normalize the fixed proxy ingress to the configured public origin. */
export function microsoftRequest(request: Request, transport: MicrosoftTransport): Request | undefined {
  const url = new URL(request.url)
  if (request.signal.aborted || request.bodyUsed || url.origin !== transport.ingressOrigin ||
      request.headers.get("host")?.toLowerCase() !== new URL(transport.ingressOrigin).host.toLowerCase()) return undefined
  const headers = new Headers(request.headers)
  headers.delete("forwarded")
  headers.delete("x-sf-ingress-proof")
  for (const name of [...headers.keys()]) if (name.startsWith("x-forwarded-")) headers.delete(name)
  headers.set("host", new URL(transport.publicOrigin).host)
  return new Request(transport.publicOrigin + url.pathname + url.search, {
    method: request.method, headers, body: request.body, signal: request.signal,
    redirect: "error", ...(request.body ? { duplex: "half" } : {}),
  })
}
