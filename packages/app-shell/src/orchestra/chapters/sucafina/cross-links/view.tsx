import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import type { SF_CROSS_COPY } from "@/i18n/orchestra-chapters/sf-cross"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import { useSfContext } from "../context"
import { sfCommonKey, useSfPresentation } from "../shared/frame/presentation"
import { SfStatePanel } from "../shared/states"
import type { SfCopyKey } from "../shared/frame/types"
import { sfExecutiveLinkAllowed, type SfExecutiveLink, type SfExecutiveSourceRoute } from "./index"

const key = (value: keyof typeof SF_CROSS_COPY): SfCopyKey => value as SfCopyKey

type Label = Readonly<{ en: string; pt: string }>
type Related = Readonly<{ kind: "risk" | "stakeholder" | "topic"; ref: string; label: string }>
const display = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback

/** No optimistic navigation: owner-bound F01 must authorize and reread first. */
export function SfExecutiveAction(props: Readonly<{
  from: SfExecutiveSourceRoute
  target: SfExecutiveLink
  label: Label | Readonly<{ key: SfCopyKey; params?: Readonly<Record<string, string | number>> }>
  pressed?: boolean
  title?: string
}>): JSX.Element {
  const owner = useSfContext()
  const { t, locale } = useSfPresentation()
  const [busy, setBusy] = createSignal(false)
  const [failure, setFailure] = createSignal<"denied" | "invalid" | "unavailable">()
  const pt = () => locale().toLowerCase().startsWith("pt")
  const allowed = () => {
    const state = owner.state(), access = owner.ready()
    return state.status === "ready" && !!access &&
      !!owner.followExecutiveLink && sfExecutiveLinkAllowed(access.context, props.target)
  }
  const invoke = async () => {
    if (!allowed() || busy()) return
    setBusy(true); setFailure(undefined)
    try {
      const status = await owner.followExecutiveLink?.(props.from, props.target)
      if (status === "committed" || status === "aborted" || status === "kept-editing") return
      console.error("SF executive navigation did not commit", { kind: props.target.kind, status })
      setFailure(status === "denied" ? "denied" : status === "invalid-link" ? "invalid" : "unavailable")
    } catch (error) {
      console.error("SF executive navigation failed", error)
      setFailure("unavailable")
    } finally {
      setBusy(false)
    }
  }
  const failureKey = () => sfCommonKey(failure() === "denied" ? "sf.common.noAccess"
    : failure() === "invalid" ? "sf.common.invalidLink" : "sf.common.unavailable")
  return <div data-sf-executive-action={props.target.kind}>
    <button type="button" class="mx-btn" disabled={!allowed() || busy()} aria-busy={busy()}
      aria-pressed={props.pressed} title={props.title}
      onClick={() => { void invoke() }}>
      {"key" in props.label ? t(props.label.key, props.label.params) : pt() ? props.label.pt : props.label.en}
    </button>
    <Show when={failure()}>{(state) =>
      <SfStatePanel state={state()} messageKey={failureKey()} />
    }</Show>
  </div>
}

/**
 * A displayed label is never a ref. Only original IDs read from the actual
 * CAP13, CAP15 and CAP02 producers can become navigation targets. The next
 * click repeats the target read under the original authenticated owner.
 */
