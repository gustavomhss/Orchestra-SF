import { describe, expect, test } from "bun:test"
import { Schema } from "effect"
import { Sucafina } from "@orchestra/schema/sucafina"
import { createSucafinaController } from "./controller"
import {
  SucafinaRequestError,
  type ControllerState,
  type Scope,
  type Selection,
  type Transport,
} from "./contract"

const decodePage = Schema.decodeUnknownSync(Sucafina.PageState)
const decodeCommand = Schema.decodeUnknownSync(Sucafina.Command)
const decodeRevision = Schema.decodeUnknownSync(Sucafina.Revision)

type ReadCall = {
  selection: Selection
  signal: AbortSignal
  gate: ReturnType<typeof Promise.withResolvers<Sucafina.PageState>>
}

type CommandCall = {
  surface: Sucafina.Surface
  draft: Sucafina.Command
  signal: AbortSignal
  gate: ReturnType<typeof Promise.withResolvers<{ ok: true; warnings?: readonly string[] }>>
}

// Deferred promises only. Requests stay pending after AbortSignal abort so a stale completion is visible.
function harness() {
  const reads: ReadCall[] = []
  const commands: CommandCall[] = []
  const prepared: Sucafina.PageState[] = []
  const transport: Transport = {
    read(selection, signal) {
      const gate = Promise.withResolvers<Sucafina.PageState>()
      reads.push({ selection, signal, gate })
      const ready = prepared.shift()
      if (ready) gate.resolve(ready)
      return gate.promise
    },
    command(surface, draft, signal) {
      const gate = Promise.withResolvers<{ ok: true; warnings?: readonly string[] }>()
      commands.push({ surface, draft, signal, gate })
      return gate.promise
    },
  }
  return {
    reads,
    commands,
    controller: createSucafinaController(transport),
    prepare(page: Sucafina.PageState) {
      prepared.push(page)
    },
  }
}

type Harness = ReturnType<typeof harness>

function page(input?: {
  surface?: Sucafina.Surface
  page?: string
  pages?: readonly string[]
  actorID?: string
  name?: string
  canWrite?: boolean
  roles?: readonly string[]
  assigned?: readonly string[]
  domains?: readonly string[]
  year?: number
  month?: number
  data?: unknown
  version?: number
  by?: string
  directory?: readonly { readonly id: string; readonly name: string }[]
}) {
  const actorID = input?.actorID ?? "actor"
  const name = input?.name ?? "actor"
  return decodePage({
    surface: input?.surface ?? "dashboard",
    page: input?.page ?? "page",
    pages: input?.pages ?? ["page"],
    actor: {
      id: actorID,
      name,
      canWrite: input?.canWrite ?? true,
      roles: input?.roles ?? ["role"],
      assigned: input?.assigned ?? ["page"],
      domains: input?.domains ?? ["domain"],
    },
    year: input?.year ?? 2026,
    month: input?.month ?? 1,
    data: input?.data ?? { field: "value" },
    versions: { field: { version: input?.version ?? 4, by: input?.by ?? "actor" } },
    directory: input?.directory ?? [{ id: "actor", name }],
  })
}

function revision(version: number, by = "actor") {
  return decodeRevision({ version, by })
}

function ownVersions(values: readonly number[]) {
  return values.map((value) => command(value).version)
}

function command(version = 2, field: unknown = "next", pageName = "page") {
  return decodeCommand({
    page: pageName,
    action: "write",
    version,
    values: { field },
  })
}

function scope(server = "server-a", identity = "session-a"): Scope {
  return { server, identity }
}

function selection(query?: Sucafina.PageQuery, surface: Sucafina.Surface = "dashboard"): Selection {
  return { surface, query: query ?? { page: "page", year: "2026" } }
}

const pageQueryKeys = [
  "page",
  "year",
  "own",
  "month",
  "version",
  "owner",
  "class",
  "q",
  "filter",
  "status",
  "priority",
  "request",
  "supplier",
  "mode",
  "risk",
  "topicStatus",
  "memberStatus",
  "projectStatus",
  "projectRisk",
  "stakeholderPriority",
  "opsMonth",
  "tab",
  "execYear",
  "opsYear",
  "secYear",
  "executiveMonth",
  "operationsMonth",
  "securityMonth",
] as const satisfies readonly (keyof Sucafina.PageQuery)[]

const everyPageQueryKey: (
  Exclude<keyof Sucafina.PageQuery, (typeof pageQueryKeys)[number]> extends never ? true : never
) = true

const queryDeltaValue = {
  page: "other",
  year: "2027",
  own: "1",
  month: "11",
  version: "9",
  owner: "o",
  class: "c",
  q: "q",
  filter: "f",
  status: "s",
  priority: "p",
  request: "r",
  supplier: "u",
  mode: "m",
  risk: "k",
  topicStatus: "ts",
  memberStatus: "ms",
  projectStatus: "ps",
  projectRisk: "pr",
  stakeholderPriority: "sp",
  opsMonth: "om",
  tab: "tb",
  execYear: "ey",
  opsYear: "oy",
  secYear: "sy",
  executiveMonth: "em",
  operationsMonth: "nm",
  securityMonth: "sm",
} satisfies Record<keyof Sucafina.PageQuery, string>

function withQueryValue(query: Sucafina.PageQuery, key: keyof Sucafina.PageQuery, value: string) {
  const next = structuredClone(query)
  Reflect.set(next, key, value)
  return next
}

function changedQueryKeys(previous: Sucafina.PageQuery, next: Sucafina.PageQuery) {
  return pageQueryKeys.filter((key) => previous[key] !== next[key])
}

function failure(
  status: number,
  message: string,
  detail?: { stored?: unknown; by?: string; errors?: readonly string[] },
) {
  return new SucafinaRequestError(status, message, detail)
}

function expectSensitiveCleared(state: ControllerState) {
  expect(state.page).toBeUndefined()
  expect(state.draft).toBeUndefined()
  expect(state.conflict).toBeUndefined()
  expect(state.warnings).toEqual([])
  expect(state.loading).toBe(false)
  expect(state.saving).toBe(false)
}

function expectCleared(state: ControllerState) {
  expectSensitiveCleared(state)
  expect(state.error).toBeUndefined()
}

async function drain() {
  await Promise.resolve()
  await Promise.resolve()
  await Promise.resolve()
}

function beginSelect(h: Harness, sel: Selection) {
  const index = h.reads.length
  const pending = h.controller.select(sel)
  expect(h.reads).toHaveLength(index + 1)
  const call = h.reads[index]
  if (!call) throw new Error(`missing read ${index}`)
  return { pending, call }
}

function beginRefresh(h: Harness) {
  const index = h.reads.length
  const pending = h.controller.refresh()
  expect(h.reads).toHaveLength(index + 1)
  expect(h.controller.state().loading).toBe(true)
  const call = h.reads[index]
  if (!call) throw new Error(`missing read ${index}`)
  return { pending, call }
}

