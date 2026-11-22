import { expect, test } from "bun:test"
import { solidDom } from "../real-ui-solid"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type {
  SfRelationsProps, SfThreadProps, SfQuestionProps, SfConfirmationProps, SfMessage,
} from "@/orchestra/chapters/sucafina/collaboration/types"

// COMPONENT-LEVEL FIXTURES ONLY. The installed A13 producer, F01 auth and C06
// receipts are NOT proven by this suite. Run only via 120 GitHub Actions after
// 114 composes the real F01/F03/i18n dependencies.
const { createComponent }: typeof import("solid-js") = await import("solid-js")
const { createStore }: typeof import("solid-js/store") = await import("solid-js/store")
const { render }: typeof import("solid-js/web") = await import("solid-js/web")
const { withBrowserPlatform } = await import("./platform-fixture")
const { LanguageProvider }: typeof import("@/context/language") = await import(solidDom("@/context/language", import.meta.dir))
const {
  SfRelations, SfThread, SfQuestion, SfConfirmation,
}: typeof import("@/orchestra/chapters/sucafina/collaboration") =
  await import(solidDom("@/orchestra/chapters/sucafina/collaboration", import.meta.dir))

const ref = (value: string) => value as SfRef
const data = (text: string) => ({ kind: "data" as const, text })
const message = (key: string): SfMessage => ({ key: key as SfMessage["key"] })

