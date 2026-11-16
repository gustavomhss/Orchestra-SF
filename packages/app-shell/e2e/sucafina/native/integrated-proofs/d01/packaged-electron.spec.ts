/** D01 is NOT a browser surrogate: it launches a CI-attested PACKAGED
 * Electron executable and invokes the real preload/main Sucafina broker.
 * No login cookie, token, owned password or grant crosses this Playwright test.
 * Microsoft authorization happens in the original broker auth BrowserWindow.
 * This spec is dispatched only by the authorized 191 hosted runner.
 */
import { createHash } from "node:crypto"
import { requireSfPackagedBrokerReadiness } from "../../../../../../../apps/desktop/test/sucafina-bootstrap213/d01-packaged-driver.ts"
import { _electron, expect, test } from "@playwright/test"
import type { SfDesktopCapability, SfDesktopBindResult } from "@orchestra/client/sucafina/transport"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { readNativeManifest } from "../../fixture/readiness.ts"
import {
  nativeSuiteFromChapter, readNativeSelectedInstallation,
} from "../../fixture/selected-installation.ts"
import {
  d01IsolatedDesktopEnvironment, requireD01PackagedHost,
} from "./desktop-host.ts"

type RendererApi = Readonly<{
  awaitInitialization(): Promise<Readonly<{ url: string; username: string | null; password: string | null }>>
  sucafina: SfDesktopCapability
}>
type Owned = Readonly<{ bindingHandle: string; generation: number }>
type CookieCounts = Readonly<{ isolated: number; isolatedHttpOnly: number; default: number }>

