import { randomUUID } from "node:crypto"
import { userInfo } from "node:os"
import path from "node:path"
import { open, rename } from "node:fs/promises"
import { loadLocalConfiguration, requireLocalOperator } from "../runtime/local-configuration.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { createOperatorIdentity } from "../runtime/operator-identity.ts"

/** Explicit owner-only enrollment; returns a private artifact path, never the credential. */
export async function prepareOperatorAccess(file: string, enableLocal = false) {
  const loaded = await loadLocalConfiguration(file)
  if (!enableLocal && loaded.config.authentication !== "local-operator") throw new Error("Explicit local operator profile required")
  const operator = requireLocalOperator(loaded.config.localOperator ?? { installationId: randomUUID(), uid: userInfo().uid })
  const config = { ...loaded.config, authentication: "local-operator" as const, localOperator: operator }
  const store = await openLocalStore(path.join(loaded.directory, "business-local"))
  try {
    const identity = createOperatorIdentity({ origin: config.origin, mount: config.mount, operator: { ...operator, name: userInfo().username }, key: loaded.keys.session, secrets: store.secrets })
    const destination = new URL(`${config.mount}/auth/local`, config.origin)
    destination.searchParams.set("code", await identity.enroll())
    const temporary = path.join(loaded.directory, `open-local-${randomUUID()}.html`)
    const handle = await open(temporary, "wx", 0o600)
    await handle.writeFile(`<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><title>Abrindo homologação local</title><p>Abrindo homologação local…</p><script>location.replace(${JSON.stringify(destination.href)})</script>`).finally(() => handle.close())
    const artifact = path.join(loaded.directory, "open-local.html")
    await rename(temporary, artifact)
    // Publish activation only after both the complete candidate and the private handoff are ready.
    if (enableLocal) {
      const temporaryConfig = path.join(loaded.directory, `installation-${randomUUID()}.json`)
      const handle = await open(temporaryConfig, "wx", 0o600)
      await handle.writeFile(`${JSON.stringify(config, null, 2)}\n`).finally(() => handle.close())
      await rename(temporaryConfig, file)
    }
    return { artifact }
  } finally { await store.dispose() }
}

if (import.meta.main) {
  const file = process.argv[2]
  if (!file || process.argv.length > 4 || (process.argv[3] && process.argv[3] !== "--enable-local")) throw new Error("Usage: bun local/enroll.ts /absolute/private/installation.json [--enable-local]")
  await prepareOperatorAccess(file, process.argv[3] === "--enable-local")
  console.log("Acesso local preparado no arquivo privado open-local.html. Nenhum usuário ou grupo Entra foi criado.")
}
