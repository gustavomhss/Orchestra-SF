import type { Host } from "@orchestra/core/host"
import type { Location } from "@orchestra/core/location"
import type { Application } from "../../runtime/application.ts"
import type { SfScopedSourcePort } from "../integration/source-lifecycle.ts"

/** Root-owned functions, never a serialized request or a caller-provided identity. */
export type SfHostRuntime = {
  identity: () => Readonly<{ installationId: string; hostId: string; projectId: string; location: Location.Ref }> | undefined
  contributions: ReadonlyArray<Host.Contribution>
}
export type CreateSfHostRuntime = (input: {
  installationId: string
  directory: string
  sourceRoot: string
  origin: string
  mount: string
  persistence: Application["persistence"] & SfScopedSourcePort
  authenticate: Application["authenticate"]
  environment: Application["environment"]
}) => Promise<SfHostRuntime>
