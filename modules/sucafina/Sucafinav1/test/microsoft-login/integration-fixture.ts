import { createHash, randomUUID } from "node:crypto"
import { readFile, rm, writeFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

type PatchFile = { path: string; source_blob: string; preimage: string; preimage_sha256: string; postimage: string; postimage_sha256: string; postimage_blob: string }
const receiptCandidates = [
  path.resolve(import.meta.dir, "../../docs/sf2h/receipts/microsoft-login/integration"),
  path.resolve(import.meta.dir, "../../docs/sf2h/receipts/integration/final-intake-55/source-outputs/microsoft49/integration"),
]
const repository = path.resolve(import.meta.dir, "../../../../..")
const temporary: string[] = []

/** Execute the exact proposed shared-file postimage without changing a canonical shared path. */
export async function integrationModule<T>(target: string): Promise<T> {
  const receipts = await receiptDirectory()
  const manifest = JSON.parse(await readFile(path.join(receipts, "mission49-installation-manifest.json"), "utf8")) as { files: PatchFile[] }
  const entry = manifest.files.find((file) => file.path === target)
  if (!entry) throw new Error("Missing integration patch entry")
  const preimage = await readFile(path.join(receipts, entry.preimage))
  const postimage = await readFile(path.join(receipts, entry.postimage))
  const canonical = await readFile(path.join(repository, target))
  if (sha256(preimage) !== entry.preimage_sha256 || blob(preimage) !== entry.source_blob || sha256(postimage) !== entry.postimage_sha256 || blob(postimage) !== entry.postimage_blob) throw new Error("Integration artifact drift")
  // After integration47 applies this exact patch, qualify the installed canonical module directly.
  if (canonical.equals(postimage) || !preimage.equals(canonical)) return import(pathToFileURL(path.join(repository, target)).href) as Promise<T>
  const file = path.join(path.dirname(path.join(repository, target)), `.microsoft49-${randomUUID()}.ts`)
  await writeFile(file, postimage, { flag: "wx", mode: 0o600 })
  temporary.push(file)
  return import(pathToFileURL(file).href) as Promise<T>
}

async function receiptDirectory() {
  for (const directory of receiptCandidates) {
    try {
      await readFile(path.join(directory, "mission49-installation-manifest.json"))
      return directory
    } catch (error) {
      if (!(error instanceof Error) || !("code" in error) || error.code !== "ENOENT") throw error
    }
  }
  throw new Error("Missing mission49 installation receipt")
}

export async function removeIntegrationModules() {
  await Promise.all(temporary.splice(0).map((file) => rm(file, { force: true })))
}

function sha256(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex") }
function blob(bytes: Uint8Array) { return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex") }
