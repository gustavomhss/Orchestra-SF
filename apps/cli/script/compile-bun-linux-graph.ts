const trailer = Buffer.from("\n---- Bun! ----\n")
const decode = new TextDecoder("utf-8", { fatal: true, ignoreBOM: true })

// The ELF framing and module records are specific to the pinned Bun 1.4.1 Linux build.
export function readLinuxBunGraph(binary: Buffer) {
  const fail = () => new Error("CLI_BUN_LINUX_GRAPH_INVALID")
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
    const key = decode.decode(graph.subarray(name, name + size))
    const entries = modules.get(key) ?? []
    entries.push(row)
    modules.set(key, entries)
  }
  return { graph, graphOffset: fileOffset + 8, tableOffset, tableSize, footer, modules }
}
