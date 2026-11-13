import type { Sucafina } from "@orchestra/schema/sucafina"
import type { Accessor } from "solid-js"

export type Scope = { server: string; identity: string }
export type Selection = { surface: Sucafina.Surface; query: Sucafina.PageQuery }
export type Draft = Sucafina.Command
export type Transport = {
  read: (selection: Selection, signal: AbortSignal) => Promise<Sucafina.PageState>
  command: (surface: Sucafina.Surface, command: Draft, signal: AbortSignal) => Promise<{ ok: true; warnings?: readonly string[] }>
}

export class SucafinaRequestError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly detail?: { stored?: unknown; by?: string; errors?: readonly string[] },
  ) {
    super(message)
    this.name = "SucafinaRequestError"
  }
}

export type ControllerState = {
  page?: Sucafina.PageState
  draft?: Draft
  loading: boolean
  saving: boolean
  error?: SucafinaRequestError
  conflict?: SucafinaRequestError
  warnings: readonly string[]
}

export type Controller = {
  state: Accessor<ControllerState>
  setScope: (scope: Scope | undefined) => void
  select: (selection: Selection) => Promise<void>
  refresh: () => Promise<void>
  edit: (draft: Draft) => void
  save: () => Promise<void>
  discardDraft: () => Promise<void>
  dispose: () => void
}
