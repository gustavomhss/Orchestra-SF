import { createHash } from "node:crypto"
import { readFile } from "node:fs/promises"
import path from "node:path"
import { pathToFileURL } from "node:url"

type PatchFile = { path: string; source_blob: string; preimage: string; preimage_sha256: string; postimage: string; postimage_sha256: string; postimage_blob: string }
type ComposedFile = { path: string; source_postimage_blob: string; source_postimage_sha256: string; postimage_blob: string; postimage_sha256: string }
type ReconciledFile = { path: string; previous_postimage_blob: string; installed_blob: string; installed_sha256: string }
const intake = path.resolve(import.meta.dir, "../../docs/sf2h/receipts/integration/final-intake-55")
const receipts = path.join(intake, "source-outputs/microsoft49/integration")
const repository = path.resolve(import.meta.dir, "../../../../..")

/** Qualify only the exact installed composition while retaining the original released artifact fences. */
export async function integrationModule<T>(target: string): Promise<T> {
  const manifestBytes = await readFile(path.join(receipts, "mission49-installation-manifest.json"))
  if (blob(manifestBytes) !== "89d033326a26ed4c0674a85a5e2ba86a2799d36e") throw new Error("Integration source manifest drift")
  const manifest = JSON.parse(manifestBytes.toString("utf8")) as { files: PatchFile[] }
  const entry = manifest.files.find((file) => file.path === target)
  if (!entry) throw new Error("Missing integration patch entry")
  const preimage = await readFile(path.join(receipts, entry.preimage))
  const postimage = await readFile(path.join(receipts, entry.postimage))
  const canonical = await readFile(path.join(repository, target))
  if (sha256(preimage) !== entry.preimage_sha256 || blob(preimage) !== entry.source_blob || sha256(postimage) !== entry.postimage_sha256 || blob(postimage) !== entry.postimage_blob) throw new Error("Integration artifact drift")
  const compositionBytes = await readFile(path.resolve(import.meta.dir, "../../docs/sf2h/receipts/http-body-limit-fix/composition/microsoft49-composition-74.json"))
  const composition = JSON.parse(compositionBytes.toString("utf8")) as { schema: string; source_release: string; source_manifest_blob: string; files: ComposedFile[] }
  if (composition.schema !== "sf2h.microsoft49-composition.v1" || composition.source_release !== "74ba5b7f71182e531049b8c56fe304c3bec4c3db" || composition.source_manifest_blob !== blob(manifestBytes) || !Array.isArray(composition.files) || composition.files.length !== manifest.files.length || new Set(composition.files.map((file) => file.path)).size !== manifest.files.length || composition.files.some((file) => !manifest.files.some((source) => source.path === file.path && source.postimage_blob === file.source_postimage_blob && source.postimage_sha256 === file.source_postimage_sha256))) throw new Error("Integration composition mapping drift")
  const installed = composition.files.find((file) => file.path === target)
  // Mission 74 is a historical composition, not a moving snapshot of the product.
  // Retain all released source/composition fences; qualify later canonical edits with
  // a separate, owner-reviewed, byte-pinned reconciliation instead of rewriting history.
  const reconciliation: { schema: string; source_manifest_blob: string; historical_composition_blob: string; baseline_commit: string; files: ReconciledFile[] } = JSON.parse(await readFile(path.join(import.meta.dir, "microsoft49-installed-reconciliation.json"), "utf8"))
  if (reconciliation.schema !== "sf2h.microsoft49-installed-reconciliation.v1" || reconciliation.source_manifest_blob !== blob(manifestBytes) || reconciliation.historical_composition_blob !== blob(compositionBytes) || reconciliation.baseline_commit !== "3b3e86b2a8181dadecbfe94e5ad30619bf9ce069" || !Array.isArray(reconciliation.files) || reconciliation.files.length !== composition.files.length || new Set(reconciliation.files.map((file) => file.path)).size !== composition.files.length || reconciliation.files.some((file) => !composition.files.some((source) => source.path === file.path && source.postimage_blob === file.previous_postimage_blob))) throw new Error("Integration reconciliation mapping drift")
  const current = reconciliation.files.find((file) => file.path === target)
  if (!installed || !current || blob(canonical) !== current.installed_blob || sha256(canonical) !== current.installed_sha256) throw new Error("Integration installed source drift requires owner reconciliation")
  // C20 CurrentChoice and other consumed contributions are part of these canonical bytes.
  // Never import a temporary source postimage in place of the installed composition.
  return import(pathToFileURL(path.join(repository, target)).href) as Promise<T>
}

/** Retained suite lifecycle export; the composed path creates no temporary modules. */
export async function removeIntegrationModules() {}

function sha256(bytes: Uint8Array) { return createHash("sha256").update(bytes).digest("hex") }
function blob(bytes: Uint8Array) { return createHash("sha1").update(`blob ${bytes.byteLength}\0`).update(bytes).digest("hex") }
