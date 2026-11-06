export * as ReviewPackZizmor from "./zizmor"

import { Effect } from "effect"
import pinned from "../../backend-toolkit/packs/zizmor"

export { RULES } from "./zizmor-rules"
export { prepare, argv, environment } from "./zizmor-input"
export { settle } from "./zizmor-result"

export const manifest = pinned
export const templateId = "zizmor-host-sarif"
export const locate = Effect.fn("ReviewPackZizmor.locate")(function* () {
  return { absent: "zizmor adapter pending" }
})