function beginSave(h: Harness) {
  const index = h.commands.length
  const pending = h.controller.save()
  expect(h.controller.state().saving).toBe(true)
  expect(h.commands).toHaveLength(index + 1)
  const call = h.commands[index]
  if (!call) throw new Error(`missing command ${index}`)
  return { pending, call }
}

function beginDiscard(h: Harness) {
  const index = h.reads.length
  const pending = h.controller.discardDraft()
  expect(h.reads).toHaveLength(index + 1)
  expect(h.controller.state().loading).toBe(true)
  const call = h.reads[index]
  if (!call) throw new Error(`missing read ${index}`)
  return { pending, call }
}

async function load(h: Harness, sel: Selection, value: Sucafina.PageState) {
  const started = beginSelect(h, sel)
  expect(h.controller.state().loading).toBe(true)
  expect(started.call.signal.aborted).toBe(false)
  expect(started.call.selection.surface).toBe(sel.surface)
  expect(started.call.selection.query).toEqual(sel.query)
  started.call.gate.resolve(value)
  await started.pending
  expect(h.controller.state().loading).toBe(false)
  expect(h.controller.state().saving).toBe(false)
  expect(h.controller.state().page).toEqual(value)
  return started
}

async function expectNoTransport(h: Harness, run: () => Promise<void>) {
  const reads = h.reads.length
  const commands = h.commands.length
  const pending = run()
  await drain()
  expect(h.reads).toHaveLength(reads)
  expect(h.commands).toHaveLength(commands)
  await pending
}

async function saveOk(h: Harness, warnings: readonly string[], nextPage: Sucafina.PageState) {
  const saving = beginSave(h)
  const draft = h.controller.state().draft
  expect(draft).toBeDefined()
  if (!draft) throw new Error("save discarded its pending draft")
  expect(saving.call.draft).toEqual(draft)
  h.prepare(nextPage)
  saving.call.gate.resolve({ ok: true, warnings })
  await saving.pending
  expect(h.controller.state().saving).toBe(false)
  expect(h.controller.state().loading).toBe(false)
  expect(h.controller.state().warnings).toEqual([...warnings])
  expect(h.controller.state().page).toEqual(nextPage)
  expect(h.controller.state().draft).toBeUndefined()
  expect(h.controller.state().error).toBeUndefined()
  expect(h.controller.state().conflict).toBeUndefined()
  return saving
}

async function armWarnings(h: Harness, active: Selection) {
  const noted = command(2, "noted", active.query.page)
  h.controller.edit(noted)
  await saveOk(h, ["noted"], page({ surface: active.surface, page: active.query.page }))
  const dirty = command(2, "dirty", active.query.page)
  h.controller.edit(dirty)
  expect(h.controller.state().warnings).toEqual(["noted"])
  expect(h.controller.state().draft).toEqual(dirty)
}

async function switchSelection(
  h: Harness,
  next: Selection,
  staleRead?: { pending: Promise<void>; call: ReadCall },
  staleWrite?: { pending: Promise<void>; call: CommandCall; failure?: SucafinaRequestError },
) {
  expect(h.controller.state().page).toBeDefined()
  expect(h.controller.state().draft).toBeDefined()
  expect(h.controller.state().warnings).toEqual(["noted"])
  const index = h.reads.length
  const pending = h.controller.select(next)
  expect(h.controller.state().page).toBeUndefined()
  expect(h.controller.state().draft).toBeUndefined()
  expect(h.controller.state().conflict).toBeUndefined()
  expect(h.controller.state().warnings).toEqual([])
  expect(h.controller.state().loading).toBe(true)
  expect(h.reads).toHaveLength(index + 1)
  const call = h.reads[index]
  if (!call) throw new Error(`missing read ${index}`)
  expect(call.signal.aborted).toBe(false)
  expect(call.selection.surface).toBe(next.surface)
  expect(call.selection.query).toEqual(next.query)
  if (staleRead) expect(staleRead.call.signal.aborted).toBe(true)
  const fresh = page({ surface: next.surface, page: next.query.page })
  call.gate.resolve(fresh)
  await pending
  if (staleRead) {
    staleRead.call.gate.resolve(page({ data: { field: "stale-read" }, page: "stale" }))
    await staleRead.pending
  }
  if (staleWrite) {
    expect(h.controller.state().error).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().warnings).toEqual([])
    const reads = h.reads.length
    const rejected = staleWrite.failure
    if (rejected) staleWrite.call.gate.reject(rejected)
    if (!rejected) staleWrite.call.gate.resolve({ ok: true, warnings: ["stale-write"] })
    await staleWrite.pending
    await drain()
    expect(h.reads).toHaveLength(reads)
    expect(h.controller.state().error).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().warnings).toEqual([])
  }
  await drain()
  expect(h.controller.state().page).toEqual(fresh)
  expect(h.controller.state().draft).toBeUndefined()
  expect(h.controller.state().conflict).toBeUndefined()
  expect(h.controller.state().warnings).toEqual([])
  expect(h.controller.state().loading).toBe(false)
  expect(h.controller.state().saving).toBe(false)
  expect(h.reads).toHaveLength(index + 1)
}

async function depart(
  h: Harness,
  active: Selection,
  next: Selection,
  staleWriteFailure?: SucafinaRequestError,
) {
  await armWarnings(h, active)
  const staleRead = beginRefresh(h)
  const staleWrite = beginSave(h)
  const write = staleWriteFailure ? { ...staleWrite, failure: staleWriteFailure } : staleWrite
  await switchSelection(h, next, staleRead, write)
  return { surface: next.surface, query: structuredClone(next.query) }
}

// The post-save read stays deferred. prepare() would resolve it before a scope, selection, or dispose race.
async function holdSaveRefresh(h: Harness, active: Selection, warnings: readonly string[]) {
  const saving = beginSave(h)
  const index = h.reads.length
  saving.call.gate.resolve({ ok: true, warnings })
  await drain()
  expect(h.reads).toHaveLength(index + 1)
  const refresh = h.reads[index]
  if (!refresh) throw new Error(`missing read ${index}`)
  expect(refresh.signal.aborted).toBe(false)
  expect(refresh.selection).toEqual(active)
  expect(h.controller.state().loading).toBe(true)
  return { pending: saving.pending, refresh }
}

