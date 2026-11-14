import { expect, test } from "bun:test"
import { mkdtemp, realpath, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import { ChildProcess } from "effect/unstable/process"
import { expectSpawn } from "../../../../../../packages/core/test/fixture/omni-expect.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { sfCaseFixture } from "./run-fixture.ts"
import { observeRestart, openRestartStore, restartMaterial, restartStage } from "./restart-reader.ts"

// This is component durability with explicitly synthetic inference records, not a provider witness.
test("separate SQLite readers recover current and historical runs and enforce persisted source and case revocation", async () => {
  expectSpawn(import.meta.path)
  const childDeadline = Date.now() + 45_000
  const directory = await mkdtemp(path.join(await realpath(tmpdir()), "sf-wp12-process-restart-"))
  const material = restartMaterial()
  const children: number[] = []
  const contexts: string[] = []
  const writer = async (action: (world: Awaited<ReturnType<typeof openRestartStore>>) => Promise<void>) => {
    const world = await openRestartStore(directory, true)
    try { await action(world) } finally { await world.close(); restartStage("writer-disposed") }
  }
  const restart = async (mode: "current" | "historical") => {
    const remaining = childDeadline - Date.now()
    if (remaining <= 0) throw new Error("WP12 restart child deadline reached before spawn")
    restartStage(`${mode}:spawn-start`)
    const child = await Effect.runPromise(AppProcess.Service.use((runner) => runner.run(
      ChildProcess.make(Bun.argv[0]!, [fileURLToPath(new URL("./restart-reader.ts", import.meta.url)), directory, mode], { extendEnv: true, stdin: "ignore" }),
      { timeout: Math.min(12_000, remaining), maxOutputBytes: 64 * 1024, maxErrorBytes: 64 * 1024, inspect: (chunk) => { process.stderr.write(chunk) } },
    )).pipe(Effect.scoped, Effect.provide(LayerNode.compile(AppProcess.node))))
    restartStage(`${mode}:spawn-returned`)
    expect(child.exitCode).toBe(0)
    expect(child.stdoutTruncated).toBe(false)
    const lines = child.stdout.toString("utf8").split("\n").filter((line) => line.startsWith("SF_WP12_RESTART_PROBE:"))
    if (child.exitCode !== 0 || lines.length !== 1) throw new Error(`Restart reader failed: ${child.stderr.toString("utf8")}`)
    const result = JSON.parse(lines[0]!.slice("SF_WP12_RESTART_PROBE:".length)) as Awaited<ReturnType<typeof observeRestart>>
    expect(result.pid).not.toBe(process.pid)
    expect(children).not.toContain(result.pid)
    children.push(result.pid)
    expect(result.elapsedMs).toBeGreaterThanOrEqual(0)
    expect(result.fixture).toBe("synthetic-inference-records")
    expect(result.unchanged).toBe(true)
    expect(result.beforeDigest).toBe(result.afterDigest)
    expect(result.observations).toMatchObject({ nativeCalls: 0, writeAttempts: 0, disposed: true })
    expect(result.observations.contextIds.length).toBeGreaterThanOrEqual(2)
    expect(result.observations.contextIds.every((id) => !contexts.includes(id))).toBe(true)
    contexts.push(...result.observations.contextIds)
    return result
  }
  try {
    restartStage("seed-start")
    await writer(async (world) => {
      await world.seedSource()
      const scope = world.freshContext()
      try {
        expect((await world.state.transaction(scope.request, { namespace: "cases", expectedStorageVersion: 0, idempotencyKey: "seed-case", commandDigest: "a".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
          state.cases.case = { ...sfCaseFixture(material.caseRef, ["principal"]), sourceRefs: [material.evidence] }
          return { commit: true, value: true }
        })).status).toBe("ok")
        const { native: _native, outputRef: _outputRef, ...base } = material.run
        expect((await world.store.create({ ...base, state: "preparing", version: 1 }, scope.context)).status).toBe("ok")
        expect((await world.store.attach("run", 1, "session", material.receipt, scope.context)).status).toBe("ok")
        expect((await world.store.transition("run", 2, "running", undefined, scope.context)).status).toBe("ok")
        expect((await world.store.publish("run", 3, material.output, scope.context)).status).toBe("ok")
        const persisted = await world.snapshot((value) => JSON.stringify(value.data))
        expect(world.observed.contextIds.every((id) => !persisted.includes(id))).toBe(true)
        for (const capability of ["executionTicket", "lease", "binding"]) expect(persisted.includes(`\"${capability}\":`)).toBe(false)
      } finally { scope.close() }
    })
    const current = await restart("current")
    expect(current.progress).toEqual({ status: "ok", state: "ready", version: 4, hasOutput: true, outputDigest: digestSfValue(material.output) })
    expect(current.current).toEqual({ status: "ok", outputDigest: digestSfValue(material.output) })
    expect(current.historical.status).toBe("unavailable")
    expect(current.observations.sourceChecks).toBeGreaterThan(0)

    await writer(async (world) => {
      await world.changeSource("advance")
      const scope = world.freshContext()
      try {
        const cases = await world.state.read(scope.request, "cases", () => null)
        if (cases.status !== "ok") throw new Error("case unavailable for version advance")
        expect((await world.state.transaction(scope.request, { namespace: "cases", expectedStorageVersion: cases.storageVersion, idempotencyKey: "advance-case", commandDigest: "b".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
          state.cases.case = { ...state.cases.case!, version: 2 }
          return { commit: true, value: true }
        })).status).toBe("ok")
        expect((await world.store.preserveStale("run", "source-changed", material.output, scope.context)).status).toBe("ok")
      } finally { scope.close() }
    })
    const historical = await restart("historical")
    expect(historical.progress).toEqual({ status: "ok", state: "stale", version: 5, hasOutput: false })
    expect(historical.current).toEqual({ status: "stale", reason: "source-changed" })
    expect(historical.historical).toEqual({ status: "ok", state: "historical", outputDigest: digestSfValue(material.output) })
    expect(historical.observations.sourceChecks).toBeGreaterThanOrEqual(3)

    await writer(async (world) => { await world.changeSource("revoke") })
    const revokedSource = await restart("historical")
    expect(revokedSource.progress).toEqual({ status: "ok", state: "stale", version: 5, hasOutput: false })
    expect(revokedSource.current).toEqual({ status: "denied", reason: "source-access-revoked" })
    expect(revokedSource.historical).toEqual({ status: "denied", reason: "source-access-revoked" })

    await writer(async (world) => {
      await world.changeSource("restore")
      const scope = world.freshContext()
      try {
        const cases = await world.state.read(scope.request, "cases", () => null)
        if (cases.status !== "ok") throw new Error("case unavailable for revocation")
        expect((await world.state.transaction(scope.request, { namespace: "cases", expectedStorageVersion: cases.storageVersion, idempotencyKey: "revoke-case", commandDigest: "c".repeat(64), targetRef: "case", targetIncarnation: "inc" }, async (state) => {
          state.cases.case = { ...state.cases.case!, participants: [] }
          return { commit: true, value: true }
        })).status).toBe("ok")
      } finally { scope.close() }
    })
    const revokedCase = await restart("historical")
    expect(revokedCase.progress.status).toBe("denied")
    expect(revokedCase.current).toEqual({ status: "denied", reason: "contribution-access-unavailable" })
    expect(revokedCase.historical).toEqual({ status: "denied", reason: "contribution-access-unavailable" })
    expect(children).toHaveLength(4)
    expect(new Set(contexts).size).toBe(contexts.length)
    restartStage("all-readers-complete")
  } finally { await rm(directory, { recursive: true, force: true }); restartStage("directory-removed") }
}, 60_000)