test.describe("D01 · real packaged Electron / Sucafina broker / private partition", () => {
  test("original Microsoft login stays within ephemeral partition; reject foreign owner and purge on logout", async ({}, info) => {
    const manifest = await readNativeManifest()
    const suite = nativeSuiteFromChapter(manifest)
    if (!suite) throw new Error("D01_ORIGINAL_F01_SELECTED_CHAPTER_NOT_INSTALLED")
    const bundle = await readNativeSelectedInstallation(manifest, suite)
    const route = bundle.selections.find((selection) => selection.intent !== "denied")?.route
    if (!route) throw new Error("D01_CURRENT_F01_RESOLVED_ROUTE_REQUIRED")
    if (route.ownerSelection.serverKey !== manifest.target.serverKey ||
        route.ownerSelection.projectId !== manifest.target.projectId ||
        route.ownerSelection.installationId !== undefined &&
        route.ownerSelection.installationId !== manifest.target.installationId)
      throw new Error("D01_F01_RETURN_ROUTE_WRONG_OWNER")
    const host = await requireD01PackagedHost(manifest)
    const app = await _electron.launch({
      executablePath: host.executablePath,
      env: d01IsolatedDesktopEnvironment(),
    })
    try {
      const main = await app.evaluate(({ app }) => ({
        isPackaged: app.isPackaged,
        appVersion: app.getVersion(),
      }))
      if (!main.isPackaged) throw new Error("D01_MUST_USE_PACKAGED_ELECTRON_NOT_DEV_WEB")
      const window = await app.firstWindow()
      await expect.poll(() => window.evaluate(() => {
        return typeof (window as unknown as { api?: RendererApi }).api?.sucafina?.registerConnection === "function"
      }), { message: "Packaged Electron preload must expose the real broker API" }).toBe(true)
      await requireSfPackagedBrokerReadiness(app, window)

      // Credentials, if the app owns them, are read INSIDE its trusted renderer
      // and forwarded by its existing preload to main. They are never returned,
      // serialized to Node, written to a file or passed through test arguments.
      const approved = await window.evaluate(async (nonsecret) => {
        const api = ((window as unknown as { api?: RendererApi }).api!)
        const owned = await api.awaitInitialization()
        if ((owned.username === null) !== (owned.password === null))
          throw new Error("D01_OWNED_CONNECTION_CREDENTIAL_PAIR_INCONSISTENT")
        const credentials = owned.url === nonsecret.baseUrl &&
          owned.username !== null && owned.password !== null
          ? { kind: "basic" as const, username: owned.username, password: owned.password }
          : { kind: "none" as const }
        return api.sucafina.registerConnection({
          serverKey: nonsecret.serverKey, projectId: nonsecret.projectId,
          baseUrl: nonsecret.baseUrl, credentials,
        })
      }, host.publicConnection).catch(() => {
        throw new Error("D01_REAL_MAIN_CONNECTION_REGISTRY_OR_APPROVAL_NOT_AVAILABLE")
      })
      if (approved.status !== "approved" ||
          approved.serverKey !== manifest.target.serverKey ||
          approved.projectId !== manifest.target.projectId)
        throw new Error("D01_REAL_REGISTRY_APPROVAL_REQUIRED")

      const selection = {
        serverKey: manifest.target.serverKey, projectId: manifest.target.projectId,
        installationId: manifest.target.installationId,
      }
      const bound = await window.evaluate(async (target) => {
        return ((window as unknown as { api?: RendererApi }).api!).sucafina.bind(target, () => {
          // Real broker handles invalidation. This callback supplies no grant.
        })
      }, selection).catch(() => {
        throw new Error("D01_MAIN_BROKER_BIND_HANDLER_NOT_REGISTERED")
      }) as SfDesktopBindResult
      if (bound.status !== "ok" || !bound.bindingHandle ||
          !Number.isSafeInteger(bound.generation) ||
          bound.descriptor.publicOrigin !== manifest.target.publicOrigin ||
          bound.descriptor.installationId !== manifest.target.installationId ||
          bound.descriptor.projectId !== manifest.target.projectId ||
          bound.descriptor.hostId !== manifest.target.hostId ||
          bound.descriptor.mount !== manifest.target.mount ||
          bound.descriptor.authMode !== "microsoft")
        throw new Error("D01_REAL_BROKER_INSTALLATION_BINDING_NOT_MATCHED")

      // This exact partition formula comes from the REAL desktop broker
      // apps/desktop/src/main/sucafina/index.ts. Reading cookie *counts* in
      // Electron main returns no cookies, values, names or credentials.
      const partition = "sf-native-" + createHash("sha256").update(JSON.stringify([
        approved.serverKey, approved.transportIdentity,
        bound.descriptor.publicOrigin, bound.descriptor.installationId,
      ])).digest("hex")
      const countCookies = async (): Promise<CookieCounts> => app.evaluate(
        async ({ session }, selected) => {
          const privateJar = session.fromPartition(selected.partition)
          const isolated = await privateJar.cookies.get({ url: selected.origin })
          const defaults = await session.defaultSession.cookies.get({ url: selected.origin })
          return {
            isolated: isolated.length,
            isolatedHttpOnly: isolated.filter((cookie) => cookie.httpOnly).length,
            default: defaults.length,
          }
        }, { partition, origin: manifest.target.publicOrigin },
      )
      const before = await countCookies()
      expect(before.isolated, "New ephemeral partition starts without imported state").toBe(0)
      expect(before.default, "Default desktop session must not receive SF cookies").toBe(0)

      const owner: Owned = { bindingHandle: bound.bindingHandle, generation: bound.generation }
      // Original F01 returnRoute and I00 single-use marker only. The login
      // window is the REAL Electron BrowserWindow scoped to this partition.
      // An unavailable Microsoft login is a missing external dependency,
      // never converted to a mock or an 'authenticated' fixture flag.
      const login = await window.evaluate(async (args) => {
        return ((window as unknown as { api?: RendererApi }).api!).sucafina.login({
          ...args.owner, returnRoute: args.route as SfResolvedRoute,
        })
      }, { owner, route }).catch(() => {
        throw new Error("D01_REAL_MICROSOFT_LOGIN_WINDOW_OR_CALLBACK_UNAVAILABLE")
      })
      if (login.status !== "authenticated" ||
          login.context.authMode !== "microsoft" ||
          login.context.stamp.installationId !== manifest.target.installationId ||
          login.context.stamp.projectId !== manifest.target.projectId ||
          login.context.stamp.hostId !== manifest.target.hostId ||
          !Object.values(manifest.actors).includes(login.context.stamp.principalRef))
        throw new Error("D01_REAL_MICROSOFT_CONTEXT_NOT_AUTHENTICATED_ON_TARGET")

      // This is an actual ctx.context IPC -> Electron net.request -> original
      // producer in the partition. It is NOT page.request or a web fetch.
      const invoked = await window.evaluate(async (args) => {
        return ((window as unknown as { api?: RendererApi }).api!).sucafina.invoke({
          kind: "request", ...args.owner,
          requestId: crypto.randomUUID(), operationId: "ctx.context",
          input: {
            installationId: args.target.installationId,
            projectId: args.target.projectId,
            hostId: args.target.hostId,
          },
        })
      }, { owner, target: manifest.target })
      if (invoked.kind !== "json-response" || invoked.status !== 200 ||
          !invoked.body || typeof invoked.body !== "object" || Array.isArray(invoked.body) ||
          invoked.body.status !== "ok" || !invoked.body.value ||
          typeof invoked.body.value !== "object" || Array.isArray(invoked.body.value) ||
          !invoked.body.value.stamp ||
          typeof invoked.body.value.stamp !== "object" ||
          Array.isArray(invoked.body.value.stamp) ||
          invoked.body.value.stamp.principalRef !== login.context.stamp.principalRef ||
          invoked.body.value.stamp.policyVersion !== login.context.stamp.policyVersion ||
          invoked.body.value.stamp.accessRevision !== login.context.stamp.accessRevision)
        throw new Error("D01_REAL_BROKER_ORIGINAL_CONTEXT_INVOKE_MISMATCH")
      const after = await countCookies()
      expect(after.isolatedHttpOnly, "Original host issued an HttpOnly cookie into the Electron private session").toBeGreaterThan(0)
      expect(after.default, "The default Electron session remains isolated").toBe(0)

      // Wrong server/project never register a connection. The real registry
      // rejects them before discovery; never attempt a new approval or login.
      for (const wrong of [
        { serverKey: manifest.wrongServer.serverKey,
          projectId: manifest.target.projectId,
          installationId: manifest.target.installationId },
        { serverKey: manifest.target.serverKey,
          projectId: manifest.wrongProject.projectId,
          installationId: manifest.target.installationId },
      ]) {
        const denied = await window.evaluate(async (target) =>
          ((window as unknown as { api?: RendererApi }).api!).sucafina.bind(target, () => undefined), wrong)
        if (denied.status === "ok")
          throw new Error("D01_FOREIGN_UNAPPROVED_REGISTRY_BOUND_SUCCESSFULLY")
      }

      const logout = await window.evaluate(async (target) =>
        ((window as unknown as { api?: RendererApi }).api!).sucafina.logout(target), owner)
      expect(logout.status).toBe("cleared")
      const cleared = await countCookies()
      expect(cleared.isolated, "Logout purges the real Electron private partition").toBe(0)
      expect(cleared.default).toBe(0)
      const stale = await window.evaluate(async (args) =>
        ((window as unknown as { api?: RendererApi }).api!).sucafina.invoke({
          kind: "request", ...args.owner, requestId: crypto.randomUUID(),
          operationId: "ctx.context", input: {
            installationId: args.target.installationId,
            projectId: args.target.projectId,
            hostId: args.target.hostId,
          },
        }), { owner, target: manifest.target })
      if (stale.kind !== "transport-error")
        throw new Error("D01_REVOKED_ELECTRON_BINDING_STILL_USABLE")

      // Safe evidence only; no URLs with query, handles, cookie metadata,
      // identity strings, credentials or provider auth responses.
      await info.attach("d01-packaged-electron-safe-evidence.json", {
        contentType: "application/json",
        body: JSON.stringify({
          candidateSha: host.candidateSha, binarySha256: host.executableSha256,
          actionsRunId: host.actionsRunId, sourceBuildRunId: host.sourceBuildRunId, packaged: main.isPackaged,
          brokerRegister: "approved", bound: true,
          originalContextViaElectronNet: true, privateHttpOnlyObserved: after.isolatedHttpOnly > 0,
          defaultSessionCookies: after.default, wrongServerAndProjectDenied: true,
          logoutPrivateJarCleared: cleared.isolated === 0,
          revokedBindingRejected: true,
          proofClass: "D01_REAL_PACKAGED_ELECTRON_BROKER_PARTITION",
        }, null, 2),
      })
    } finally {
      await app.close()
    }
  })
})
