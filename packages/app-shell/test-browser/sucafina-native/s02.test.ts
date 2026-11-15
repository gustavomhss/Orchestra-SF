/**
 * S02 / hosted browser tests, target:
 * packages/app-shell/test-browser/sucafina-native/s02.test.ts
 * W07 never executes this file locally. The sole dispatcher 120 selects it
 * only on a composed/authorized tree with F01/F03/A02 installed.
 */
import { expect, mock, test } from "bun:test"
import path from "node:path"
import type { JSX } from "solid-js"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import type {
  SfCellCoordinate, SfGridRange, SfGridNavigation, SfMonthId,
  SfMonthlyGridProps, SfPasteRequest, SfPasteRow, SfPasteState, SfUiState,
  SfMessage, SfCopyKey,
} from "@/orchestra/chapters/sucafina/shared/monthly-grid/types"

if (process.env.SF_S02_DOM !== "1") {
  test("SfMonthlyGrid hosted Solid DOM contract: focus, TSV, review/CAS, mobile", async () => {
    const processRef = Bun.spawn(
      [Bun.which("bun")!, "--conditions=browser", "test", "--preload", "./happydom.ts", import.meta.path],
      {
        cwd: path.resolve(import.meta.dir, "../.."),
        env: { ...process.env, SF_S02_DOM: "1" },
        stdout: "pipe",
        stderr: "pipe",
        timeout: 180000,
        killSignal: "SIGKILL",
      },
    )
    const [out, err, code] = await Promise.all([
      new Response(processRef.stdout).text(),
      new Response(processRef.stderr).text(),
      processRef.exited,
    ])
    expect(code, out + err).toBe(0)
  }, 240000)
} else {
  const { createComponent, render, createStore } = await import("../lean-dom.test-helper")
  const { solidDom } = await import("../solid-dom")
  mock.module(solidDom("@/context/language", import.meta.dir), () => ({
    useLanguage: () => ({
      intl: () => "en-US",
      t: (key: string, params?: Record<string, string | number>) =>
        Object.entries(params ?? {}).reduce((text, [name, value]) =>
          text.replace("{{" + name + "}}", String(value)), key),
    }),
  }))
  const { SfMonthlyGrid }: typeof import("@/orchestra/chapters/sucafina/shared/monthly-grid") =
    await import(solidDom("@/orchestra/chapters/sucafina/shared/monthly-grid", import.meta.dir))

  type Row = Readonly<{ id: SfRef; title: string }>
  const ref = (raw: string) => raw as SfRef
  const key = (raw: string) => raw as SfCopyKey
  const msg: SfMessage = { key: key("sf.s02.missing") }
  const source = {
    ref: ref("source-authorized"),
    version: 12,
    label: { kind: "data" as const, text: "Authorized projection" },
    scope: { kind: "data" as const, text: "visible rows only" },
    coverage: { state: "complete" as const, summary: msg, reasons: [], knownCount: 2, expectedCount: 2 },
  }
  const rows: readonly Row[] = [
    { id: ref("row-r1"), title: "Original budget row" },
    { id: ref("row-r2"), title: "Original CAPEX row" },
  ]
  const months = Array.from({ length: 12 }, (_, id) => ({
    id: id as SfMonthId,
    labelKey: key("month." + id),
    closed: id === 8,
  }))
  const coordinate = (row: number, month: number): SfCellCoordinate => ({
    rowRef: rows[row]!.id, month: month as SfMonthId, measure: "budget",
  })
  const cells = rows.flatMap((row, ri) => months.map((month) => ({
    coordinate: coordinate(ri, month.id),
    value: month.id === 1 && ri === 0
      ? { kind: "missing" as const, reason: msg }
      : month.id === 2 && ri === 0
      ? { kind: "inherited" as const, value: 42, unit: { kind: "currency" as const, code: "USD" },
          sourceRef: source.ref, sourceVersion: source.version }
      : { kind: "known" as const, value: ri === 0 && month.id === 0 ? 0 : 13,
          unit: { kind: "currency" as const, code: "USD" }, origin: source },
    permission: ri === 1 && month.id === 0
      ? { editable: false as const, reason: msg }
      : { editable: true as const },
    fractionDigits: 2,
  })))
  const columns = [{
    id: "name", labelKey: key("sf.s02.row"), align: "start" as const,
    widthPolicy: { kind: "content" as const, minPx: 120, maxPx: 300 },
    render: (row: Row) => row.title as unknown as JSX.Element,
  }]

  const mount = (initial: Partial<{ state: SfUiState; paste: SfPasteState }> = {}) => {
    const [ui, setUi] = createStore({
      activeCell: coordinate(0, 0) as SfCellCoordinate | null,
      selectedRange: null as SfGridRange | null,
      paste: (initial.paste ?? { phase: "idle" }) as SfPasteState,
      state: initial.state ?? "ready" as SfUiState,
    })
    const events = {
      pastes: [] as SfPasteRequest[],
      apply: [] as (readonly SfPasteRow[])[],
      retry: [] as (readonly SfPasteRow[])[],
      navigate: [] as SfGridNavigation[],
      edits: [] as { coordinate: SfCellCoordinate; text: string }[],
      commits: [] as { coordinate: SfCellCoordinate; text: string; exit: string }[],
      canceled: [] as SfCellCoordinate[],
      canceledPaste: 0,
      rowsOpened: [] as SfRef[],
    }
    const props: SfMonthlyGridProps<Row> = {
      rows, months, columns, cells,
      draftCells: [],
      getRowKey: (row) => row.id,
      get activeCell() { return ui.activeCell },
      get selectedRange() { return ui.selectedRange },
      get paste() { return ui.paste },
      get state() { return ui.state },
      onSelectRange: (range) => {
        setUi("selectedRange", range)
        if (range) setUi("activeCell", range.extent)
      },
      onPasteTsv: (req) => events.pastes.push(req),
      onApplyPastedRows: (accepted) => events.apply.push(accepted),
      onRetryFailedPasteRows: (failed) => events.retry.push(failed),
      onCancelPaste: () => { events.canceledPaste += 1; setUi("paste", { phase: "idle" }) },
      onNavigate: (navigation) => {
        events.navigate.push(navigation)
        const row = rows.findIndex((item) => item.id === navigation.from.rowRef)
        const month = months.findIndex((item) => item.id === navigation.from.month)
        const clamp = (value: number, cap: number) => Math.max(0, Math.min(cap, value))
        const toRow = navigation.key === "ArrowDown" ? clamp(row + 1, rows.length - 1)
          : navigation.key === "ArrowUp" ? clamp(row - 1, rows.length - 1) : row
        const toMonth = navigation.key === "ArrowRight" ? clamp(month + 1, 11)
          : navigation.key === "ArrowLeft" ? clamp(month - 1, 11) : month
        setUi("activeCell", coordinate(toRow, toMonth))
      },
      onEdit: (draft) => events.edits.push(draft),
      onCommitCell: (draft) => events.commits.push(draft),
      onCancelCell: (coord) => events.canceled.push(coord),
      onOpenRow: (rowRef) => events.rowsOpened.push(rowRef),
    }
    const host = document.createElement("div")
    document.body.appendChild(host)
    const dispose = render(() => createComponent(SfMonthlyGrid, props), host)
    return {
      host, ui, setUi, events,
      close: () => { dispose(); host.remove() },
      grid: () => host.querySelector<HTMLDivElement>('[role="grid"]')!,
      buttons: () => [...host.querySelectorAll<HTMLButtonElement>("button")],
      button: (key: string) => [...host.querySelectorAll<HTMLButtonElement>("button")].find(
        (button) => button.textContent?.trim() === key,
      ),
    }
  }
  const paste = (grid: HTMLElement, originalTsv: string) => {
    const event = new Event("paste", { bubbles: true, cancelable: true })
    Object.defineProperty(event, "clipboardData", {
      value: { getData: (type: string) => type === "text/plain" ? originalTsv : undefined },
    })
    grid.dispatchEvent(event)
    return event
  }
  const keydown = (target: Element, key: string, shiftKey = false, ctrlKey = false) =>
    target.dispatchEvent(new KeyboardEvent("keydown", {
      key, shiftKey, ctrlKey, bubbles: true, cancelable: true,
    }))
  const row = (id: string, result: SfPasteRow["result"], revision = 8): SfPasteRow => ({
    rowRef: ref(id), revision, result, issues: result === "ready" ? [] : [msg],
    cells: [{
      coordinate: { rowRef: ref(id), month: 0, measure: "budget" },
      rawText: result === "ready" ? "0" : "",
    }],
  })

  test("zero is not missing; null inheritance is explicit and known inherited value stays visible", () => {
    const page = mount()
    try {
      const text = page.host.textContent ?? ""
      expect(text).toContain("0")
      expect(text).toContain("42")
      expect(text).toContain("sf.s02.inherited")
      expect(text).toContain("sf.s02.missing")
      expect(page.host.querySelectorAll('[role="grid"][tabindex="0"]')).toHaveLength(1)
      expect(page.host.querySelectorAll('[role="gridcell"][tabindex]')).toHaveLength(0)
    } finally { page.close() }
  })

  test("arrows/Shift range navigate with a single tab stop and no wrap at December", () => {
    const page = mount()
    try {
      keydown(page.grid(), "ArrowRight")
      expect(page.events.navigate[0]?.key).toBe("ArrowRight")
      page.setUi("activeCell", coordinate(0, 11))
      keydown(page.grid(), "ArrowRight", true)
      expect(page.ui.selectedRange?.extent.month).toBe(11)
      expect(page.ui.selectedRange?.anchor.month).toBe(11)
      page.setUi("activeCell", coordinate(0, 0))
      keydown(page.grid(), "ArrowDown", true)
      expect(page.ui.selectedRange?.extent.rowRef).toBe(rows[1]!.id)
      expect(page.ui.selectedRange?.anchor.rowRef).toBe(rows[0]!.id)
      keydown(page.grid(), "Home", false, true)
      expect(page.events.navigate.at(-1)?.key).toBe("Control+Home")
      expect(page.events.navigate.at(-1)?.visibleRowCount).toBeGreaterThan(0)
    } finally { page.close() }
  })

  test("Enter/F2 edit only permitted open month; Enter commits exactly original local characters, not domain", () => {
    const page = mount()
    try {
      keydown(page.grid(), "Enter")
      const editor = page.host.querySelector<HTMLInputElement>(".sf-s02-editor")
      expect(editor?.value).toBe("0")
      if (!editor) throw Error("editable zero editor missing")
      editor.value = "000.00"
      editor.dispatchEvent(new Event("input", { bubbles: true }))
      expect(page.events.edits.at(-1)?.text).toBe("000.00")
      keydown(editor, "Enter")
      expect(page.events.commits.at(-1)).toEqual({
        coordinate: coordinate(0, 0), text: "000.00", exit: "Enter",
      })
      page.setUi("activeCell", coordinate(1, 0))
      keydown(page.grid(), "F2")
      expect(page.host.querySelector(".sf-s02-editor")).toBeNull()
      page.setUi("activeCell", coordinate(0, 8))
      keydown(page.grid(), "F2")
      expect(page.host.querySelector(".sf-s02-editor")).toBeNull()
    } finally { page.close() }
  })

  test("editor takes focus, Esc cancels raw input, and copy is never hijacked by the grid", async () => {
    const page = mount()
    try {
      keydown(page.grid(), "F2")
      await Promise.resolve()
      const editor = page.host.querySelector<HTMLInputElement>(".sf-s02-editor")
      if (!editor) throw Error("missing editor")
      expect(document.activeElement).toBe(editor)
      const copy = new Event("copy", { bubbles: true, cancelable: true })
      Object.defineProperty(copy, "clipboardData", {
        value: { setData: () => { throw Error("grid must not replace editor clipboard") } },
      })
      editor.dispatchEvent(copy)
      expect(copy.defaultPrevented).toBe(false)
      editor.value = "001.25"
      editor.dispatchEvent(new Event("input", { bubbles: true }))
      keydown(editor, "Escape")
      expect(page.events.canceled).toEqual([coordinate(0, 0)])
      expect(page.events.commits).toHaveLength(0)
      expect(page.host.querySelector(".sf-s02-editor")).toBeNull()
      keydown(page.grid(), "F2")
      const next = page.host.querySelector<HTMLInputElement>(".sf-s02-editor")!
      next.value = "2.5"
      next.dispatchEvent(new Event("input", { bubbles: true }))
      keydown(next, "Tab", true)
      expect(page.events.commits.at(-1)?.exit).toBe("Shift+Tab")
    } finally { page.close() }
  })

  test("applying paste blocks a second preview and inline mutation", () => {
    const page = mount({ paste: {
      phase: "applying", originalTsv: "1",
      range: { anchor: coordinate(0, 0), extent: coordinate(0, 0) }, rows: [],
    } })
    try {
      paste(page.grid(), "3")
      expect(page.events.pastes).toHaveLength(0)
      keydown(page.grid(), "F2")
      expect(page.host.querySelector(".sf-s02-editor")).toBeNull()
    } finally { page.close() }
  })

  test("paste keeps CRLF, tabs, zero and trailing empty cells verbatim with UI months 0-based", () => {
    const page = mount()
    try {
      const exact = "0\t10\t\r\n\t23\t"
      const event = paste(page.grid(), exact)
      expect(event.defaultPrevented).toBe(true)
      expect(page.events.pastes).toHaveLength(1)
      expect(page.events.pastes[0]?.originalTsv).toBe(exact)
      expect(page.events.pastes[0]?.range.anchor.month).toBe(0)
      expect(page.events.pastes[0]?.range.extent.month).toBe(2)
      expect(page.events.pastes[0]?.range.extent.rowRef).toBe(rows[1]!.id)
      expect(JSON.stringify(page.events.pastes[0])).not.toContain('"month":12')
    } finally { page.close() }
  })

  test("overflow and ragged TSV fail safe before owner preview, preserving original text", () => {
    const page = mount()
    try {
      page.setUi("activeCell", coordinate(1, 11))
      paste(page.grid(), "1\t2\r\n3\t4")
      expect(page.events.pastes).toHaveLength(0)
      expect(page.host.textContent).toContain("sf.s02.paste.overflow")
      expect(page.host.textContent).toContain("1\t2")
      page.setUi("activeCell", coordinate(0, 0))
      paste(page.grid(), "1\t2\r\n3")
      expect(page.events.pastes).toHaveLength(0)
      expect(page.host.textContent).toContain("sf.s02.paste.irregular")
      expect(page.host.textContent).toContain("1\t2")
    } finally { page.close() }
  })

  test("review/apply only forwards ready rows; failed/conflict retry only via explicit action", () => {
    const page = mount()
    try {
      const ready = row("row-r1", "ready")
      const applied = row("row-old", "applied")
      const failed = row("row-r2", "failed")
      const conflict = row("row-stale", "conflict")
      const invalid = row("row-invalid", "invalid")
      page.setUi("paste", {
        phase: "partial",
        originalTsv: "0\r\n99",
        range: { anchor: coordinate(0, 0), extent: coordinate(1, 0) },
        rows: [ready, applied, failed, conflict, invalid],
      })
      page.button("sf.s02.paste.apply")?.click()
      expect(page.events.apply).toEqual([[ready]])
      page.button("sf.s02.paste.retry")?.click()
      expect(page.events.retry).toEqual([[failed, conflict]])
      expect(page.events.retry[0]).not.toContain(applied)
      expect(page.events.retry[0]).not.toContain(invalid)
      page.setUi("state", "outcome-unknown")
      expect(page.button("sf.s02.paste.retry")?.disabled).toBe(true)
      expect(page.button("sf.s02.paste.apply")?.disabled).toBe(true)
    } finally { page.close() }
  })

  test("320px alternate includes twelve months and selectable paste anchor without squeezed 12 columns", () => {
    const page = mount()
    try {
      const mobile = page.host.querySelector(".sf-s02-mobile")!
      expect(mobile.querySelectorAll("details")).toHaveLength(2)
      expect(mobile.querySelectorAll("details:first-child li")).toHaveLength(12)
      const select = mobile.querySelector<HTMLButtonElement>(".sf-s02-mobile-select")
      expect(select).not.toBeNull()
      select?.click()
      expect(page.ui.selectedRange?.anchor.month).toBe(0)
      const textarea = page.host.querySelector<HTMLTextAreaElement>(".sf-s02-paste textarea")!
      textarea.value = "0\t\r\n2\t"
      textarea.dispatchEvent(new Event("input", { bubbles: true }))
      page.button("sf.s02.paste.review")?.click()
      expect(page.events.pastes[0]?.originalTsv).toBe("0\t\r\n2\t")
    } finally { page.close() }
  })

  test("session-expired never renders the authorized private grid or paste controls", () => {
    const page = mount({ state: "session-expired" })
    try {
      expect(page.host.querySelector('[role="grid"]')).toBeNull()
      expect(page.host.querySelector(".sf-s02-paste")).toBeNull()
      expect(page.host.textContent).toContain("sf.common.noAccess")
    } finally { page.close() }
  })
}
