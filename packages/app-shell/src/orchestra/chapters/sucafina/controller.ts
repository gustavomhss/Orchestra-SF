import { createSignal } from "solid-js"
import { SucafinaRequestError } from "./contract"
import type { Controller, ControllerState, Draft, Scope, Selection, Transport } from "./contract"

type Page = NonNullable<ControllerState["page"]>

// Scope generation plus the per-read and per-write sequence decide which completion may land.
// Abort is advisory: a transport that ignores it can still resolve, and that result stays inert.
export function createSucafinaController(transport: Transport): Controller {
  const [state, setState] = createSignal<ControllerState>(blank())
  let disposed = false
  let scope: Scope | undefined
  let scopeGeneration = 0
  let selection: Selection | undefined
  let selectionGeneration = 0
  let draftRevision = 0
  let readSequence = 0
  let readAbort: AbortController | undefined
  let writeSequence = 0
  let writeAbort: AbortController | undefined

  function setScope(next: Scope | undefined) {
    if (disposed) return
    const incoming = next === undefined ? undefined : { server: next.server, identity: next.identity }
    if (sameScope(scope, incoming)) return
    scope = incoming
    scopeGeneration += 1
    resetSurface()
  }

  // Dispose is terminal. A late auth or command callback must not revive an unmounted controller.
  function dispose() {
    if (disposed) return
    disposed = true
    scope = undefined
    scopeGeneration += 1
    resetSurface()
  }

  function select(input: Selection) {
    if (disposed || scope === undefined) return Promise.resolve()
    const next = cloneSelection(input)
    if (selection !== undefined && sameSelection(selection, next)) return startRead()
    selection = next
    selectionGeneration += 1
    invalidateWrite()
    setState({ ...blank(), loading: true })
    return startRead()
  }

  function refresh() {
    if (disposed || scope === undefined || selection === undefined) return Promise.resolve()
    return startRead()
  }

  // Authorized write is the masked page itself: canWrite, and the draft names that page.
  // Display name is not an identity. Scope identity arrives from the shell.
  function edit(input: Draft) {
    if (disposed || scope === undefined) return
    const page = state().page
    if (page === undefined || !page.actor.canWrite) return
    if (input.page !== page.page) return
    draftRevision += 1
    setState({
      ...state(),
      draft: structuredClone(input),
      error: undefined,
      conflict: undefined,
    })
  }

  async function save() {
    if (disposed || scope === undefined || selection === undefined) return
    const draft = state().draft
    if (draft === undefined || state().saving) return
    const generation = scopeGeneration
    const selected = selectionGeneration
    const submitted = draftRevision
    const sequence = writeSequence + 1
    writeSequence = sequence
    const abort = new AbortController()
    writeAbort?.abort()
    writeAbort = abort
    const surface = selection.surface
    const command = structuredClone(draft)
    setState({ ...state(), saving: true })
    // Settle both outcomes so a rejected command stays a state change. No retry and no version rebase.
    const settled = await transport.command(surface, command, abort.signal).then(
      (result) => ({ ok: true as const, result }),
      (error: unknown) => ({ ok: false as const, error }),
    )
    if (!writeCurrent(generation, selected, sequence)) return
    if (!settled.ok) {
      const request = requestError(settled.error)
      if (request.status === 401 || request.status === 403) {
        clearPrivate()
        return
      }
      if (request.status === 409) {
        setState({ ...state(), saving: false, conflict: request })
        return
      }
      setState({ ...state(), saving: false, error: request })
      return
    }
    // Revision keeps edits that landed while this command was in flight. No optimistic page write.
    const retained = draftRevision === submitted ? undefined : state().draft
    setState({
      ...state(),
      saving: false,
      warnings: [...(settled.result.warnings ?? [])],
      error: undefined,
      conflict: undefined,
      draft: retained,
    })
    await startRead(true)
  }

  function discardDraft() {
    if (disposed || scope === undefined || selection === undefined) return Promise.resolve()
    invalidateWrite()
    draftRevision += 1
    setState({
      ...state(),
      draft: undefined,
      error: undefined,
      conflict: undefined,
      saving: false,
    })
    return startRead()
  }

  function startRead(afterSave = false) {
    const current = selection
    const generation = scopeGeneration
    const selected = selectionGeneration
    if (disposed || scope === undefined || current === undefined) return Promise.resolve()
    invalidateRead()
    const sequence = readSequence
    const abort = new AbortController()
    readAbort = abort
    setState({ ...state(), loading: true })
    return transport.read(cloneSelection(current), abort.signal).then(
      (page) => {
        if (!readCurrent(generation, selected, sequence)) return
        const next = structuredClone(page)
        const previous = state().page
        const revoked = previous !== undefined && !samePermissions(previous, next)
        if (revoked) invalidateWrite()
        const currentState = state()
        // Same selection keeps a dirty draft and an open conflict until the user, the scope, or permissions move.
        setState({
          ...currentState,
          page: next,
          loading: false,
          saving: revoked ? false : currentState.saving,
          error: undefined,
          draft: revoked ? undefined : currentState.draft,
          conflict: revoked ? undefined : currentState.conflict,
          warnings: revoked && (!afterSave || currentState.saving) ? [] : currentState.warnings,
        })
      },
      (error: unknown) => {
        if (!readCurrent(generation, selected, sequence)) return
        const request = requestError(error)
        if (request.status === 401 || request.status === 403) {
          clearPrivate()
          return
        }
        setState({ ...state(), loading: false, error: request })
      },
    )
  }

  function resetSurface() {
    selection = undefined
    selectionGeneration += 1
    invalidateRead()
    invalidateWrite()
    setState(blank())
  }

  function clearPrivate() {
    invalidateRead()
    invalidateWrite()
    setState(blank())
  }

  function invalidateRead() {
    readAbort?.abort()
    readAbort = undefined
    readSequence += 1
  }

  function invalidateWrite() {
    writeAbort?.abort()
    writeAbort = undefined
    writeSequence += 1
  }

  function readCurrent(generation: number, selected: number, sequence: number) {
    return disposed === false && generation === scopeGeneration && selected === selectionGeneration && sequence === readSequence
  }

  function writeCurrent(generation: number, selected: number, sequence: number) {
    return disposed === false && generation === scopeGeneration && selected === selectionGeneration && sequence === writeSequence
  }

  return { state, setScope, select, refresh, edit, save, discardDraft, dispose }
}