export function SfExecutiveRelatedLinks(props: Readonly<{
  from: SfExecutiveSourceRoute
  omit: Related["kind"]
}>): JSX.Element {
  const owner = useSfContext()
  const { t } = useSfPresentation()
  const [records, setRecords] = createSignal<readonly Related[]>([])
  const [choice, setChoice] = createSignal("")
  const [status, setStatus] = createStore({ loading: false, failed: false, denied: false })
  const chosen = () => records().find((item) => JSON.stringify([item.kind, item.ref]) === choice())

  createEffect(() => {
    const generation = owner.generation(), state = owner.state(), ready = owner.ready()
    setRecords([]); setChoice("")
    setStatus({ loading: false, failed: false, denied: state.status === "denied" || state.status === "context-mismatch" })
    if (state.status !== "ready" || !ready) return
    const controller = new AbortController()
    const { signal } = controller
    const current = () => !signal.aborted && owner.generation() === generation &&
      owner.state().status === "ready" && owner.ready()?.transport === ready.transport
    const add = (kind: Related["kind"], next: readonly Related[]) => {
      if (current()) setRecords((old) => [...old.filter((item) => item.kind !== kind), ...next])
    }
    const miss = (response: { kind: string; status?: number; reason?: string; body?: { status?: string } }) => {
      if (!current()) return
      if (response.kind !== "response") {
        if (response.reason !== "aborted") setStatus("failed", true)
        return
      }
      if (response.body?.status === "denied" || response.status === 401 || response.status === 403) {
        setStatus("denied", true)
        return
      }
      setStatus("failed", true)
    }
    const jobs: Promise<void>[] = []
    if (props.omit !== "risk" && sfExecutiveLinkAllowed(ready.context, { kind: "risks" })) {
      jobs.push(createSfDomainClient(ready.transport)["domain.page.CAP13"]({}, { signal })
        .then((response) => {
          if (response.kind === "response" && response.status === 200 && response.body.status === "ok" &&
              response.body.value.capabilityId === "CAP13") {
            const next: Related[] = (response.body.value.data.risks ?? []).map((row) => ({
              kind: "risk", ref: String(row.id), label: display(row.title, display(row.name, String(row.id))),
            }))
            add("risk", next)
            return
          }
          miss(response)
        }).catch(() => { if (current()) setStatus("failed", true) }))
    }
    if (props.omit !== "stakeholder" && sfExecutiveLinkAllowed(ready.context, { kind: "stakeholders" })) {
      jobs.push(createSfDomainClient(ready.transport)["domain.page.CAP15"]({}, { signal })
        .then((response) => {
          if (response.kind === "response" && response.status === 200 && response.body.status === "ok" &&
              response.body.value.capabilityId === "CAP15") {
            const next: Related[] = (response.body.value.data.stakeholders ?? []).map((row) => ({
              kind: "stakeholder", ref: String(row.id), label: display(row.name, String(row.id)),
            }))
            add("stakeholder", next)
            return
          }
          miss(response)
        }).catch(() => { if (current()) setStatus("failed", true) }))
    }
    if (props.omit !== "topic" && sfExecutiveLinkAllowed(ready.context, { kind: "topics" })) {
      jobs.push(createSfPeopleClient(ready.transport)["domain.page.CAP02"]({ topicStatus: "" }, { signal })
        .then((response) => {
          if (response.kind === "response" && response.status === 200 && response.body.status === "ok" &&
              response.body.value.capabilityId === "CAP02") {
            const next: Related[] = response.body.value.data.hotTopics.map((row) => ({
              kind: "topic", ref: row.id, label: display(row.action, row.id),
            }))
            add("topic", next)
            return
          }
          miss(response)
        }).catch(() => { if (current()) setStatus("failed", true) }))
    }
    setStatus("loading", jobs.length > 0)
    void Promise.all(jobs).finally(() => { if (current()) setStatus("loading", false) })
    onCleanup(() => controller.abort())
  })

  return <section class="mt-3" data-sf-executive-record-links>
    <h3>{t(key("sf.cross.references"))}</h3>
    <div class="flex flex-wrap items-end gap-2">
      <label class="flex flex-col gap-1">
        <span>{t(key("sf.cross.openCanonical"))}</span>
        <select class="mx-input" value={choice()} onChange={(event) => setChoice(event.currentTarget.value)}
          disabled={status.loading || records().length === 0}>
          <option value="">{t(key(status.loading ? "sf.cross.loading" : "sf.cross.select"))}</option>
          <For each={records()}>{(row) => <option value={JSON.stringify([row.kind, row.ref])}>
            {t(key(`sf.cross.kind.${row.kind}`)) + " · " + row.label}
          </option>}</For>
        </select>
      </label>
      <Show when={chosen()}>{(row) =>
        <SfExecutiveAction from={props.from} target={{ kind: row().kind, ref: row().ref }}
          label={{ key: key("sf.cross.open") }} />}
      </Show>
    </div>
    <Show when={!status.loading && status.denied}>
      <SfStatePanel state="denied" messageKey={sfCommonKey("sf.common.noAccess")} />
    </Show>
    <Show when={!status.loading && !status.denied && status.failed}>
      <SfStatePanel state="unavailable" messageKey={sfCommonKey("sf.common.unavailable")} />
    </Show>
    <Show when={!status.loading && !status.denied && !status.failed && records().length === 0}>
      <p role="status" class="text-sm">
        {t(key("sf.cross.empty"))}
      </p>
    </Show>
  </section>
}