function mount<Props extends object>(Component: (props: Props) => import("solid-js").JSX.Element, initial: Props) {
  const [props, set] = createStore(initial)
  const host = document.createElement("div")
  document.body.append(host)
  const dispose = render(() => withBrowserPlatform(() => createComponent(LanguageProvider, {
    locale: "en",
    get children() {
      return createComponent(Component, props as Props)
    },
  })), host)
  const button = (label: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(
    (item) => item.textContent?.trim() === label,
  )!
  return { props, set, host, button, close: () => { dispose(); host.remove() } }
}

function change(select: HTMLSelectElement, value: string) {
  select.value = value
  select.dispatchEvent(new Event("change", { bubbles: true }))
}

test("S05 relations use original source/target/kind and a CAS remove, never infer case from a label", () => {
  const created: Parameters<SfRelationsProps["onCreate"]>[0][] = []
  const removed: Parameters<SfRelationsProps["onRemove"]>[0][] = []
  const opened: SfRef[] = []
  const searched: string[] = []
  const props: SfRelationsProps = {
    sourceRef: ref("source-001"),
    state: "ready",
    relations: [{
      ref: ref("relation-001"), sourceRef: ref("source-001"), targetRef: ref("target-existing"),
      kind: "depends-on", sourceLabel: data("Source A"), targetLabel: data("Confidential target B"),
      caseRef: ref("optional-case"), version: 4, canRemove: true,
    }],
    candidates: [
      { ref: ref("target-001"), kind: "request", label: data("Same Name"),
        allowedRelationKinds: [{ id: "depends-on", label: message("sf.s05.relations.kind") }] },
      { ref: ref("target-002"), kind: "request", label: data("Same Name"),
        allowedRelationKinds: [{ id: "follows", label: message("sf.s05.relations.kind") }] },
    ],
    onSearchTargets: (query) => searched.push(query),
    onCreate: (request) => created.push(request),
    onRemove: (request) => removed.push(request),
    onOpen: (recordRef) => opened.push(recordRef),
  }
  const view = mount(SfRelations, props)
  try {
    expect(created).toHaveLength(0)
    expect(removed).toHaveLength(0)
    const search = view.host.querySelector<HTMLInputElement>('input[type="search"]')!
    search.value = "same"
    search.dispatchEvent(new Event("input", { bubbles: true }))
    expect(searched).toEqual(["same"])
    const fields = view.host.querySelectorAll<HTMLSelectElement>("select")
    change(fields[0]!, "target-002")
    change(fields[1]!, "follows")
    view.button("Link record").click()
    view.button("Link record").click()
    expect(created).toEqual([{ sourceRef: ref("source-001"), targetRef: ref("target-002"), kind: "follows" }])
    view.button("Open related record").click()
    expect(opened).toEqual([ref("target-existing")])
    view.button("Remove relationship").click()
    view.button("Remove relationship").click()
    expect(removed).toEqual([{ relationRef: ref("relation-001"), expectedVersion: 4 }])
    view.set("state", "denied")
    expect(view.host.textContent).not.toContain("Confidential target B")
    expect(view.host.querySelector("textarea")).toBeNull()
    expect(view.host.querySelectorAll("button")).toHaveLength(0)
  } finally {
    view.close()
  }
})

test("S05 relationships refuse a stale target selection after source changes", () => {
  const writes: unknown[] = []
  const view = mount(SfRelations, {
    sourceRef: ref("A"), state: "ready" as const, relations: [] as SfRelationsProps["relations"],
    candidates: [{ ref: ref("T"), kind: "work", label: data("T"),
      allowedRelationKinds: [{ id: "connect", label: message("sf.s05.relations.kind") }] }],
    onSearchTargets() {}, onCreate: (request: Parameters<SfRelationsProps["onCreate"]>[0]) => writes.push(request),
    onRemove() {}, onOpen() {},
  })
  try {
    const selects = view.host.querySelectorAll<HTMLSelectElement>("select")
    change(selects[0]!, "T")
    change(selects[1]!, "connect")
    view.set("sourceRef", ref("B"))
    expect(view.button("Link record").disabled).toBe(true)
    expect(writes).toHaveLength(0)
  } finally {
    view.close()
  }
})

test("S05 thread preserves exact content, incarnation and version; unknown outcome only reconciles", () => {
  const posts: Parameters<SfThreadProps["onPost"]>[0][] = []
  const reads: SfRef[] = []
  const edits: string[] = []
  const opened: string[] = []
  const view = mount(SfThread, {
    threadRef: ref("thread-1"), incarnation: "incarnation-canonical", version: 7,
    messages: [{
      ref: ref("message-one"), incarnation: "message-incarnation", version: 1,
      author: data("Approved author"), createdAt: "2026-11-15T14:00:00.000Z",
      text: "Private discussion body", sourceRefs: [ref("original-source")],
    }], draft: "  Keep whitespace  ", state: "ready" as SfThreadProps["state"],
    onEditDraft: (value: string) => edits.push(value),
    onPost: (request: Parameters<SfThreadProps["onPost"]>[0]) => posts.push(request),
    onReconcileRead: (threadRef: SfRef) => reads.push(threadRef),
    onOpenOrigin: () => opened.push("origin"),
  })
  try {
    expect(posts).toHaveLength(0)
    expect(view.host.textContent).toContain("Private discussion body")
    view.button("Open originating record").click()
    expect(opened).toEqual(["origin"])
    const editor = view.host.querySelector<HTMLTextAreaElement>("textarea")!
    editor.value = "new comment"
    editor.dispatchEvent(new Event("input", { bubbles: true }))
    expect(edits).toEqual(["new comment"])
    view.button("Post comment").click()
    view.button("Post comment").click()
    expect(posts).toEqual([{
      threadRef: ref("thread-1"), incarnation: "incarnation-canonical",
      expectedVersion: 7, text: "  Keep whitespace  ",
    }])
    view.set("state", "outcome-unknown")
    expect(view.button("Post comment").disabled).toBe(true)
    view.button("Check the original outcome").click()
    expect(reads).toEqual([ref("thread-1")])
    view.set("state", "unavailable")
    expect(view.host.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("  Keep whitespace  ")
    view.set("state", "denied")
    expect(view.host.textContent).not.toContain("Private discussion body")
    expect(view.host.textContent).not.toContain("Keep whitespace")
    expect(view.host.querySelector("textarea")).toBeNull()

    // New owner binding must not inherit the old DOM value or the old post fence.
    view.set("messages", [])
    view.set("threadRef", ref("thread-next"))
    view.set("incarnation", "incarnation-next")
    view.set("version", 9)
    view.set("draft", "  Next owner\r\nstill exact  ")
    view.set("state", "ready")
    expect(view.host.textContent).not.toContain("Private discussion body")
    const ownerDisplay = view.host.querySelector<HTMLTextAreaElement>("textarea")!.value
    // Byte-level assertion distinguishes LF (0a) from hidden CRLF (0d 0a) in Bun diffs.
    expect([...new TextEncoder().encode(ownerDisplay)]).toEqual([
      ...new TextEncoder().encode("  Next owner\nstill exact  "),
    ])
    expect(ownerDisplay).toBe("  Next owner\nstill exact  ")
    expect(edits).toEqual(["new comment"]) // changing owner cannot synthesize an edit
    expect(posts).toHaveLength(1) // changing owner cannot replay a POST
    view.button("Post comment").click()
    expect(posts).toEqual([
      { threadRef: ref("thread-1"), incarnation: "incarnation-canonical", expectedVersion: 7, text: "  Keep whitespace  " },
      { threadRef: ref("thread-next"), incarnation: "incarnation-next", expectedVersion: 9,
        text: "  Next owner\r\nstill exact  " },
    ])
    expect([...new TextEncoder().encode(posts[1]!.text)]).toEqual([
      ...new TextEncoder().encode("  Next owner\r\nstill exact  "),
    ])
  } finally {
    view.close()
  }
})

test("S05 question uses authorized recipient ref and preserves source refs on draft changes", () => {
  const prepares: Parameters<SfQuestionProps["onPrepare"]>[0][] = []
  const edits: Parameters<SfQuestionProps["onEditQuestion"]>[0][] = []
  const submitted: string[] = []
  const answered: Parameters<SfQuestionProps["onAnswer"]>[0][] = []
  const opened: SfRef[] = []
  const view = mount<SfQuestionProps>(SfQuestion, {
    questionRef: ref("q1"), sourceRef: ref("source-1"),
    recipientOptions: [
      { ref: ref("recipient-allowed"), label: data("Alex"), available: true },
      { ref: ref("recipient-denied"), label: data("Alex"), available: false },
    ],
    question: { text: "Please review source?", recipientRef: ref("recipient-allowed"), sourceRefs: [ref("source-1")] },
    state: "ready" as SfQuestionProps["state"],
    onEditQuestion: (draft: Parameters<SfQuestionProps["onEditQuestion"]>[0]) => edits.push(draft),
    onPrepare: (draft: Parameters<SfQuestionProps["onPrepare"]>[0]) => prepares.push(draft),
    onSubmit: () => submitted.push("submit"),
    onAnswer: (request: Parameters<SfQuestionProps["onAnswer"]>[0]) => answered.push(request),
    onOpen: (questionRef: SfRef) => opened.push(questionRef),
  })
  try {
    expect(view.host.querySelector('option[value="recipient-denied"]')).toBeNull()
    view.button("Open question").click()
    expect(opened).toEqual([ref("q1")])
    const question = view.host.querySelector<HTMLTextAreaElement>('textarea[id$="-text"]')!
    question.value = "Edited question"
    question.dispatchEvent(new Event("input", { bubbles: true }))
    expect(edits).toEqual([{
      text: "Edited question", recipientRef: ref("recipient-allowed"), sourceRefs: [ref("source-1")],
    }])
    view.button("Prepare question").click()
    expect(prepares).toEqual([{ text: "Please review source?", recipientRef: ref("recipient-allowed"), sourceRefs: [ref("source-1")] }])
    view.button("Submit prepared question").click()
    expect(submitted).toEqual(["submit"]) // only a consumer callback, not an installed send
    const answer = view.host.querySelector<HTMLTextAreaElement>('textarea[id$="-answer"]')!
    answer.value = "Real author response"
    answer.dispatchEvent(new Event("input", { bubbles: true }))
    view.button("Submit answer").click()
    expect(answered).toEqual([{ questionRef: ref("q1"), text: "Real author response" }])
    view.set("answer", { ref: ref("a1"), version: 8, text: "Recorded answer", author: data("Alex") })
    expect(view.host.textContent).toContain("Recorded answer")
    expect(view.host.querySelector('textarea[id$="-answer"]')).toBeNull()
    view.set("state", "denied")
    expect(view.host.textContent).not.toContain("Please review source?")
    expect(view.host.textContent).not.toContain("Recorded answer")
  } finally {
    view.close()
  }
})

test("S05 confirmation is scoped to the material version and never approves partial or revoked coverage", () => {
  const confirmed: Parameters<SfConfirmationProps["onConfirm"]>[0][] = []
  const revalidated: SfRef[] = []
  const view = mount(SfConfirmation, {
    selectionRef: ref("January-material"), materialVersion: 18,
    status: "stale" as SfConfirmationProps["status"],
    coverage: { state: "partial" as SfConfirmationProps["coverage"]["state"],
      summary: message("sf.common.partial"), reasons: [message("sf.common.unavailable")],
      knownCount: 1, expectedCount: 2 },
    state: "ready" as SfConfirmationProps["state"],
    onConfirm: (request: Parameters<SfConfirmationProps["onConfirm"]>[0]) => confirmed.push(request),
    onRevalidate: (selectionRef: SfRef) => revalidated.push(selectionRef),
  })
  try {
    expect(view.button("Confirm no change").disabled).toBe(true)
    view.button("Check current material").click()
    expect(revalidated).toEqual([ref("January-material")])
    view.set("status", "current")
    expect(view.button("Confirm no change").disabled).toBe(true)
    view.set("coverage", { state: "complete", summary: message("sf.common.saved"),
      reasons: [], knownCount: 2, expectedCount: 2 })
    view.button("Confirm no change").click()
    view.button("Confirm no change").click()
    expect(confirmed).toEqual([{ selectionRef: ref("January-material"), materialVersion: 18 }])
    view.set("materialVersion", 19)
    view.button("Confirm no change").click()
    expect(confirmed).toEqual([
      { selectionRef: ref("January-material"), materialVersion: 18 },
      { selectionRef: ref("January-material"), materialVersion: 19 },
    ])
    view.set("status", "revoked")
    expect(view.host.textContent).not.toContain("January-material")
    expect(view.host.querySelector("dl")).toBeNull()
    expect(view.host.querySelector('button:not(:disabled)')).toBeNull()
  } finally {
    view.close()
  }
})
