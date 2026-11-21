import { For, Show, createEffect, createUniqueId, onCleanup } from "solid-js"
import { createStore } from "solid-js/store"
import { createSfFilesClient, readSfFilesSignedAssetQuery } from "@orchestra/client/sucafina/files"
import { useLanguage } from "@/context/language"
import { useSfContext } from "../../context"
import { SfStatePanel } from "../states"
import type { SfCopyKey } from "../frame/types"

/**
 * WS-7: UI adapter to the ORIGINAL A06 source asset producer.
 * Selection is not admission. Only a scanner-accepted, CAS-bound producer write
 * can create an asset; reads require a fresh, actor-bound 5-minute HMAC link.
 * No raw URL, client-side scanner decision, local blob persistence or retry.
 */
type UploadKind = "contract" | "quote" | "signed-po" | "supplier"
type PublicAsset = Readonly<{
  id?: unknown
  name?: unknown
  type?: unknown
  bytes?: unknown
  size?: unknown
}>
export type SfBoundAssetProps = Readonly<{
  surface: "dashboard" | "procurement"
  uploadKind?: UploadKind
  page: "Vendor Contracts" | "Requests" | "Suppliers"
  recordRef: string
  recordVersion: number
  assets: readonly PublicAsset[]
  disabled: boolean
  onReconcile: () => void
}>

const allowedMime: Readonly<Record<string, readonly string[]>> = {
  pdf: ["application/pdf"],
  txt: ["text/plain"],
  md: ["text/markdown", "text/plain"],
  csv: ["text/csv", "application/vnd.ms-excel"],
  json: ["application/json"],
  png: ["image/png"],
  jpg: ["image/jpeg"],
  jpeg: ["image/jpeg"],
  doc: ["application/msword"],
  docx: ["application/vnd.openxmlformats-officedocument.wordprocessingml.document"],
  xls: ["application/vnd.ms-excel"],
  xlsx: ["application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"],
}
const maxLocalBytes = 25 * 1024 * 1024
const safeRef = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && value.length <= 255 &&
  !/[\\/\x00-\x1f\x7f%]/.test(value) && value !== "." && value !== ".."
const assetRef = (value: unknown): string | undefined =>
  safeRef(value) ? value : typeof value === "number" && Number.isSafeInteger(value) && value >= 0
    ? String(value) : undefined
const assetName = (asset: PublicAsset): string | undefined =>
  typeof asset.name === "string" && asset.name.trim() && !/[\x00-\x1f\x7f]/.test(asset.name)
    ? asset.name : assetRef(asset.id)
