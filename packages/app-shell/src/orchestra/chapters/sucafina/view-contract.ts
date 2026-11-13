import type { Sucafina } from "@orchestra/schema/sucafina"

export type NativeViewProps = {
  page: Sucafina.PageState
  query: Sucafina.PageQuery
  onQuery: (query: Sucafina.PageQuery) => void
}
