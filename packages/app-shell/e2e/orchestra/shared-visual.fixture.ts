import { expect, type Page, type TestInfo } from "@playwright/test"
import { Board } from "@orchestra/schema/board"
import { CapabilityManagement } from "@orchestra/schema/capability-management"
import { Inbox } from "@orchestra/schema/inbox"
import { RagStudio } from "@orchestra/schema/rag-studio"
import { Schema } from "effect"
import { items } from "../../src/orchestra/chapters/inbox/fixture"
import { setupCompactNavigation } from "./compact-navigation.fixture"

export const sharedVisualVariants = [
  { name: "dark-wide", scheme: "dark", width: 1440, height: 1000 },
  { name: "light-wide", scheme: "light", width: 1440, height: 1000 },
  { name: "dark-narrow", scheme: "dark", width: 390, height: 844 },
  { name: "light-small", scheme: "light", width: 320, height: 900 },
] as const
export type SharedVisualVariant = (typeof sharedVisualVariants)[number]

const directory = "/work/compact-navigation"
const location = { directory, project: { id: "compact-project", directory } }

// Read-only examples from the existing Inbox design fixture, decoded through the
// wire schema. This does not enable ?preview=inbox or contact Teams/GitHub.
export const sharedInboxItems = Schema.decodeUnknownSync(Schema.Array(Inbox.Item))(
  items.filter((item) => item.id === "preview-teams-mention" || item.id === "preview-github-review"),
)

// The existing board.test.ts Launch example, completed against today's wire
// schema. It is synthetic component data, never a Maestro execution receipt.
export const sharedBoardTitle = "Issue 1 — Preserve the complete deployment and review history across projects — العربية עברית 日本語 — without truncating the original title"
const project = Schema.decodeUnknownSync(Board.Project)({
  id: "prj_launch", key: "LCH", name: "Launch", goal: "Ship the first public build",
  targetDate: null, budgetUsd: null, repoProjectID: null, githubRepo: null,
  status: "active", pausedReason: null, autoAcceptIntake: false,
  githubState: "signed_out", githubError: null, githubSyncedAt: null,
  reviewTier: null, reviewAcceptedUnavailable: [],
})
const forecast = Schema.decodeUnknownSync(Board.ProjectForecast)({
  shipped: 1, remaining: 3, targetDate: null,
  forecast: { kind: "insufficient", shipped: 1, needed: 5 },
})
const boardIssues = Schema.decodeUnknownSync(Schema.Array(Board.Issue))(
  ["backlog", "ready", "building", "shipped", "intake", "cut"].map((stage, index) => ({
    id: "iss_" + (index + 1), number: index + 1, ref: "LCH-" + (index + 1), epic: null,
    title: index === 0 ? sharedBoardTitle : "Issue " + (index + 1), body: "", type: "feature",
    stage, position: index + 1, estimate: null, seat: stage === "building" ? "backend" : null,
    sessionID: null, branch: null, prNumber: null, holdBeforeMerge: false, paused: false,
    stageEnteredAt: Date.parse("2026-11-13T12:00:00Z"), githubNumber: null, dependsOn: [],
    steps: stage === "building"
      ? [{ title: "Schema", status: "done", now: null }, { title: "Handlers", status: "active", now: "wiring the routes" }]
      : [],
  })),
)
const boardSummary = Schema.decodeUnknownSync(Board.Summary)({
  project, stages: { backlog: 1, ready: 1, building: 1, shipped: 1, intake: 1, cut: 1 },
  openQuestions: 0, health: "on_track", forecast,
})
const boardSnapshot = Schema.decodeUnknownSync(Board.Snapshot)({
  project, epics: [], issues: boardIssues, questions: [], cursor: null, forecast, epicForecasts: [], scope: [],
})
const boardPage = Schema.decodeUnknownSync(Board.IssuePage)({
  issue: boardIssues[0], questions: [], notes: [], attachments: [], activity: [],
  dependencies: { dependsOn: [], blocks: [] },
  trail: { state: "signed_out", message: "Sign in to GitHub to see this trail" },
})
export const sharedRagSources = Schema.decodeUnknownSync(Schema.Array(RagStudio.Source))([
  { id: "visual-cut-a", locationId: "compact-location", path: "/documents/first.txt", contentHash: "source-a", status: "read" },
  { id: "visual-cut-b", locationId: "compact-location", path: "/documents/second.txt", contentHash: "source-b", status: "read" },
])
const pipeline = Schema.decodeUnknownSync(RagStudio.Pipeline)({
  parser: "plain", boundary: "document", tokenizer: "utf16", lexical: true,
  embedding: false, embeddingModel: "", queryModel: "", dimension: 0,
  numericType: "float32", metric: "cosine", k: 4,
})
// "live" is the required wire literal. The screenshot receipt explicitly states
// that this response is intercepted; it is not live-provider qualification.
const connections = Schema.decodeUnknownSync(CapabilityManagement.ConnectionPage)({ items: [], coverage: "live" })

