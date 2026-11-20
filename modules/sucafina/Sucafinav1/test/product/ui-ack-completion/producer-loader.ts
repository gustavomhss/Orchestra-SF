import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join, resolve } from "node:path"
import { pathToFileURL } from "node:url"

type ProducerModule = Pick<typeof import("../../../product/collaboration/recipient-actions.ts"), "createRecipientThreadActions">

/**
 * Historical component evidence: the published producer and its two stateless
 * dependencies remain the exact Git blobs named by the original manifest.
 * Canonical context/authority modules stay external singletons. This does not
 * certify the current installed producer or a live Microsoft Team.
 */
export async function loadRecipientActions() {
  const directory = await mkdtemp(join(tmpdir(), "sf-ui-ack-producer-"))
  try {
    const source = resolve(import.meta.dir, "producer/recipient-actions.ts.fixture")
    const contract = resolve(import.meta.dir, "producer/contract.ts.fixture")
    const threads = resolve(import.meta.dir, "producer/threads.ts.fixture")
    const original = resolve(import.meta.dir, "../../../product/collaboration")
    const canonical = resolve(original, "../contracts/canonical.ts")
    const threadContext = resolve(original, "./thread-context.ts")
    const manifest = new Map([
      [source, "22c6309c61b27b89914086a7602bf3bea61a988b"],
      [contract, "b62fce6f0fb0845dbfd18cc94009c33f1586b9c5"],
      [threads, "08a14bb4713b0ccd67d9310b94fe30218eb7349d"],
      [canonical, "1769271386cdda1017c38023b0988ce2d64423d2"],
      [threadContext, "930e7a5febbc981ba1881fc67e9ab065691e3eb8"],
    ])
    const bytesByPath = new Map<string, Uint8Array>()
    for (const [path, expected] of manifest) {
      const bytes = await Bun.file(path).bytes()
      const observed = new Bun.CryptoHasher("sha1").update("blob " + bytes.byteLength + "\0").update(bytes).digest("hex")
      if (observed !== expected) throw new Error("Pinned recipient component bytes changed: " + path)
      bytesByPath.set(path, bytes)
    }
    const producerImports = new Map([
      ["../../runtime/contract.ts", contract],
      ["../contracts/canonical.ts", canonical],
      ["./threads.ts", threads],
      ["./thread-context.ts", threadContext],
    ])
    const threadImports = new Map([
      ["../contracts/canonical.ts", canonical],
      ["../contracts/validation.ts", resolve(original, "../contracts/validation.ts")],
      ["./recipient-authority.ts", resolve(original, "./recipient-authority.ts")],
      ["./thread-context.ts", threadContext],
      ["../reviews/thread-context.ts", resolve(original, "../reviews/thread-context.ts")],
    ])
    const compiled = new Map<string, string>()
    const external = new Set([...producerImports.values(), ...threadImports.values()].filter((path) => path !== contract && path !== threads))
    for (const [path, imports] of [[source, producerImports], [contract, new Map<string, string>()], [threads, threadImports]] as const) {
      const bytes = bytesByPath.get(path)
      if (!bytes) throw new Error("Missing pinned recipient component")
      const relocated = new Set<string>()
      const contents = new TextDecoder().decode(bytes).replace(/^import (?!type\b)([^\r\n]+ from )"([^"\r\n]+)"$/gm, (_line, clause: string, specifier: string) => {
        const target = imports.get(specifier)
        if (!target || relocated.has(specifier)) throw new Error("Unmanifested or repeated recipient runtime import")
        relocated.add(specifier)
        return "import " + clause + JSON.stringify(target)
      })
      if (relocated.size !== imports.size) throw new Error("Recipient runtime import relocation incomplete")
      compiled.set(path, contents)
    }
    const built = await Bun.build({
      entrypoints: [source], target: "bun", format: "esm", outdir: directory, naming: "recipient-actions.js",
      plugins: [{
        name: "published-recipient-imports",
        setup(build) {
          build.onLoad({ filter: /\.ts\.fixture$/ }, (args) => {
            const contents = compiled.get(args.path)
            if (contents === undefined) throw new Error("Unmanifested recipient compiler input")
            return { contents, loader: "ts" }
          })
          build.onResolve({ filter: /.*/ }, (args) => {
            if (!compiled.has(args.importer)) return
            if (compiled.has(args.path)) return { path: args.path }
            if (!external.has(args.path)) throw new Error("Unmanifested recipient runtime dependency")
            return { path: args.path, external: true }
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
