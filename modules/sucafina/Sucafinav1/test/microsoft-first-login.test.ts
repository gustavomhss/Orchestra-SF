import { expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { Layer } from "effect"
import { HttpRouter, HttpServer } from "effect/unstable/http"
import { createSfHostRuntime } from "../../../../apps/cli/src/sucafina-product/host-context.ts"
import { composeSfInstallation } from "../../../../apps/cli/src/sucafina-product/installation.ts"
import { createMicrosoftInstallation } from "../local/entry.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { group, microsoftFixture, oid } from "./microsoft-login/oidc-fixture.ts"
import { ingressOrigin, listenerOrigin, privateFixture, publicOrigin } from "./microsoft-login/private-fixture.ts"
import { microsoftNativeHost } from "./microsoft-login/native-host.ts"

test("first configured Microsoft member reaches all three native surfaces without an admin bootstrap", async () => {
  const disk = await privateFixture()
  const close: (() => void | Promise<void>)[] = [disk.close]
  try {
    // Private owner configuration selects roles and admits this principal to
    // native context. It grants no product namespace, operation or human action.
    await writeFile(disk.file, JSON.stringify({
      ...disk.config,
      groups: { ...disk.config.groups, planner: { finance: `group:${group}` } },
      grants: [{ principalRef: oid, namespaces: [], operations: [], humanActions: [] }],
    }), { mode: 0o600 })
    const provider = await microsoftFixture()
    const application = await createMicrosoftInstallation(
      { origin: listenerOrigin, createHostRuntime: createSfHostRuntime }, disk.file, disk.environment,
      { fetch: provider.fetch, now: () => new Date(provider.clock.value) },
    )
    close.push(application.dispose)
    const installation = await composeSfInstallation(application, listenerOrigin)
    close.push((await microsoftNativeHost(disk, installation)).dispose)
    const router = HttpRouter.toWebHandler(
      Layer.merge(installation.layer, installation.privacy).pipe(Layer.provide(HttpServer.layerServices)),
      { disableLogger: true },
    )
    close.push(router.dispose)
    const store = await openLocalStore(path.join(disk.directory, "business-microsoft"))
    close.push(store.dispose)
    const request = (suffix: string, cookie?: string) => router.handler(new Request(
      `${ingressOrigin}${disk.config.mount}${suffix}`,
      { headers: { host: new URL(ingressOrigin).host, ...(cookie ? { cookie } : {}) } },
    ))
    const anonymous = await request("/dashboard")
    expect(anonymous.status).toBe(303)
    expect(new URL(anonymous.headers.get("location")!, publicOrigin).pathname).toBe("/sucafina/auth/login")

    const login = await request("/auth/login")
    expect(login.status).toBe(303)
    const destination = login.headers.get("location")!
    const state = new URL(destination).searchParams.get("state")!
    const code = await provider.issueCode(destination, oid)
    const loginCookie = login.headers.getSetCookie().find((value) => value.includes("_login="))!.split(";")[0]!
    const callback = await request(`/auth/callback?state=${state}&code=${encodeURIComponent(code)}`, loginCookie)
    expect(callback.status).toBe(303)
    const cookie = callback.headers.getSetCookie().find((value) => value.includes("_session="))!.split(";")[0]!
    expect(cookie).toContain("__Secure-sucafina_")

    const surfaces = [
      ["dashboard", "CAP01", "viewer"], ["planner", "CAP17", "finance"],
      ["procurement", "CAP24", "requester"],
    ] as const
    for (const [surface, capabilityId, role] of surfaces) {
      const page = await request("/api/ui/pages/" + capabilityId, cookie)
      expect(page.status).toBe(200)
      expect(page.headers.get("content-type")).toContain("application/json")
      expect(await page.json()).toMatchObject({
        status: "ok", context: { principalRef: oid }, value: { capabilityId },
      })
      const map = await store.transaction(surface, async (snapshot) => ({ commit: false, value: snapshot.data.roleMap }))
      expect(map).toEqual(expect.arrayContaining([expect.objectContaining({
        surface, role, entra: `group:${group}`, by: "microsoft:installation-config",
      })]))
      expect((await request("/" + surface, cookie)).status).toBe(404)
    }
    // Live Graph membership is rechecked for the same issued cookie.
    provider.account.groups.splice(0)
    for (const [, capabilityId] of surfaces) {
      const denied = await request("/api/ui/pages/" + capabilityId, cookie)
      expect(denied.status).toBe(403)
      expect(await denied.json()).toEqual({ status: "denied" })
    }
  } finally {
    for (const dispose of close.reverse()) await dispose()
  }
})