async function expectLateAuthKeepsReplacement(status: 401 | 403, source: "read" | "write") {
  const h = harness()
  h.controller.setScope(scope())
  await load(h, selection(), page())
  const staleRead = source === "read" ? beginRefresh(h) : undefined
  if (source === "write") h.controller.edit(command(2, "old"))
  const staleWrite = source === "write" ? beginSave(h) : undefined
  const next: Selection = { surface: "dashboard", query: { page: "page", year: "2027" } }
  const index = h.reads.length
  const pending = h.controller.select(next)
  expect(h.controller.state().page).toBeUndefined()
  expect(h.controller.state().draft).toBeUndefined()
  expect(h.reads).toHaveLength(index + 1)
  const call = h.reads[index]
  if (!call) throw new Error(`missing read ${index}`)
  if (staleRead) expect(staleRead.call.signal.aborted).toBe(true)
  const fresh = page({ data: { field: "fresh" } })
  call.gate.resolve(fresh)
  await pending
  const written = command(2, "kept")
  h.controller.edit(written)
  expect(h.controller.state().page).toEqual(fresh)
  expect(h.controller.state().draft).toEqual(written)
  const reads = h.reads.length
  const commands = h.commands.length
  const reason = failure(status, status === 401 ? "unauthorized" : "forbidden")
  if (staleRead) {
    staleRead.call.gate.reject(reason)
    await staleRead.pending
  }
  if (staleWrite) {
    staleWrite.call.gate.reject(reason)
    await staleWrite.pending
  }
  await drain()
  expect(h.controller.state().page).toEqual(fresh)
  expect(h.controller.state().draft).toEqual(written)
  expect(h.controller.state().draft?.version).toBe(command(2).version)
  expect(h.controller.state().loading).toBe(false)
  expect(h.controller.state().saving).toBe(false)
  expect(h.reads).toHaveLength(reads)
  expect(h.commands).toHaveLength(commands)
}

async function expectRevocation(input: NonNullable<Parameters<typeof page>[0]>) {
  const h = harness()
  h.controller.setScope(scope())
  await load(h, selection(), page())
  const written = command(2, "dirty")
  h.controller.edit(written)
  const saving = beginSave(h)
  expect(saving.call.draft.version).toBe(command(2).version)
  saving.call.gate.reject(failure(409, "conflict", { stored: { version: 99 }, by: "other" }))
  await saving.pending
  expect(h.controller.state().conflict?.status).toBe(409)
  expect(h.controller.state().draft).toEqual(written)
  const next = page(input)
  const refreshing = beginRefresh(h)
  refreshing.call.gate.resolve(next)
  await refreshing.pending
  expect(h.controller.state().page).toEqual(next)
  expect(h.controller.state().draft).toBeUndefined()
  expect(h.controller.state().conflict).toBeUndefined()
}

