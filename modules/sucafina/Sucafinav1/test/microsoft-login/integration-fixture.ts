import { createHash, randomUUID } from "node:crypto"
import { readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

type PatchFile = { path: string; source_blob: string; preimage: string; preimage_sha256: string; postimage: string; postimage_sha256: string; postimage_blob: string }
const receipts = path.resolve(import.meta.dir, "../../docs/sf2h/receipts/microsoft-login/integration")
const repository = path.resolve(import.meta.dir, "../../../../..")
const temporary: string[] = []

/** Execute the exact proposed shared-file postimage without changing a canonical shared path. */
export async function integrationModule<T>(target: string): Promise<T> {
  const manifest = JSON.parse(await readFile(path.join(receipts, "mission49-installation-manifest.json"), "utf8")) as { files: PatchFile[] }
  const entry = manifest.files.find((file) => file.path === target)
  if (!entry) throw new Error("Missing integration patch entry")
  const preimage = await readFile(path.join(receipts, entry.preimage))
  const postimage = await readFile(path.join(receipts, entry.postimage))
  const canonical = await readFile(path.join(repository, target))
  if (sha256(preimage) !== entry.preimage_sha256 || blob(preimage) !== entry.source_blob || sha256(postimage) !== entry.postimage_sha256 || blob(postimage) !== entry.postimage_blob) throw new Error("Integration artifact drift")
  // After integration47 applies this exact patch, qualify the installed canonical module directly.
  if (canonical.equals(postimage)) return import(pathToFileURL(path.join(repository, target)).href) as Promise<T>
  if (!preimage.equals(canonical)) throw new Error("Integration source drift requires owner reconciliation")
  const file = path.join(path.dirname(path.join(repository, target)), `.microsoft49-${randomUUID()}.ts`)
  await writeFile(file, postimage, { flag: "wx", mode: 0o600 })
  temporary.push(file)
  return import(pathToFileURL(file).href) as Promise<T>
}

export async function removeIntegrationModules() {
  await Promise.all(temporary.splice(0).map((file) => rm(file, { force: true })))
}

function sha256(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex") }
function blob(bytes: Uint8Array) { return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex") }
