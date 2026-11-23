import { expect, test } from "bun:test"
import { chapterPageTitleKey, currentRoute } from "./layout-route"

test("parses Orchestra chapter routes without a server", () => {
  expect(currentRoute("/orchestra/mcp", "")).toEqual({ type: "chapter", chapter: "mcp" })
  expect(currentRoute("/orchestra/mcp/", "")).toEqual({ type: "chapter", chapter: "mcp" })
})

test("keeps views inside a chapter on that chapter", () => {
  expect(currentRoute("/orchestra/workflows/doc-1/executions/run-9", "")).toEqual({
    type: "chapter",
    chapter: "workflows",
  })
  expect(currentRoute("/orchestra/hooks/new", "")).toEqual({ type: "chapter", chapter: "hooks" })
})

test("keeps non-chapter shapes on their existing routes", () => {
  expect(currentRoute("/orchestra", "")).toEqual({ type: "home" })
  expect(currentRoute("/", "")).toEqual({ type: "home" })
  expect(currentRoute("/new-session", "?draftId=d1")).toEqual({ type: "draft", draftID: "d1" })
})

test("keeps a malformed server key on Home instead of throwing", () => {
  expect(currentRoute("/server/not-base64/session/s1", "")).toEqual({ type: "home" })
})

test("identifies native subpages independently of their chapter entry label", () => {
  const pages = [
    ["/orchestra/sf-home/search", "sf.ui31.title"],
    ["/orchestra/sf-home/context", "sf.ui67.title"],
    ["/orchestra/sf-home/administration", "sf.ui69.title"],
    ["/orchestra/sf-planner/capex", "sf.cap19.title"],
    ["/orchestra/sf-planner/versions/compare", "sf.u46.compare"],
    ["/orchestra/sf-procurement/suppliers", "sf.cap27.title"],
    ["/orchestra/sf-procurement/settings", "sf.cap28.title"],
    ["/orchestra/sf-imports/exports", "sf.ui68.title"],
  ] as const
  for (const [path, title] of pages) {
    expect(chapterPageTitleKey(path)).toBe(title)
    expect(chapterPageTitleKey(path + "?year=2026#details")).toBe(title)
    expect(currentRoute(path, "").type).toBe("chapter")
  }
})

test("does not infer a native title from invalid records or generic session paths", () => {
  expect(chapterPageTitleKey("/orchestra/sf-procurement/suppliers/not-an-encoded-ref")).toBeUndefined()
  expect(chapterPageTitleKey("/orchestra/sf-home/search/unknown")).toBeUndefined()
  expect(chapterPageTitleKey("/orchestra/workflows")).toBeUndefined()
  expect(chapterPageTitleKey("/new-session")).toBeUndefined()
  expect(chapterPageTitleKey("/")).toBeUndefined()
})
