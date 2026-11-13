import { createEffect, createSignal, onCleanup, onMount, Show, untrack } from "solid-js"
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
import { NativeCommands } from "./native-commands"
import type { NativeCommandControls } from "./native-commands"

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
  const [commands, setCommands] = createSignal<NativeCommandControls>()
  const [viewRevision, setViewRevision] = createSignal(1)
  const navigate = (run: () => void) => {
    const controls = commands()
    if (controls) { controls.navigate(run); return }
    if (!controller.state().draft && !controller.state().saving) run()
  }
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
      onSave={() => commands()?.save()}
      saveLabel={commands()?.label()}
      onSurface={(surface) => {
        if (session.surfaces.includes(surface)) navigate(() => props.onSelection({ surface, query: {} }))
      }}
      onPage={(page) => {
        const current = controller.state().page
        if (current?.surface === props.selection.surface && current.pages.includes(page))
          navigate(() => props.onSelection({ surface: props.selection.surface, query: { ...props.selection.query, page } }))
      }}
      children={() => (
        <>
          <Show when={viewRevision()} keyed>{(_revision) => (
            <Show when={controller.state().page}>{(page) => (
              <NativeViews page={page()} query={props.selection.query} onQuery={(query) => {
                const surface = props.selection.surface
                // A cancelled filter navigation must restore controls to the current query too.
                if (controller.state().draft) setViewRevision((value) => value + 1)
                navigate(() => props.onSelection({ surface, query }))
              }} />
            )}</Show>
          )}</Show>
          <NativeCommands controller={controller} onControls={setCommands} />
        </>
      )}
    />
  )
}
