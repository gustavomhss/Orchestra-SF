import path from "node:path"
import { fileURLToPath } from "node:url"
import { waveFourTest } from "./wave-four"
import { withDesignInstallation } from "./installation"

/** The existing real ClamD script is run only inside the hosted test-ci job. */
export const collabTest = waveFourTest.extend<{ realScanner: true }>({
  realScanner: [async ({}, use) => { await withRealScanner(() => use(true)) }, { timeout: 300_000 }],
  installation: [async ({ realScanner }, use) => {
    if (!realScanner) throw new Error("The actual scanner was not qualified")
    await withDesignInstallation(use, "four-files")
  }, { scope: "test", timeout: 190_000 }],
})

export { capture, enter, observePage, ready, reflow, scheme, scrollPageTop } from "./wave-three"

async function withRealScanner<T>(use: () => Promise<T>) {
  if (process.env.GITHUB_ACTIONS !== "true" || process.env.RUNNER_OS !== "Linux" ||
      process.env.RUNNER_ARCH !== "X64" || process.env.GITHUB_REPOSITORY !== "gustavomhss/Orchestra-SF")
    throw new Error("The live import scanner is qualified only by this repository's hosted Linux X64 test-ci")
  const repository = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../../../..")
  const [{ AppProcess }, { LayerNode }, { Effect }, { ChildProcess }] = await Promise.all([
    import("@orchestra/core/process"),
    import("@orchestra/core/effect/layer-node"),
    import("effect"),
    import("effect/unstable/process"),
  ])
  return Effect.runPromise(Effect.scoped(Effect.gen(function* () {
    const launcher = yield* AppProcess.Service
    const owned: { id?: string } = {}
    const resource = yield* Effect.acquireRelease(
      Effect.gen(function* () {
        const result = yield* launcher.run(ChildProcess.make("bash", ["script/sf-ci/operations-clamd.sh"], {
          cwd: repository, env: { ...process.env }, extendEnv: false,
        }), { timeout: 240_000, maxOutputBytes: 64 * 1024, maxErrorBytes: 64 * 1024 })
        const ids = result.stdout.toString("utf8").split(/\r?\n/).filter((line) => /^[a-f0-9]{64}$/.test(line))
        if (ids.length === 1) owned.id = ids[0]
        return { result, owned }
      }),
      () => Effect.gen(function* () {
        // Remove only the exact container ID printed by our successful docker run.
        // Never delete a service by a common name or reuse a pre-existing daemon.
        if (!owned.id) return
        const stopped = yield* launcher.run(ChildProcess.make("docker", ["rm", "--force", owned.id], {
          cwd: repository, env: { ...process.env }, extendEnv: false,
        }), { timeout: 30_000, maxOutputBytes: 4096, maxErrorBytes: 4096 })
        if (stopped.exitCode !== 0) throw new Error("Owned CI scanner cleanup failed")
      }).pipe(Effect.orDie),
    )
    if (!resource.owned.id || resource.result.exitCode !== 0 ||
        !resource.result.stdout.toString("utf8").includes("SF_REAL_CLAMD_INSTREAM_READY"))
      throw new Error("Original ClamD protocol/INSTREAM qualification failed")
    console.info("SF_DESIGN_STAGE real-scanner-qualified")
    return yield* Effect.promise(use)
  })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))))
}
