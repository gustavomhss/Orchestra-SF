import { For, Show, createEffect, createMemo, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfProcurementClient } from "@orchestra/client/sucafina/procurement"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import type { SfRef } from "@orchestra/schema/sucafina/context"
import { useSfContext } from "../../context"
import { encodeSfRouteRef } from "../../navigation-state"
import { decodeVendorContractsPage, vendorRef, vendorVersion } from "./model"
import {
  decodeRequestsPage, isPoWritable, requestRef, requestVersion,
  type SfRequestsRead,
} from "../requests/model"

type Ready = Extract<SfRequestsRead, { kind: "ready" }>
type Review = Readonly<{
  request: SfRef; requestVersion: number; oldRef: string; contractRef: string
}>
type Scope = Readonly<{
  epoch: number; owner: string; stamp: string; contract: string; version: number
}>
type State = "loading" | "ready" | "denied" | "unavailable" | "stale" | "reviewing" |
  "sending" | "outcome-unknown" | "verifying"
type Props = Readonly<{
  contractRef: string
  contractVersion: number
  routeHref: string
  disabled: boolean
}>

/**
 * CAP14 -> canonical CAP25 relation. No new sourcing-domain write exists:
 * the producer-owned PO.contractRef is the writable foreign reference.
 * Only current authorized PO drafts may be linked. PR, sourcing and PO are
 * navigated through the bound source request; readback is proof of persistence.
 */
