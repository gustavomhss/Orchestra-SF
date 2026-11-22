import { createEffect, createMemo, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { SfResolvedRoute } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../context"
import type { SfNativeNavigationState } from "../navigation-state"
import { matchSfNativeRoutePath, sfNativeRouteSpecs } from "../route-registry"
import { sfCommonKey, useSfPresentation } from "../shared/frame/presentation"
import type { SfCopyKey } from "../shared/frame/types"
import { SfStatePanel } from "../shared/states"
import { extendedRouteAvailable } from "./extended-routes"
import { sfCaptureReadyOwner, sfSameReadyOwnerSnapshot } from "./native-chapter-entry"
import "./source-navigation.css"

const entries = sfNativeRouteSpecs.filter((route) =>
  route.kind === "entry" && /^CAP(?:0[1-9]|1[0-9]|2[0-8])$/.test(route.surfaceId))
  .sort((left, right) => left.surfaceId.localeCompare(right.surfaceId))

/** In-chapter navigation for the original 28 source pages. The manifest names
 * paths only; the live F01 context and producer availability admit each link.
 * Every ordinary click uses that same owner's guarded native transition.
 */
export function SfSourceNavigation(props: Readonly<{
  route: () => SfResolvedRoute | undefined
  navigation: Pick<SfNativeNavigationState, "requestNativeTransition">
}>): JSX.Element {
  const handle = useSfContext()
  const { t } = useSfPresentation()
  const [view, setView] = createStore<{ busy?: string; failure?: "denied" | "invalid" | "unavailable" }>({})
  const pending = { revision: 0 }
  onCleanup(() => { pending.revision += 1 })
  const owner = () => {
    const route = props.route(), state = handle.state()
    if (!route || state.status !== "ready" || !entries.some((entry) => entry.surfaceId === route.surfaceId)) return
    const captured = sfCaptureReadyOwner(state)
    const candidate = matchSfNativeRoutePath(route.pathname)
    if (!captured || !candidate || candidate.surfaceId !== route.surfaceId ||
      captured.selection.serverKey !== route.ownerSelection.serverKey ||
      captured.selection.projectId !== route.ownerSelection.projectId ||
      captured.selection.installationId !== route.ownerSelection.installationId) return
    return { captured, context: state.context, chapter: candidate.chapterId }
  }
  const links = createMemo(() => {
    const current = owner()
    if (!current) return []
    return entries.flatMap((entry) => {
      if (entry.chapterId !== current.chapter) return []
      const candidate = matchSfNativeRoutePath(entry.pattern)
      if (!candidate || !extendedRouteAvailable(current.context, candidate)) return []
      const selection = current.captured.selection
      return [{ surfaceId: entry.surfaceId, href: entry.pattern + "?" + new URLSearchParams({
        server: selection.serverKey!, project: selection.projectId!, installation: selection.installationId!,
      }).toString() }]
    })
  })
  createEffect(() => {
    void handle.generation()
    void props.route()?.href
    pending.revision += 1
    setView("busy", undefined)
    setView("failure", undefined)
  })
  let navigation: HTMLElement | undefined
  createEffect(() => {
    const surface = props.route()?.surfaceId
    void links()
    if (!surface || !/^CAP(?:0[1-9]|1[0-9]|2[0-8])$/.test(surface)) return
    const reveal = () => {
      const strip = navigation
      const active = strip?.querySelector<HTMLElement>('a[aria-current="page"]')
      if (!strip || !active || strip.scrollWidth <= strip.clientWidth) return
      const viewport = strip.getBoundingClientRect(), item = active.getBoundingClientRect()
      if (item.left >= viewport.left && item.right <= viewport.right - 12) return
      strip.scrollTo({ left: strip.scrollLeft + item.left - viewport.left - (strip.clientWidth - item.width) / 2, behavior: "instant" })
    }
    const observer = new ResizeObserver(reveal)
    let canceled = false
    queueMicrotask(() => {
      if (canceled) return
      reveal()
      if (navigation) observer.observe(navigation)
    })
    onCleanup(() => { canceled = true; observer.disconnect() })
  })
  const invoke = async (href: string) => {
    const current = owner(), link = links().find((item) => item.href === href)
    if (!current || !link || view.busy) return
    const generation = handle.generation(), revision = ++pending.revision
    const stillCurrent = () => pending.revision === revision && sfSameReadyOwnerSnapshot(handle, current.captured, generation)
    setView("busy", link.surfaceId)
    setView("failure", undefined)
    try {
      const result = await props.navigation.requestNativeTransition(href, "sidebar", {
        expectedOwnerKey: current.captured.ownerKey,
      })
      if (!stillCurrent()) return
      if (result.status === "committed" || result.status === "aborted" || result.status === "kept-editing") return
      console.error("Sucafina source navigation did not commit", { status: result.status })
      setView("failure", result.status === "denied" ? "denied" : result.status === "invalid-link" ? "invalid" : "unavailable")
    } catch (error) {
      if (!stillCurrent()) return
      console.error("Sucafina source navigation failed", error instanceof Error ? error.name : "unknown")
      setView("failure", "unavailable")
    } finally {
      if (stillCurrent()) setView("busy", undefined)
    }
  }
  return <Show when={links().length}>
    <nav ref={navigation} class="sf-source-navigation" aria-label={t(sfCommonKey("sf.common.moreViews"))}
      data-sf-source-navigation={owner()?.chapter}
      data-sf-source-polished={/^CAP(?:0[1-9]|1[0-9]|2[0-8])$/.test(props.route()?.surfaceId ?? "") ? "" : undefined}>
      <For each={links()}>{(link) => <a href={link.href}
        data-sf-capability={link.surfaceId}
        aria-current={props.route()?.surfaceId === link.surfaceId ? "page" : undefined}
        aria-busy={view.busy === link.surfaceId} aria-disabled={view.busy !== undefined}
        onClick={(event) => {
          if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          void invoke(link.href)
        }}>
        {t(("sf." + link.surfaceId.toLowerCase() + ".title") as SfCopyKey)}
      </a>}</For>
    </nav>
    <Show when={view.failure}>{(state) => <SfStatePanel state={state()}
      messageKey={sfCommonKey(state() === "denied" ? "sf.common.noAccess"
        : state() === "invalid" ? "sf.common.invalidLink" : "sf.common.unavailable")} />}</Show>
  </Show>
}
