import { expect, test } from "bun:test"
import { chmod, copyFile, mkdtemp, realpath, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { createHash } from "node:crypto"
import { buildRecoveryPlan } from "../local/recovery-plan.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import { runRecoveryCommand, withRecoveryPoint } from "../runtime/local-recovery.ts"
import type { RecoveryConfiguration } from "../runtime/local-recovery.ts"
import { createLocalBackups } from "../runtime/local-backups.ts"
import { restoreBackup } from "../runtime/operations.ts"
import { prepareLocalConfiguration } from "../runtime/local-configuration.ts"
import { prepareOperatorAccess } from "../local/enroll.ts"
import { createLocalInstallation } from "../local/entry.ts"

test("real WAL replication restores an earlier commit and business restore preserves current credentials", async () => {
  const root = await mkdtemp(join(await realpath(tmpdir()), "sucafina-pitr-"))
  const binary = join(root, "litestream")
  const installed = Bun.which("litestream")
  if (!installed) throw new Error("Pinned Litestream executable is required on the hosted runner")
  await copyFile(installed, binary)
  await chmod(binary, 0o755)
  const store = await openLocalStore(join(root, "business-local"))
  const state = {
    child: undefined as ReturnType<typeof Bun.spawn> | undefined,
    app: undefined as Awaited<ReturnType<typeof createLocalInstallation>> | undefined,
  }
  try {
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.marker = "before"; return { commit: true, value: undefined } })
    const plan = buildRecoveryPlan({ installationDirectory: root, binary, home: root, installationId: "0190ab12-3456-4789-8abc-def012345678", uid: process.getuid!() })
    await Bun.write(plan.configurationPath, plan.configuration)
    await chmod(join(root, "recovery"), 0o700)
    await chmod(plan.configurationPath, 0o600)
    const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex")
    const config: RecoveryConfiguration = { binary, binarySha256: hash(await Bun.file(binary).bytes()), configurationPath: plan.configurationPath, configurationSha256: hash(await Bun.file(plan.configurationPath).bytes()), databasePath: plan.databasePath, directory: join(root, "recovery") }
    state.child = Bun.spawn([binary, "replicate", "-config", plan.configurationPath, "-no-expand-env"], { cwd: root, stdin: "ignore", stdout: Bun.file(join(root, "replicate.log")), stderr: Bun.file(join(root, "replicate-error.log")) })
    const marker = (at?: string) => withRecoveryPoint(config, at, (point) => point.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.marker })))
    const waitFor = async (value: string) => {
      const deadline = Date.now() + 30000
      while (Date.now() < deadline) {
        if (await marker().catch(() => undefined) === value) return
        if (state.child!.exitCode !== null) throw new Error(`Replication exited: ${await Bun.file(join(root, "replicate-error.log")).text()}`)
        await Bun.sleep(250)
      }
      throw new Error(`Replication did not retain ${value}: ${await Bun.file(join(root, "replicate.log")).text()}`)
    }
    await waitFor("before")
    const target = new Date().toISOString()
    await Bun.sleep(1100)
    await store.transaction("dashboard", async (snapshot) => { snapshot.data.marker = "after"; snapshot.versions.dataset = { version: 1, by: "live" }; return { commit: true, value: undefined } })
    await waitFor("after")
    expect(await marker(target)).toBe("before")
    const backups = await createLocalBackups(join(root, "archives"))
    const recovered = await withRecoveryPoint(config, target, (point) => backups.capture(point, "dashboard", new Date().toISOString()))
    const secret = new Uint8Array([9, 8, 7])
    await store.secrets.put("current-session", secret, Date.now() + 60000)
    expect(await restoreBackup(store, backups.source, "dashboard", recovered.id, { id: "admin", canWrite: true, roles: ["admin"] }, true, 1, new Date().toISOString())).toEqual({ ok: true })
    expect(await store.secrets.get("current-session", Date.now())).toEqual(secret)
    expect(await store.transaction("dashboard", async (snapshot) => ({ commit: false, value: snapshot.data.marker }))).toBe("before")
    expect((await backups.verify("dashboard", recovered.id, new Date().toISOString())).durationMs).toBeGreaterThanOrEqual(0)

    const configuration = await prepareLocalConfiguration(root)
    const access = await prepareOperatorAccess(configuration, true)
    await writeFile(join(root, "recovery", "recovery.json"), JSON.stringify(config), { mode: 0o600, flag: "wx" })
    const origin = "http://localhost:4110"
    const app = await createLocalInstallation({ origin }, configuration, {
      ORCHESTRA_DB: join(root, "host-data", "orchestra.db"),
      ORCHESTRA_INHERIT_CREDENTIALS: "0",
      ORCHESTRA_CONFIG_DIR: join(root, "host-config"),
      ORCHESTRA_CREDENTIAL_KEY_FILE: join(root, "host-credential.key"),
      TMPDIR: join(root, "host-tmp"),
      XDG_DATA_HOME: join(root, "host-data"),
      XDG_CONFIG_HOME: join(root, "host-config"),
      XDG_CACHE_HOME: join(root, "host-cache"),
      XDG_STATE_HOME: join(root, "host-state"),
    })
    state.app = app
    const handoff = (await Bun.file(access.artifact).text()).match(/location\.replace\(("[^"\r\n]*")\)/)?.[1]
    if (!handoff) throw new Error("Private enrollment handoff is malformed")
    const destination = new URL(JSON.parse(handoff))
    expect(destination.origin).toBe(origin)
    expect(destination.pathname).toBe("/sucafina/auth/local")
    expect(Date.now()).toBeGreaterThan(Date.parse(target))
    const enrollment = await app.handler(new Request(destination))
    expect(enrollment?.status).toBe(303)
    const issuedCookie = enrollment?.headers.get("set-cookie")
    if (!issuedCookie) throw new Error("Local enrollment did not issue a session cookie")
    const cookie = issuedCookie.split(";")[0]!
    expect((await app.handler(new Request(destination)))?.status).toBe(403)
    expect((await app.handler(new Request(`${origin}/sucafina/dashboard`, { headers: { Cookie: cookie } })))?.status).toBe(200)

    const liveVersion = await store.transaction("dashboard", async (snapshot) => {
      snapshot.data.marker = "http-live-after-target"
      snapshot.versions.dataset = { version: (snapshot.versions.dataset?.version ?? 0) + 1, by: "http-live" }
      return { commit: true, value: snapshot.versions.dataset.version }
    })
    const live = () => store.transaction("dashboard", async (snapshot) => ({
      commit: false,
      value: { marker: snapshot.data.marker, version: snapshot.versions.dataset?.version },
    }))
    expect(await live()).toEqual({ marker: "http-live-after-target", version: liveVersion })
    const restorePoint = (confirmed: boolean, session?: string) => app.handler(new Request(`${origin}/sucafina/backups`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Origin: origin, ...(session ? { Cookie: session } : {}) },
      body: JSON.stringify({ action: "restore-point", confirmed, version: liveVersion, values: { surface: "dashboard", at: target } }),
    }))
    expect((await restorePoint(true))?.status).toBe(403)
    expect((await restorePoint(false, cookie))?.status).toBe(422)
    expect(await live()).toEqual({ marker: "http-live-after-target", version: liveVersion })

    const restored = await restorePoint(true, cookie)
    expect(restored?.status).toBe(200)
    expect(await restored!.json()).toMatchObject({ ok: true })
    expect(await live()).toEqual({ marker: "before", version: liveVersion + 1 })
    // The same session was minted after target; restoring business data must retain it.
    expect((await app.handler(new Request(`${origin}/sucafina/dashboard`, { headers: { Cookie: cookie } })))?.status).toBe(200)
  } finally {
    try { await state.app?.dispose() } finally {
      try {
        if (state.child && state.child.exitCode === null) { state.child.kill(); await state.child.exited }
      } finally {
        try { await store.dispose() } finally { await rm(root, { recursive: true, force: true }) }
      }
    }
  }
}, 120000)


test("a recovery executable ignoring SIGTERM is killed within the bounded grace period", async () => {
  const started = performance.now()
  await expect(runRecoveryCommand([process.execPath, "-e", 'process.on("SIGTERM", () => {}); setInterval(() => {}, 1000)'], await realpath(tmpdir()), { timeoutMs: 500 })).rejects.toThrow("deadline")
  expect(performance.now() - started).toBeLessThan(5000)
})
