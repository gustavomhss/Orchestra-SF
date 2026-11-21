import { createHash } from "node:crypto"
import path from "node:path"
import { exportsImportMetaRequire } from "@orchestra/script/esm-binding"
import { readLinuxBunGraph } from "./compile-bun-linux-graph"

const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
const utf16 = new TextDecoder("utf-16le", { fatal: true, ignoreBOM: true })

export function linuxBunTextWitness(binary: Buffer, debugIds?: ReadonlyMap<string, string>) {
  const fail = () => new Error("CLI_COMPILER_TEXT_GRAPH_INVALID")
  const { graph, graphOffset, tableOffset, modules } = readLinuxBunGraph(binary)
  const uniqueRow = (name: string) => {
    const rows = modules.get(name)
    if (rows?.length !== 1) throw fail()
    return rows[0]!
  }
  const readBody = (row: number) => {
    const start = graph.readUInt32LE(row + 8)
    const length = graph.readUInt32LE(row + 12)
    const encoding = graph[row + 48]
    if ((encoding !== 1 && encoding !== 2) || start + length >= tableOffset || graph[start + length] !== 0) throw fail()
    const body = graph.subarray(start, start + length)
    if (encoding === 1 && body.some((byte) => byte > 127)) throw fail()
    if (encoding === 2 && ((start | length) % 2 || start + length + 1 >= tableOffset ||
        graph[start + length + 1] !== 0)) throw fail()
    return {
      body, encoding: encoding === 1 ? "ascii" : "utf16le",
      offset: graphOffset + start, bytes: length,
    }
  }

  const claimed = new Set<string>()
  const checkedHelpers = new Set<string>()
  return (source: string, raw: Buffer, expectedSha256: string, chunks: readonly string[] = []) => {
    const name = textModuleName(source, raw)
    const row = uniqueRow(name)
    if (claimed.has(name) || graph[row + 49] !== 13) throw fail()
    const text = readBody(row)
    const decoded = text.encoding === "ascii" ? text.body : Buffer.from(utf16.decode(text.body), "utf8")
    const decodedSha256 = createHash("sha256").update(decoded).digest("hex")
    if (decodedSha256 !== expectedSha256 || !decoded.equals(raw)) throw fail()

    const dynamicChunks = chunks.map((chunk) => {
      if (!chunkPath.test(chunk)) throw fail()
      const module = "/$bunfs/root/" + chunk.slice(2)
      const chunkRow = uniqueRow(module)
      if (graph[chunkRow + 49] !== 1 || graph[chunkRow + 50] !== 1) throw fail()
      const chunkText = readBody(chunkRow)
      const code = (chunkText.encoding === "ascii" ? decoder : utf16).decode(chunkText.body)
      // Exclude the exact terminal metadata authenticated by this module's
      // compiler map from the stub grammar, while hashing the entire raw body.
      const debugId = debugIds?.get(module)
      const footer = debugId ? `\n//# debugId=${debugId}\n` : undefined
      const binding = textDefaultBinding(footer && code.endsWith(footer) ? code.slice(0, -footer.length) : code, name)
      if (!binding) throw fail()
      if (binding.helperModule) {
        const key = JSON.stringify([binding.helperModule, binding.exported])
        if (!checkedHelpers.has(key)) {
          const helperRow = uniqueRow(binding.helperModule)
          if (graph[helperRow + 49] !== 1 || graph[helperRow + 50] !== 1) throw fail()
          const helper = readBody(helperRow)
          const helperCode = (helper.encoding === "ascii" ? decoder : utf16).decode(helper.body)
          if (!exportsImportMetaRequire(helperCode, binding.exported)) throw fail()
          checkedHelpers.add(key)
        }
      }
      return { module, offset: chunkText.offset, bytes: chunkText.bytes,
        sha256: createHash("sha256").update(chunkText.body).digest("hex") }
    })
    claimed.add(name)
    return { module: name, loader: "text", encoding: text.encoding, offset: text.offset,
      bytes: text.bytes, decodedSha256, dynamicChunks }
  }
}

