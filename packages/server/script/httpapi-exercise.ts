// Runs the V2 HttpApi exercise. The optional nonce binds a run-level Omni witness to G05 Actions.
const nonce = process.env.ORCHESTRA_OMNI_CONTROL_NONCE
delete process.env.ORCHESTRA_OMNI_CONTROL_NONCE
if (nonce !== undefined && !/^[0-9a-f]{32}$/.test(nonce)) throw new Error("Invalid G05 Omni control nonce")

const { Effect } = await import("effect")
const { main } = await import("../test/httpapi-exercise")
const { message } = await import("../test/httpapi-exercise/assertions")
const { parseOptions } = await import("../test/httpapi-exercise/routing")
const args = Bun.argv.slice(2)
const result = await Effect.runPromise(main(args)).then(
  () => ({ ok: true as const }),
  (error: unknown) => ({ ok: false as const, error }),
)
if (!result.ok) console.error(message(result.error))
if (nonce === undefined) process.exit(result.ok ? 0 : 1)

// This is a script-level observation, not bun:test's declared/suite control.
// Only effect mode is expected to spawn. Coverage/auth can honestly report no Omni proof.
const { Omni } = await import("@orchestra/core/omni")
const { omniSpawner } = await import("@orchestra/core/flag/flag")
const mode = parseOptions(args).mode
const raw = process.env.ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER
const counts = Omni.snapshot()
const required = mode === "effect"
const problem = raw !== "1" && raw !== "strict" ? "G05 requires Omni on" : Omni.verdict(omniSpawner(raw), counts, required)
const verdict = problem ? "FAIL" : counts.spawns > 0 ? "pass" : "not applicable"
const destination = process.env.G05_OMNI_RECEIPT
if (destination)
  await Bun.write(destination, JSON.stringify({
    schema: "orchestra.g05.omni/1",
    scope: "HTTPAPI_SCRIPT",
    nonce,
    mode,
    sourceSha: process.env.GITHUB_SHA ?? null,
    sourceTree: process.env.G05_SOURCE_TREE ?? null,
    expectedSpawn: required,
    counts,
    verdict,
    problem: problem ?? null,
    exerciseSucceeded: result.ok,
  }, null, 2) + "\n")
console.log(`omni positive control [${nonce}]: ${verdict} (httpapi script ${mode}); ${counts.spawns} Omni spawns, ${counts.delegations} delegated.`)
if (problem) console.error(problem)
process.exit(result.ok && !problem ? 0 : 1)
