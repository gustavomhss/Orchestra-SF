import { Packer } from "docx"
import type { Document } from "docx"

/** The pinned docx compiler supplies OOXML files; ZIP STORE avoids JSZip's
 * async worker scheduler stalling inside Bun's HTTP request context.
 * Each entry is checksummed and the archive has a conventional central directory.
 */
export async function packPreservedDocx(document: Document): Promise<Uint8Array> {
  const compiler: unknown = Reflect.get(Packer, "compiler")
  if (!compiler || typeof compiler !== "object" || !("compile" in compiler) || typeof compiler.compile !== "function")
    throw new Error("DOCX compiler unavailable")
  const zip: unknown = compiler.compile(document)
  if (!zip || typeof zip !== "object" || !("files" in zip) || !zip.files || typeof zip.files !== "object")
    throw new Error("DOCX entries unavailable")

  const entries: { name: Uint8Array; bytes: Uint8Array; crc: number }[] = []
  let size = 0
  for (const [path, value] of Object.entries(zip.files)) {
    if (!value || typeof value !== "object" || !("dir" in value) || !("name" in value)) throw new Error("Invalid DOCX entry")
    if (value.dir) continue
    if (value.name !== path || !path || path.startsWith("/") || path.includes("\\") ||
        path.split("/").some((part) => part === ".." || part === "." || !part)) throw new Error("Invalid DOCX entry path")
    const data: unknown = "_data" in value ? await value._data : undefined
    const binary = "_dataBinary" in value && value._dataBinary === true
    const bytes = typeof data === "string" ? Buffer.from(data, binary ? "latin1" : "utf8")
      : data instanceof Uint8Array ? data : data instanceof ArrayBuffer ? new Uint8Array(data) : undefined
    if (!bytes) throw new Error("Unsupported DOCX entry data")
    const name = Buffer.from(path, "utf8")
    if (name.length > 0xffff || bytes.length > 0xffffffff) throw new Error("DOCX entry too large")
    size += 30 + name.length + bytes.length + 46 + name.length
    if (!Number.isSafeInteger(size) || size > 64 * 1024 * 1024) throw new Error("DOCX archive too large")
    entries.push({ name, bytes, crc: crc32(bytes) })
  }
  if (!entries.length || entries.length > 0xffff) throw new Error("Invalid DOCX entry count")
  const archive = Buffer.alloc(size + 22)
  const central: { entry: (typeof entries)[number]; offset: number }[] = []
  let offset = 0
  for (const entry of entries) {
    const start = offset
    archive.writeUInt32LE(0x04034b50, offset)
    archive.writeUInt16LE(20, offset + 4)
    archive.writeUInt16LE(0x0800, offset + 6)
    archive.writeUInt16LE(0, offset + 8)
    archive.writeUInt16LE(0, offset + 10)
    archive.writeUInt16LE(33, offset + 12)
    archive.writeUInt32LE(entry.crc, offset + 14)
    archive.writeUInt32LE(entry.bytes.length, offset + 18)
    archive.writeUInt32LE(entry.bytes.length, offset + 22)
    archive.writeUInt16LE(entry.name.length, offset + 26)
    archive.writeUInt16LE(0, offset + 28)
    offset += 30
    archive.set(entry.name, offset)
    offset += entry.name.length
    archive.set(entry.bytes, offset)
    offset += entry.bytes.length
    central.push({ entry, offset: start })
  }
  const centralStart = offset
  for (const { entry, offset: localOffset } of central) {
    archive.writeUInt32LE(0x02014b50, offset)
    archive.writeUInt16LE(20, offset + 4)
    archive.writeUInt16LE(20, offset + 6)
    archive.writeUInt16LE(0x0800, offset + 8)
    archive.writeUInt16LE(0, offset + 10)
    archive.writeUInt16LE(0, offset + 12)
    archive.writeUInt16LE(33, offset + 14)
    archive.writeUInt32LE(entry.crc, offset + 16)
    archive.writeUInt32LE(entry.bytes.length, offset + 20)
    archive.writeUInt32LE(entry.bytes.length, offset + 24)
    archive.writeUInt16LE(entry.name.length, offset + 28)
    archive.writeUInt16LE(0, offset + 30)
    archive.writeUInt16LE(0, offset + 32)
    archive.writeUInt16LE(0, offset + 34)
    archive.writeUInt16LE(0, offset + 36)
    archive.writeUInt32LE(0, offset + 38)
    archive.writeUInt32LE(localOffset, offset + 42)
    offset += 46
    archive.set(entry.name, offset)
    offset += entry.name.length
  }
  archive.writeUInt32LE(0x06054b50, offset)
  archive.writeUInt16LE(0, offset + 4)
  archive.writeUInt16LE(0, offset + 6)
  archive.writeUInt16LE(entries.length, offset + 8)
  archive.writeUInt16LE(entries.length, offset + 10)
  archive.writeUInt32LE(offset - centralStart, offset + 12)
  archive.writeUInt32LE(centralStart, offset + 16)
  archive.writeUInt16LE(0, offset + 20)
  if (offset + 22 !== archive.length) throw new Error("DOCX central directory size mismatch")
  return archive
}

const crcTable = Uint32Array.from({ length: 256 }, (_, byte) => {
  let crc = byte
  for (let i = 0; i < 8; i++) crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1
  return crc >>> 0
})

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff
  for (const byte of bytes) crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]!
  return (crc ^ 0xffffffff) >>> 0
}
