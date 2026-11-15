import { createEffect, createMemo, createSignal, For, onCleanup, Show, type JSX } from "solid-js"
import { createStore } from "solid-js/store"
import { useLanguage } from "@/context/language"
import { createSfDomainClient } from "@orchestra/client/sucafina/domain"
import { SfDomain, SfDomainPerformance } from "@orchestra/schema/sucafina/domain"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import type { SfEditScopeKey, SfIntentRef, SfOperationRef, SfRef } from "@orchestra/schema/sucafina/context"
import type { SfPublicDraftController, SfSurfaceProps } from "../../context/contracts"
import { useSfContext } from "../../context"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/table"
import { SfStatePanel } from "../../shared/states"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewField, SfReviewSnapshot } from "../../shared/change-review"
import "./performance.css"

type Performance = typeof SfDomainPerformance.Type
type Item = NonNullable<Performance["items"]>[number]
type Sub = NonNullable<Item["subs"]>[number]
type ContractInput = typeof SfDomain.operations["domain.command.CAP16.save"]["input"]["Type"]
type ItemInput = typeof SfDomain.operations["domain.command.CAP16.save-item"]["input"]["Type"]
type SubInput = typeof SfDomain.operations["domain.command.CAP16.save-sub"]["input"]["Type"]
type ContractValues = ContractInput["values"]
type ItemValues = ItemInput["values"]
type SubValues = SubInput["values"]

type EditKind = "contract" | "item" | "sub"
type CommandKind = "save" | "save-item" | "delete-item" | "save-sub" | "delete-sub"
type FormData = Readonly<{
  kind: EditKind
  itemId?: string; subId?: string
  name?: string; year?: string; description?: string; color?: string
  label?: string; objective?: string; target?: string
  totalWeight?: string; owner?: string; ownerWeight?: string
  co1?: string; co1Weight?: string; co2?: string; co2Weight?: string
  score?: string; status?: string; q1?: string; q2?: string; q3?: string; q4?: string
  statusQ1?: string; statusQ2?: string; statusQ3?: string; statusQ4?: string
  notes?: string
}>
type FieldName = Extract<keyof FormData, string>
type Field = Readonly<{ name: FieldName; label: string; kind: "text" | "textarea" | "number" | "select";
  required?: boolean; options?: readonly string[] }>
type ActiveEdit = Readonly<{
  controller: SfPublicDraftController<FormData>
  identity: { kind: "record"; recordRef: SfRef } | { kind: "new"; newIntentRef: SfIntentRef }
  record: Item | Sub | Performance | undefined
  sourceSub: Sub | undefined
  itemId: string | null
  command: "save" | "save-item" | "save-sub"
  operationRef: SfOperationRef
}>
type Removal = Readonly<{ kind: "delete-item" | "delete-sub"; itemId: string; subId?: string; operationRef: SfOperationRef }>
type Mode = "overview" | "edit" | "review-edit" | "review-delete"
const key = (s: string) => s as SfCopyKey
const labelMessage = (s: string) => ({ key: key(s) })
const text = (value: unknown): string =>
  value === undefined || value === null ? "" :
  typeof value === "string" || typeof value === "number" || typeof value === "boolean" ? String(value) : ""
const reference = (value: unknown): string | null =>
  typeof value === "string" && value.trim() ? value
    : typeof value === "number" && Number.isFinite(value) ? String(value) : null
const finite = (value: string | undefined): number | undefined =>
  value === undefined || value.trim() === "" ? undefined : Number(value)
const stringOr = (value: unknown) => value === undefined || value === null ? undefined : text(value)
const opId: Readonly<Record<CommandKind, SfOperationId>> = {
  save: "domain.command.CAP16.save",
  "save-item": "domain.command.CAP16.save-item",
  "delete-item": "domain.command.CAP16.delete-item",
  "save-sub": "domain.command.CAP16.save-sub",
  "delete-sub": "domain.command.CAP16.delete-sub",
}
const statusOptions = ["", "ahead", "on", "behind", "complete", "rescheduled"] as const

