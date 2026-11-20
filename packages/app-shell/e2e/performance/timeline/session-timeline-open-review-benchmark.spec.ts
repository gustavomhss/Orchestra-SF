import { benchmark, expect } from "../benchmark"
import { buildInitialStreamEvent, setupTimelineBenchmark } from "./session-timeline-benchmark.fixture"
import { createReviewDiffs } from "./timeline-test-helpers"
import { runTimelineStreamBenchmark, measureReviewPaneLoad, measureReviewNextFile } from "./session-timeline-benchmark.case"

benchmark.describe("performance: session timeline streaming", () => {
  benchmark("streams assistant text in v2 with review pane open", async ({ page, report }) => {
    benchmark.setTimeout(Number(process.env.TIMELINE_COMPLETION_TIMEOUT_MS ?? 420_000) + 60_000)
    const result = await runTimelineStreamBenchmark(page, { reviewPane: true })
    report(result.metrics, result.context)
  })
})

benchmark.describe("performance: review pane", () => {
  benchmark("loads v2 review diffs and switches active files", async ({ page, report }) => {
    benchmark.setTimeout(240_000)
    const historyTurns = Number(process.env.REVIEW_PANE_HISTORY_TURNS ?? 72)
    const diffs = createReviewDiffs()
    const fixture = await setupTimelineBenchmark(page, {
      historyTurns,
      eventBatch: 1,
      vcsDiff: diffs,
    })

    fixture.transport.enqueue(buildInitialStreamEvent(1))
    await expect(fixture.text).toBeVisible()
    await expect(fixture.text).toContainText("Implementation plan")
    await fixture.scrollToBottom()
    await fixture.waitForStableGeometry()

    const open = await measureReviewPaneLoad(page, diffs[0]!.file)
    const switches = []
    for (const diff of diffs.slice(1, 4)) switches.push(await measureReviewNextFile(page, diff.file))

    report(
      {
        open,
        switches,
      },
      {
        historyTurns,
        reviewDiffs: diffs.length,
      },
    )
  })
})