export function sfAssetFileAdmissible(file: Pick<File, "name" | "size" | "type">): boolean {
  const extension = file.name.split(".").pop()?.toLowerCase() ?? ""
  return file.name.length > 0 && file.name.length <= 255 && !/[\\/\"\x00-\x1f\x7f]/.test(file.name) &&
    file.size > 0 && file.size <= maxLocalBytes &&
    (allowedMime[extension]?.includes(file.type.toLowerCase()) ?? false)
}
type Scope = Readonly<{
  epoch: number; owner: string; stamp: string; ref: string; version: number
}>
type Phase = "idle" | "selected" | "sending" | "checking" | "accepted" |
  "unavailable" | "blocked" | "denied" | "stale" | "outcome-unknown"
type BoundKey =
  | "orchestra.sf.s04.bound.blockedSize"
  | "orchestra.sf.s04.bound.blockedSelection"
  | "orchestra.sf.s04.bound.sending"
  | "orchestra.sf.s04.bound.readFailed"
  | "orchestra.sf.s04.bound.unconfirmed"
  | "orchestra.sf.s04.bound.accepted"
  | "orchestra.sf.s04.bound.rejected"
  | "orchestra.sf.s04.bound.stale"
  | "orchestra.sf.s04.bound.denied"
  | "orchestra.sf.s04.bound.unavailable"
  | "orchestra.sf.s04.bound.noReference"
  | "orchestra.sf.s04.bound.checking"
  | "orchestra.sf.s04.bound.referenceGone"
  | "orchestra.sf.s04.bound.signature"
  | "orchestra.sf.s04.bound.downloadDenied"
  | "orchestra.sf.s04.bound.downloaded"
export function SfBoundAssets(props: SfBoundAssetProps) {
  const sf = useSfContext()
  const language = useLanguage()
  const t = (value: BoundKey | "orchestra.sf.s04.bound.unidentified" | "orchestra.sf.s04.bound.empty" |
    "orchestra.sf.s04.bound.refUnavailable" | "orchestra.sf.s04.bound.ref" | "orchestra.sf.s04.bound.download" |
    "orchestra.sf.s04.bound.admissionClosed" | "orchestra.sf.s04.bound.attach" | "orchestra.sf.s04.bound.selected" |
    "orchestra.sf.s04.bound.admit" | "orchestra.sf.s04.bound.reread",
    params?: Record<string, string | number>) =>
    language.t(value as Parameters<typeof language.t>[0], params)
  const inputId = createUniqueId()
  const [ui, setUi] = createStore({
    file: undefined as File | undefined,
    phase: "idle" as Phase,
    detail: "" as BoundKey | "",
    busy: false,
  })
  let controller = new AbortController()

  const scope = (): Scope | undefined => {
    const state = sf.state()
    const ready = sf.ready()
    return state.status === "ready" && ready
      ? { epoch: sf.generation(), owner: state.ownerKey,
          stamp: JSON.stringify(ready.context.stamp),
          ref: props.recordRef, version: props.recordVersion }
      : undefined
  }
  const current = (expected: Scope) => {
    const now = scope()
    return now !== undefined && now.epoch === expected.epoch && now.owner === expected.owner &&
      now.stamp === expected.stamp && now.ref === expected.ref && now.version === expected.version
  }
  const portReady = (operation: "files.asset.upload" | "files.asset.link" | "files.asset.download") =>
    sf.ready()?.context.availability.some((resource) =>
      resource.family === "files" && resource.operations.some((entry) =>
        entry.operationId === operation && entry.state === "ready" && entry.operational)) === true
  const canAdmit = () => !!props.uploadKind && !props.disabled && !!scope() &&
    safeRef(props.recordRef) && Number.isSafeInteger(props.recordVersion) &&
    props.recordVersion >= 0 && ui.phase !== "outcome-unknown" && portReady("files.asset.upload")

  createEffect(() => {
    void sf.generation()
    void sf.state().status
    void props.recordRef
    void props.recordVersion
    void props.uploadKind
    controller.abort()
    controller = new AbortController()
    setUi({ file: undefined, busy: false, phase: "idle", detail: "" })
  })
  onCleanup(() => controller.abort())

  const begin = () => {
    controller.abort()
    controller = new AbortController()
    return controller.signal
  }
  const choose = (file: File | undefined) => {
    if (ui.busy || !canAdmit()) return
    begin()
    if (!file) { setUi({ file: undefined, phase: "idle", detail: "" }); return }
    if (!sfAssetFileAdmissible(file)) {
      setUi({ file: undefined, phase: "blocked", detail: "orchestra.sf.s04.bound.blockedSize" })
      return
    }
    setUi({ file, phase: "selected", detail: "" })
  }
  const admit = async () => {
    if (ui.phase === "outcome-unknown") return
    const file = ui.file
    const snapshot = scope()
    const upload = props.uploadKind
    const ready = sf.ready()
    if (!file || !snapshot || !ready || !upload || !canAdmit() || ui.busy ||
        !sfAssetFileAdmissible(file)) {
      setUi({ phase: "blocked", detail: "orchestra.sf.s04.bound.blockedSelection" })
      return
    }
    const signal = begin()
    setUi({ phase: "sending", busy: true, detail: "orchestra.sf.s04.bound.sending" })
    let bytes: Uint8Array
    try { bytes = new Uint8Array(await file.arrayBuffer()) }
    catch {
      if (current(snapshot) && !signal.aborted) setUi({ busy: false, phase: "unavailable", detail: "orchestra.sf.s04.bound.readFailed" })
      return
    }
    if (signal.aborted || !current(snapshot) || ui.file !== file ||
        bytes.byteLength !== file.size || !portReady("files.asset.upload")) return
    const response = await createSfFilesClient(ready.transport)["files.asset.upload"]({
      surface: props.surface, upload, record: snapshot.ref, recordVersion: snapshot.version,
      name: file.name, page: props.page, mediaType: file.type, bytes,
    }, { signal, idempotencyKey: crypto.randomUUID() })
    // Transport treats any uncertain dispatched upload as outcome-unknown; do not retry.
    if (signal.aborted || !current(snapshot)) return
    if (response.kind === "transport-error") {
      setUi({ busy: false, file: undefined,
        phase: response.reason === "outcome-unknown" ? "outcome-unknown" : "unavailable",
        detail: "orchestra.sf.s04.bound.unconfirmed" })
      return
    }
    if (response.status >= 200 && response.status < 300 && response.body.ok === true) {
      // Even a producer receipt is not proof that the next authorized read sees the ref.
      setUi({ busy: false, file: undefined, phase: "accepted",
        detail: "orchestra.sf.s04.bound.accepted" })
      props.onReconcile()
      return
    }
    setUi({ busy: false, file: undefined,
      phase: response.status === 403 ? "denied" : response.status === 409 ? "stale" :
        response.status === 422 ? "blocked" : "unavailable",
      detail: response.status === 422 ? "orchestra.sf.s04.bound.rejected" :
        response.status === 409 ? "orchestra.sf.s04.bound.stale" :
        response.status === 403 ? "orchestra.sf.s04.bound.denied" : "orchestra.sf.s04.bound.unavailable" })
  }
  const download = async (id: string, name: string) => {
    if (ui.phase === "outcome-unknown") return
    const snapshot = scope()
    const ready = sf.ready()
    if (!snapshot || !ready || ui.busy || !portReady("files.asset.link") ||
        !portReady("files.asset.download") ||
        !props.assets.some((asset) => assetRef(asset.id) === id)) {
      setUi({ phase: "denied", detail: "orchestra.sf.s04.bound.noReference" })
      return
    }
    const signal = begin()
    setUi({ busy: true, phase: "checking", detail: "orchestra.sf.s04.bound.checking" })
    const client = createSfFilesClient(ready.transport)
    const link = await client["files.asset.link"]({ surface: props.surface, assetId: id }, { signal })
    if (signal.aborted || !current(snapshot)) return
    if (link.kind !== "response" || link.status !== 200 || link.body.ok !== true) {
      setUi({ busy: false, phase: "denied", detail: "orchestra.sf.s04.bound.referenceGone" })
      return
    }
    const signed = readSfFilesSignedAssetQuery(link.body.query)
    if (!signed || signed.assetId !== id || !current(snapshot)) {
      setUi({ busy: false, phase: "unavailable", detail: "orchestra.sf.s04.bound.signature" })
      return
    }
    const result = await client["files.asset.download"]({
      surface: props.surface, assetId: signed.assetId, expires: signed.expires,
      signature: signed.signature,
    }, { signal })
    if (signal.aborted || !current(snapshot)) return
    if (result.kind !== "response" || result.status !== 200 ||
        !(result.body instanceof Uint8Array) || !result.body.byteLength ||
        !props.assets.some((asset) => assetRef(asset.id) === id)) {
      setUi({ busy: false, phase: "denied", detail: "orchestra.sf.s04.bound.downloadDenied" })
      return
    }
    // Private bytes are never rendered as HTML or retained as a reusable href.
    const href = URL.createObjectURL(new Blob([new Uint8Array(result.body)], { type: "application/octet-stream" }))
    const anchor = document.createElement("a")
    anchor.href = href
    anchor.download = name.replace(/[\\/\x00-\x1f\x7f]/g, "_").slice(0, 180)
    anchor.click()
    requestAnimationFrame(() => URL.revokeObjectURL(href))
    setUi({ busy: false, phase: "idle", detail: "orchestra.sf.s04.bound.downloaded" })
  }

  const label = (asset: PublicAsset) => assetName(asset) ?? t("orchestra.sf.s04.bound.unidentified")
  return <div class="sf-bound-assets" data-sf-asset-record={props.recordRef} data-sf-asset-phase={ui.phase}>
    <Show when={props.assets.length} fallback={<SfStatePanel state="empty" messageKey={"orchestra.sf.s04.bound.empty" as SfCopyKey} />}>
      <ul><For each={props.assets}>{(asset) => {
        const id = assetRef(asset.id)
        const name = label(asset)
        return <li>
          <span>{name}</span>
          <Show when={id} fallback={<span>{" · "}{t("orchestra.sf.s04.bound.refUnavailable")}</span>}>
            {(ref) => <>
              <span>{" · "}{t("orchestra.sf.s04.bound.ref", { ref: ref() })}</span>
              <button type="button" class="mx-btn" disabled={ui.busy || ui.phase === "outcome-unknown" || !portReady("files.asset.link") ||
                !portReady("files.asset.download") || !scope()}
                onClick={() => { void download(ref(), name) }}>{t("orchestra.sf.s04.bound.download")}</button>
            </>}
          </Show>
        </li>
      }}</For></ul>
    </Show>
    <Show when={props.uploadKind} fallback={<p>{t("orchestra.sf.s04.bound.admissionClosed")}</p>}>
      <div class="sf-bound-assets-admit">
        <label for={inputId}>{t("orchestra.sf.s04.bound.attach")}</label>
        <input id={inputId} type="file" accept=".pdf,.txt,.md,.csv,.json,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
          disabled={!canAdmit() || ui.busy} onChange={(event) => {
            const file = event.currentTarget.files?.[0]
            event.currentTarget.value = ""
            choose(file)
          }} />
        <Show when={ui.file}>{(file) => <p>{t("orchestra.sf.s04.bound.selected", { name: file().name, bytes: file().size })}</p>}</Show>
        <button type="button" class="mx-btn primary" disabled={!ui.file || !canAdmit() || ui.busy}
          onClick={() => { void admit() }}>{t("orchestra.sf.s04.bound.admit", { version: props.recordVersion })}</button>
      </div>
    </Show>
    <Show when={ui.detail}>{(detail) => <p role={ui.phase === "denied" || ui.phase === "blocked" ||
      ui.phase === "stale" || ui.phase === "outcome-unknown" ? "alert" : "status"}>{t(detail() as Parameters<typeof t>[0])}</p>}</Show>
    <Show when={ui.phase === "stale" || ui.phase === "outcome-unknown" || ui.phase === "accepted"}>
      <button type="button" class="mx-btn" disabled={ui.busy} onClick={props.onReconcile}>
        {t("orchestra.sf.s04.bound.reread")}
      </button>
    </Show>
  </div>
}