describe("sucafina controller", () => {
  test("blocks transport without a scope and clears in-flight work when scope becomes undefined", async () => {
    const h = harness()
    expect(h.controller.state().loading).toBe(false)
    expect(h.controller.state().saving).toBe(false)
    expect(h.controller.state().warnings).toEqual([])
    await expectNoTransport(h, () => h.controller.select(selection()))
    await expectNoTransport(h, () => h.controller.refresh())
    h.controller.edit(command())
    expect(h.controller.state().draft).toBeUndefined()
    await expectNoTransport(h, () => h.controller.save())
    await expectNoTransport(h, () => h.controller.discardDraft())
    expectCleared(h.controller.state())

    h.controller.setScope(scope())
    await expectNoTransport(h, () => h.controller.refresh())
    const started = beginSelect(h, selection())
    h.controller.setScope(scope())
    expect(started.call.signal.aborted).toBe(false)
    expect(h.controller.state().loading).toBe(true)
    const loaded = page()
    started.call.gate.resolve(loaded)
    await started.pending
    expect(h.controller.state().page).toEqual(loaded)
    expect(started.call.signal.aborted).toBe(false)

    const written = command()
    h.controller.edit(written)
    expect(h.controller.state().draft).toEqual(written)
    h.controller.setScope(scope())
    expect(h.controller.state().page).toEqual(loaded)
    expect(h.controller.state().draft).toEqual(written)
    expect(started.call.signal.aborted).toBe(false)

    const staleRead = beginRefresh(h)
    const staleSave = beginSave(h)
    const reads = h.reads.length
    const commands = h.commands.length
    h.controller.setScope(undefined)
    expect(staleRead.call.signal.aborted).toBe(true)
    expect(staleSave.call.signal.aborted).toBe(true)
    expectCleared(h.controller.state())
    staleRead.call.gate.resolve(page({ data: { field: "stale-read" } }))
    staleSave.call.gate.resolve({ ok: true, warnings: ["stale-write"] })
    await staleRead.pending
    await staleSave.pending
    await drain()
    expectCleared(h.controller.state())
    expect(h.reads).toHaveLength(reads)
    expect(h.commands).toHaveLength(commands)
    await expectNoTransport(h, () => h.controller.select(selection()))
    await expectNoTransport(h, () => h.controller.refresh())
    h.controller.edit(command())
    await expectNoTransport(h, () => h.controller.save())
    await expectNoTransport(h, () => h.controller.discardDraft())
    expectCleared(h.controller.state())

    h.controller.setScope(scope("server-b", "session-b"))
    const revived = page({ data: { field: "revived" } })
    await load(h, selection(), revived)
    const revivedDraft = command(2, "revived")
    h.controller.edit(revivedDraft)
    expect(h.controller.state().page).toEqual(revived)
    expect(h.controller.state().draft).toEqual(revivedDraft)
    const saving = beginSave(h)
    expect(saving.call.draft).toEqual(revivedDraft)
    expect(saving.call.surface).toBe("dashboard")
    saving.call.gate.reject(failure(500, "later"))
    await saving.pending
    await drain()
    expect(h.controller.state().page).toEqual(revived)
    expect(h.controller.state().draft).toEqual(revivedDraft)
    expect(h.commands).toHaveLength(commands + 1)
  })

  test("drops stale read and write results when server or identity changes", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const loaded = page()
    await load(h, selection(), loaded)
    h.controller.edit(command())
    await saveOk(h, ["noted"], loaded)
    h.controller.edit(command())
    expect(h.controller.state().warnings).toEqual(["noted"])
    expect(h.controller.state().draft).toEqual(command())
    expect(h.controller.state().page).toEqual(loaded)

    const staleRead = beginRefresh(h)
    const staleSave = beginSave(h)
    const reads = h.reads.length
    const commands = h.commands.length
    h.controller.setScope(scope("server-b"))
    expect(staleRead.call.signal.aborted).toBe(true)
    expect(staleSave.call.signal.aborted).toBe(true)
    expectCleared(h.controller.state())
    staleRead.call.gate.resolve(page({ data: { field: "stale-read" } }))
    staleSave.call.gate.resolve({ ok: true, warnings: ["stale-write"] })
    await staleRead.pending
    await staleSave.pending
    await drain()
    expectCleared(h.controller.state())
    expect(h.reads).toHaveLength(reads)
    expect(h.commands).toHaveLength(commands)
    await expectNoTransport(h, () => h.controller.refresh())

    const fresh = page({ data: { field: "fresh" } })
    const next = beginSelect(h, selection())
    next.call.gate.resolve(fresh)
    await next.pending
    expect(h.controller.state().page).toEqual(fresh)
    expect(h.controller.state().warnings).toEqual([])

    h.controller.edit(command())
    const failed = beginRefresh(h)
    failed.call.gate.reject(failure(500, "failed"))
    await failed.pending
    expect(h.controller.state().error).toBeInstanceOf(SucafinaRequestError)
    expect(h.controller.state().error?.status).toBe(500)
    expect(h.controller.state().page).toEqual(fresh)
    expect(h.controller.state().draft).toEqual(command())

    const lateRead = beginRefresh(h)
    const lateSave = beginSave(h)
    h.controller.setScope(scope("server-b", "session-b"))
    expect(lateRead.call.signal.aborted).toBe(true)
    expect(lateSave.call.signal.aborted).toBe(true)
    expectCleared(h.controller.state())
    lateRead.call.gate.reject(failure(500, "stale"))
    lateSave.call.gate.reject(failure(422, "stale", { errors: ["stale"] }))
    await lateRead.pending
    await lateSave.pending
    await drain()
    expectCleared(h.controller.state())

    await load(h, selection(), page())
    h.controller.edit(command(2, "dirty"))
    const conflicted = beginSave(h)
    expect(conflicted.call.draft.version).toBe(command(2).version)
    conflicted.call.gate.reject(failure(409, "conflict", { stored: { version: 99 }, by: "other" }))
    await conflicted.pending
    expect(h.controller.state().conflict?.status).toBe(409)
    expect(h.controller.state().draft?.version).toBe(command(2).version)
    const sent = h.commands.length
    h.controller.setScope(scope("server-c", "session-b"))
    expectCleared(h.controller.state())
    await drain()
    expect(h.commands).toHaveLength(sent)
    expect(h.commands.every((call) => call.draft.version !== command(99).version)).toBe(true)
    expectCleared(h.controller.state())
  })

  test("dispose aborts pending work and ignores late completions", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const loaded = page()
    await load(h, selection(), loaded)
    h.controller.edit(command())
    await saveOk(h, ["noted"], loaded)
    h.controller.edit(command())
    expect(h.controller.state().warnings).toEqual(["noted"])
    expect(h.controller.state().draft).toEqual(command())
    const staleRead = beginRefresh(h)
    const staleSave = beginSave(h)
    const reads = h.reads.length
    const commands = h.commands.length
    h.controller.dispose()
    expect(staleRead.call.signal.aborted).toBe(true)
    expect(staleSave.call.signal.aborted).toBe(true)
    expectCleared(h.controller.state())
    staleRead.call.gate.resolve(page({ data: { field: "stale-read" } }))
    staleSave.call.gate.reject(failure(500, "stale"))
    await staleRead.pending
    await staleSave.pending
    await drain()
    expectCleared(h.controller.state())
    expect(h.reads).toHaveLength(reads)
    expect(h.commands).toHaveLength(commands)
    h.controller.setScope(scope("server-b", "session-b"))
    await expectNoTransport(h, () => h.controller.select(selection()))
    await expectNoTransport(h, () => h.controller.refresh())
    h.controller.edit(command())
    await expectNoTransport(h, () => h.controller.save())
    await expectNoTransport(h, () => h.controller.discardDraft())
    expectCleared(h.controller.state())
  })

  test("clears synchronously on surface or any query change and ignores stale read and write results", async () => {
    expect(everyPageQueryKey).toBe(true)
    const stable: Sucafina.PageQuery = { page: "page" }
    const h = harness()
    h.controller.setScope(scope())
    await load(h, { surface: "dashboard", query: { ...stable } }, page())
    const planner = await depart(
      h,
      { surface: "dashboard", query: { ...stable } },
      { surface: "planner", query: { ...stable } },
    )
    expect(planner.surface).toBe("planner")
    expect(planner.query).toEqual(stable)

    // Each step changes exactly one PageQuery field from the loaded selection.
    const query = await pageQueryKeys.reduce<Promise<Sucafina.PageQuery>>(async (previous, key) => {
      const currentQuery = await previous
      const nextQuery = withQueryValue(currentQuery, key, queryDeltaValue[key])
      expect(changedQueryKeys(currentQuery, nextQuery)).toEqual([key])
      const active: Selection = { surface: "planner", query: currentQuery }
      await armWarnings(h, active)
      if (key === "priority") {
        const conflicted = beginSave(h)
        conflicted.call.gate.reject(failure(409, "conflict", { stored: { version: 99 }, by: "other" }))
        await conflicted.pending
        expect(h.controller.state().saving).toBe(false)
        expect(h.controller.state().conflict?.status).toBe(409)
        expect(h.controller.state().warnings).toEqual(["noted"])
        expect(h.controller.state().draft).toEqual(command(2, "dirty", currentQuery.page))
      }
      const stale = beginRefresh(h)
      if (key === "priority") expect(h.controller.state().conflict?.status).toBe(409)
      await switchSelection(h, { surface: "planner", query: nextQuery }, stale)
      return structuredClone(nextQuery)
    }, Promise.resolve(structuredClone(stable)))

    // A late rejected write after a same-scope switch must not land or refresh.
    const dashboard = await depart(
      h,
      { surface: "planner", query },
      { surface: "dashboard", query },
      failure(422, "stale", { errors: ["stale"] }),
    )
    expect(dashboard.surface).toBe("dashboard")
    expect(changedQueryKeys(query, dashboard.query)).toEqual([])
    const procurement = await depart(
      h,
      dashboard,
      { surface: "procurement", query: dashboard.query },
      failure(500, "stale"),
    )
    expect(procurement.surface).toBe("procurement")
    expect(changedQueryKeys(dashboard.query, procurement.query)).toEqual([])
    const nextYear = withQueryValue(procurement.query, "year", "2028")
    expect(changedQueryKeys(procurement.query, nextYear)).toEqual(["year"])
    const yearShifted = await depart(
      h,
      procurement,
      { surface: procurement.surface, query: nextYear },
      failure(422, "stale", { errors: ["stale"] }),
    )
    const nextVersion = withQueryValue(yearShifted.query, "version", "8")
    expect(changedQueryKeys(yearShifted.query, nextVersion)).toEqual(["version"])
    await depart(h, yearShifted, { surface: yearShifted.surface, query: nextVersion }, failure(500, "stale"))
  })

  test("refreshes the same selection regardless of query key order and keeps the dirty draft", async () => {
    const forward: Sucafina.PageQuery = { page: "page", year: "2026", version: "1", q: "needle" }
    const reverse: Sucafina.PageQuery = { q: "needle", version: "1", year: "2026", page: "page" }
    const middle: Sucafina.PageQuery = { year: "2026", page: "page", q: "needle", version: "1" }
    expect(Object.keys(forward)).not.toEqual(Object.keys(reverse))
    expect(Object.keys(middle)).not.toEqual(Object.keys(forward))
    expect(forward).toEqual(reverse)
    expect(middle).toEqual(forward)

    const h = harness()
    h.controller.setScope(scope())
    const loaded = page()
    await load(h, { surface: "dashboard", query: forward }, loaded)
    const written = command(2, "dirty")
    h.controller.edit(written)
    expect(h.controller.state().draft).toEqual(written)

    const first = beginSelect(h, { surface: "dashboard", query: reverse })
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().page).toEqual(loaded)
    expect(h.controller.state().loading).toBe(true)
    expect(first.call.signal.aborted).toBe(false)
    expect(first.call.selection.query).toEqual(forward)

    const second = beginSelect(h, { surface: "dashboard", query: middle })
    expect(first.call.signal.aborted).toBe(true)
    expect(second.call.signal.aborted).toBe(false)
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().page).toEqual(loaded)

    const fresh = page({ data: { field: "fresh" } })
    second.call.gate.resolve(fresh)
    await second.pending
    first.call.gate.resolve(page({ data: { field: "stale" } }))
    await first.pending
    await drain()
    expect(h.controller.state().page).toEqual(fresh)
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().error).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().warnings).toEqual([])
    expect(h.controller.state().loading).toBe(false)
  })

  test("keeps a dirty draft on same-scope refresh unless actor permissions or permitted pages change", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const loaded = page()
    await load(h, selection(), loaded)
    const written = command(2, "dirty")
    h.controller.edit(written)
    // actor.name is the display label. Scope identity remains the shell session id.
    const refreshed = page({
      name: "renamed",
      year: 2027,
      month: 2,
      data: { field: "fresh" },
      version: 8,
      by: "someone",
      directory: [{ id: "actor", name: "renamed" }],
    })
    const reading = beginRefresh(h)
    expect(h.controller.state().draft).toEqual(written)
    reading.call.gate.resolve(refreshed)
    await reading.pending
    expect(h.controller.state().page).toEqual(refreshed)
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().conflict).toBeUndefined()

    const conflicted = beginSave(h)
    conflicted.call.gate.reject(failure(409, "conflict", { stored: { version: 99 }, by: "other" }))
    await conflicted.pending
    await drain()
    expect(h.controller.state().conflict?.status).toBe(409)
    expect(h.controller.state().draft).toEqual(written)
    expect(h.commands).toHaveLength(1)
    const benign = page({
      name: "renamed",
      year: 2028,
      month: 3,
      data: { field: "benign" },
      version: 5,
      by: "someone",
      directory: [{ id: "actor", name: "renamed" }],
    })
    const again = beginRefresh(h)
    const commands = h.commands.length
    again.call.gate.resolve(benign)
    await again.pending
    await drain()
    expect(h.controller.state().page).toEqual(benign)
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().draft?.version).toBe(command(2).version)
    expect(h.controller.state().conflict?.status).toBe(409)
    expect(h.controller.state().conflict?.detail?.by).toBe("other")
    expect(h.controller.state().conflict?.detail?.stored).toEqual({ version: 99 })
    expect(h.controller.state().saving).toBe(false)
    expect(h.commands).toHaveLength(commands)

    await expectRevocation({ actorID: "other" })
    await expectRevocation({ canWrite: false })
    await expectRevocation({ roles: ["other"] })
    await expectRevocation({ assigned: ["other"] })
    await expectRevocation({ domains: ["other"] })
    await expectRevocation({ pages: ["page", "extra"] })
  })

  test("copies selection, draft, and page so later caller mutations cannot leak", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const query = { page: "page", year: "2026", q: "needle" }
    const input: Selection = { surface: "dashboard", query }
    const started = beginSelect(h, input)
    input.surface = "procurement"
    query.page = "tampered"
    query.q = "tampered"
    expect(started.call.selection).toEqual({
      surface: "dashboard",
      query: { page: "page", year: "2026", q: "needle" },
    })
    expect(started.call.selection).not.toBe(input)
    expect(started.call.selection.query).not.toBe(query)

    const delivered = page({ data: { note: { text: "value" } } })
    started.call.gate.resolve(delivered)
    await started.pending
    const note = delivered.data.note
    if (!note || typeof note !== "object" || Array.isArray(note)) throw new Error("fixture note")
    Reflect.set(note, "text", "forged")
    Reflect.set(delivered.actor, "id", "forged")
    Reflect.set(delivered.actor, "canWrite", false)
    Reflect.set(delivered.actor.roles, 0, "forged")
    Reflect.set(delivered.pages, 0, "forged")
    Reflect.set(delivered.pages, delivered.pages.length, "extra")
    const revision = delivered.versions.field
    if (!revision) throw new Error("fixture version")
    Reflect.set(revision, "version", 99)
    const entry = delivered.directory[0]
    if (!entry) throw new Error("fixture directory")
    Reflect.set(entry, "name", "forged")
    expect(h.controller.state().page).toEqual(page({ data: { note: { text: "value" } } }))
    expect(h.controller.state().page).not.toBe(delivered)

    const written = decodeCommand({
      page: "page",
      action: "write",
      version: 2,
      values: { note: { text: "next" } },
    })
    h.controller.edit(written)
    const draftNote = written.values.note
    if (!draftNote || typeof draftNote !== "object" || Array.isArray(draftNote)) throw new Error("fixture note")
    Reflect.set(draftNote, "text", "forged")
    Reflect.set(written, "action", "forged")
    Reflect.set(written, "page", "other")
    Reflect.set(written, "version", 99)
    const stored = decodeCommand({
      page: "page",
      action: "write",
      version: 2,
      values: { note: { text: "next" } },
    })
    expect(h.controller.state().draft).toEqual(stored)

    const again = beginRefresh(h)
    expect(again.call.selection).toEqual({
      surface: "dashboard",
      query: { page: "page", year: "2026", q: "needle" },
    })
    again.call.gate.resolve(page())
    await again.pending
    expect(h.controller.state().draft).toEqual(stored)
    const saving = beginSave(h)
    expect(saving.call.surface).toBe("dashboard")
    expect(saving.call.draft).toEqual(stored)
    expect(saving.call.draft).not.toBe(written)
    h.prepare(page())
    saving.call.gate.resolve({ ok: true })
    await saving.pending
  })

  test("clears sensitive state on read 401 and 403 and preserves page and draft on other read failures", async () => {
    await ([401, 403] as const).reduce(async (previous, status) => {
      await previous
      const h = harness()
      h.controller.setScope(scope())
      const loaded = page()
      await load(h, selection(), loaded)
      h.controller.edit(command())
      await saveOk(h, ["noted"], loaded)
      h.controller.edit(command())
      expect(h.controller.state().warnings).toEqual(["noted"])
      expect(h.controller.state().draft).toEqual(command())
      expect(h.controller.state().page).toEqual(loaded)
      const reading = beginRefresh(h)
      reading.call.gate.reject(failure(status, status === 401 ? "unauthorized" : "forbidden"))
      await reading.pending
      expectSensitiveCleared(h.controller.state())
    }, Promise.resolve())

    const h = harness()
    h.controller.setScope(scope())
    const loaded = page()
    await load(h, selection(), loaded)
    const written = command(2, "kept")
    h.controller.edit(written)
    const failed = beginRefresh(h)
    failed.call.gate.reject(failure(500, "failed"))
    await failed.pending
    expect(h.controller.state().error).toBeInstanceOf(SucafinaRequestError)
    expect(h.controller.state().error?.status).toBe(500)
    expect(h.controller.state().error?.message).toBe("failed")
    expect(h.controller.state().page).toEqual(loaded)
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().loading).toBe(false)
    expect(h.controller.state().conflict).toBeUndefined()

    const race = harness()
    race.controller.setScope(scope())
    await load(race, selection(), page())
    const kept = command(2, "kept")
    race.controller.edit(kept)
    const first = beginRefresh(race)
    const second = beginRefresh(race)
    expect(first.call.signal.aborted).toBe(true)
    expect(second.call.signal.aborted).toBe(false)
    const fresh = page({ data: { field: "fresh" } })
    second.call.gate.resolve(fresh)
    await second.pending
    first.call.gate.reject(failure(500, "stale"))
    await first.pending
    await drain()
    expect(race.controller.state().error).toBeUndefined()
    expect(race.controller.state().page).toEqual(fresh)
    expect(race.controller.state().draft).toEqual(kept)
    expect(race.controller.state().loading).toBe(false)
  })

  test("submits one command using the selected surface and the draft's own version", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const sel: Selection = { surface: "planner", query: { page: "page", year: "2026" } }
    const loaded = page({ surface: "planner", version: 4 })
    await load(h, sel, loaded)
    expect(h.controller.state().draft).toBeUndefined()
    await expectNoTransport(h, () => h.controller.save())
    const written = command(2, "next")
    h.controller.edit(written)
    expect(h.controller.state().draft).toEqual(written)
    const saving = beginSave(h)
    const duplicate = h.controller.save()
    await drain()
    expect(h.commands).toHaveLength(1)
    expect(h.controller.state().saving).toBe(true)
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().draft?.version).toBe(command(2).version)
    expect(saving.call.surface).toBe("planner")
    expect(saving.call.draft).toEqual(written)
    expect(saving.call.draft.version).toBe(command(2).version)
    expect(loaded.versions.field).toEqual(revision(4))
    expect(h.controller.state().page).toEqual(loaded)
    const refreshed = page({ surface: "planner", version: 4, data: { field: "saved" } })
    h.prepare(refreshed)
    saving.call.gate.resolve({ ok: true, warnings: ["saved"] })
    await saving.pending
    await duplicate
    await drain()
    expect(h.commands).toHaveLength(1)
    expect(h.commands[0]?.draft.version).toBe(command(2).version)
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().page).toEqual(refreshed)
    expect(h.controller.state().warnings).toEqual(["saved"])
    expect(h.controller.state().saving).toBe(false)
    expect(h.reads[h.reads.length - 1]?.selection).toEqual(sel)
  })

  test("retains the draft on 422 and 409 without retry or version rebase", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const loaded = page({ version: 4 })
    await load(h, selection(), loaded)
    const written = command(2, "next")
    h.controller.edit(written)
    const invalid = beginSave(h)
    expect(invalid.call.draft).toEqual(written)
    expect(invalid.call.surface).toBe("dashboard")
    invalid.call.gate.reject(failure(422, "invalid", { errors: ["missing field", "bad year"] }))
    await invalid.pending
    await drain()
    expect(h.controller.state().error).toBeInstanceOf(SucafinaRequestError)
    expect(h.controller.state().error?.status).toBe(422)
    expect(h.controller.state().error?.message).toBe("invalid")
    expect(h.controller.state().error?.detail?.errors).toEqual(["missing field", "bad year"])
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().page).toEqual(loaded)
    expect(h.controller.state().saving).toBe(false)
    expect(h.commands).toHaveLength(1)

    const revised = command(2, "revised")
    h.controller.edit(revised)
    expect(h.controller.state().error).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().draft).toEqual(revised)

    const conflicted = beginSave(h)
    conflicted.call.gate.reject(failure(409, "conflict", { stored: { version: 99, field: "server" }, by: "other" }))
    await conflicted.pending
    await drain()
    expect(h.controller.state().conflict).toBeInstanceOf(SucafinaRequestError)
    expect(h.controller.state().conflict?.status).toBe(409)
    expect(h.controller.state().conflict?.message).toBe("conflict")
    expect(h.controller.state().conflict?.detail?.by).toBe("other")
    expect(h.controller.state().conflict?.detail?.stored).toEqual({ version: 99, field: "server" })
    expect(h.controller.state().draft).toEqual(revised)
    expect(h.controller.state().page).toEqual(loaded)
    expect(h.controller.state().saving).toBe(false)
    expect(h.commands).toHaveLength(2)
    expect(h.commands.map((call) => call.draft.version)).toEqual(ownVersions([2, 2]))

    const replaced = command(2, "after-conflict")
    h.controller.edit(replaced)
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().error).toBeUndefined()
    expect(h.controller.state().draft).toEqual(replaced)
    await drain()
    expect(h.commands).toHaveLength(2)
  })

  test("clears sensitive state on save 401 and 403 and retains the draft on other save failures", async () => {
    await ([401, 403] as const).reduce(async (previous, status) => {
      await previous
      const h = harness()
      h.controller.setScope(scope())
      const loaded = page()
      await load(h, selection(), loaded)
      h.controller.edit(command())
      await saveOk(h, ["noted"], loaded)
      h.controller.edit(command())
      expect(h.controller.state().warnings).toEqual(["noted"])
      expect(h.controller.state().draft).toEqual(command())
      expect(h.controller.state().page).toEqual(loaded)
      const reads = h.reads.length
      const commands = h.commands.length
      const saving = beginSave(h)
      saving.call.gate.reject(failure(status, status === 401 ? "unauthorized" : "forbidden"))
      await saving.pending
      await drain()
      expectSensitiveCleared(h.controller.state())
      expect(h.reads).toHaveLength(reads)
      expect(h.commands).toHaveLength(commands + 1)
    }, Promise.resolve())

    const h = harness()
    h.controller.setScope(scope())
    const loaded = page()
    await load(h, selection(), loaded)
    const written = command(2, "kept")
    h.controller.edit(written)
    const reads = h.reads.length
    const saving = beginSave(h)
    expect(saving.call.draft).toEqual(written)
    expect(h.controller.state().page).toEqual(loaded)
    saving.call.gate.reject(failure(500, "failed"))
    await saving.pending
    await drain()
    expect(h.controller.state().draft).toEqual(written)
    expect(h.controller.state().page).toEqual(loaded)
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().error).toBeInstanceOf(SucafinaRequestError)
    expect(h.controller.state().error?.status).toBe(500)
    expect(h.controller.state().error?.message).toBe("failed")
    expect(h.controller.state().saving).toBe(false)
    expect(h.commands).toHaveLength(1)
    expect(h.reads).toHaveLength(reads)
  })

  test("refreshes after a successful save and keeps only edits made while that save was pending", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const sel = selection()
    const loaded = page()
    await load(h, sel, loaded)
    const written = command(2, "once")
    h.controller.edit(written)
    const warnings = ["noted"]
    const refreshed = page({ data: { field: "saved" } })
    const saving = beginSave(h)
    expect(h.controller.state().page).toEqual(loaded)
    expect(saving.call.surface).toBe(sel.surface)
    expect(saving.call.draft).toEqual(written)
    h.prepare(refreshed)
    saving.call.gate.resolve({ ok: true, warnings })
    await saving.pending
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().warnings).toEqual(["noted"])
    expect(h.controller.state().page).toEqual(refreshed)
    expect(h.reads[h.reads.length - 1]?.selection).toEqual(sel)
    warnings.push("forged")
    expect(h.controller.state().warnings).toEqual(["noted"])

    const during = command(2, "during")
    const kept = command(2, "kept")
    h.controller.edit(during)
    const again = beginSave(h)
    expect(again.call.draft).toEqual(during)
    h.controller.edit(kept)
    expect(h.controller.state().draft).toEqual(kept)
    expect(again.call.draft).toEqual(during)
    expect(h.commands).toHaveLength(2)
    const after = page({ data: { field: "after" } })
    h.prepare(after)
    again.call.gate.resolve({ ok: true, warnings: ["after"] })
    await again.pending
    expect(h.controller.state().draft).toEqual(kept)
    expect(h.controller.state().page).toEqual(after)
    expect(h.controller.state().warnings).toEqual(["after"])
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().error).toBeUndefined()
    expect(h.controller.state().saving).toBe(false)
    expect(h.commands).toHaveLength(2)
    expect(h.reads[h.reads.length - 1]?.selection).toEqual(sel)
  })

  test("drops edits made during save when the authorized refresh revokes permission", async () => {
    const h = harness()
    h.controller.setScope(scope())
    await load(h, selection(), page())
    const written = command(2, "pending")
    const kept = command(2, "kept")
    h.controller.edit(written)
    const saving = beginSave(h)
    expect(saving.call.draft).toEqual(written)
    h.controller.edit(kept)
    expect(h.controller.state().draft).toEqual(kept)
    expect(saving.call.draft).toEqual(written)
    expect(h.commands).toHaveLength(1)
    const refreshed = page({ canWrite: false, roles: ["other"] })
    h.prepare(refreshed)
    saving.call.gate.resolve({ ok: true, warnings: ["noted"] })
    await saving.pending
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().page).toEqual(refreshed)
    expect(h.controller.state().warnings).toEqual(["noted"])
    expect(h.controller.state().saving).toBe(false)
    expect(h.commands).toHaveLength(1)
  })

  test("discard clears the draft and conflict, refreshes, and the next command uses the masked version", async () => {
    const h = harness()
    h.controller.setScope(scope())
    const sel = selection()
    await load(h, sel, page({ version: 4 }))
    h.controller.edit(command(2, "local"))
    const invalid = beginSave(h)
    invalid.call.gate.reject(failure(422, "invalid", { errors: ["missing field"] }))
    await invalid.pending
    expect(h.controller.state().error?.status).toBe(422)
    expect(h.controller.state().draft).toEqual(command(2, "local"))

    const discarding = beginDiscard(h)
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().error).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(discarding.call.selection).toEqual(sel)
    const masked = page({ version: 5, data: { field: "masked" } })
    discarding.call.gate.resolve(masked)
    await discarding.pending
    expect(h.controller.state().page).toEqual(masked)
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().loading).toBe(false)

    h.controller.edit(command(2, "local"))
    const conflicted = beginSave(h)
    // Conflict payload version 99 must not be copied into the draft or a follow-up command.
    conflicted.call.gate.reject(failure(409, "conflict", { stored: { version: 99, field: "server" }, by: "other" }))
    await conflicted.pending
    await drain()
    expect(h.controller.state().draft).toEqual(command(2, "local"))
    expect(h.controller.state().conflict?.status).toBe(409)
    expect(h.controller.state().conflict?.detail?.stored).toEqual({ version: 99, field: "server" })
    expect(h.commands.map((call) => call.draft.version)).toEqual(ownVersions([2, 2]))

    const again = beginDiscard(h)
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().error).toBeUndefined()
    expect(again.call.selection).toEqual(sel)
    const current = page({ version: 6, data: { field: "current" } })
    again.call.gate.resolve(current)
    await again.pending
    expect(h.controller.state().page).toEqual(current)
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().page?.versions.field).toEqual(revision(6))

    const next = command(6, "from-page")
    h.controller.edit(next)
    expect(h.controller.state().draft).toEqual(next)
    expect(h.controller.state().draft?.version).toBe(h.controller.state().page?.versions.field?.version)
    const saving = beginSave(h)
    expect(saving.call.draft).toEqual(next)
    expect(saving.call.surface).toBe(sel.surface)
    expect(h.commands.map((call) => call.draft.version)).toEqual(ownVersions([2, 2, 6]))
    h.prepare(page({ version: 6 }))
    saving.call.gate.resolve({ ok: true })
    await saving.pending
    await drain()
    expect(h.commands.map((call) => call.draft.version)).toEqual(ownVersions([2, 2, 6]))
  })

  test("ignores an edit unless the active page is writable and the draft names that page", async () => {
    const denied = harness()
    denied.controller.setScope(scope())
    denied.controller.edit(command())
    expect(denied.controller.state().draft).toBeUndefined()
    await expectNoTransport(denied, () => denied.controller.save())

    const readonly = page({ canWrite: false })
    await load(denied, selection(), readonly)
    denied.controller.edit(command())
    expect(denied.controller.state().draft).toBeUndefined()
    await expectNoTransport(denied, () => denied.controller.save())
    expect(denied.controller.state().page).toEqual(readonly)

    const open = harness()
    open.controller.setScope(scope())
    const loaded = page({ version: 4 })
    await load(open, selection(), loaded)
    open.controller.edit(command(2, "next", "other"))
    expect(open.controller.state().draft).toBeUndefined()
    await expectNoTransport(open, () => open.controller.save())
    const written = command(2, "next")
    open.controller.edit(written)
    expect(open.controller.state().draft).toEqual(written)
    open.controller.edit(command(6, "ignored", "other"))
    await drain()
    expect(open.controller.state().draft).toEqual(written)
    expect(open.controller.state().draft?.version).toBe(command(2).version)
    expect(loaded.versions.field).toEqual(revision(4))
    expect(open.controller.state().page).toEqual(loaded)
  })

  test("ignores a stale 401 or 403 after a newer page and draft are active", async () => {
    await ([401, 403] as const).reduce(async (previous, status) => {
      await previous
      await expectLateAuthKeepsReplacement(status, "read")
      await expectLateAuthKeepsReplacement(status, "write")
    }, Promise.resolve())
  })

  test("a deferred post-save refresh cannot revive state after selection, scope, or dispose", async () => {
    const selected = harness()
    selected.controller.setScope(scope())
    const sel = selection()
    await load(selected, sel, page())
    selected.controller.edit(command(2, "once"))
    const held = await holdSaveRefresh(selected, sel, ["noted"])
    const next: Selection = { surface: "planner", query: { ...sel.query } }
    const index = selected.reads.length
    const pending = selected.controller.select(next)
    expect(selected.controller.state().page).toBeUndefined()
    expect(selected.controller.state().draft).toBeUndefined()
    expect(selected.controller.state().warnings).toEqual([])
    expect(held.refresh.signal.aborted).toBe(true)
    expect(selected.reads).toHaveLength(index + 1)
    const call = selected.reads[index]
    if (!call) throw new Error(`missing read ${index}`)
    expect(call.signal.aborted).toBe(false)
    expect(call.selection).toEqual(next)
    const fresh = page({ surface: "planner", data: { field: "current" } })
    call.gate.resolve(fresh)
    await pending
    held.refresh.gate.resolve(page({ data: { field: "stale-refresh" }, page: "stale" }))
    await held.pending
    await drain()
    expect(selected.controller.state().page).toEqual(fresh)
    expect(selected.controller.state().draft).toBeUndefined()
    expect(selected.controller.state().warnings).toEqual([])
    expect(selected.controller.state().loading).toBe(false)
    expect(selected.controller.state().saving).toBe(false)
    expect(selected.reads).toHaveLength(index + 1)

    const moved = harness()
    moved.controller.setScope(scope())
    const origin = selection()
    await load(moved, origin, page())
    moved.controller.edit(command(2, "once"))
    const acrossScope = await holdSaveRefresh(moved, origin, ["noted"])
    const scopeReads = moved.reads.length
    const scopeCommands = moved.commands.length
    moved.controller.setScope(scope("server-b"))
    expect(acrossScope.refresh.signal.aborted).toBe(true)
    expectCleared(moved.controller.state())
    acrossScope.refresh.gate.resolve(page({ data: { field: "stale-refresh" } }))
    await acrossScope.pending
    await drain()
    expectCleared(moved.controller.state())
    expect(moved.reads).toHaveLength(scopeReads)
    expect(moved.commands).toHaveLength(scopeCommands)

    const ended = harness()
    ended.controller.setScope(scope())
    const staying = selection()
    await load(ended, staying, page())
    ended.controller.edit(command(2, "once"))
    const acrossDispose = await holdSaveRefresh(ended, staying, ["noted"])
    const disposeReads = ended.reads.length
    const disposeCommands = ended.commands.length
    ended.controller.dispose()
    expect(acrossDispose.refresh.signal.aborted).toBe(true)
    expectCleared(ended.controller.state())
    acrossDispose.refresh.gate.resolve(page({ data: { field: "stale-refresh" } }))
    await acrossDispose.pending
    await drain()
    expectCleared(ended.controller.state())
    expect(ended.reads).toHaveLength(disposeReads)
    expect(ended.commands).toHaveLength(disposeCommands)
    ended.controller.setScope(scope("server-b", "session-b"))
    await expectNoTransport(ended, () => ended.controller.select(selection()))
    await expectNoTransport(ended, () => ended.controller.refresh())
    ended.controller.edit(command())
    await expectNoTransport(ended, () => ended.controller.save())
    await expectNoTransport(ended, () => ended.controller.discardDraft())
    expectCleared(ended.controller.state())
  })

  test("ignores a late command success after dispose", async () => {
    const h = harness()
    h.controller.setScope(scope())
    await load(h, selection(), page())
    h.controller.edit(command())
    const saving = beginSave(h)
    const reads = h.reads.length
    const commands = h.commands.length
    h.controller.dispose()
    expect(saving.call.signal.aborted).toBe(true)
    expectCleared(h.controller.state())
    saving.call.gate.resolve({ ok: true, warnings: ["stale-write"] })
    await saving.pending
    await drain()
    expectCleared(h.controller.state())
    expect(h.reads).toHaveLength(reads)
    expect(h.commands).toHaveLength(commands)
    h.controller.setScope(scope("server-b", "session-b"))
    await expectNoTransport(h, () => h.controller.select(selection()))
    await expectNoTransport(h, () => h.controller.refresh())
    h.controller.edit(command())
    await expectNoTransport(h, () => h.controller.save())
    await expectNoTransport(h, () => h.controller.discardDraft())
    expectCleared(h.controller.state())
  })
})

