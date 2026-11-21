import { createEffect, createSignal, onCleanup, Show, untrack } from "solid-js"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../context"
import type { SfSurfaceProps } from "../../context/contracts"
import { encodeSfRouteRef } from "../../navigation-state"
import { SfPageFrame } from "../../shared/frame"
import { sfOperationReady } from "../cases/model"
import { u18Key } from "../choice/model"

type Client = ReturnType<typeof createSfDecisionsClient>
type Selection = Parameters<Client["decisions.procurement-proposal-review"]>[0]
type Review = Extract<Awaited<ReturnType<Client["decisions.procurement-proposal-review"]>>, { kind: "response" }>["body"]
type Proposal = Extract<Review, { status: "ok" }>["value"]

export function SfProcurementProposal(props: { selection: Selection; expectedVersion?: number; onReview?: (approved: boolean) => void; approvalHref?: string }) {
  const owner = useSfContext()
  const language = useLanguage()
  const [proposal, setProposal] = createSignal<Proposal>()
  const [busy, setBusy] = createSignal(false)
  const [message, setMessage] = createSignal<"missing" | "unconfirmed">()
  let active: AbortController | undefined

  const request = async (kind?: "submit" | "approve") => {
    const ready = owner.ready()
    const operation = kind ? "decisions.procurement-proposal-advance" : "decisions.procurement-proposal-review"
    if (!ready || !sfOperationReady(ready.context, operation) || busy()) return
    const reviewed = proposal()
    if (kind && !reviewed?.allowedActions.includes(kind)) return
    const controller = new AbortController()
    active = controller
    const selection = props.selection
    const client = createSfDecisionsClient(ready.transport)
    const generation = owner.generation()
    setBusy(true)
    setMessage(undefined)
    setProposal(undefined)
    props.onReview?.(false)
    try {
      const result = kind && reviewed
        ? await client["decisions.procurement-proposal-advance"]({ ...selection, action: { kind, reviewDigest: reviewed.reviewDigest } }, { signal: controller.signal, idempotencyKey: crypto.randomUUID() })
        : await client["decisions.procurement-proposal-review"](selection, { signal: controller.signal })
      if (controller.signal.aborted || generation !== owner.generation()) return
      if (result.kind === "response" && result.body.status === "ok" &&
        (props.expectedVersion === undefined || result.body.value.domainVersion === props.expectedVersion) &&
        (!kind || result.body.value.proposalDigest === reviewed?.proposalDigest)) {
        setProposal(result.body.value)
        props.onReview?.(result.body.value.state === "approved")
      } else setMessage(kind ? "unconfirmed" : "missing")
    } catch {
      if (!controller.signal.aborted && generation === owner.generation()) setMessage(kind ? "unconfirmed" : "missing")
    } finally {
      if (active === controller) {
        setBusy(false)
        active = undefined
      }
    }
  }

  createEffect(() => {
    owner.generation()
    const ready = owner.ready()
    const selection = props.selection
    active?.abort()
    setBusy(false)
    setProposal(undefined)
    props.onReview?.(false)
    if (ready && selection) untrack(() => void request())
    onCleanup(() => active?.abort())
  })

  const canAdvance = () => {
    const ready = owner.ready()
    return !!ready && sfOperationReady(ready.context, "decisions.procurement-proposal-advance")
  }
  return <section class="mx-card sf-u18-section" aria-label={language.t("sf.u18.proposal.title")}>
    <h3>{language.t("sf.u18.proposal.title")}</h3>
    <Show when={proposal()}>{(review) => <>
      <p>{review().targetId}</p>
      <dl>
        <dt>{language.t("sf.u18.proposal.current")}</dt>
        <dd>{review().currentAmount === null ? "—" : `${review().currentAmount} ${review().currency}`}</dd>
        <dt>{language.t("sf.u18.proposal.amount")}</dt><dd>{review().amount} {review().currency}</dd>
        <dt>{language.t("sf.u18.proposal.version")}</dt><dd>{review().domainVersion}</dd>
      </dl>
      <p role="status">{language.t(`sf.u18.proposal.${review().state}`)}</p>
      <Show when={review().step}>{(step) => <p>{language.t("sf.u18.proposal.step", { step: step().index + 1 })}{step().holderId ? ` · ${step().holderId}` : ""}</p>}</Show>
      <Show when={review().allowedActions.includes("submit")}>
        <button type="button" disabled={busy() || !canAdvance()} onClick={() => void request("submit")}>{language.t("sf.u18.proposal.submit")}</button>
      </Show>
      <Show when={review().allowedActions.includes("approve")}>
        <button type="button" disabled={busy() || !canAdvance()} onClick={() => void request("approve")}>{language.t("sf.u18.proposal.approve")}</button>
      </Show>
      <Show when={review().state === "pending" && props.approvalHref}>
        <p><a href={props.approvalHref}>{language.t("sf.u18.proposal.link")}</a></p>
      </Show>
    </>}</Show>
    <Show when={message()}>{(error) => <p role="status">{language.t(`sf.u18.proposal.${error()}`)}</p>}</Show>
    <button type="button" disabled={busy()} onClick={() => void request()}>{language.t("sf.u18.proposal.refresh")}</button>
  </section>
}

export function procurementProposalHref(caseRef: string, selection: Selection, owner: { serverKey?: string; projectId?: string; installationId?: string }) {
  const query = new URLSearchParams({
    proposalChoice: selection.choiceId, proposalVersion: String(selection.caseRef.version),
  })
  if (owner.serverKey && owner.projectId && owner.installationId) {
    query.set("server", owner.serverKey)
    query.set("project", owner.projectId)
    query.set("installation", owner.installationId)
  }
  return `/orchestra/sf-decisions/${encodeSfRouteRef(caseRef)}/changes/${encodeSfRouteRef(selection.changeId)}?${query}`
}

export function SfProcurementProposalPage(props: { route: Extract<SfSurfaceProps<"UI39">["route"], { kind: "entry" }> }) {
  const language = useLanguage()
  const selection = () => {
    const query = props.route.query.procurementProposal
    const parts = /^case:([^:]+):([^:]+)$/.exec(props.route.params.caseRef)
    if (!query || !parts) return undefined
    try {
      return { caseRef: { id: decodeURIComponent(parts[1]!), incarnation: decodeURIComponent(parts[2]!), version: query.caseVersion },
        choiceId: query.choiceId, changeId: props.route.params.changeRef }
    } catch {
      return undefined
    }
  }
  return <SfPageFrame titleKey={u18Key("sf.u18.proposal.title")} context={[]} tabs={[]} activeTab={null}
    secondaryActions={[]} density="comfortable" layout="work" onLayoutMode={() => undefined}>
    <Show when={selection()} fallback={<p>{language.t("sf.u18.proposal.missing")}</p>}>
      {(current) => <SfProcurementProposal selection={current()} />}
    </Show>
  </SfPageFrame>
}
