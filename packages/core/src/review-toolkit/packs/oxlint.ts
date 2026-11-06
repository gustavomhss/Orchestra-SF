export * as ReviewPackOxlint from "./oxlint"

import { Effect } from "effect"
import pinned from "../../backend-toolkit/packs/oxlint"

export { prepare, argv, environment } from "./oxlint-input"
export { settle } from "./oxlint-result"

export const RULES = ["eslint(no-debugger)", "typescript(no-explicit-any)"] as const
export const manifest = pinned
export const templateId = "oxlint-host-sarif"
export const locate = Effect.fn("ReviewPackOxlint.locate")(function* () {
  return { absent: "oxlint adapter pending" }
})