const EDIT_FIELDS: Readonly<Record<EditKind, readonly Field[]>> = {
  contract: [
    { name: "name", label: "sf.u31.contractName", kind: "text" },
    { name: "year", label: "sf.u31.year", kind: "number" },
  ],
  item: [
    { name: "name", label: "sf.u31.itemName", kind: "text", required: true },
    { name: "description", label: "sf.u31.description", kind: "textarea" },
    { name: "color", label: "sf.u31.color", kind: "text" },
    { name: "totalWeight", label: "sf.u31.itemWeight", kind: "number" },
    { name: "ownerWeight", label: "sf.u31.ownerWeight", kind: "number" },
    { name: "co1Weight", label: "sf.u31.co1Weight", kind: "number" },
    { name: "co2Weight", label: "sf.u31.co2Weight", kind: "number" },
  ],
  sub: [
    { name: "label", label: "sf.u31.subName", kind: "text", required: true },
    { name: "objective", label: "sf.u31.objective", kind: "textarea" },
    { name: "description", label: "sf.u31.description", kind: "textarea" },
    { name: "target", label: "sf.u31.target", kind: "text" },
    { name: "totalWeight", label: "sf.u31.totalWeight", kind: "number" },
    { name: "owner", label: "sf.u31.owner", kind: "text" },
    { name: "ownerWeight", label: "sf.u31.ownerWeight", kind: "number" },
    { name: "co1", label: "sf.u31.co1", kind: "text" },
    { name: "co1Weight", label: "sf.u31.co1Weight", kind: "number" },
    { name: "co2", label: "sf.u31.co2", kind: "text" },
    { name: "co2Weight", label: "sf.u31.co2Weight", kind: "number" },
    { name: "score", label: "sf.u31.score", kind: "number" },
    { name: "status", label: "sf.u31.status", kind: "select", options: statusOptions },
    { name: "q1", label: "sf.u31.q1", kind: "text" },
    { name: "q2", label: "sf.u31.q2", kind: "text" },
    { name: "q3", label: "sf.u31.q3", kind: "text" },
    { name: "q4", label: "sf.u31.q4", kind: "text" },
    { name: "statusQ1", label: "sf.u31.statusQ1", kind: "text" },
    { name: "statusQ2", label: "sf.u31.statusQ2", kind: "text" },
    { name: "statusQ3", label: "sf.u31.statusQ3", kind: "text" },
    { name: "statusQ4", label: "sf.u31.statusQ4", kind: "text" },
    { name: "notes", label: "sf.u31.notes", kind: "textarea" },
  ],
}
const editContract = (data: Performance): FormData => ({
  kind: "contract", name: text(data.name), year: stringOr(data.year),
})
const editItem = (item?: Item): FormData => ({
  kind: "item", itemId: reference(item?.id) || undefined,
  name: text(item?.name), description: text(item?.description), color: stringOr(item?.color),
  totalWeight: stringOr(item?.totalWeight), ownerWeight: stringOr(item?.ownerWeight),
  co1Weight: stringOr(item?.co1Weight), co2Weight: stringOr(item?.co2Weight),
})
const editSub = (itemId: string, sub?: Sub): FormData => ({
  kind: "sub", itemId, subId: reference(sub?.id) || undefined,
  label: text(sub?.label), objective: text(sub?.objective), target: stringOr(sub?.target),
  description: stringOr(sub?.description),
  totalWeight: stringOr(sub?.totalWeight), owner: text(sub?.owner),
  ownerWeight: stringOr(sub?.ownerWeight), co1: text(sub?.co1),
  co1Weight: stringOr(sub?.co1Weight), co2: text(sub?.co2),
  co2Weight: stringOr(sub?.co2Weight), score: stringOr(sub?.score),
  status: text(sub?.status), q1: stringOr(sub?.q1), q2: stringOr(sub?.q2),
  q3: stringOr(sub?.q3), q4: stringOr(sub?.q4),
  statusQ1: stringOr(sub?.statusQ1), statusQ2: stringOr(sub?.statusQ2),
  statusQ3: stringOr(sub?.statusQ3), statusQ4: stringOr(sub?.statusQ4),
  notes: text(sub?.notes),
})
const contractValues = (v: FormData): ContractValues => ({
  name: v.name, year: finite(v.year),
})
const itemValues = (v: FormData): ItemValues => ({
  itemId: v.itemId, name: v.name, description: v.description,
  totalWeight: finite(v.totalWeight), ownerWeight: finite(v.ownerWeight),
  co1Weight: finite(v.co1Weight), co2Weight: finite(v.co2Weight), color: v.color,
})
const subValues = (v: FormData, source?: Sub): SubValues => ({
  itemId: v.itemId || "", subId: v.subId, label: v.label, objective: v.objective,
  target: v.target === stringOr(source?.target) ? source?.target : v.target,
  description: v.description, totalWeight: finite(v.totalWeight), owner: v.owner,
  ownerWeight: finite(v.ownerWeight), co1: v.co1, co1Weight: finite(v.co1Weight),
  co2: v.co2, co2Weight: finite(v.co2Weight), score: finite(v.score),
  status: v.status,
  q1: v.q1 === stringOr(source?.q1) ? source?.q1 : v.q1,
  q2: v.q2 === stringOr(source?.q2) ? source?.q2 : v.q2,
  q3: v.q3 === stringOr(source?.q3) ? source?.q3 : v.q3,
  q4: v.q4 === stringOr(source?.q4) ? source?.q4 : v.q4,
  statusQ1: v.statusQ1, statusQ2: v.statusQ2,
  statusQ3: v.statusQ3, statusQ4: v.statusQ4, notes: v.notes,
})
const finiteEdit = (v: FormData): boolean => {
  const nums: readonly (keyof FormData)[] = v.kind === "contract" ? ["year"]
    : v.kind === "item" ? ["totalWeight", "ownerWeight", "co1Weight", "co2Weight"]
    : ["totalWeight", "ownerWeight", "co1Weight", "co2Weight", "score"]
  return nums.every((key) => {
    const raw = v[key]
    return raw === undefined || raw.trim() === "" ||
      Number.isFinite(Number(raw)) && (key !== "year" || Number.isInteger(Number(raw)))
  })
}
function fields(value: FormData): readonly SfReviewField[] {
  return EDIT_FIELDS[value.kind].map((field) => ({
    path: field.name, label: labelMessage(field.label),
    value: value[field.name] === undefined
      ? { kind: "missing", reason: labelMessage("sf.common.unknown") }
      : { kind: "text", text: { kind: "data", text: text(value[field.name]) } },
  }))
}
function readState(status: string, http: number): SfUiState {
  if (http === 401 || status === "unauthenticated") return "session-expired"
  if (http === 403 || status === "denied") return "denied"
  if (status === "stale") return "stale"
  if (status === "needs-input") return "invalid"
  return "unavailable"
}

