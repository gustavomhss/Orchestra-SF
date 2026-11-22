/** Private G08 consumer; original readNativeManifest remains strictly v2. */
import path from "node:path"
import { readPrivateNativeText, requireNativeInvocation } from "./readiness.ts"
import { serializeInstalledNativeManifest, validateInstalledNativeManifest } from "./g08-manifest-contract.ts"
import type { InstalledNativeManifest } from "./g08-manifest-contract.ts"

export async function readG08NativeManifest(): Promise<InstalledNativeManifest> {
  const file = process.env.SF_NATIVE_INSTALLED_MANIFEST
  if (!file || !path.isAbsolute(file)) throw new Error("F04_REAL_INSTALLED_MANIFEST_REQUIRED")
  const text = await readPrivateNativeText(path.dirname(file), file, 65_536)
  const manifest = validateInstalledNativeManifest(JSON.parse(text))
  if (text !== serializeInstalledNativeManifest(manifest) || manifest.scratchRoot !== path.dirname(file))
    throw new Error("F04_PRIVATE_MANIFEST_WRITER_CONTRACT_REQUIRED")
  requireNativeInvocation(manifest)
  return manifest
}
