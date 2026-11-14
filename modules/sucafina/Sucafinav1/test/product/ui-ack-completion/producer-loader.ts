import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

type ProducerModule = Pick<typeof import("../../../product/collaboration/recipient-actions.ts"), "createRecipientThreadActions">

/** Compile the published UTF-8 blob without modifying its bytes or duplicating its algorithm.
 * Runtime imports stay external and resolve to the retained, manifest-checked real modules.
 * This helper executes only inside the selected GitHub Actions tests.
 */
export async function loadRecipientActions() {
  const source = resolve(import.meta.dir, "producer/recipient-actions.ts.fixture")
  const bytes = await Bun.file(source).bytes()
  const blob = new Bun.CryptoHasher("sha1").update("blob " + bytes.byteLength + "\0").update(bytes).digest("hex")
  if (blob !== "22c6309c61b27b89914086a7602bf3bea61a988b") throw new Error("Pinned recipient producer bytes changed")
  const original = resolve(import.meta.dir, "../../../product/collaboration")
  const dependencies = {
    "../../runtime/contract.ts": "b62fce6f0fb0845dbfd18cc94009c33f1586b9c5",
    "../contracts/canonical.ts": "1769271386cdda1017c38023b0988ce2d64423d2",
    "./threads.ts": "08a14bb4713b0ccd67d9310b94fe30218eb7349d",
    "./thread-context.ts": "930e7a5febbc981ba1881fc67e9ab065691e3eb8",
  }
  for (const [specifier, expected] of Object.entries(dependencies)) {
    const dependency = await Bun.file(resolve(original, specifier)).bytes()
    const observed = new Bun.CryptoHasher("sha1").update("blob " + dependency.byteLength + "\0").update(dependency).digest("hex")
    if (observed !== expected) throw new Error("Pinned recipient runtime dependency changed: " + specifier)
  }
  const imports = new Set(Object.keys(dependencies))
  const directory = await mkdtemp(join(tmpdir(), "sf-ui-ack-producer-"))
  try {
    const built = await Bun.build({
      entrypoints: [source], target: "bun", format: "esm", outdir: directory, naming: "recipient-actions.js",
      plugins: [{
        name: "published-recipient-imports",
        setup(build) {
          build.onLoad({ filter: /recipient-actions\.ts\.fixture$/ }, async () => ({ contents: await Bun.file(source).text(), loader: "ts" }))
          build.onResolve({ filter: /.*/ }, (args) => {
            if (args.importer !== source) return
            if (!imports.has(args.path)) throw new Error("Unmanifested recipient runtime dependency")
            return { path: resolve(original, args.path), external: true }
          })
        },
      }],
    })
    if (!built.success) throw new AggregateError(built.logs, "Published recipient producer compilation failed")
    const producer: ProducerModule = await import(pathToFileURL(join(directory, "recipient-actions.js")).href)
    if (typeof producer.createRecipientThreadActions !== "function") throw new Error("Published recipient factory unavailable")
    return { createRecipientThreadActions: producer.createRecipientThreadActions, close: () => rm(directory, { recursive: true, force: true }) }
  } catch (error) {
    await rm(directory, { recursive: true, force: true })
    throw error
  }
}