type TextMetafile = {
  inputs: Record<string, { imports: readonly { path: string; kind?: string; original?: string; external?: boolean; with?: unknown }[] }>
  outputs: Record<string, { entryPoint?: string; inputs: Record<string, unknown>; exports?: readonly string[] }>
}

const chunkPath = /^\.\/chunk-[0123456789abcdefghjkmnpqrstvwxyz]{8}\.js$/

export function textInputEdges(meta: TextMetafile, key: string) {
  const identities = []
  const chunks = new Set<string>()
  for (const [source, input] of Object.entries(meta.inputs)) {
    for (const edge of input.imports) {
      const direct = edge.path === key
      if (direct) {
        if (edge.external || typeof edge.with !== "object" || edge.with === null ||
            !("type" in edge.with) || edge.with.type !== "text") return undefined
      } else {
        const output = meta.outputs[edge.path]
        if (output?.entryPoint !== key) continue
        // Bun drops the loader attribute when it splits a dynamic import into a chunk.
        if (!edge.external || edge.kind !== "dynamic-import" || !edge.original || !chunkPath.test(edge.path) ||
            Object.keys(output.inputs).length !== 1 || !Object.hasOwn(output.inputs, key) ||
            output.exports?.length !== 1 || output.exports[0] !== "default") return undefined
        chunks.add(edge.path)
      }
      identities.push(JSON.stringify([source, edge.kind, edge.original, direct ? "direct" : "chunk"]))
    }
  }
  return identities.length ? { identities: identities.sort(), chunks: [...chunks].sort() } : undefined
}

function textDefaultBinding(code: string, textModule: string): { helperModule: string; exported: string } | { helperModule?: undefined } | undefined {
  // Bun emits a sole-input Text chunk as a generated default-export stub.
  const stub = /var (?<value>[$A-Z_a-z][$\w]*)=(?<call>[$A-Z_a-z][$\w]*|import\.meta\.require)\((?<target>"(?:[^"\\]|\\.)*")\);export\{(?<exported>[$A-Z_a-z][$\w]*) as default\};\s*$/.exec(code)
  if (!stub?.groups || stub.groups.value !== stub.groups.exported || stub.groups.target !== JSON.stringify(textModule))
    return undefined
  const prelude = code.slice(0, stub.index).replace(/^\/\/ @bun\r?\n/, "")
  const imported = /^import\{(?<helper>[$A-Z_a-z][$\w]*)(?: as (?<alias>[$A-Z_a-z][$\w]*))?\}from"(?<module>\/\$bunfs\/root\/chunk-[0123456789abcdefghjkmnpqrstvwxyz]{8}\.js)";$/.exec(prelude)?.groups
  if (imported?.module && imported.helper) {
    if (stub.groups.call !== (imported.alias ?? imported.helper)) return undefined
    return { helperModule: imported.module, exported: imported.helper }
  }
  const local = /^var (?<helper>[$A-Z_a-z][$\w]*)=import\.meta\.require;$/.exec(prelude)?.groups
  if (local) return stub.groups.call === local.helper ? {} : undefined
  if (!prelude && stub.groups.call === "import.meta.require") return {}
  return undefined
}

function textModuleName(source: string, raw: Buffer) {
  // Bun's ASSET template uses the base name and the low five bits of each little-endian
  // byte of xxHash64(length prefix + content), per ContentHasher and truncated_hash32_bytes.
  const length = Buffer.alloc(8)
  length.writeBigUInt64LE(BigInt(raw.length))
  const digest = Bun.hash.xxHash64(Buffer.concat([length, raw]), 0n)
  const bytes = Buffer.alloc(8)
  bytes.writeBigUInt64LE(digest)
  const alphabet = "0123456789abcdefghjkmnpqrstvwxyz"
  const suffix = Array.from(bytes, (byte) => alphabet[byte & 31]).join("")
  const filename = path.parse(source)
  return "/$bunfs/root/" + filename.name + "-" + suffix + filename.ext
}
