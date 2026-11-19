import { createEffect, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import { useSfContext } from "../context"
import { sfCommonKey, useSfPresentation } from "../shared/frame/presentation"
import type { SfCopyKey } from "../shared/frame"
import { SfStatePanel } from "../shared/states"
import { sfExecutiveLinkAllowed, type SfExecutiveLink, type SfExecutiveSourceRoute } from "./index"

type Label = Readonly<{ en: string; pt: string }>
type Related = Readonly<{ kind: "risk" | "stakeholder" | "topic"; ref: string; label: string }>
const display = (value: unknown, fallback: string) =>
  typeof value === "string" && value.trim() ? value : fallback

/** No optimistic navigation: owner-bound F01 must authorize and reread first. */
const copy = (value: string) => value as SfCopyKey
export function SfExecutiveAction(props: Readonly<{
  from: SfExecutiveSourceRoute
  target: SfExecutiveLink
  label?: Label
  labelKey?: SfCopyKey
}>): JSX.Element {
  const owner = useSfContext()
  const { locale, t } = useSfPresentation()
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
      setFailure(status === "denied" ? "denied" : status === "invalid-link" ? "invalid" : "unavailable")
    } catch {
      setFailure("unavailable")
    } finally {
      setBusy(false)
    }
  }
  const failureKey = () => sfCommonKey(failure() === "denied" ? "sf.common.noAccess"
    : failure() === "invalid" ? "sf.common.invalidLink" : "sf.common.unavailable")
  return <div data-sf-executive-action={props.target.kind}>
    <button type="button" class="mx-btn" disabled={!allowed() || busy()} aria-busy={busy()}
      onClick={() => { void invoke() }}>
      {props.labelKey ? t(props.labelKey) : pt() ? props.label?.pt ?? "" : props.label?.en ?? ""}
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
  const [loading, setLoading] = createSignal(false)
  const [failed, setFailed] = createSignal(false)
  const [denied, setDenied] = createSignal(false)
  const chosen = () => records().find((item) => JSON.stringify([item.kind, item.ref]) === choice())
  const kindLabel = (kind: Related["kind"]) => t(copy(
    kind === "risk" ? "sf.cross.kind.risk" :
    kind === "stakeholder" ? "sf.cross.kind.stakeholder" : "sf.cross.kind.topic"))

  createEffect(() => {
    const generation = owner.generation(), state = owner.state(), ready = owner.ready()
    setRecords([]); setChoice(""); setLoading(false); setFailed(false); setDenied(false)
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
        if (response.reason !== "aborted") setFailed(true)
        return
      }
      if (response.body?.status === "denied" || response.status === 401 || response.status === 403) {
        setDenied(true)
        return
      }
      setFailed(true)
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
        }).catch(() => { if (current()) setFailed(true) }))
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
        }).catch(() => { if (current()) setFailed(true) }))
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
        }).catch(() => { if (current()) setFailed(true) }))
    }
    setLoading(jobs.length > 0)
    void Promise.all(jobs).finally(() => { if (current()) setLoading(false) })
    onCleanup(() => controller.abort())
  })

  return <section class="mt-3" data-sf-executive-record-links>
    <h3>{t(copy("sf.cross.references"))}</h3>
    <div class="flex flex-wrap items-end gap-2">
      <label class="flex flex-col gap-1">
        <span>{t(copy("sf.cross.openCanonical"))}</span>
        <select class="mx-input" value={choice()} onChange={(event) => setChoice(event.currentTarget.value)}
          disabled={loading() || records().length === 0}>
          <option value="">{loading() ? t(copy("sf.cross.loading")) : t(copy("sf.cross.select"))}</option>
          <For each={records()}>{(row) => <option value={JSON.stringify([row.kind, row.ref])}>
            {kindLabel(row.kind) + " · " + row.label}
          </option>}</For>
        </select>
      </label>
      <Show when={chosen()}>{(row) =>
        <SfExecutiveAction from={props.from} target={{ kind: row().kind, ref: row().ref }}
          labelKey={copy("sf.cross.open")} />}
      </Show>
    </div>
    <Show when={!loading() && denied()}>
      <SfStatePanel state="denied" messageKey={sfCommonKey("sf.common.noAccess")} />
    </Show>
    <Show when={!loading() && failed() && !denied()}>
      <SfStatePanel state="unavailable" messageKey={sfCommonKey("sf.common.unavailable")} />
    </Show>
    <Show when={!loading() && !failed() && !denied() && records().length === 0}>
      <p role="status" class="text-sm">{t(copy("sf.cross.empty"))}</p>
    </Show>
  </section>
}
