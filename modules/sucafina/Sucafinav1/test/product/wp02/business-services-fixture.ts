import path from "node:path"
import atlasPackage from "../../../../../atlas/boundary/package.json" with { type: "json" }
import contractFreeze from "../../../product/contracts/freeze-v1.json" with { type: "json" }
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { createResidentAiBundle } from "../../../product/ai/resident.ts"
import { createSfBusinessServices } from "../../../../../../apps/cli/src/sucafina-product/business-services.ts"

/** Real BusinessContext/case/scenario ports; no scanner or native inference claim. */
export async function createFixtureBusiness(input: Parameters<typeof createSfBusinessServices>[0]) {
  const business = createSfBusinessServices(input)
  try {
    const root = path.resolve(import.meta.dir, "../../../product/ai")
    const bundle = await createResidentAiBundle({ root, manifestPath: path.join(root, "manifests/resident.json") })
    business.initializeAtlas(undefined, {
      boundaryVersion: atlasPackage.version,
      schemaVersion: contractFreeze.canonicalSha256,
      manifestVersion: bundle.manifestDigest,
      skillVersion: digestSfValue(bundle.skills.map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))),
    })
    return business
  } catch (error) { business.dispose(); throw error }
}
