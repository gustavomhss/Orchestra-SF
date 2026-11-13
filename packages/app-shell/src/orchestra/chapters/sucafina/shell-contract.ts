import type { Sucafina } from "@orchestra/schema/sucafina"
import type { JSX } from "solid-js"
import type { Controller } from "./contract"

export type NativeShellProps = {
  controller: Pick<Controller, "state" | "save" | "refresh" | "discardDraft">
  surface: Sucafina.Surface
  surfaces: readonly Sucafina.Surface[]
  onSurface: (surface: Sucafina.Surface) => void
  onPage: (page: string) => void
  onSave?: () => void
  saveLabel?: string
  filters?: JSX.Element
  children: (page: Sucafina.PageState) => JSX.Element
}
