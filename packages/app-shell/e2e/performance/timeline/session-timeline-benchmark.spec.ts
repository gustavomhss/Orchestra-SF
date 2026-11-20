import { benchmark } from "../benchmark"
import { runTimelineStreamBenchmark } from "./session-timeline-benchmark.case"

benchmark.describe("performance: session timeline streaming", () => {
  benchmark("streams assistant text in v2 with review pane closed", async ({ page, report }) => {
    benchmark.setTimeout(Number(process.env.TIMELINE_COMPLETION_TIMEOUT_MS ?? 420_000) + 60_000)
    const result = await runTimelineStreamBenchmark(page, {})
    report(result.metrics, result.context)
  })

  benchmark("streams assistant text in v2 with review diffs and pane closed", async ({ page, report }) => {
    benchmark.setTimeout(Number(process.env.TIMELINE_COMPLETION_TIMEOUT_MS ?? 420_000) + 60_000)
    const result = await runTimelineStreamBenchmark(page, { reviewDiffs: true })
    report(result.metrics, result.context)
  })

})
