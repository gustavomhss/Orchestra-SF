import path from "node:path"
import { readLinuxBunGraph } from "./compile-bun-linux-graph"
import { matchCompileMapCoordinates } from "./compile-map-coordinates"

const namespace = "/$bunfs/root/"
const utf8 = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })
const digest = (bytes: Uint8Array) => new Bun.CryptoHasher("sha256").update(bytes).digest("hex")

export async function detachCompileSourceMaps(
  binary: Buffer,
  outputs: readonly { path: string; arrayBuffer(): Promise<ArrayBuffer> }[],
) {
  const maps = new Map<string, Buffer>()
  for (const output of outputs) {
    const name = path.basename(output.path)
    requireMap(/^[a-zA-Z0-9_.-]+\.map$/.test(name) && !maps.has(name))
    maps.set(name, Buffer.from(await output.arrayBuffer()))
  }
  const originalSha256 = digest(binary)
  const layout = readLinuxBunGraph(binary)
  const protectedRanges = protectedGraphRanges(layout)
  const changes: { start: number; end: number }[] = []
  const files = new Map<string, string>()
  const modules = []
  for (const [name, rows] of layout.modules) {
    requireMap(name.startsWith(namespace) && rows.length === 1)
    const row = rows[0]!
    const body = graphPointer(layout, row + 8)
    const map = graphPointer(layout, row + 16)
    const encoding = layout.graph.readUInt8(row + 48)
    const loader = layout.graph.readUInt8(row + 49)
    const code = {
      name, offset: layout.graphOffset + body.start, byteLength: body.end - body.start,
      sha256: digest(layout.graph.subarray(body.start, body.end)), encoding, loader,
    }
    if (map.start === map.end) {
      modules.push({ ...code, status: "no-compiler-map" as const })
      continue
    }
    requireMap(encoding === 1 || encoding === 2)
    const mapName = name.slice(namespace.length) + ".map"
    const emitted = maps.get(mapName)
    requireMap(emitted !== undefined && !files.has(mapName))
    requireMap(protectedRanges.every((range) => map.start >= range.end || map.end <= range.start))
    const embedded = layout.graph.subarray(map.start, map.end)
    const bound = verifyEmbeddedMap(embedded, emitted)
    files.set(mapName, bound.json)
    modules.push({ ...code, status: "matched-compiler-map" as const, map: mapName,
      coordinates: bound.coordinates, sources: bound.sourceHashes, mapSha256: digest(Buffer.from(bound.json)),
      emittedMapSha256: digest(emitted), embeddedMapSha256: digest(embedded),
    })
    changes.push(
      { start: layout.graphOffset + map.start, end: layout.graphOffset + map.end },
      { start: layout.graphOffset + row + 16, end: layout.graphOffset + row + 24 },
    )
  }
  requireMap(files.size > 0 && maps.size === files.size)
  const stripped = Buffer.from(binary)
  let previousEnd = 0
  for (const range of changes.sort((a, b) => a.start - b.start)) {
    requireMap(range.start >= previousEnd && range.end > range.start)
    stripped.fill(0, range.start, range.end)
    previousEnd = range.end
  }
  // The caller writes only this buffer to bin/. Check the loader's framing again
  // and verify that every module byte range is identical after removing metadata.
  const delivered = readLinuxBunGraph(stripped)
  requireMap(delivered.modules.size === modules.length)
  for (const module of modules) {
    const row = delivered.modules.get(module.name)?.[0]
    requireMap(row !== undefined && delivered.graph.readBigUInt64LE(row + 16) === 0n &&
      digest(stripped.subarray(module.offset, module.offset + module.byteLength)) === module.sha256)
  }

  return {
    binary: stripped,
    files,
    index: {
      schema: "orchestra-linux-compile-source-maps-v1",
      bunRevision: Bun.revision,
      originalSha256,
      binarySha256: digest(stripped),
      detachedMapCount: files.size,
      scrubbedRanges: changes,
      modules,
    },
  }
}