export function SfPerformanceView(props: SfSurfaceProps<"CAP16">): JSX.Element {
  const owner = useSfContext()
  const language = useLanguage()
  const t = (name: string) => language.t(name as Parameters<typeof language.t>[0])
  const [store, setStore] = createStore({
    state: "loading" as SfUiState,
    data: undefined as Performance | undefined,
    cas: undefined as number | undefined,
    actions: [] as readonly string[],
    ownerId: "",
    focusItem: null as string | null,
    focusSub: null as string | null,
    mode: "overview" as Mode,
    error: null as string | null,
    warnings: [] as readonly string[],
    confirmedWeights: false,
    busy: false,
    uncertain: false,
    reload: 0,
  })
  const [active, setActive] = createSignal<ActiveEdit | null>(null)
  const [removal, setRemoval] = createSignal<Removal | null>(null)
  const [confirmed, setConfirmed] = createSignal<Readonly<{
    controller: SfPublicDraftController<FormData>
    operationRef: SfOperationRef
    kind: EditKind
    itemId: string | null
    subId: string | null
  }> | null>(null)
  let readOwner = ""
  let deepLink = ""
  const ready = () => {
    const context = owner.state()
    const value = owner.ready()
    return context.status === "ready" && value
      ? { context, value, key: [context.ownerKey, context.context.stamp.accessRevision].join("|") }
      : undefined
  }
  const current = () => ready()?.key === store.ownerId && !!store.ownerId &&
    store.state !== "denied" && store.state !== "session-expired"
  const data = () => current() ? store.data : undefined
  const items = () => data()?.items || []
  const allowed = (kind: CommandKind) => {
    const r = ready()
    const destination = r?.context.context.destinations.find(
      (entry) => entry.capabilityId === "CAP16" && entry.canRead)
    return current() && store.cas !== undefined &&
      !!destination && destination.allowedActionIds.includes(kind) &&
      store.actions.includes(kind) && r!.context.context.availability.some((resource) =>
        resource.operations.some((operation) =>
          operation.operationId === opId[kind] && operation.state === "ready"))
  }
  const refresh = () => setStore("reload", (n) => n + 1)
  const snapshot = () => active()?.controller.snapshot()

  createEffect(() => {
    const r = ready()
    const generation = owner.generation()
    void store.reload
    if (!r || !r.context.context.destinations.some(
      (entry) => entry.capabilityId === "CAP16" && entry.canRead)) {
      readOwner = ""
      deepLink = ""
      setActive(null)
      setRemoval(null)
      setConfirmed(null)
      setStore({ data: undefined, ownerId: "", cas: undefined, actions: [],
        mode: "overview", focusItem: null, focusSub: null, error: null,
        state: !r ? owner.state().status === "resolving" ? "loading"
          : owner.state().status === "unauthenticated" ? "session-expired"
          : owner.state().status === "denied" ? "denied" : "unavailable" : "denied" })
      return
    }
    if (readOwner !== r.key) {
      readOwner = r.key
      deepLink = ""
      setActive(null)
      setRemoval(null)
      setConfirmed(null)
      setStore({ data: undefined, ownerId: "", cas: undefined, focusItem: null,
        focusSub: null, mode: "overview", error: null, warnings: [], uncertain: false })
    }
    setStore("state", "loading")
    const controller = new AbortController()
    let live = true
    const client = createSfDomainClient(r.value.transport)
    void client["domain.page.CAP16"]({}, { signal: controller.signal }).then((response) => {
      if (!live || owner.generation() !== generation || ready()?.key !== r.key) return
      if (response.kind !== "response" || response.body.status !== "ok") {
        setStore({ data: undefined, ownerId: "", actions: [], cas: undefined,
          state: response.kind === "response" ? readState(response.body.status, response.status) : "unavailable" })
        return
      }
      const value = response.body.value.data.itperf
      const cas = response.body.value.versions.itperf
      if (!value) {
        setStore({ data: undefined, ownerId: "", actions: [], cas: undefined, state: "unavailable" })
        return
      }
      setStore({ data: value, cas, actions: response.body.value.allowedActionIds,
        ownerId: r.key, state: "ready" })
      const pending = confirmed()
      if (pending) {
        // Only an authorized server refetch may confirm a successful edit.
        const item = pending.itemId ? (value.items || []).find((entry) =>
          reference(entry.id) === pending.itemId) : undefined
        const sub = item && pending.subId ? (item.subs || []).find((entry) =>
          reference(entry.id) === pending.subId) : undefined
        const fresh = pending.kind === "contract" ? editContract(value)
          : pending.kind === "item" && item ? editItem(item)
          : pending.kind === "sub" && item && sub ? editSub(pending.itemId!, sub)
          : undefined
        if (fresh && cas !== undefined)
          pending.controller.confirmSave({ kind: "projected",
            operationRef: pending.operationRef, baseVersion: cas, value: fresh })
        else pending.controller.confirmSave({ kind: "confirmed-without-projection",
          operationRef: pending.operationRef, resultVersion: null })
        setConfirmed(null)
      } else if (active() && active()!.controller.snapshot().availability === "active" && cas !== undefined) {
        // Shared itperf version governs every item and subitem, not one invented row CAS.
        const editing = active()!
        const item = editing.itemId ? (value.items || []).find((entry) =>
          reference(entry.id) === editing.itemId) : undefined
        const editSnapshot = editing.controller.snapshot()
        const sub = item && editing.command === "save-sub" && editSnapshot.availability === "active"
          ? (item.subs || []).find((entry) => reference(entry.id) === editSnapshot.value.subId)
          : undefined
        const fresh = editing.command === "save" ? editContract(value)
          : editing.command === "save-item" && item ? editItem(item)
          : editing.command === "save-sub" && item && sub ? editSub(editing.itemId!, sub) : undefined
        if (fresh) editing.controller.receiveRemote({ baseVersion: cas, value: fresh })
      }
      if (deepLink !== r.key + ":" + props.route.pathname) {
        deepLink = r.key + ":" + props.route.pathname
        if (props.route.kind !== "entry") {
          const itemId = String(props.route.params.itemRef)
          const item = (value.items || []).find((entry) => reference(entry.id) === itemId)
          if (!item) {
            setStore({ data: undefined, ownerId: "", state: "not-found" })
            return
          }
          setStore({ focusItem: itemId, focusSub: null })
          if (props.route.kind === "subitem") {
            const subId = String(props.route.params.subitemRef)
            if (!(item.subs || []).some((sub) => reference(sub.id) === subId)) {
              setStore({ data: undefined, ownerId: "", state: "not-found" })
              return
            }
            setStore("focusSub", subId)
          }
        }
      }
    }).catch((error: unknown) => {
      if (!live || controller.signal.aborted) return
      console.error("N16 CAP16 read failed")
      setStore({ state: "unavailable", data: undefined, ownerId: "", cas: undefined, actions: [] })
    })
    onCleanup(() => { live = false; controller.abort() })
  })

  const beginEdit = (kind: EditKind, item?: Item, sub?: Sub) => {
    const r = ready()
    const operation: ActiveEdit["command"] = kind === "contract" ? "save"
      : kind === "item" ? "save-item" : "save-sub"
    const itemId = reference(item?.id)
    if (!r || !data() || !allowed(operation) || (kind === "sub" && !itemId)) return
    const value = kind === "contract" ? editContract(data()!)
      : kind === "item" ? editItem(item)
      : editSub(itemId!, sub)
    const identity: ActiveEdit["identity"] = kind === "contract"
      ? { kind: "record", recordRef: "itperf" as SfRef }
      : kind === "item" && itemId
        ? { kind: "record", recordRef: itemId as SfRef }
        : kind === "sub" && reference(sub?.id)
          ? { kind: "record", recordRef: reference(sub!.id)! as SfRef }
          : { kind: "new", newIntentRef: ("n16-new:" + kind + ":" + (itemId || "root")) as SfIntentRef }
    const draft = r.value.drafts.acquire<FormData>({
      surfaceId: "CAP16",
      editScopeKey: ("cap16:" + kind + ":" + (itemId || "root")) as SfEditScopeKey,
      identity, baseVersion: store.cas!, base: kind === "contract" || !!item || !!sub ? value : null,
      value, revalidation: { operationId: "domain.page.CAP16", input: {},
        fieldPaths: EDIT_FIELDS[kind].map((field) => field.name), actionIds: [operation] },
    })
    setActive({ controller: draft, identity, record: kind === "contract" ? data()
      : kind === "sub" ? sub : item, sourceSub: kind === "sub" ? sub : undefined,
      itemId, command: operation,
      operationRef: crypto.randomUUID() as SfOperationRef })
    setRemoval(null)
    setStore({ mode: "edit", error: null, confirmedWeights: false, warnings: [] })
  }

  const beginRemove = (kind: Removal["kind"], item: Item, sub?: Sub) => {
    const itemId = reference(item.id)
    const subId = reference(sub?.id)
    if (!allowed(kind) || !itemId || kind === "delete-sub" && !subId) return
    setActive(null)
    setRemoval({ kind, itemId, subId: subId || undefined,
      operationRef: crypto.randomUUID() as SfOperationRef })
    setStore({ mode: "review-delete", error: null, confirmedWeights: false })
  }
  const draftFields = () => {
    const state = snapshot()
    return state?.availability === "active" ? fields(state.value) : []
  }
  const beginReview = () => {
    const editing = active()
    const state = snapshot()
    if (!editing || state?.availability !== "active" || store.uncertain || !allowed(editing.command)) return
    if (!finiteEdit(state.value) ||
        EDIT_FIELDS[state.value.kind].some((field) => field.required && !text(state.value[field.name]).trim())) {
      setStore("error", t("sf.common.fieldErrorSummary"))
      return
    }
    editing.controller.setPhase("reviewing")
    setStore({ mode: "review-edit", error: null })
  }

  const perform = async () => {
    const r = ready()
    const editing = active()
    const deleting = removal()
    const isDelete = store.mode === "review-delete" && !!deleting
    const action = isDelete ? deleting!.kind : editing?.command
    if (!r || !action || !allowed(action) || store.busy || store.uncertain || store.cas === undefined) return
    const currentDraft = editing?.controller.snapshot()
    if (!isDelete && (!editing || currentDraft?.availability !== "active" ||
        currentDraft.baseVersion !== store.cas)) {
      setStore({ error: t("sf.common.stale"), mode: "edit" })
      return
    }
    const commandRef = isDelete ? deleting!.operationRef : editing!.operationRef
    const idempotencyKey = crypto.randomUUID()
    const signal = new AbortController()
    const confirmedWeights = store.confirmedWeights
    setStore({ busy: true, error: null })
    try {
      if (!isDelete && currentDraft?.availability === "active") {
        const payload = new TextEncoder().encode(JSON.stringify([
          opId[action], currentDraft.value, store.cas, confirmedWeights, idempotencyKey]))
        const digest = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", payload)))
          .map((byte) => byte.toString(16).padStart(2, "0")).join("")
        editing!.controller.setPending({ operationRef: commandRef,
          idempotencyKey, payloadDigest: digest, expectedVersion: store.cas })
        editing!.controller.setPhase("submitting")
      }
      const client = createSfDomainClient(r.value.transport)
      // Exactly five frozen A01 operations, never a free action/path dispatcher.
      const response = isDelete && deleting!.kind === "delete-item"
        ? await client["domain.command.CAP16.delete-item"]({
            version: store.cas, confirmed: confirmedWeights,
            values: { itemId: deleting!.itemId } }, { signal: signal.signal, idempotencyKey })
        : isDelete && deleting!.kind === "delete-sub"
        ? await client["domain.command.CAP16.delete-sub"]({
            version: store.cas, confirmed: confirmedWeights,
            values: { itemId: deleting!.itemId, subId: deleting!.subId! }
          }, { signal: signal.signal, idempotencyKey })
        : action === "save" && currentDraft?.availability === "active"
        ? await client["domain.command.CAP16.save"]({
            version: store.cas, confirmed: confirmedWeights, values: contractValues(currentDraft.value),
          }, { signal: signal.signal, idempotencyKey })
        : action === "save-item" && currentDraft?.availability === "active"
        ? await client["domain.command.CAP16.save-item"]({
            version: store.cas, confirmed: confirmedWeights, values: itemValues(currentDraft.value),
          }, { signal: signal.signal, idempotencyKey })
        : action === "save-sub" && currentDraft?.availability === "active"
        ? await client["domain.command.CAP16.save-sub"]({
            version: store.cas, confirmed: confirmedWeights,
            values: subValues(currentDraft.value, editing?.sourceSub),
          }, { signal: signal.signal, idempotencyKey })
        : null
      if (ready()?.key !== r.key) return
      if (response?.kind === "response" && response.status >= 200 &&
          response.status < 300 && response.body.ok) {
        setStore({ warnings: response.body.warnings || [], error: null,
          mode: "overview", confirmedWeights: false })
        if (!isDelete && editing && currentDraft?.availability === "active")
          setConfirmed({ controller: editing.controller, operationRef: commandRef,
            kind: currentDraft.value.kind, itemId: editing.itemId,
            subId: currentDraft.value.subId || null })
        refresh()
      } else if (response?.kind === "transport-error" &&
          response.reason === "outcome-unknown" || response === null) {
        editing?.controller.setPhase("outcome-unknown")
        setStore({ uncertain: true, error: t("sf.common.operationUnknown") })
      } else if (response?.kind === "response") {
        editing?.controller.setPhase(response.status === 409 ? "conflict" : "validation-error")
        setStore({ mode: isDelete ? "overview" : "edit",
          error: !response.body.ok ? response.body.errors?.join(" ") || t("sf.common.failed") : t("sf.common.failed") })
        if (response.status === 401 || response.status === 403)
          setStore({ data: undefined, ownerId: "", cas: undefined, actions: [],
            state: response.status === 401 ? "session-expired" : "denied" })
      } else {
        setStore({ error: t("sf.common.unavailable"), mode: isDelete ? "overview" : "edit" })
      }
    } catch (error: unknown) {
      console.error("N16 CAP16 mutation result unknown")
      editing?.controller.setPhase("outcome-unknown")
      setStore({ uncertain: true, error: t("sf.common.operationUnknown") })
    } finally {
      setStore("busy", false)
    }
  }

  const ownerAssignments = createMemo(() => items().flatMap((item) => (item.subs || []).flatMap((sub) =>
    ([["owner", sub.owner, sub.ownerWeight],["co1", sub.co1, sub.co1Weight],
      ["co2", sub.co2, sub.co2Weight]] as const)
      .filter((entry) => text(entry[1]).trim())
      .map((entry) => ({ name: text(entry[1]), role: entry[0], weight: entry[2],
        item: text(item.name), sub: text(sub.label) })))))
  const readCopy = () => store.state === "loading" ? "sf.common.loading"
    : store.state === "denied" ? "sf.common.noAccess"
    : store.state === "session-expired" ? "sf.common.loginAgain"
    : store.state === "not-found" ? "sf.common.removed"
    : store.state === "stale" ? "sf.common.stale" : "sf.common.unavailable"
  const sourceReview = (): SfReviewSnapshot | null => {
    const editing = active()
    const state = snapshot()
    if (!editing || state?.availability !== "active" || !editing.record || store.cas === undefined) return null
    return { kind: "persisted", ref: editing.identity.kind === "record"
      ? editing.identity.recordRef : "itperf" as SfRef,
      version: state.baseVersion ?? store.cas, fields: state.base ? fields(state.base) : [] }
  }

  return <div data-sf-surface="CAP16" data-sf-authorized={current()}>
    <SfPageFrame titleKey={key("sf.cap16.title")} context={[]} tabs={[]} activeTab={null}
      density="comfortable" layout="work" onLayoutMode={() => undefined}
      primaryAction={allowed("save-item") ? {
        id: "new-item", labelKey: key("sf.cap16.primary"), tone: "primary",
        disabled: store.busy || store.uncertain, busy: store.busy,
        onInvoke: () => beginEdit("item"),
      } : undefined}
      secondaryActions={[]}>
      <SfStatePanel state={store.state} messageKey={key(readCopy())}
        onRetryRead={refresh} onBack={() => setStore({ mode: "overview", focusItem: null, focusSub: null })}>
        <Show when={data()}>
          {(performance) => <div class="sf-u31-shell">
            <Show when={store.error}>
              {(error) => <p class="sf-u31-error" role="alert"><bdi>{error()}</bdi></p>}
            </Show>
            <Show when={store.uncertain}>
              <SfStatePanel state="outcome-unknown" messageKey={key("sf.common.operationUnknown")}
                onRetryRead={refresh} />
            </Show>
            <Show when={store.warnings.length}>
              <ul role="status"><For each={store.warnings}>{(warning) => <li><bdi>{warning}</bdi></li>}</For></ul>
            </Show>
            <section id="performance-contract" aria-labelledby="sf-u31-contract">
              <h2 id="sf-u31-contract">{t("sf.u31.contract")}</h2>
              <dl class="sf-u31-definitions">
                <dt>{t("sf.u31.name")}</dt><dd><bdi>{text(performance().name)}</bdi></dd>
                <dt>{t("sf.u31.year")}</dt><dd><bdi>{text(performance().year)}</bdi></dd>
                <dt>{t("sf.u31.noGlobalScore")}</dt>
                <dd>{t("sf.common.unavailable")}</dd>
              </dl>
              <Show when={allowed("save")}>
                <button class="mx-btn" type="button" onClick={() => beginEdit("contract")}>
                  {t("sf.u31.saveContract")}
                </button>
              </Show>
            </section>
            <div class="sf-u31-grid">
              <section class="sf-u31-panel" aria-labelledby="sf-u31-items">
                <h2 id="sf-u31-items">{t("sf.u31.item")}</h2>
                <Show when={items().length} fallback={<p>{t("sf.common.empty")}</p>}>
                  <div class="sf-u31-cards">
                    <For each={items()}>
                      {(item) => {
                        const itemRef = () => reference(item.id)
                        return <article class="sf-u31-item" data-sf-performance-item={itemRef() || undefined}>
                          <h3><bdi>{text(item.name)}</bdi></h3>
                          <dl class="sf-u31-definitions">
                            <dt>{t("sf.u31.itemWeight")}</dt><dd><bdi>{text(item.totalWeight)}</bdi></dd>
                            <dt>{t("sf.u31.ownerWeight")}</dt><dd><bdi>{text(item.ownerWeight)}</bdi></dd>
                            <dt>{t("sf.u31.co1Weight")}</dt><dd><bdi>{text(item.co1Weight)}</bdi></dd>
                            <dt>{t("sf.u31.co2Weight")}</dt><dd><bdi>{text(item.co2Weight)}</bdi></dd>
                            <Show when={item.description !== undefined}>
                              <dt>{t("sf.u31.description")}</dt><dd><bdi>{text(item.description)}</bdi></dd>
                            </Show>
                            <Show when={item.color !== undefined}>
                              <dt>{t("sf.u31.color")}</dt><dd><bdi>{text(item.color)}</bdi></dd>
                            </Show>
                          </dl>
                          <div class="sf-u31-actions">
                            <Show when={allowed("save-item") && itemRef()}>
                              <button type="button" class="mx-btn"
                                onClick={() => beginEdit("item",item)}>{t("sf.u31.saveItem")}</button>
                            </Show>
                            <Show when={allowed("delete-item") && itemRef()}>
                              <button type="button" class="mx-btn danger"
                                onClick={() => beginRemove("delete-item",item)}>{t("sf.u31.deleteItem")}</button>
                            </Show>
                            <Show when={allowed("save-sub") && itemRef()}>
                              <button type="button" class="mx-btn"
                                onClick={() => beginEdit("sub",item)}>{t("sf.u31.addSub")}</button>
                            </Show>
                          </div>
                          <Show when={(item.subs || []).length} fallback={<p>{t("sf.common.empty")}</p>}>
                            <div class="sf-u31-rows" role="region" aria-label={t("sf.u31.subName")} tabindex="0">
                              <table><thead><tr>
                                <th scope="col">{t("sf.u31.subName")}</th>
                                <th scope="col">{t("sf.u31.totalWeight")}</th>
                                <th scope="col">{t("sf.u31.score")}</th>
                                <th scope="col">{t("sf.u31.status")}</th>
                                <th scope="col">{t("sf.u31.owner")}</th>
                                <th scope="col">{t("sf.u31.q1")}</th>
                                <th scope="col">{t("sf.u31.q2")}</th>
                                <th scope="col">{t("sf.u31.q3")}</th>
                                <th scope="col">{t("sf.u31.q4")}</th>
                                <th scope="col">{t("sf.u31.readChange")}</th>
                              </tr></thead><tbody>
                                <For each={item.subs || []}>{(sub) => <tr data-sf-performance-sub={reference(sub.id) || undefined}>
                                  <th scope="row"><bdi>{text(sub.label)}</bdi></th>
                                  <td><bdi>{text(sub.totalWeight)}</bdi></td>
                                  <td><bdi>{text(sub.score)}</bdi></td>
                                  <td><bdi>{text(sub.status)}</bdi></td>
                                  <td><bdi>{text(sub.owner)}</bdi></td>
                                  <td><bdi>{text(sub.q1)}</bdi></td>
                                  <td><bdi>{text(sub.q2)}</bdi></td>
                                  <td><bdi>{text(sub.q3)}</bdi></td>
                                  <td><bdi>{text(sub.q4)}</bdi></td>
                                  <td><div class="sf-u31-actions">
                                    <Show when={allowed("save-sub") && reference(sub.id) && itemRef()}>
                                      <button type="button" class="mx-btn" onClick={() => beginEdit("sub",item,sub)}>
                                        {t("sf.u31.saveSub")}</button>
                                    </Show>
                                    <Show when={allowed("delete-sub") && reference(sub.id) && itemRef()}>
                                      <button type="button" class="mx-btn danger"
                                        onClick={() => beginRemove("delete-sub",item,sub)}>
                                        {t("sf.u31.deleteSub")}</button>
                                    </Show>
                                  </div></td>
                                </tr>}</For>
                              </tbody></table>
                            </div>
                          </Show>
                          <Show when={store.focusItem === itemRef() && store.focusSub}>
                            <For each={(item.subs || []).filter((sub) => reference(sub.id) === store.focusSub)}>
                              {(sub) => <dl class="sf-u31-definitions">
                                <dt>{t("sf.u31.objective")}</dt><dd><bdi>{text(sub.objective)}</bdi></dd>
                                <dt>{t("sf.u31.target")}</dt><dd><bdi>{text(sub.target)}</bdi></dd>
                                <dt>{t("sf.u31.co1")}</dt><dd><bdi>{text(sub.co1)}</bdi></dd>
                                <dt>{t("sf.u31.co2")}</dt><dd><bdi>{text(sub.co2)}</bdi></dd>
                                <dt>{t("sf.u31.notes")}</dt><dd><bdi>{text(sub.notes)}</bdi></dd>
                                <dt>{t("sf.u31.q1") + " " + t("sf.u31.status")}</dt><dd><bdi>{text(sub.statusQ1)}</bdi></dd>
                                <dt>{t("sf.u31.q2") + " " + t("sf.u31.status")}</dt><dd><bdi>{text(sub.statusQ2)}</bdi></dd>
                                <dt>{t("sf.u31.q3") + " " + t("sf.u31.status")}</dt><dd><bdi>{text(sub.statusQ3)}</bdi></dd>
                                <dt>{t("sf.u31.q4") + " " + t("sf.u31.status")}</dt><dd><bdi>{text(sub.statusQ4)}</bdi></dd>
                              </dl>}
                            </For>
                          </Show>
                        </article>
                      }}
                    </For>
                  </div>
                </Show>
              </section>
              <section class="sf-u31-panel" id="owner-dashboard" aria-labelledby="sf-u31-owners">
                <h2 id="sf-u31-owners">{t("sf.u31.ownerDashboard")}</h2>
                <p>{t("sf.common.currentSource")}</p>
                <Show when={ownerAssignments().length} fallback={<p>{t("sf.common.empty")}</p>}>
                  <div class="sf-u31-rows" role="region" aria-label={t("sf.u31.ownerDashboard")} tabindex="0">
                    <table><thead><tr><th scope="col">{t("sf.u31.owner")}</th>
                      <th scope="col">{t("sf.u31.role")}</th>
                      <th scope="col">{t("sf.u31.subName")}</th>
                      <th scope="col">{t("sf.u31.allocations")}</th>
                    </tr></thead><tbody>
                      <For each={ownerAssignments()}>{(assignment) => <tr>
                        <th scope="row"><bdi>{assignment.name}</bdi></th>
                        <td>{t("sf.u31." + assignment.role)}</td>
                        <td><bdi>{assignment.item + " / " + assignment.sub}</bdi></td>
                        <td><bdi>{text(assignment.weight)}</bdi></td>
                      </tr>}</For>
                    </tbody></table>
                  </div>
                </Show>
              </section>
            </div>
            <Show when={store.mode === "edit" && snapshot()?.availability === "active" ? active() : null}>
              {(editing) => {
                const snap = () => editing().controller.snapshot()
                const draft = () => { const state = snap(); return state.availability === "active" ? state.value : undefined }
                const modify = (field: FieldName, value: string) => {
                  const previous = snap()
                  if (previous.availability === "active")
                    editing().controller.edit({ ...previous.value, [field]: value })
                }
                return <form class="sf-u31-panel" data-sf-performance-editor
                  onSubmit={(event) => { event.preventDefault(); beginReview() }}>
                  <h2>{t(editing().command === "save" ? "sf.u31.saveContract"
                    : editing().command === "save-item" ? "sf.u31.saveItem" : "sf.u31.saveSub")}</h2>
                  <div class="sf-u31-fieldset">
                    <For each={EDIT_FIELDS[draft()?.kind || "item"]}>
                      {(field) => <label>{t(field.label)}
                        <Show when={field.kind === "textarea"} fallback={
                          <Show when={field.kind === "select"} fallback={
                            <input type={field.kind === "number" ? "number" : "text"}
                              step={field.kind === "number" ? "any" : undefined}
                              min={field.name === "score" ? 1 : undefined}
                              required={field.required} value={draft() ? text(draft()![field.name]) : ""}
                              onInput={(event) => modify(field.name,event.currentTarget.value)} />
                          }>
                            <select value={draft() ? text(draft()![field.name]) : ""}
                              onChange={(event) => modify(field.name,event.currentTarget.value)}>
                              <For each={field.options || []}>{(option) =>
                                <option value={option}>{t("sf.u31.status." + (option || "blank"))}</option>}</For>
                            </select>
                          </Show>
                        }>
                          <textarea value={draft() ? text(draft()![field.name]) : ""}
                            onInput={(event) => modify(field.name,event.currentTarget.value)} />
                        </Show>
                      </label>}
                    </For>
                  </div>
                  <div class="sf-u31-actions">
                    <button type="submit" class="mx-btn primary" disabled={store.busy || store.uncertain}>
                      {t("sf.common.review")}
                    </button>
                    <button type="button" class="mx-btn" onClick={() => setStore("mode", "overview")}>
                      {t("sf.common.back")}
                    </button>
                    <button type="button" class="mx-btn" onClick={() => {
                      editing().controller.discard(); setStore({ mode: "overview", error: null })
                    }}>{t("sf.common.discard")}</button>
                  </div>
                </form>
              }}
            </Show>
            <Show when={store.mode === "review-edit" && snapshot()?.availability === "active" ? active() : null}>
              {(editing) => {
                const currentDraft = () => editing().controller.snapshot()
                const proposed = () => { const state = currentDraft(); return state.availability === "active" ? state.value : undefined }
                return <section class="sf-u31-panel" aria-label={t("sf.common.review")}>
                  <label><input type="checkbox" checked={store.confirmedWeights}
                    onChange={(event) => setStore("confirmedWeights", event.currentTarget.checked)} />
                    {t("sf.u31.confirmWeights")}</label>
                  <SfChangeReview
                    operation={{ ref: editing().operationRef,
                      label: labelMessage(editing().command === "save" ? "sf.u31.saveContract"
                        : editing().command === "save-item" ? "sf.u31.saveItem" : "sf.u31.saveSub"),
                      scope: { kind: "message", message: labelMessage("sf.cap16.title") } }}
                    base={sourceReview()} current={sourceReview()}
                    proposed={{ kind: "draft", intentRef: editing().identity.kind === "new"
                      ? editing().identity.newIntentRef :
                        ("n16-edit:" + String(editing().identity.recordRef)) as SfIntentRef,
                      sourceRef: editing().identity.kind === "record" ? editing().identity.recordRef : null,
                      sourceVersion: (() => { const state = currentDraft(); return state.availability === "active"
                        ? state.baseVersion : null })(),
                      fields: proposed() ? fields(proposed()!) : [] }}
                    effects={[{ id: "itperf-save", domain: "dashboard", state: "proposed",
                      title: { kind: "message", message: labelMessage("sf.cap16.title") },
                      details: proposed() ? fields(proposed()!) : [] }]}
                    coverage={{ state: "complete", summary: labelMessage("sf.common.currentSource"),
                      reasons: [], knownCount: null, expectedCount: null }}
                    blockingReasons={store.uncertain ? [labelMessage("sf.common.operationUnknown")] : []}
                    confirmation={!store.uncertain && allowed(editing().command)
                      ? { kind: "admitted", labelKey: key("sf.common.save"), purpose: "save",
                        binding: { kind: "catalog-command", operationId: opId[editing().command],
                          version: { kind: "record", expectedVersion: store.cas! },
                          confirmation: store.confirmedWeights ? "producer-confirmed-field" : "presentation-only" } }
                      : { kind: "blocked", labelKey: key("sf.common.unavailable"),
                        reasons: [labelMessage("sf.common.unavailable")] }}
                    state={store.uncertain ? "outcome-unknown" : "ready"}
                    onConfirm={() => { void perform() }}
                    onRevise={() => setStore("mode", "edit")}
                    onCancel={() => setStore("mode", "edit")}
                    onReconcile={refresh}
                  />
                </section>
              }}
            </Show>
            <Show when={store.mode === "review-delete" ? removal() : null}>
              {(target) => <section class="sf-u31-panel" aria-label={t("sf.common.review")}>
                <SfChangeReview operation={{ ref: target().operationRef,
                  label: labelMessage(target().kind === "delete-item" ? "sf.u31.deleteItem" : "sf.u31.deleteSub"),
                  scope: { kind: "message", message: labelMessage("sf.cap16.title") } }}
                  base={{ kind: "persisted", ref: (target().subId || target().itemId) as SfRef,
                    version: store.cas!, fields: [] }}
                  current={{ kind: "persisted", ref: (target().subId || target().itemId) as SfRef,
                    version: store.cas!, fields: [] }}
                  proposed={{ kind: "not-provided", reason: labelMessage("sf.common.removed") }}
                  effects={[{ id: "itperf-delete", domain: "dashboard", state: "proposed",
                    title: { kind: "message", message: labelMessage("sf.cap16.title") }, details: [] }]}
                  coverage={{ state: "complete", summary: labelMessage("sf.common.currentSource"),
                    reasons: [], knownCount: null, expectedCount: null }}
                  blockingReasons={store.uncertain ? [labelMessage("sf.common.operationUnknown")] : []}
                  confirmation={!store.uncertain && allowed(target().kind)
                    ? { kind: "admitted",
                      labelKey: key(target().kind === "delete-item" ? "sf.u31.deleteItem" : "sf.u31.deleteSub"),
                      purpose: "delete",
                      binding: { kind: "catalog-command", operationId: opId[target().kind],
                        version: { kind: "record", expectedVersion: store.cas! },
                        confirmation: "presentation-only" } }
                    : { kind: "blocked", labelKey: key("sf.common.unavailable"),
                      reasons: [labelMessage("sf.common.unavailable")] }}
                  state={store.uncertain ? "outcome-unknown" : "ready"}
                  onConfirm={() => { void perform() }}
                  onRevise={() => setStore("mode", "overview")}
                  onCancel={() => setStore("mode", "overview")}
                  onReconcile={refresh}
                />
              </section>}
            </Show>
          </div>}
        </Show>
      </SfStatePanel>
    </SfPageFrame>
  </div>
}
