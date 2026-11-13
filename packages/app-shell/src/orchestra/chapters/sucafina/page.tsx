import { Navigate, useLocation, useNavigate, useParams } from "@solidjs/router"
import { Sucafina } from "@orchestra/schema/sucafina"
import { Option, Schema } from "effect"
import { createMemo, Show } from "solid-js"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { MxPage } from "../kit"
import type { Selection } from "./contract"
import { useNativeSession } from "./native-access-gate"
import { NativeChapter } from "./native-chapter"

const base = "/orchestra/sucafina"

export default function SucafinaPage(): JSX.Element {
  const session = useNativeSession()
  if (!session) return <NativeChapter selection={{ surface: "dashboard", query: {} }} onSelection={() => {}} />

  const language = useLanguage()
  if (!session.surfaces.length) {
    return (
      <MxPage id="sucafina-chapter-access" title={language.t("sucafina.native.access.brand")} description={language.t("sucafina.native.access.signedOutDescription")}>
        <div class="mx-card"><strong>{language.t("sucafina.native.access.signedOut")}</strong></div>
      </MxPage>
    )
  }

  const params = useParams<{ rest?: string }>()
  const location = useLocation()
  const navigate = useNavigate()
  const selection = createMemo(() => {
    const surface = session.surfaces.find((item) => item === params.rest)
    if (!surface) return undefined
    const query = Schema.decodeUnknownOption(Sucafina.PageQuery)(Object.fromEntries(new URLSearchParams(location.search)))
    return { surface, query: Option.getOrElse(query, () => ({})) }
  })
  const select = (next: Selection) => {
    if (!session.surfaces.includes(next.surface)) return
    const query = Schema.decodeUnknownOption(Sucafina.PageQuery)(next.query)
    if (Option.isNone(query)) return
    const search = new URLSearchParams()
    Object.entries(query.value).forEach(([key, value]) => {
      if (typeof value === "string") search.set(key, value)
    })
    const encoded = search.toString()
    navigate(`${base}/${next.surface}${encoded ? `?${encoded}` : ""}`)
  }

  return (
    <Show when={selection()} fallback={<Navigate href={`${base}/${session.surfaces[0]}`} />}>
      {(selected) => (
        <>
          <div class="mx-toolbar">
            <button type="button" class="mx-btn" onClick={() => void session.signOut()}>
              {language.t("sucafina.native.access.signOut")}
            </button>
          </div>
          <NativeChapter selection={selected()} onSelection={select} />
        </>
      )}
    </Show>
  )
}