type Layout = ReturnType<typeof readLinuxBunGraph>

function graphPointer(layout: Layout, field: number, terminator = 0) {
  const start = layout.graph.readUInt32LE(field)
  const end = start + layout.graph.readUInt32LE(field + 4)
  requireMap(end + terminator <= layout.tableOffset)
  if (terminator === 1) requireMap(layout.graph[end] === 0)
  if (terminator === 2) requireMap((start | end) % 2 === 0 && layout.graph.readUInt16LE(end) === 0)
  return { start, end: end + terminator }
}

function protectedGraphRanges(layout: Layout) {
  const ranges = []
  for (const rows of layout.modules.values()) {
    for (const row of rows) {
      const encoding = layout.graph.readUInt8(row + 48)
      requireMap(encoding <= 2)
      const terminators = [1, encoding === 2 ? 2 : 1, 0, 0, layout.graph.readUInt32LE(row + 44) ? 1 : 0]
      for (const [index, field] of [0, 8, 24, 32, 40].entries()) {
        const pointer = graphPointer(layout, row + field, terminators[index])
        if (pointer.start !== pointer.end) ranges.push(pointer)
      }
    }
  }
  // This build uses no bytecode. Reject graph extensions with independent
  // pointers before changing a byte in the standalone image.
  const flags = layout.graph.readUInt32LE(layout.footer + 28)
  requireMap((flags & ~0x17f) === 0)
  if (flags & 0x40) {
    const bytecodeTable = layout.tableOffset + layout.tableSize + (flags & 0x20 ? 4 * layout.modules.size : 0)
    requireMap(bytecodeTable + 4 <= layout.footer && layout.graph.readUInt32LE(bytecodeTable) === 0)
  }
  const argv = layout.footer + 20
  const start = layout.graph.readUInt32LE(argv)
  const length = layout.graph.readUInt32LE(argv + 4)
  requireMap(start >= layout.tableOffset + layout.tableSize && start + length + 1 <= layout.footer)
  return ranges
}

function verifyEmbeddedMap(embedded: Buffer, emitted: Buffer) {
  const map: { version?: unknown; sources?: unknown; sourcesContent?: unknown; names?: unknown; mappings?: unknown } =
    JSON.parse(utf8.decode(emitted))
  requireMap(map.version === 3 && stringArray(map.sources) && stringArray(map.sourcesContent) &&
    stringArray(map.names) && typeof map.mappings === "string")
  const sources = embedded.readUInt32LE(0)
  const mappingStart = 8 + 16 * sources
  const mappingEnd = mappingStart + embedded.readUInt32LE(4)
  requireMap(sources > 0 && sources === map.sources.length && sources === map.sourcesContent.length &&
    mappingStart < mappingEnd && mappingEnd <= embedded.length)
  const slice = (field: number) => {
    const start = embedded.readUInt32LE(field)
    const end = start + embedded.readUInt32LE(field + 4)
    requireMap(start >= mappingEnd && end <= embedded.length)
    return embedded.subarray(start, end)
  }
  const contents = map.sourcesContent
  const sourceHashes = map.sources.map((source, index) => {
    const content = Buffer.from(contents[index]!)
    requireMap(utf8.decode(slice(8 + 8 * index)) === source &&
      content.equals(Bun.zstdDecompressSync(slice(8 + 8 * (sources + index)))))
    return { source, sha256: digest(content) }
  })
  const coordinates = matchCompileMapCoordinates(embedded.subarray(mappingStart, mappingEnd), map.mappings, sources)
  return { coordinates, sourceHashes,
    json: JSON.stringify({ version: 3, sources: map.sources, names: map.names, mappings: map.mappings }) + "\n",
  }
}

function stringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every((entry) => typeof entry === "string")
}

function requireMap(condition: boolean): asserts condition {
  if (!condition) throw new Error("CLI_COMPILE_SOURCE_MAP_EVIDENCE_INVALID")
}
