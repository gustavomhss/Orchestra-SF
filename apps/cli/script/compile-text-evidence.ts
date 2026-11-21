import { createHash } from "node:crypto"
import path from "node:path"
import { exportsImportMetaRequire } from "@orchestra/script/esm-binding"

const trailer = Buffer.from("\n---- Bun! ----\n")
const decoder = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
const utf16 = new TextDecoder("utf-16le", { fatal: true, ignoreBOM: true })

// The ELF framing and 52-byte module records are specific to the pinned Bun 1.4.1 Linux build.
export function linuxBunTextWitness(binary: Buffer) {
  const fail = () => new Error("CLI_COMPILER_TEXT_GRAPH_INVALID")
  const range = (offset: number, length: number) => {
    if (!Number.isSafeInteger(offset) || !Number.isSafeInteger(length) || offset < 0 || length < 0 ||
        offset > binary.length || length > binary.length - offset) throw fail()
    return binary.subarray(offset, offset + length)
  }
  const u64 = (offset: number) => Number(binary.readBigUInt64LE(offset))
  const header = range(0, 64)
  if (!header.subarray(0, 6).equals(Buffer.from([0x7f, 0x45, 0x4c, 0x46, 2, 1])) ||
      header.readUInt16LE(18) !== 62) throw fail()
  const program = u64(32)
  const sections = u64(40)
  const programCount = header.readUInt16LE(56)
  const sectionCount = header.readUInt16LE(60)
  const namesIndex = header.readUInt16LE(62)
  if (header.readUInt16LE(54) !== 56 || header.readUInt16LE(58) !== 64 ||
      !programCount || !namesIndex || namesIndex >= sectionCount) throw fail()
  range(program, programCount * 56)
  range(sections, sectionCount * 64)
  const nameHeader = sections + namesIndex * 64
  const sectionNames = range(u64(nameHeader + 24), u64(nameHeader + 32))
  const bunSections = []
  for (let index = 0; index < sectionCount; index++) {
    const section = sections + index * 64
    const start = binary.readUInt32LE(section)
    const end = sectionNames.indexOf(0, start)
    if (end === -1) throw fail()
    if (sectionNames.subarray(start, end).equals(Buffer.from(".bun"))) bunSections.push(section)
  }
  if (bunSections.length !== 1) throw fail()
  const section = bunSections[0]!
  const fileOffset = u64(section + 24)
  const payload = range(fileOffset, u64(section + 32))
  const address = u64(section + 16)
  if (binary.readUInt32LE(section + 4) !== 1 || payload.length < 56 ||
      Number(payload.readBigUInt64LE(0)) !== payload.length - 8 ||
      !payload.subarray(-trailer.length).equals(trailer)) throw fail()
  const mapped = Array.from({ length: programCount }, (_, i) => program + i * 56).some((segment) => {
    const offset = u64(segment + 8)
    const size = u64(segment + 32)
    return binary.readUInt32LE(segment) === 1 && Number.isSafeInteger(offset) && Number.isSafeInteger(size) &&
      offset <= fileOffset && payload.length <= size - (fileOffset - offset) &&
      u64(segment + 16) + fileOffset - offset === address
  })
  if (!mapped) throw fail()

  const graph = payload.subarray(8)
  const footer = graph.length - trailer.length - 32
  const tableOffset = graph.readUInt32LE(footer + 8)
  const tableSize = graph.readUInt32LE(footer + 12)
  const entrypoint = graph.readUInt32LE(footer + 16)
  if (Number(graph.readBigUInt64LE(footer)) !== footer || !tableOffset || tableSize % 52 !== 0 ||
      tableOffset + tableSize > footer || entrypoint >= tableSize / 52) throw fail()
  const modules = new Map<string, number[]>()
  for (let row = tableOffset; row < tableOffset + tableSize; row += 52) {
    const name = graph.readUInt32LE(row)
    const size = graph.readUInt32LE(row + 4)
    if (!size || name + size >= tableOffset || graph[name + size] !== 0) throw fail()
    const key = decoder.decode(graph.subarray(name, name + size))
    const entries = modules.get(key) ?? []
    entries.push(row)
    modules.set(key, entries)
  }

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
      offset: fileOffset + 8 + start, bytes: length,
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
      const binding = textDefaultBinding(code, name)
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
