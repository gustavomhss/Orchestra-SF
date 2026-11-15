# Mission87 → mission52: complete first-save browser consumer adapter (NOT APPLIED)

Producer route: POST {mount}/dashboard?sf=dashboard-hot-topic-draft-outcome. It requires fresh same-origin human decisions.edit admission, the ORIGINAL Idempotency-Key, Content-Type application/json, and a body containing ONLY the ORIGINAL first-register caseRef {id,incarnation,version}. Even after current case version advances, do not change this ref.

200/ok returns {draftRef,version:1} after authoritative original C08 transaction and final auth/source checks; no Apply grant. 403 denied, 409 conflict/stale, 400 malformed, and 503 unavailable all block continuation. Browser fetch itself sends Origin for same-origin POST; scripts cannot set Origin manually.

Proposed standalone adapter for mission52-owned client code (this receipt does NOT edit any UI or product path):

```ts
export type CaseRef = Readonly<{ id: string; incarnation: string; version: number }>
export type PendingFirstSave = Readonly<{ caseRef: CaseRef; key: string }>
export type OriginalAck = Readonly<{ draftRef: string; version: 1 }>
type Recovery = { state: "recovered"; value: OriginalAck } | { state: "blocked" } | { state: "none" }

const isObject = (x: unknown): x is Record<string, unknown> =>
  !!x && typeof x === "object" && !Array.isArray(x)
const exact = (x: Record<string, unknown>, keys: string[]) =>
  Object.keys(x).sort().join(",") === [...keys].sort().join(",")
const isCaseRef = (x: unknown): x is CaseRef =>
  isObject(x) && exact(x, ["id", "incarnation", "version"]) &&
  typeof x.id === "string" && !!x.id.trim() &&
  typeof x.incarnation === "string" && !!x.incarnation.trim() &&
  Number.isSafeInteger(x.version) && (x.version as number) >= 1
const isKey = (x: unknown): x is string =>
  typeof x === "string" && /^[A-Za-z0-9._:-]{8,128}$/.test(x)
const isPending = (x: unknown): x is PendingFirstSave =>
  isObject(x) && exact(x, ["caseRef", "key"]) && isCaseRef(x.caseRef) && isKey(x.key)
const isAck = (x: unknown): x is OriginalAck =>
  isObject(x) && exact(x, ["draftRef", "version"]) &&
  typeof x.draftRef === "string" && !!x.draftRef.trim() && x.version === 1
const checkedAck = (status: number, body: unknown) =>
  status === 200 && isObject(body) && body.status === "ok" && isAck(body.value) ? body.value : undefined

/** Scoped to the authenticated installation/project/principal/case UI identity. */
export function createFirstSaveRecovery(scope: string, mount: string) {
  if (!scope || !mount.startsWith("/") || mount.includes("?") || mount.includes("#"))
    throw new Error("Invalid first-save browser scope")
  const storageKey = "sf:first-hot-topic-draft:" + encodeURIComponent(scope)
  const read = (): PendingFirstSave | "invalid" | undefined => {
    try {
      const raw = sessionStorage.getItem(storageKey)
      if (raw === null) return undefined
      const parsed: unknown = JSON.parse(raw)
      return isPending(parsed) ? parsed : "invalid"
    } catch { return "invalid" }
  }
  /** MUST succeed synchronously before original first registration is sent. */
  const checkpoint = (originalCaseRef: CaseRef, originalKey: string) => {
    if (read() !== undefined || !isCaseRef(originalCaseRef) || !isKey(originalKey))
      throw new Error("First-save checkpoint unavailable")
    sessionStorage.setItem(storageKey, JSON.stringify({ caseRef: originalCaseRef, key: originalKey }))
    if (!isPending(read())) throw new Error("First-save checkpoint not retained")
  }
  /** Call only on an authenticated 200/ok response to the ORIGINAL registration. */
  const confirmRegister = (httpStatus: number, body: unknown): OriginalAck => {
    if (!isPending(read())) throw new Error("First-save checkpoint missing or corrupt")
    const ack = checkedAck(httpStatus, body)
    if (!ack) throw new Error("First-save response not authoritative")
    sessionStorage.removeItem(storageKey)
    return ack
  }
  /** Must be called exclusively from a fresh user click after reload. */
  const recoverOnClick = async (): Promise<Recovery> => {
    const pending = read()
    if (pending === undefined) return { state: "none" }
    if (pending === "invalid") return { state: "blocked" }
    const url = new URL(mount.replace(/\/$/, "") + "/dashboard?sf=dashboard-hot-topic-draft-outcome", location.origin)
    if (url.origin !== location.origin) return { state: "blocked" }
    try {
      const response = await fetch(url.toString(), {
        method: "POST", credentials: "same-origin",
        headers: { "Content-Type": "application/json", "Idempotency-Key": pending.key },
        body: JSON.stringify({ caseRef: pending.caseRef }),
        signal: AbortSignal.timeout(15000),
      })
      const body: unknown = await response.json().catch(() => undefined)
      const ack = checkedAck(response.status, body)
      if (!ack) return { state: "blocked" }
      sessionStorage.removeItem(storageKey)
      return { state: "recovered", value: ack }
    } catch { return { state: "blocked" } }
  }
  return { read, checkpoint, confirmRegister, recoverOnClick }
}
```

Integration points owned exclusively by mission52:

1. Scope the checkpoint to current authenticated installation/project/principal/case (not editable browser fields). Before any FIRST register POST, generate its key once and call checkpoint(originalCaseRef, originalKey); if persistence is denied, do not dispatch. Persist only those two values, never draft body, evidence or an Apply permission.
2. Send the original registration with its exact key. Only after an authenticated HTTP 200 with canonical {status:ok,value:{draftRef,version:1}} call confirmRegister(status,body), then bind that ACK; a timeout/abort/ambiguous response leaves the checkpoint and locks new first-register submissions.
3. On hard reload, display an explicit Recover pending first save control if read() is pending. Recover only on a fresh user click with recoverOnClick(), not automatically. Do NOT call register, replay old payload, list by timestamp or match by equal text. Success binds the original draftRef/version and clears pending; it never permits Apply.
4. On blocked or invalid checkpoint, suppress success/existence and retain the block until fresh authorized reconciliation. Do not silently generate another key or delete the checkpoint on 400/403/409/503. A changed UI actor/scope must never inherit another checkpoint.
5. Browser owner52 must independently prove hard reload with only caseRef/key, lost ACK, version advance, revocation, no second C08 write, and blocked new register during uncertain outcome. This adapter is a proposed patch for52, NOT a tested browser integration.