export async function setupSharedVisual(page: Page, variant: SharedVisualVariant) {
  await page.setViewportSize({ width: variant.width, height: variant.height })
  await setupCompactNavigation(page, { selected: true, scheme: variant.scheme })
  const state: {
    inbox: "ready" | "empty" | "error"
    connections: "ready" | "denied"
    rag: "ready" | "error"
    ragSources: readonly RagStudio.Source[]
    ragReadWait?: (path: string) => Promise<void>
    board: "ready" | "empty" | "error"
    reads: string[]
    writes: string[]
  } = { inbox: "ready", connections: "ready", rag: "ready", ragSources: [], board: "ready", reads: [], writes: [] }
  const headers = {
    "access-control-allow-origin": "*",
    "access-control-allow-methods": "GET, OPTIONS",
    "access-control-allow-headers": "*",
  }
  await page.route("**/api/**", async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    const path = url.pathname
    if (!/^\/api\/(?:inbox(?:\/|$)|capability\/(?:connections|targets)(?:\/|$)|rag-studio(?:\/|$)|board(?:\/|$))/.test(path))
      return route.fallback()
    if (request.method() === "OPTIONS") return route.fulfill({ status: 204, headers })
    if (request.method() !== "GET") {
      state.writes.push(request.method() + " " + path)
      return route.fulfill({ status: 405, headers, json: { message: "This component visual fixture permits reads only." } })
    }
    state.reads.push(path)
    if (path === "/api/inbox")
      return route.fulfill({ status: state.inbox === "error" ? 503 : 200, headers,
        json: state.inbox === "error" ? { message: "Inbox read unavailable in this visual case." }
          : { location, data: state.inbox === "empty" ? [] : sharedInboxItems } })
    if (path === "/api/capability/connections")
      return route.fulfill({ status: state.connections === "denied" ? 403 : 200, headers,
        json: state.connections === "denied" ? { _tag: "ForbiddenError", message: "Host authorization denied." } : connections })
    if (path === "/api/rag-studio/sources" || path === "/api/rag-studio/pipeline") {
      const failed = state.rag === "error", sources = state.ragSources
      await state.ragReadWait?.(path)
      return route.fulfill({ status: failed ? 503 : 200, headers,
        json: failed ? { message: "Rag Studio read unavailable in this visual case." }
          : { location, data: path.endsWith("/sources") ? sources : pipeline } })
    }
    const source = state.ragSources.find((item) => path === "/api/rag-studio/sources/" + item.id)
    if (source) {
      await state.ragReadWait?.(path)
      return route.fulfill({ headers, json: { location, data: Schema.decodeUnknownSync(RagStudio.SourceDetail)({
        source, text: source.id === "visual-cut-a" ? "First source original text." : "Second source original text.", chunks: [],
      }) } })
    }
    if (path === "/api/board")
      return route.fulfill({ status: state.board === "error" ? 503 : 200, headers,
        json: state.board === "error" ? { message: "Board read unavailable in this visual case." }
          : state.board === "empty" || url.searchParams.get("archived") === "true" ? [] : [boardSummary] })
    if (path === "/api/board/LCH") return route.fulfill({ headers, json: boardSnapshot })
    if (path === "/api/board/LCH/issue/1") return route.fulfill({ headers, json: boardPage })
    // Spend/proof/provider acquisition are not invented to fill a screenshot.
    return route.fulfill({ status: 404, headers, json: { _tag: "BoardNotFoundError", message: "Not supplied by this visual fixture." } })
  })
  return state
}

export async function captureSharedState(page: Page, info: TestInfo, variant: SharedVisualVariant,
  state: Awaited<ReturnType<typeof setupSharedVisual>>, surface: string, checkpoint: string, limits: string) {
  expect(info.config.metadata.bundle, "Screenshots must use the compiled production application").toBe("production")
  await expect(page.locator("html")).toHaveAttribute("data-color-scheme", variant.scheme)
  expect(state.writes, "Opening, inspecting and closing these surfaces must not send a mutation").toEqual([])
  await page.evaluate(() => document.fonts.ready.then(() => undefined))
  const name = surface + "-" + checkpoint + "-" + variant.name
  const path = info.outputPath(name + ".png")
  await page.screenshot({ path, animations: "disabled", fullPage: true })
  await info.attach(name, { path, contentType: "image/png" })
  await info.attach(name + "-source", { contentType: "application/json", body: JSON.stringify({
    classification: "component-visual", bundle: info.config.metadata.bundle, surface, checkpoint, variant,
    path: new URL(page.url()).pathname, fixture: "shared-visual.fixture.ts + compact-navigation.fixture.ts",
    syntheticReadResponses: true, originalProductionUI: true, backendQualified: false, liveProviderQualified: false,
    observedReads: [...new Set(state.reads)], observedWrites: state.writes, limits,
  }, null, 2) })
}
