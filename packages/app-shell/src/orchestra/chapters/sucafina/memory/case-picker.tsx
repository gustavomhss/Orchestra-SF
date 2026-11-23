import { For, Show, createEffect, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { useSfContext } from "../context"
import { SfStatePanel } from "../shared/states"
import type { SfCopyKey, SfUiState } from "../shared/frame"

type CaseIdentity = { caseId: string; incarnation: string; version: number }
type CaseOption = CaseIdentity & { ref: string; title: string }

/** The original case catalogue supplies identities; a selection never supplies authority. */
export function SfMemoryCasePicker(props: {
  current: CaseIdentity | null
  onSelect: (choice: CaseOption | null) => void
}) {
  const owner = useSfContext()
  const language = useLanguage()
  const [view, setView] = createStore({
    state: "loading" as SfUiState,
    options: [] as CaseOption[],
    revision: 0,
  })
  createEffect(() => {
    const generation = owner.generation()
    const ready = owner.ready()
    void view.revision
    const abort = new AbortController()
    setView({ state: "loading", options: [] })
    if (!ready) return
    void createSfDecisionsClient(ready.transport)["projection.cases"]({}, { signal: abort.signal })
      .then((result) => {
        if (abort.signal.aborted || owner.generation() !== generation || owner.ready() !== ready) return
        if (result.kind !== "response" || result.body.status !== "ok") {
          setView("state", result.kind === "response" && result.body.status === "denied" ? "denied"
            : result.kind === "response" && result.body.status === "stale" ? "stale" : "unavailable")
          return
        }
        const options = result.body.value.cases.map(caseOption)
        if (options.some((option) => option === null) ||
          new Set(options.map((option) => option?.ref)).size !== options.length) {
          console.error("SF memory case catalogue omitted a valid unique identity")
          setView("state", "unavailable")
          return
        }
        const admitted = options.filter((option): option is CaseOption => option !== null)
        setView({ state: admitted.length ? "ready" : "empty", options: admitted })
      })
      .catch((error: unknown) => {
        if (abort.signal.aborted || owner.generation() !== generation || owner.ready() !== ready) return
        console.error("SF memory case catalogue read failed", error)
        setView("state", "unavailable")
      })
    onCleanup(() => abort.abort())
  })
  const selected = () => {
    const current = props.current
    return current ? view.options.find((option) =>
      option.caseId === current.caseId && option.incarnation === current.incarnation &&
      option.version === current.version)?.ref ?? "" : ""
  }
  const message = () => view.state === "loading" ? "sf.common.loading" : view.state === "empty" ? "sf.u26.noAuthorizedCases"
    : view.state === "denied" ? "sf.common.noAccess" : view.state === "stale" ? "sf.common.stale" : "sf.common.unavailable"
  return <div class="sf-memory-case-picker">
    <SfStatePanel state={view.state} messageKey={message() as SfCopyKey}
      onRetryRead={() => setView("revision", (value) => value + 1)}>
      <Show when={view.options.length}>
        <label>
          <span>{language.t("sf.u26.authorizedCase")}</span>
          <select value={selected()} data-sf-memory-case onChange={(event) =>
            props.onSelect(view.options.find((option) => option.ref === event.currentTarget.value) ?? null)}>
            <option value="">{language.t("sf.u26.chooseCase")}</option>
            <For each={view.options}>{(option) => <option value={option.ref}>{option.title}</option>}</For>
          </select>
        </label>
      </Show>
    </SfStatePanel>
  </div>
}

function caseOption(entry: { caseRef: string; title: string; version: number }): CaseOption | null {
  const match = /^case:([^:]+):([^:]+)$/.exec(entry.caseRef)
  if (!match || !Number.isSafeInteger(entry.version) || entry.version <= 0) return null
  try {
    const caseId = decodeURIComponent(match[1]!)
    const incarnation = decodeURIComponent(match[2]!)
    return caseId.trim() && incarnation.trim()
      ? { caseId, incarnation, version: entry.version, ref: entry.caseRef, title: entry.title } : null
  } catch { return null }
}