export function SfContractRequestLinks(props: Props) {
  const sf = useSfContext()
  const [state, setState] = createStore({
    read: undefined as Ready | undefined,
    status: "loading" as State,
    selected: "",
    review: undefined as Review | undefined,
    refresh: 0,
    busy: false,
    notice: "",
    awaiting: undefined as Readonly<{ ref: string; contract: string }> | undefined,
  })
  let writeController: AbortController | undefined

  const scope = (): Scope | undefined => {
    const owner = sf.state()
    const ready = sf.ready()
    return owner.status === "ready" && ready
      ? { epoch: sf.generation(), owner: owner.ownerKey, stamp: JSON.stringify(ready.context.stamp),
          contract: props.contractRef, version: props.contractVersion } : undefined
  }
  const current = (expected: Scope) => {
    const now = scope()
    return !!now && now.epoch === expected.epoch && now.owner === expected.owner &&
      now.stamp === expected.stamp && now.contract === expected.contract && now.version === expected.version
  }
  const operationReady = (operation: string) =>
    sf.ready()?.context.availability.some((resource) =>
      resource.family === "procurement" && resource.resource === "CAP25" &&
      resource.operations.some((item) =>
        item.operationId === operation && item.state === "ready" && item.operational)) === true
  const canRead = () => sf.ready()?.context.destinations.some((item) =>
    item.capabilityId === "CAP25" && item.canRead) === true &&
    operationReady("domain.page.CAP25")
  const canWrite = () => !props.disabled && !state.busy && state.status === "ready" &&
    state.read?.actionIds.includes("save") === true &&
    sf.ready()?.context.destinations.some((item) =>
      item.capabilityId === "CAP25" && item.canRead && item.allowedActionIds.includes("save")) === true &&
    operationReady("domain.command.CAP25.save")

  const requestHref = (ref: SfRef, part: "requisition" | "sourcing" | "po") => {
    const ownerUrl = new URL(props.routeHref, "http://orchestra.invalid")
    const query = new URLSearchParams()
    for (const key of ["server", "project", "installation"]) {
      const value = ownerUrl.searchParams.get(key)
      if (value) query.set(key, value)
    }
    return "/orchestra/sf-procurement/requests/" + encodeSfRouteRef(ref) +
      "/" + part + (query.size ? "?" + query.toString() : "")
  }

  createEffect(() => {
    const expected = scope()
    const ready = sf.ready()
    void state.refresh
    writeController?.abort()
    setState({ read: undefined, selected: "", review: undefined, busy: false, status: "loading", notice: "" })
    if (!expected || !ready || !canRead()) {
      setState("status", "denied")
      return
    }
    const controller = new AbortController()
    void createSfProcurementClient(ready.transport)["domain.page.CAP25"](
      {}, { signal: controller.signal },
    ).then((reply) => {
      if (controller.signal.aborted || !current(expected)) return
      if (reply.kind !== "response" || reply.status >= 500) {
        setState({ status: "unavailable", read: undefined }); return
      }
      if (reply.status === 401 || reply.status === 403) {
        setState({ status: "denied", read: undefined }); return
      }
      const decoded = decodeRequestsPage(reply.body, ready.context.stamp)
      if (decoded.kind !== "ready") {
        setState({ status: decoded.kind === "stale" ? "stale" :
          decoded.kind === "denied" || decoded.kind === "unauthenticated" ? "denied" : "unavailable",
          read: undefined })
        return
      }
      const awaiting = state.awaiting
      if (awaiting) {
        const confirmed = decoded.records.some((row) => requestRef(row) === awaiting.ref &&
          row.po?.contractRef === awaiting.contract)
        setState({ awaiting: undefined,
          notice: confirmed ? "Contract/PR/PO link confirmed by an authorized CAP25 re-read." :
            "The link was not confirmed by the current source. Review and reconcile.",
          status: confirmed ? "ready" : "stale", read: decoded })
      } else setState({ status: "ready", read: decoded })
    }).catch(() => {
      if (!controller.signal.aborted && current(expected)) setState({ status: "unavailable", read: undefined })
    })
    onCleanup(() => { controller.abort(); writeController?.abort() })
  })

  const linked = createMemo(() => (state.read?.records ?? []).filter((row) =>
    row.po?.contractRef === props.contractRef && !!requestRef(row)))
  const candidates = createMemo(() => {
    const read = state.read
    if (!read) return []
    return read.records.filter((row) => {
      const ref = requestRef(row)
      return !!ref && !!row.po && isPoWritable(row) && requestVersion(read, ref) !== undefined &&
        row.po.contractRef !== props.contractRef
    })
  })
  const reviewLink = () => {
    const source = state.read
    if (!source || !canWrite() || !state.selected) return
    const row = candidates().find((item) => requestRef(item) === state.selected)
    const ref = row && requestRef(row)
    if (!row || !row.po || !ref) return
    const version = requestVersion(source, ref)
    if (version === undefined || !props.contractRef) {
      setState({ status: "stale", notice: "Missing current source version. No write dispatched." })
      return
    }
    setState({ review: { request: ref, requestVersion: version,
      oldRef: row.po.contractRef ?? "", contractRef: props.contractRef },
      status: "reviewing", notice: "" })
  }
  const confirmLink = async () => {
    const expected = scope()
    const review = state.review
    const ready = sf.ready()
    const read = state.read
    if (!expected || !review || !ready || !read || props.disabled || state.busy ||
        state.status !== "reviewing" || !operationReady("domain.command.CAP25.save") ||
        !read.actionIds.includes("save") ||
        !sf.ready()?.context.destinations.some((item) => item.capabilityId === "CAP25" &&
          item.canRead && item.allowedActionIds.includes("save"))) return
    const original = read.records.find((row) => requestRef(row) === review.request)
    if (!original || !original.po || !isPoWritable(original) ||
        original.po.contractRef !== review.oldRef ||
        requestVersion(read, review.request) !== review.requestVersion ||
        review.contractRef !== props.contractRef) {
      setState({ status: "stale", review: undefined, notice: "Source changed. Link was not submitted." })
      return
    }
    writeController = new AbortController()
    const signal = writeController.signal
    setState({ busy: true, status: "sending",
      notice: "Revalidating the contract source before the PO relationship mutation…" })
    // A stale or deleted CAP14 contract MUST NOT be linked by a writable CAP25 PO.
    // The existing producer owns both authoritative sources; this is a read
    // fence, not a substitute for server-side referential integrity.
    const contractSource = await createSfDomainClient(ready.transport)["domain.page.CAP14"](
      {}, { signal },
    )
    if (signal.aborted || !current(expected)) return
    const freshContract = contractSource.kind === "response" && contractSource.status === 200
      ? decodeVendorContractsPage(contractSource.body, ready.context.stamp) : undefined
    if (!freshContract || freshContract.kind !== "ready" ||
        !freshContract.records.some((row) => {
          const ref = vendorRef(row)
          return ref === expected.contract && vendorVersion(freshContract, ref) === expected.version
        })) {
      setState({ busy: false, status: "stale", review: undefined,
        notice: "Contract source is not current or accessible. No PO link was sent." })
      return
    }
    setState("notice", "Submitting source-version-bound PO contract relation…")
    const result = await createSfProcurementClient(ready.transport)["domain.command.CAP25.save"]({
      page: "Requests", action: "save", id: review.request, version: review.requestVersion,
      values: { po: { contractRef: review.contractRef } },
    }, { signal, idempotencyKey: crypto.randomUUID() })
    if (signal.aborted || !current(expected)) return
    if (result.kind === "transport-error") {
      setState({ busy: false, review: undefined,
        status: result.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable",
        notice: "No final source receipt. Reconcile before further edits; do not retry blindly." })
      return
    }
    if (result.status < 300 && result.body.ok === true) {
      setState({ busy: false, review: undefined, status: "verifying",
        awaiting: { ref: review.request, contract: props.contractRef },
        notice: "Source accepted write; independent authorized re-read required." })
      setState("refresh", state.refresh + 1)
      return
    }
    setState({ busy: false, review: undefined,
      status: result.status === 409 ? "stale" : result.status === 403 ? "denied" : "unavailable",
      notice: "The source did not accept the relation. Re-read CAP25 for its current version." })
  }
  const reconcile = () => { if (!state.busy) setState("refresh", state.refresh + 1) }

  return <div class="sf-contract-request-links" data-sf-contract-relation={props.contractRef}
    data-sf-contract-relation-state={state.status}>
    <Show when={state.status === "ready" || state.status === "reviewing" || state.status === "sending"}
      fallback={<p role="status">Procurement relation is not currently available ({state.status}); no link inferred.</p>}>
      <Show when={linked().length} fallback={<p>No authorized PR / sourcing / PO linked by a canonical contract reference.</p>}>
        <ul><For each={linked()}>{(row) => {
          const ref = requestRef(row)
          return <li>
            <strong>{row.number}</strong> · {row.status}
            <Show when={ref}>{(value) => <>
              <a href={requestHref(value(), "requisition")}> PR</a>
              <Show when={row.sourcing}><a href={requestHref(value(), "sourcing")}> Sourcing</a></Show>
              <Show when={row.po}><a href={requestHref(value(), "po")}> PO {row.po?.number}</a></Show>
            </>}</Show>
          </li>
        }}</For></ul>
      </Show>
      <Show when={canWrite() && candidates().length > 0}>
        <label>Link an authorized PO draft to this contract
          <select value={state.selected} disabled={state.busy} onChange={(event) =>
            setState({ selected: event.currentTarget.value, review: undefined, notice: "" })}>
            <option value="">Choose a source PR / PO…</option>
            <For each={candidates()}>{(row) =>
              <option value={requestRef(row)}>{row.number} · {row.po?.number ?? "PO draft"}</option>
            }</For>
          </select>
        </label>
        <button type="button" class="mx-btn" disabled={!state.selected || state.busy}
          onClick={reviewLink}>Review source link</button>
      </Show>
      <Show when={state.review}>{(review) => <div data-sf-contract-link-review="true">
        <p>Review: {review().request} (version {review().requestVersion}), contract reference:
          {review().oldRef || "none"} → {review().contractRef}. Only this contract reference is submitted.</p>
        <button type="button" class="mx-btn primary" disabled={state.busy || props.disabled}
          onClick={() => { void confirmLink() }}>Confirm contract link</button>
        <button type="button" class="mx-btn" disabled={state.busy}
          onClick={() => setState({ review: undefined, status: "ready" })}>Cancel</button>
      </div>}</Show>
      <p class="sf-contract-request-note">Sourcing and PR links follow the authorized request referenced by the PO.
        A sourcing-only record without an editable PO has no producer-backed contract link mutation.</p>
    </Show>
    <Show when={state.notice}><p role={state.status === "outcome-unknown" || state.status === "stale" ||
      state.status === "denied" ? "alert" : "status"}>{state.notice}</p></Show>
    <button type="button" class="mx-btn" disabled={state.busy} onClick={reconcile}>
      Re-read authorized procurement refs
    </button>
  </div>
}
