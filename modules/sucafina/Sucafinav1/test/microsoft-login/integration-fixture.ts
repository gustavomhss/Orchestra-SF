import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

type PatchFile = { path: string; source_blob: string; preimage: string; preimage_sha256: string; postimage: string; postimage_sha256: string; postimage_blob: string }
const receipts = path.resolve(import.meta.dir, "../../docs/sf2h/receipts/integration/final-intake-55/source-outputs/microsoft49/integration")
const repository = path.resolve(import.meta.dir, "../../../../..")

/** Verify the archived integration evidence, then exercise the installed canonical module. */
export async function integrationModule<T>(target: string): Promise<T> {
  const manifest = JSON.parse(await readFile(path.join(receipts, "mission49-installation-manifest.json"), "utf8")) as { files: PatchFile[] }
  const entry = manifest.files.find((file) => file.path === target)
  if (!entry) throw new Error("Missing integration patch entry")
  const preimage = await readFile(path.join(receipts, entry.preimage))
  const postimage = await readFile(path.join(receipts, entry.postimage))
  if (sha256(preimage) !== entry.preimage_sha256 || blob(preimage) !== entry.source_blob || sha256(postimage) !== entry.postimage_sha256 || blob(postimage) !== entry.postimage_blob) throw new Error("Integration artifact drift")
  // The historical proposal has been integrated and evolved; qualify the current checkout.
  return import(pathToFileURL(path.join(repository, target)).href) as Promise<T>
}

function sha256(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex") }
function blob(bytes: Uint8Array) { return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex") }
