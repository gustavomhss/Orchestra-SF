import { Schema } from "effect"
import type { SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import { SfIntelligenceAnalysisOutput } from "@orchestra/schema/sucafina/analyses"
import { SfAnalysisOutput } from "../../../../../../../packages/app-shell/src/orchestra/chapters/sucafina/decisions/analyses/output"
import { nativeBrowserConfig, renderNativeBrowser } from "../../native-ui-browser/client"

const config = nativeBrowserConfig()
if (!config || typeof config !== "object" || !("value" in config)) throw new Error("SF_IMPORT_OUTPUT_FIXTURE_MISSING")
const input = Schema.decodeUnknownSync(Schema.Struct({
  output: SfIntelligenceAnalysisOutput,
  owner: Schema.Struct({ serverKey: Schema.NonEmptyString, projectId: Schema.NonEmptyString, installationId: Schema.NonEmptyString }),
}))(config.value, { onExcessProperty: "error" })
if (input.output.status !== "ok") throw new Error("SF_IMPORT_OUTPUT_FIXTURE_REJECTED")
const output = input.output.value
// These are the real fixture's owner selectors; they do not grant authority.
const owner: SfOwnerSelection = { serverKey: input.owner.serverKey as SfServerKey,
  projectId: input.owner.projectId as SfRef, installationId: input.owner.installationId as SfRef }
renderNativeBrowser(() => <SfAnalysisOutput output={output} owner={owner} />)
