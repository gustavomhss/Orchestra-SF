import { createContext, createEffect, onCleanup, onMount, Show, useContext } from "solid-js"
import type { JSX } from "solid-js"
import { useLanguage } from "@/context/language"
import { MxPage } from "../kit"
import { createNativeAccess } from "./access"
import type { VerifiedAccess } from "./access"

export type NativeSession = VerifiedAccess & {
  refresh: () => Promise<void>
  signOut: () => Promise<void>
  invalidate: () => void
}
export type NativeAccessGateProps = {
  origin: string
  fetch?: typeof fetch
  children: (access: VerifiedAccess) => JSX.Element
}

const NativeSessionContext = createContext<NativeSession>()

export function useNativeSession(): NativeSession | undefined {
  return useContext(NativeSessionContext)
}

export function NativeAccessGate(props: NativeAccessGateProps): JSX.Element {
  const language = useLanguage()
  const access = createNativeAccess({ origin: props.origin, fetch: props.fetch })
  const foregroundRefresh = () => {
    if (access.state().verified && !access.state().checking && document.visibilityState === "visible") void access.refresh()
  }

  onMount(() => {
    window.addEventListener("focus", foregroundRefresh)
    document.addEventListener("visibilitychange", foregroundRefresh)
    void access.refresh()
  })
  createEffect(() => {
    if (!access.state().verified) return
    const interval = window.setInterval(foregroundRefresh, 30_000)
    onCleanup(() => window.clearInterval(interval))
  })
  onCleanup(() => {
    window.removeEventListener("focus", foregroundRefresh)
    document.removeEventListener("visibilitychange", foregroundRefresh)
    access.dispose()
  })

  return (
    <Show when={access.state().verified} keyed fallback={
      <MxPage id="sucafina-access" title={language.t("sucafina.native.access.brand")} description="">
        <div class="mx-card">
          <Show when={access.state().error !== undefined || access.state().phase === "error"}>
            <div role="alert">
              <strong>{language.t("sucafina.native.access.error")}</strong>
              <p>{language.t("sucafina.native.access.errorDescription")}</p>
            </div>
          </Show>
          <Show when={access.state().error === undefined && access.state().phase === "unconfigured"}>
            <strong>{language.t("sucafina.native.access.unconfigured")}</strong>
            <p>{language.t("sucafina.native.access.unconfiguredDescription")}</p>
          </Show>
          <Show when={access.state().error === undefined && access.state().phase === "signed-out"}>
            <strong>{language.t("sucafina.native.access.signedOut")}</strong>
            <p>{language.t("sucafina.native.access.signedOutDescription")}</p>
          </Show>
          <Show when={access.state().phase === "checking" || access.state().checking}>
            <p role="status">{language.t("sucafina.native.access.checking")}</p>
          </Show>
          <button type="button" disabled={access.state().phase === "checking" || access.state().checking} onClick={() => void access.refresh()}>
            {language.t("sucafina.native.access.retry")}
          </button>
        </div>
      </MxPage>
    }>
      {(verified) => (
        <NativeSessionContext.Provider value={Object.freeze({
          ...verified,
          refresh: access.refresh,
          signOut: access.signOut,
          invalidate: access.invalidate,
        })}>
          {props.children(verified)}
        </NativeSessionContext.Provider>
      )}
    </Show>
  )
}
