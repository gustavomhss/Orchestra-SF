import { mkdir, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { prepareLocalConfiguration } from "../../runtime/local-configuration.ts"
import { tenant, clientId, group, syntheticSecret } from "./oidc-fixture.ts"

export const publicOrigin = "https://mvp.example.test"
export const listenerOrigin = "http://127.0.0.1:4110"
export const ingressOrigin = "http://mvp.example.test"

/** Synthetic installation only. No provisioned Azure resource or customer credential is used. */
export async function privateFixture() {
  const root = await mkdtemp(path.join(await realpath(tmpdir()), "sf-microsoft49-"))
  const directory = path.join(root, "private")
  const workspaceDirectory = path.join(root, "workspace")
  await mkdir(workspaceDirectory, { mode: 0o700 })
  await prepareLocalConfiguration(directory)
  const file = path.join(directory, "microsoft.json")
  const config = {
    version: 1, deployment: "azure-https", authentication: "microsoft", origin: publicOrigin, listenerOrigin, ingressOrigin,
    mount: "/sucafina", tenantId: tenant, clientId, workspaceDirectory,
    groups: { dashboard: { viewer: `group:${group}` }, planner: {}, procurement: { requester: `group:${group}` } },
    grants: [], scanner: null, sessionSeconds: 3600, loginSeconds: 300,
  }
  await writeFile(file, JSON.stringify(config), { mode: 0o600 })
  await writeFile(path.join(directory, "client-secret.txt"), syntheticSecret, { mode: 0o600 })
  const environment = {
    SUCAFINA_MICROSOFT_CONFIG: file, ORCHESTRA_DB: path.join(directory, "host-data", "orchestra.db"), ORCHESTRA_INHERIT_CREDENTIALS: "0",
    ORCHESTRA_CONFIG_DIR: path.join(directory, "host-config"), ORCHESTRA_CREDENTIAL_KEY_FILE: path.join(directory, "host-credential.key"),
    TMPDIR: path.join(directory, "host-tmp"), XDG_DATA_HOME: path.join(directory, "host-data"), XDG_CONFIG_HOME: path.join(directory, "host-config"),
    XDG_CACHE_HOME: path.join(directory, "host-cache"), XDG_STATE_HOME: path.join(directory, "host-state"),
  }
  return { root, directory, file, config, environment, workspaceDirectory, close: () => rm(root, { recursive: true, force: true }) }
}
