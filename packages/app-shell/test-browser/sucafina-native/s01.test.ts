import { expect, test } from "bun:test"
import path from "node:path"
import type { SfRef } from "../../src/orchestra/chapters/sucafina/context/contracts"
import type {
  SfColumn, SfDataTableProps, SfLayoutMode, SfPage, SfSort, SfUiState,
} from "../../src/orchestra/chapters/sucafina/shared/table/contracts"

async function runBrowserLane() {
  const process = Bun.spawn(
    [Bun.which("bun")!, "--conditions=browser", "test", "--preload", "./happydom.ts", import.meta.path],
    {
      cwd: path.resolve(import.meta.dir, "../.."),
      env: { ...Bun.env, SF_S01_DOM: "1" },
      stdout: "pipe",
      stderr: "pipe",
      timeout: 180000,
      killSignal: "SIGKILL",
    },
  )
  const [out, err, code] = await Promise.all([
    new Response(process.stdout).text(), new Response(process.stderr).text(), process.exited,
  ])
  if (code !== 0) throw new Error("S01 browser lane failed: " + String(code) + "\n" + out + "\n" + err)
}

if (process.env.SF_S01_DOM !== "1") {
  test("S01 authorized components in the Orchestra browser lane", runBrowserLane, 240000)
} else {
  const { createComponent, createStore, render } = await import("../lean-dom.test-helper")
  const { solidDom } = await import("../solid-dom")
  const { LanguageProvider }: typeof import("@/context/language") = await import(
    solidDom("@/context/language", import.meta.dir),
  )
  const { SfDataTable }: typeof import("@/orchestra/chapters/sucafina/shared/table") = await import(
    solidDom("@/orchestra/chapters/sucafina/shared/table", import.meta.dir),
  )
  const { SfListDetail, SfRecordDetail }: typeof import("@/orchestra/chapters/sucafina/shared/detail") = await import(
    solidDom("@/orchestra/chapters/sucafina/shared/detail", import.meta.dir),
  )

  type RecordRow = { ref: SfRef; label: string; count: number }
  const record = (ref: string, label: string, count: number): RecordRow => ({
    ref: ref as SfRef, label, count,
  })
  const original = [record("ref-a", "Equal title", 0), record("ref-b", "Equal title", 12)]
  const key = (key: string) => key as SfColumn<RecordRow>["labelKey"]

  function fixture(composed = false) {
    const events: string[] = []
    const [state, update] = createStore({
      rows: original,
      selectedKey: undefined as SfRef | undefined,
      ui: "ready" as SfUiState,
      sort: { kind: "none" } as SfSort,
      page: { kind: "offset", index: 0, size: 2, total: null } as SfPage,
      layoutMode: "single" as SfLayoutMode,
      disabledAction: true,
    })
    const columns: readonly SfColumn<RecordRow>[] = [
      { id: "label", labelKey: key("sf.s01.listLabel"), align: "start", widthPolicy: { kind: "flex", minPx: 120, weight: 1 },
        sortKey: "name", render: (row) => row.label },
      { id: "count", labelKey: key("sf.s01.countLabel"), align: "end", widthPolicy: { kind: "fixed", px: 120 },
        render: (row) => String(row.count) },
    ]
    const table: SfDataTableProps<RecordRow> = {
      get rows() { return state.rows },
      get selectedKey() { return state.selectedKey },
      get sort() { return state.sort },
      get page() { return state.page },
      get state() { return state.ui },
      density: "comfortable",
      getRowKey: (row) => row.ref,
      columns,
      captionKey: key("sf.s01.listLabel"),
      rowActions: () => [{ id: "approve", labelKey: key("sf.common.approve"), tone: "secondary",
        disabled: state.disabledAction, busy: false }],
      onSort(sort) { events.push("sort:" + (sort.kind === "field" ? sort.direction : "none")); update("sort", sort) },
      onPage(page) {
        events.push("page:" + (page.kind === "offset" ? page.index : page.direction))
        if (page.kind === "offset") update("page", { kind: "offset", index: page.index, size: 2, total: null })
      },
      onSelect(ref) { events.push("select:" + ref); update("selectedKey", ref) },
      onRowAction(value) { events.push("action:" + value.recordRef + ":" + value.actionId) },
    }
    const host = document.createElement("div")
    document.body.appendChild(host)
    const list = () => createComponent(SfDataTable<RecordRow>, table)
    const detail = () => createComponent(SfRecordDetail, {
      get title() { return { kind: "data", text: state.selectedKey ?? "" } as const },
      status: { code: "current", text: { kind: "data", text: "Approved by producer" }, tone: "success" },
      metadata: [{
        id: "record-count",
        label: { key: key("sf.s01.countLabel") },
        value: { kind: "number", value: 0, unit: { kind: "quantity", label: { key: key("sf.s01.listLabel") } }, fractionDigits: 0 },
      }],
      sections: [
        { id: "allowed", titleKey: key("sf.s01.detailLabel"), content: "Authorized section", state: "ready" },
        { id: "blocked", titleKey: key("sf.s01.rowActions"), content: "PRIVATE DENIED SECTION", state: "denied" },
      ],
      primaryAction: { id: "do-write", labelKey: key("sf.common.save"), tone: "primary", disabled: false, busy: false,
        onInvoke() { events.push("detail:write") } },
      secondaryActions: [],
      sourceActions: [],
      onBack() { events.push("back"); update("selectedKey", undefined) },
      onOpenPage() { events.push("open-page") },
    })
    const component = () => composed
      ? createComponent(SfListDetail, {
          get selectedRef() { return state.selectedKey },
          get layoutMode() { return state.layoutMode },
          get list() { return list() },
          get detail() { return detail() },
          onBack() { events.push("back"); update("selectedKey", undefined) },
          onOpenPage() { events.push("open-page") },
        })
      : list()
    const dispose = render(() => createComponent(LanguageProvider, {
      locale: "en",
      get children() { return component() },
    }), host)
    return { host, events, state, update, done: () => (dispose(), host.remove()) }
  }

  test("table uses opaque row identity, native semantics, controlled sort/page and explicit gestures", () => {
    const view = fixture()
    try {
      expect(view.events).toEqual([])
      expect(view.host.querySelector("table caption")?.textContent).toBe("Records")
      expect(view.host.querySelectorAll('th[scope="col"]')).toHaveLength(3)
      expect(view.host.querySelector('[role="grid"]')).toBeNull()
      expect([...view.host.querySelectorAll("tbody tr")].map((row) => row.getAttribute("data-sf-row"))).toEqual([
        "ref-a", "ref-b",
      ])
      expect(view.host.querySelector("tbody tr")?.textContent).toContain("0")
      expect(view.host.textContent).toContain("Total unavailable")
      expect(view.host.querySelector<HTMLButtonElement>('button[data-sf-action="approve"]')?.disabled).toBe(true)
      view.host.querySelector<HTMLButtonElement>(".sf-s01-sort")!.click()
      expect(view.events).toEqual(["sort:asc"])
      expect(view.host.querySelector("th[aria-sort=ascending]")).not.toBeNull()
      view.host.querySelector<HTMLButtonElement>(".sf-s01-sort")!.click()
      expect(view.events).toContain("sort:desc")
      view.host.querySelector<HTMLButtonElement>('.sf-s01-pagination button:last-child')!.click()
      expect(view.events).toContain("page:1")
      view.host.querySelectorAll<HTMLButtonElement>('button[data-sf-action="select"]')[1].click()
      expect(view.events).toContain("select:ref-b")
      expect(view.events.some((event) => event.startsWith("action:"))).toBe(false)
      view.update("disabledAction", false)
      view.update("ui", "conflict")
      expect(view.host.querySelector<HTMLButtonElement>('button[data-sf-action="approve"]')?.disabled).toBe(true)
      view.update("ui", "ready")
      view.host.querySelector<HTMLButtonElement>('button[data-sf-action="approve"]')!.click()
      expect(view.events).toContain("action:ref-a:approve")
      view.update("rows", [...original.map((row) => ({ ...row }))])
      expect(view.host.querySelector('tr[data-sf-row="ref-b"]')?.getAttribute("aria-selected")).toBe("true")
    } finally { view.done() }
  })

  test("single detail retains same-owner list, filter DOM, scroll and returns focus to the same ref", async () => {
    const view = fixture(true)
    try {
      const list = view.host.querySelector<HTMLElement>(".sf-s01-list-pane")!
      const scroller = list.querySelector<HTMLElement>(".sf-s01-table-scroll")!
      scroller.scrollTop = 36
      scroller.dispatchEvent(new Event("scroll", { bubbles: true }))
      const trigger = list.querySelectorAll<HTMLButtonElement>('button[data-sf-action="select"]')[1]
      trigger.focus()
      trigger.click()
      await Promise.resolve()
      expect(view.state.selectedKey).toBe("ref-b")
      expect(list.hidden).toBe(true)
      expect(view.host.querySelector(".sf-s01-record-detail h2")?.textContent).toBe("ref-b")
      expect(view.host.textContent).toContain("0")
      expect(view.host.textContent).not.toContain("PRIVATE DENIED SECTION")
      const detail = view.host.querySelector<HTMLElement>(".sf-s01-detail-pane")!
      detail.querySelector<HTMLButtonElement>(".sf-s01-detail-navigation button")!.click()
      await Promise.resolve()
      expect(view.state.selectedKey).toBeUndefined()
      expect(list.hidden).toBe(false)
      expect(scroller.scrollTop).toBe(36)
      expect(document.activeElement?.closest("tr")?.getAttribute("data-sf-row")).toBe("ref-b")
      expect(view.events.filter((event) => event === "back")).toHaveLength(1)
      expect(view.events.filter((event) => event === "detail:write")).toHaveLength(0)
    } finally { view.done() }
  })

  test("filtered-empty differs from empty, and denied/session-expired never leave private rows in the DOM", () => {
    const view = fixture()
    try {
      view.update("rows", [])
      view.update("ui", "filtered-empty")
      expect(view.host.querySelector("table")).toBeNull()
      expect(view.host.textContent).toContain("No results for these filters.")
      view.update("ui", "empty")
      expect(view.host.textContent).toContain("No records yet.")
      view.update("rows", [record("private-ref", "PRIVATE TABLE VALUE", 9)])
      view.update("ui", "denied")
      expect(view.host.textContent).not.toContain("PRIVATE TABLE VALUE")
      expect(view.host.textContent).toContain("You do not have access")
      view.update("ui", "session-expired")
      expect(view.host.textContent).not.toContain("PRIVATE TABLE VALUE")
      expect(view.events).toEqual([])
      view.update("ui", "partial")
      expect(view.host.querySelector('tr[data-sf-row="private-ref"]')).not.toBeNull()
    } finally { view.done() }
  })
}
