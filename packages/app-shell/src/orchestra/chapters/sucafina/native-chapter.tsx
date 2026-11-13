import { createEffect, onCleanup, onMount, untrack } from "solid-js"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { MxPage } from "../kit"
import { SucafinaRequestError } from "./contract"
import type { Selection, Transport } from "./contract"
import { useNativeSession } from "./native-access-gate"
import { createNativeTransport } from "./transport"
import { createSucafinaController } from "./controller"
import { NativeShell } from "./native-shell"
import { NativeViews } from "./native-views"

export type NativeChapterProps = {
  selection: Selection
  onSelection: (selection: Selection) => void
  fetch?: typeof fetch
}

export function NativeChapter(props: NativeChapterProps): JSX.Element {
  const session = useNativeSession()
  if (!session) {
    const language = useLanguage()
    return (
      <MxPage id="sucafina-chapter-access" title={language.t("sucafina.native.access.brand")} description={language.t("sucafina.native.access.signedOutDescription")}>
        <div class="mx-card"><strong>{language.t("sucafina.native.access.signedOut")}</strong></div>
      </MxPage>
    )
  }

  const native = createNativeTransport({ server: { url: session.origin }, principal: session.principal.id, fetch: props.fetch })
  const denied = (error: unknown, signal: AbortSignal): never => {
    if (!signal.aborted && error instanceof SucafinaRequestError && (error.status === 401 || error.status === 403)) session.invalidate()
    throw error
  }
  const transport: Transport = {
    read: (selection, signal) => native.read(selection, signal).catch((error: unknown) => denied(error, signal)),
    command: (surface, command, signal) => native.command(surface, command, signal).catch((error: unknown) => denied(error, signal)),
  }
  const controller = createSucafinaController(transport)
  const scope = { server: session.origin, identity: JSON.stringify([session.principal.id, session.sessionScope]) }
  onMount(() => {
    createEffect(() => {
      const selection = { surface: props.selection.surface, query: { ...props.selection.query } }
      untrack(() => {
        if (!session.surfaces.includes(selection.surface)) {
          controller.setScope(undefined)
          return
        }
        controller.setScope(scope)
        void controller.select(selection)
      })
    })
  })
  onCleanup(controller.dispose)

  return (
    <NativeShell
      controller={controller}
      surface={props.selection.surface}
      surfaces={session.surfaces}
      onSurface={(surface) => {
        if (session.surfaces.includes(surface)) props.onSelection({ surface, query: {} })
      }}
      onPage={(page) => {
        const current = controller.state().page
        if (current?.surface === props.selection.surface && current.pages.includes(page))
          props.onSelection({ surface: props.selection.surface, query: { ...props.selection.query, page } })
      }}
      children={(page) => <NativeViews page={page} query={props.selection.query} onQuery={(query) => props.onSelection({ surface: props.selection.surface, query })} />}
    />
  )
}
