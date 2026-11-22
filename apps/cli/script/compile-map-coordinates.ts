// Byte layout and delta rules from Bun 1.4.1, src/sourcemap/InternalSourceMap.rs.
// The embedded format preserves positions but omits unmapped segments and names.
const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/"

export function matchCompileMapCoordinates(embedded: Buffer, mappings: string, sources: number) {
  const standard = sourceMapCoordinates(mappings)
  let count = 0
  for (const coordinates of embeddedCoordinates(embedded)) {
    const next = standard.next()
    if (next.done || coordinates[2]! >= sources || coordinates.some((value, index) => value !== next.value[index]))
      throw new Error("CLI_COMPILE_SOURCE_MAP_COORDINATES_DIFFER")
    count++
  }
  if (!standard.next().done) throw new Error("CLI_COMPILE_SOURCE_MAP_COORDINATES_DIFFER")
  return count
}

function* sourceMapCoordinates(mappings: string) {
  let source = 0
  let sourceLine = 0
  let sourceColumn = 0
  for (const [line, group] of mappings.split(";").entries()) {
    let column = 0
    for (const segment of group ? group.split(",") : []) {
      const fields = []
      let number = 0
      let shift = 0
      for (const character of segment) {
        const code = alphabet.indexOf(character)
        requireMapping(code >= 0 && shift <= 30)
        number += (code & 31) * 2 ** shift
        if (code & 32) {
          shift += 5
          continue
        }
        fields.push(number % 2 ? -Math.floor(number / 2) : number / 2)
        number = shift = 0
      }
      requireMapping(shift === 0 && [1, 4, 5].includes(fields.length))
      column += fields[0]!
      requireMapping(column >= 0)
      if (fields.length === 1) continue
      source += fields[1]!
      sourceLine += fields[2]!
      sourceColumn += fields[3]!
      requireMapping(source >= 0 && sourceLine >= 0 && sourceColumn >= 0)
      yield [line, column, source, sourceLine, sourceColumn]
    }
  }
}

function* embeddedCoordinates(bytes: Buffer) {
  const expected = Number(bytes.readBigUInt64LE(8))
  const windows = bytes.readUInt32LE(24)
  const stream = bytes.readUInt32LE(28)
  requireMapping(Number(bytes.readBigUInt64LE(0)) === bytes.length && stream === 32 + 24 * windows &&
    stream < bytes.length && bytes.at(-1) === 0)
  let nextOffset = 0
  let total = 0
  for (let index = 0; index < windows; index++) {
    const sync = 32 + index * 24
    const start = stream + bytes.readUInt32LE(sync + 8)
    const end = index + 1 < windows ? stream + bytes.readUInt32LE(sync + 32) : bytes.length - 1
    requireMapping(start === stream + nextOffset && start + 32 <= end && end < bytes.length)
    nextOffset = end - stream
    const window = bytes.subarray(start, end)
    const count = window.readUInt8(0)
    const flags = window.readUInt8(1)
    requireMapping(count > 0 && count <= 64 && (flags & ~12) === 0)
    const lineMask = window.readBigUInt64LE(8)
    const sourceLineMask = window.readBigUInt64LE(16)
    const sourceColumnMask = window.readBigUInt64LE(24)
    const generatedColumns = 32 + window.readUInt16LE(2)
    const sourceLines = generatedColumns + window.readUInt16LE(4)
    const sourceColumns = sourceLines + window.readUInt16LE(6)
    requireMapping(sourceColumns <= window.length)
    const columns = createLane(window.subarray(32, generatedColumns))
    const lines = createLane(window.subarray(generatedColumns, sourceLines))
    const originals = createLane(window.subarray(sourceLines, sourceColumns))
    const tail = createLane(window.subarray(sourceColumns))
    const exceptions = new Map<number, number>()
    if (flags & 4) {
      for (let entry = tail.byte(); entry !== 255; entry = tail.byte()) {
        const delta = tail.signed()
        requireMapping(entry < count - 1 && delta > 1 && hasBit(lineMask, entry) && !exceptions.has(entry))
        exceptions.set(entry, delta)
      }
    }
    const sourceMask = flags & 8 ? tail.mask() : 0xffffffffffffffffn
    let line = bytes.readInt32LE(sync)
    let column = bytes.readInt32LE(sync + 4)
    let source = bytes.readInt32LE(sync + 20)
    let originalLine = bytes.readInt32LE(sync + 12)
    let originalColumn = bytes.readInt32LE(sync + 16)
    requireMapping(Math.min(line, column, source, originalLine, originalColumn) >= 0)
    yield [line, column, source, originalLine, originalColumn]
    for (let delta = 0; delta < count - 1; delta++) {
      const nextLine = exceptions.get(delta) ?? Number(hasBit(lineMask, delta))
      const nextColumn = columns.signed()
      line += nextLine
      column = nextLine ? nextColumn : column + nextColumn
      originalLine += hasBit(sourceLineMask, delta) ? nextLine : lines.signed()
      originalColumn += hasBit(sourceColumnMask, delta) ? nextColumn : originals.signed()
      if (!hasBit(sourceMask, delta)) source += tail.signed()
      requireMapping(Math.min(column, source, originalLine, originalColumn) >= 0)
      yield [line, column, source, originalLine, originalColumn]
    }
    requireMapping(columns.done() && lines.done() && originals.done() && tail.done())
    total += count
  }
  requireMapping(total === expected && stream + nextOffset === bytes.length - 1)
}

function createLane(bytes: Buffer) {
  let position = 0
  const byte = () => bytes.readUInt8(position++)
  return {
    byte,
    mask() {
      const value = bytes.readBigUInt64LE(position)
      position += 8
      return value
    },
    signed() {
      let number = 0
      for (let shift = 0; shift <= 28; shift += 7) {
        const value = byte()
        number += (value & 127) * 2 ** shift
        requireMapping(number <= 0xffffffff)
        if (!(value & 128)) return (number % 2 ? -Math.floor(number / 2) - 1 : number / 2)
      }
      throw new Error("CLI_COMPILE_SOURCE_MAP_VARINT_INVALID")
    },
    done: () => position === bytes.length,
  }
}

function hasBit(mask: bigint, index: number) {
  return (mask & (1n << BigInt(index))) !== 0n
}

function requireMapping(condition: boolean): asserts condition {
  if (!condition) throw new Error("CLI_COMPILE_SOURCE_MAP_COORDINATES_INVALID")
}