function blank(): ControllerState {
  return { loading: false, saving: false, warnings: [] }
}

function sameScope(left: Scope | undefined, right: Scope | undefined) {
  if (left === undefined || right === undefined) return left === right
  return left.server === right.server && left.identity === right.identity
}

function sameSelection(left: Selection, right: Selection) {
  return left.surface === right.surface && sameQuery(left.query, right.query)
}

function sameQuery(left: Selection["query"], right: Selection["query"]) {
  const keys = new Set<keyof Selection["query"]>([
    ...(Object.keys(left) as (keyof Selection["query"])[]),
    ...(Object.keys(right) as (keyof Selection["query"])[]),
  ])
  return [...keys].every((key) => left[key] === right[key])
}

// actor.name is a display label. Permission loss is id, canWrite, roles, assigned, domains, or permitted pages.
function samePermissions(left: Page, right: Page) {
  return (
    left.actor.id === right.actor.id &&
    left.actor.canWrite === right.actor.canWrite &&
    sameStrings(left.actor.roles, right.actor.roles) &&
    sameStrings(left.actor.assigned, right.actor.assigned) &&
    sameStrings(left.actor.domains, right.actor.domains) &&
    sameStrings(left.pages, right.pages)
  )
}

function sameStrings(left: readonly string[], right: readonly string[]) {
  return left.length === right.length && left.every((item, index) => item === right[index])
}

function cloneSelection(input: Selection): Selection {
  return { surface: input.surface, query: structuredClone(input.query) }
}

function requestError(error: unknown) {
  if (error instanceof SucafinaRequestError) {
    const detail = error.detail === undefined ? undefined : structuredClone(error.detail)
    return new SucafinaRequestError(error.status, error.message, detail)
  }
  if (error instanceof Error) return new SucafinaRequestError(0, error.message)
  return new SucafinaRequestError(0, "request failed")
}
