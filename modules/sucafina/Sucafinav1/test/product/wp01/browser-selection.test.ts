import { afterAll } from "bun:test"
import { pathToFileURL } from "node:url"
import path from "node:path"
import { ensureWp01BrowserCleanup, wp01BrowserLifecycleEvidence } from "./browser-fixture.ts"
import { openWp01PoolRegistration } from "./browser-pool-registration.ts"

// One Bun entry owns registration and order. The forty original files retain
// their own assertions, titles, parameter tables, budgets and describe-scoped hooks.
const run = await openWp01PoolRegistration()

// A failed import, hook or consumer cannot omit physical cleanup. This fallback
// never substitutes for the named finalizer case or turns an incomplete run green.
afterAll(async () => {
  const failures: unknown[] = []
  try { await ensureWp01BrowserCleanup() } catch (error) { failures.push(error) }
  run.lifecycle(wp01BrowserLifecycleEvidence())
  if (failures.length === 0) {
    try { run.complete() } catch (error) { failures.push(error) }
  }
  if (failures.length) {
    run.incomplete()
    throw new AggregateError(failures, "WP01 owned browser entry did not complete cleanly")
  }
}, 25_000)

for (const source of run.inventory.sources) {
  const { registerPoolTests } = await import(pathToFileURL(path.join(run.repoRoot, source.path)).href)
  run.register(source.path, registerPoolTests)
}
run.seal()