test("permission refresh invalidates a pending write and all its later outcomes", async () => {
  for (const outcome of [401, 403, 409, 422, 500, "ok"] as const) {
    const h = harness()
    h.controller.setScope(scope())
    await load(h, selection(), page())
    h.controller.edit(command(2, "old private draft"))
    const writing = beginSave(h)
    const reading = beginRefresh(h)
    const authorized = page({ canWrite: false, roles: ["viewer"], data: { field: "masked" }, version: 9 })
    reading.call.gate.resolve(authorized)
    await reading.pending
    await drain()
    expect(h.controller.state().page).toEqual(authorized)
    expect(h.controller.state().draft).toBeUndefined()
    expect(h.controller.state().conflict).toBeUndefined()
    expect(h.controller.state().saving).toBe(false)
    expect(writing.call.signal.aborted).toBe(true)
    const afterRefresh = structuredClone(h.controller.state())
    const reads = h.reads.length
    if (outcome === "ok") writing.call.gate.resolve({ ok: true, warnings: ["old private warning"] })
    else writing.call.gate.reject(failure(outcome, "old private error", {
      stored: { private: "old restricted value" }, by: "old writer", errors: ["old private validation"],
    }))
    await writing.pending
    await drain()
    expect(h.controller.state()).toEqual(afterRefresh)
    expect(h.reads).toHaveLength(reads)
    expect(h.commands).toHaveLength(1)
    h.controller.dispose()
  }
})
