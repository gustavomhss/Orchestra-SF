import { createHash } from "node:crypto"
import { mkdir } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"

export const exportEvidenceDirectory = join(process.env.RUNNER_TEMP ?? tmpdir(), "sf66-export-artifacts")

/** Synthetic test corpus only. The file and digest describe the exact generated
 * bytes consumed by the test, for a separate hosted reader/rendering job. */
export async function recordExportEvidence(input: { caseId: string; name: string; mediaType: string; bytes: Uint8Array; observations: Record<string, unknown> }) {
  if (!/^[a-z0-9-]+$/.test(input.caseId) || !input.name || /[/\\\0\r\n]/.test(input.name)) throw new Error("Invalid export evidence name")
  await mkdir(exportEvidenceDirectory, { recursive: true, mode: 0o700 })
  const file_name = `${input.caseId}-${input.name}`
  const manifest = { case_id: input.caseId, file_name, format: input.name.split(".").at(-1)?.toLowerCase(), media_type: input.mediaType,
    sha256: createHash("sha256").update(input.bytes).digest("hex"), byte_count: input.bytes.length, observations: input.observations }
  await Bun.write(join(exportEvidenceDirectory, file_name), input.bytes)
  await Bun.write(join(exportEvidenceDirectory, `${input.caseId}.manifest.json`), JSON.stringify(manifest, null, 2) + "\n")
  console.log("SF66_EXPORT_EVIDENCE " + JSON.stringify(manifest))
  const encoded = Buffer.from(input.bytes).toString("base64")
  const size = 12_000
  const total = Math.ceil(encoded.length / size)
  for (let index = 0; index < total; index++) console.log("SF66_EXPORT_BYTES " + JSON.stringify({ case_id: input.caseId, format: manifest.format,
    sha256: manifest.sha256, index, total, data: encoded.slice(index * size, (index + 1) * size) }))
  return manifest
}
