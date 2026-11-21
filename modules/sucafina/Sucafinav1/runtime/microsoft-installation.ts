import { createEntraClient } from "./microsoft-entra-client.ts"
import { createMicrosoftIdentity } from "./microsoft-identity.ts"
import type { EntraOptions, LocalSecrets } from "./local-contract.ts"
import { requireLocalIsolation } from "./local-configuration.ts"
import { bindMicrosoftInstallation, loadMicrosoftConfiguration } from "./microsoft-configuration.ts"

export type MicrosoftTransport = Readonly<{ kind: "explicit-https-proxy"; listenerOrigin: string; ingressOrigin: string; publicOrigin: string }>

/** The owner chooses this profile before binding the host; no request header can enable it. */
export async function prepareMicrosoftInstallation(
  context: { origin: string; publicOrigin?: string },
  file: string | undefined,
  environment: Readonly<Record<string, string | undefined>> = process.env,
  overrides: { fetch?: EntraOptions["fetch"]; now?: () => Date } = {},
) {
  if (!file || environment.SUCAFINA_LOCAL_CONFIG) throw new Error("One explicit Microsoft installation profile required")
  const privateConfiguration = await loadMicrosoftConfiguration(file)
  const { config, directory, keys } = privateConfiguration
  if (context.origin !== config.listenerOrigin) throw new Error("Microsoft listener origin mismatch")
  if (context.publicOrigin !== undefined && context.publicOrigin !== config.origin) throw new Error("Microsoft public origin mismatch")
  await requireLocalIsolation(directory, environment)
  await bindMicrosoftInstallation(directory, config)
  const client = createEntraClient({ tenantId: config.tenantId, clientId: config.clientId, profile: "web-confidential", clientSecret: privateConfiguration.clientSecret, ...overrides })
  const transport: MicrosoftTransport = Object.freeze({ kind: "explicit-https-proxy", listenerOrigin: config.listenerOrigin, ingressOrigin: config.ingressOrigin, publicOrigin: config.origin })
  return {
    loaded: { config, directory, keys }, client, grants: config.grants, workspaceDirectory: config.workspaceDirectory, transport, clawScopes: privateConfiguration.clawScopes,
    createIdentity: (secrets: LocalSecrets) => createMicrosoftIdentity({ origin: config.origin, mount: config.mount, tenantId: config.tenantId, clientId: config.clientId, client, secrets, key: keys.session, sessionSeconds: config.sessionSeconds, loginSeconds: config.loginSeconds, now: overrides.now }),
  }
}
