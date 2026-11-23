import { batch } from "solid-js"
import { createStore } from "solid-js/store"

export type SourceStatus = "not_yet_read" | "read" | "failed"

// Shared so Maintain sees a file admitted in this sitting, and a pass can refresh the open cut.
export const [roster, setRoster] = createStore({
  status: "loading" as "loading" | "ready" | "error",
  sources: [] as Array<{ id: string; path: string; status: SourceStatus }>,
  openId: "",
  revision: 0,
  sourceRetry: 0,
  pipelineRetry: 0,
  embeddingModel: "",
  pipelineKnown: false,
  pipelineFailed: false,
})

export function statusKey(status: SourceStatus) {
  if (status === "read") return "orchestra.ragStudio.status.read" as const
  if (status === "failed") return "orchestra.ragStudio.status.failed" as const
  return "orchestra.ragStudio.status.not_yet_read" as const
}

export function statusTone(status: SourceStatus) {
  if (status === "read") return "good" as const
  if (status === "failed") return "bad" as const
  return undefined
}

export function touchRoster() {
  setRoster("revision", (value) => value + 1)
}

// Retry only the reads that failed; successful pipeline edits and unsent form input stay local.
export function retryReads() {
  batch(() => {
    if (roster.status === "error") {
      setRoster({ status: "loading", sourceRetry: roster.sourceRetry + 1 })
    }
    if (roster.pipelineFailed) {
      setRoster({ pipelineKnown: false, pipelineFailed: false, pipelineRetry: roster.pipelineRetry + 1 })
    }
  })
}
