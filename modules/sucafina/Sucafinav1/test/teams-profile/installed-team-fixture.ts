import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createSfHostRuntime } from "../../../../../apps/cli/src/sucafina-product/host-context.ts"
import { composeSfInstallation } from "../../../../../apps/cli/src/sucafina-product/installation.ts"
import { createMicrosoftInstallation } from "../../local/entry.ts"
import type { SfProductGrant } from "../../product/integration/product-authority.ts"
import type { LocalConfiguration } from "../../runtime/local-configuration.ts"
import { openLocalStore, type LocalStore } from "../../runtime/local-store.ts"
import { prepareMicrosoftInstallation } from "../../runtime/microsoft-installation.ts"
import { microsoftNativeHost } from "../microsoft-login/native-host.ts"
import { group, microsoftFixture, oid } from "../microsoft-login/oidc-fixture.ts"
import { ingressOrigin, listenerOrigin, privateFixture } from "../microsoft-login/private-fixture.ts"
import { admitMicrosoftFixtureTeam } from "../microsoft-login/team-admission-fixture.ts"

/** The production installation and its original host graph on disposable storage.
 * Microsoft OIDC and Graph are synthetic. Tests may prepare factual source data before startup. */
export async function openInstalledTeamFixture(input: {
  grants: readonly SfProductGrant[]
  groups: LocalConfiguration["groups"]
  seed?: (store: LocalStore) => Promise<void>
  additionalTeamIds?: readonly string[]
}) {
  const disk = await privateFixture()
  const cleanup: (() => Promise<void> | void)[] = [disk.close]
  const close = async () => {
    const failures: unknown[] = []
    for (const dispose of cleanup.splice(0).reverse()) {
      await Promise.resolve().then(dispose).catch((error: unknown) => { failures.push(error) })
    }
    if (failures.length) throw new AggregateError(failures, "Installed Team fixture cleanup failed")
  }
  try {
    await writeFile(disk.file, JSON.stringify({ ...disk.config, groups: input.groups, grants: input.grants,
      teams: "direct", supremeAdminGroupId: group }), { mode: 0o600 })
    const provider = await microsoftFixture({ teams: "direct" })
    const overrides = { fetch: provider.fetch, now: () => new Date(provider.clock.value) }
    if (input.seed) {
      // Bind the validated installation before the source fixture can create its
      // private store. Production must still reject adoption of unbound data.
      await prepareMicrosoftInstallation({ origin: listenerOrigin }, disk.file, disk.environment, overrides)
      const store = await openLocalStore(path.join(disk.directory, "business-microsoft"))
      try { await input.seed(store) } finally { await store.dispose() }
    }
    const application = await createMicrosoftInstallation(
      { origin: listenerOrigin, createHostRuntime: createSfHostRuntime }, disk.file, disk.environment, overrides,
    )
    cleanup.push(application.dispose)
    const installation = await composeSfInstallation(application, listenerOrigin)
    cleanup.push((await microsoftNativeHost(disk, installation)).dispose)
    const router = HttpRouter.toWebHandler(
      Layer.merge(installation.layer, installation.privacy).pipe(Layer.provide(HttpServer.layerServices)),
      { disableLogger: true },
    )
    cleanup.push(router.dispose)
    const request = (pathname: string, init: RequestInit = {}) => {
      const url = new URL(pathname, ingressOrigin)
      if (url.origin !== ingressOrigin || url.username || url.password || url.hash)
        throw new Error("Installed Team fixture requires its own ingress")
      const headers = new Headers(init.headers)
      headers.set("host", url.host)
      return router.handler(new Request(url, { ...init, headers }))
    }
    const team = await admitMicrosoftFixtureTeam({ installation, provider, request, additionalTeamIds: input.additionalTeamIds })
    const runtime = await installation.discovery?.current(new AbortController().signal)
    const binding = runtime?.identity()
    if (!binding) throw new Error("Installed Team fixture discovery unavailable")
    const observer = await openLocalStore(path.join(disk.directory, "business-microsoft"))
    cleanup.push(observer.dispose)
    const snapshot = () => observer.transaction("dashboard", async (state) =>
      ({ commit: false, value: structuredClone(state) }))
    const login = async (principal = oid) => {
      const started = await request(installation.mount + "/auth/login")
      const authorize = started.headers.get("location")
      const challenge = started.headers.getSetCookie().find((cookie) => cookie.includes("_login="))?.split(";")[0]
      const state = authorize && new URL(authorize).searchParams.get("state")
      if (started.status !== 303 || !authorize || !challenge || !state)
        throw new Error("Installed Microsoft authorization challenge unavailable")
      const code = await provider.issueCode(authorize, principal)
      const finished = await request(installation.mount + "/auth/callback?" + new URLSearchParams({ state, code }),
        { headers: { cookie: challenge } })
      const cookie = finished.headers.getSetCookie().find((value) => value.includes("_session="))?.split(";")[0]
      if (finished.status !== 303 || !cookie) throw new Error("Installed Microsoft session unavailable")
      return cookie
    }
    return { request, login, team, binding, snapshot, mount: installation.mount, [Symbol.asyncDispose]: close }
  } catch (error) {
    await close().catch((failure) => { throw new AggregateError([error, failure], "Installed Team fixture setup failed") })
    throw error
  }
}
