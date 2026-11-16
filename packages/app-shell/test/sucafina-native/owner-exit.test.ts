import { describe, expect, test } from "bun:test"
import type { SfOwnerSelection, SfRef, SfServerKey } from "@orchestra/schema/sucafina/context"
import type { SfContextState } from "../../src/orchestra/chapters/sucafina/context/contracts"
import { confirmSfOwnerExit } from "../../src/orchestra/chapters/sucafina/host/native-chapter-entry"

const selection = { serverKey: "server-a" as SfServerKey, projectId: "project-a" as SfRef, installationId: "install-a" as SfRef } satisfies SfOwnerSelection
const unavailable = (): SfContextState => ({ status: "unavailable", selection, reason: "network" })

describe("quarantined owner exit", () => {
  test("asks before discarding unsent quarantine and never reveals it", async () => {
    const events: string[] = []
    const handle = { state: unavailable, generation: () => 1, hasDirtyDrafts: () => true,
      discardDrafts: () => { events.push("discard"); return true } }
    expect(await confirmSfOwnerExit({ handle: () => handle, disposed: () => false,
      confirmDiscard: async () => { events.push("confirm"); return true }, restoreFocus: () => events.push("focus"),
      onDiscarded: () => events.push("purge-view"), onBlocked: () => events.push("pending") })).toBe(true)
    expect(events).toEqual(["confirm", "discard", "purge-view"])
  })
  test("cancel and empty quarantine do not discard", async () => {
    const events: string[] = []
    let dirty = true
    const handle = { state: unavailable, generation: () => 1, hasDirtyDrafts: () => dirty,
      discardDrafts: () => { events.push("discard"); return true } }
    const deps = { handle: () => handle, disposed: () => false, confirmDiscard: async () => { events.push("confirm"); return false },
      restoreFocus: () => events.push("focus"), onDiscarded: () => events.push("purge-view"), onBlocked: () => events.push("pending") }
    expect(await confirmSfOwnerExit(deps)).toBe(false)
    expect(events).toEqual(["confirm", "focus"])
    dirty = false
    expect(await confirmSfOwnerExit(deps)).toBe(true)
    expect(events).toEqual(["confirm", "focus"])
  })
  test("source refusal for a pending outcome blocks navigation and reports pending", async () => {
    const events: string[] = []
    const handle = { state: unavailable, generation: () => 1, hasDirtyDrafts: () => true, discardDrafts: () => false }
    expect(await confirmSfOwnerExit({ handle: () => handle, disposed: () => false, confirmDiscard: async () => true,
      restoreFocus: () => events.push("focus"), onDiscarded: () => events.push("purge-view"), onBlocked: () => events.push("pending") })).toBe(false)
    expect(events).toEqual(["focus", "pending"])
  })
  test("owner, generation, handle or authority changes during consent never discard", async () => {
    for (const mutation of ["selection", "generation", "handle", "status"]) {
      let generation = 1
      let state = unavailable()
      let discarded = false
      const handle = { state: () => state, generation: () => generation, hasDirtyDrafts: () => true,
        discardDrafts: () => { discarded = true; return true } }
      let active: typeof handle | undefined = handle
      const accepted = await confirmSfOwnerExit({ handle: () => active, disposed: () => false,
        confirmDiscard: async () => {
          if (mutation === "selection") state = { status: "unavailable", selection: { ...selection, projectId: "project-b" as SfRef }, reason: "network" }
          if (mutation === "generation") generation += 1
          if (mutation === "handle") active = undefined
          if (mutation === "status") state = { status: "resolving", selection }
          return true
        }, restoreFocus: () => {}, onDiscarded: () => {}, onBlocked: () => {} })
      expect(accepted).toBe(false)
      expect(discarded).toBe(false)
    }
  })
  test("an aborted native transition cannot discard after its confirmation resolves", async () => {
    const abort = new AbortController()
    let discarded = false
    const handle = { state: unavailable, generation: () => 1, hasDirtyDrafts: () => true,
      discardDrafts: () => { discarded = true; return true } }
    const result = await confirmSfOwnerExit({ handle: () => handle, disposed: () => false, valid: () => !abort.signal.aborted,
      confirmDiscard: async () => { abort.abort(); return true }, restoreFocus: () => {}, onDiscarded: () => {}, onBlocked: () => {} })
    expect(result).toBe(false)
    expect(discarded).toBe(false)
  })
  test("in-place mutation of a non-ready selection cannot discard the next owner's draft", async () => {
    const mutable = { ...selection }
    const state: SfContextState = { status: "unavailable", selection: mutable, reason: "network" }
    let discarded = false
    const handle = { state: () => state, generation: () => 1, hasDirtyDrafts: () => true,
      discardDrafts: () => { discarded = true; return true } }
    const accepted = await confirmSfOwnerExit({ handle: () => handle, disposed: () => false,
      confirmDiscard: async () => { mutable.projectId = "other" as SfRef; return true },
      restoreFocus: () => {}, onDiscarded: () => {}, onBlocked: () => {} })
    expect(accepted).toBe(false)
    expect(discarded).toBe(false)
  })
})
