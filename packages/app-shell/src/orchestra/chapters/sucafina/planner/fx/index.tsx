import { A } from "@solidjs/router"
import { createEffect, createSignal, For, onCleanup, Show } from "solid-js"
import { createStore } from "solid-js/store"
import type { JSX } from "solid-js"
import type { Schema } from "effect"
import { useLanguage } from "@/context/language"
import type { SF_U45_COPY } from "@/i18n/orchestra-chapters/sf-u45"
import type { SF_COMMON_COPY } from "@/i18n/orchestra-chapters/sf-common"
import { createSfPlannerClient } from "@orchestra/client/sucafina/planner"
import { SfPlanner } from "@orchestra/schema/sucafina/planner"
import { useSfContext } from "../../context"
import type {
  SfEditScopeKey, SfIntentRef, SfRef, SfSurfaceProps, SfPublicDraftController,
} from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import type { SfCopyKey, SfUiState } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { SfDataTable } from "../../shared/table"
import type { SfSort } from "../../shared/table"
import { SfChangeReview } from "../../shared/change-review"
import type { SfReviewField, SfReviewSnapshot } from "../../shared/change-review"
import "./fx.css"

type Result = Schema.Schema.Type<(typeof SfPlanner)["operations"]["domain.page.CAP22"]["output"]>
type Authorized = Extract<Result, { status: "ok" }>
type FxRate = Authorized["value"]["data"]["rates"][number]
type RateDraft = Readonly<{ id: string | null; cur: string; rate: string | number | null }>
type Intent = Readonly<{ kind: "save" | "delete"; id: string | null; version: number; ref: string }>
type Copy = keyof typeof SF_U45_COPY | keyof typeof SF_COMMON_COPY
const key = (value: Copy) => value as SfCopyKey
const ref = (value: string) => value as SfRef
const reviewField = (label: Copy, value: string): SfReviewField => ({
  path: label, label: { key: key(label) },
  value: { kind: "text", text: { kind: "data", text: value } },
})

async function hashReviewedCommand(command: unknown): Promise<string> {
  const bytes = new TextEncoder().encode(JSON.stringify(command))
  const fingerprint = await crypto.subtle.digest("SHA-256", bytes)
  return Array.from(new Uint8Array(fingerprint), (byte) => byte.toString(16).padStart(2, "0")).join("")
}

/** U45/CAP22. USD is a displayed canonical base, never an editable row.
 * Currency validation, conversion, precision and in-use checks remain in planner.ts.
 */
export function SfFxView(props: SfSurfaceProps<"CAP22">): JSX.Element {
  const host = useSfContext()
  const language = useLanguage()
  const [screen, setScreen] = createStore<{
    state: SfUiState
    page: Authorized | null
    filter: string
    versionId: string | null
    selection: string | null
    sort: SfSort
    intent: Intent | null
    busy: boolean
    problem: string | null
    lockedOutcome: boolean
  }>({
    state: "loading", page: null, filter: props.route.query.filter ?? "",
    versionId: props.route.query.version ?? null,
    selection: null, sort: { kind: "none" },
    intent: null, busy: false, problem: null, lockedOutcome: false,
  })
  const [draft, setDraft] = createSignal<SfPublicDraftController<RateDraft> | null>(null)
  const [localIntent, setLocalIntent] = createSignal<SfIntentRef | null>(null)
  const currentValue = () => {
    const state = draft()?.snapshot()
    return state?.availability === "active" ? state.value : null
  }
  const selectedVersion = () => screen.page?.value.data.selectedVersion
  const activeVersionId = () => selectedVersion()?.id ?? screen.versionId
  const canRead = () => host.ready()?.context.destinations.some(
    (item) => item.capabilityId === "CAP22" && item.canRead,
  ) === true
  const can = (action: string) => {
    const ready = host.ready()
    const destination = ready?.context.destinations.find((item) => item.capabilityId === "CAP22")
    return !!screen.page && !!destination?.canRead &&
      destination.allowedActionIds.includes(action) &&
      screen.page.value.allowedActionIds.includes(action) &&
      !screen.lockedOutcome && !(selectedVersion()?.locked ?? true)
  }
  const state = (): SfUiState => {
    switch (host.state().status) {
      case "ready": return screen.state
      case "resolving": return "loading"
      case "denied": return "denied"
      case "unauthenticated": return "session-expired"
      case "context-mismatch": return "invalid"
      default: return "unavailable"
    }
  }
  const message = (): Copy => {
    switch (state()) {
      case "ready": return "sf.cap22.description"
      case "loading": return "sf.common.loading"
      case "empty": return "sf.common.empty"
      case "filtered-empty": return "sf.common.filterEmpty"
      case "denied": return "sf.common.noAccess"
      case "session-expired": return "sf.common.loginAgain"
      case "not-found": return "sf.common.removed"
      case "outcome-unknown": return "sf.common.operationUnknown"
      case "conflict": return "sf.common.conflict"
      case "stale": return "sf.common.stale"
      case "invalid": return "sf.common.invalidLink"
      default: return "sf.common.unavailable"
    }
  }
  const read = async (signal: AbortSignal, generation: number, requestedVersion: string | null) => {
    const owner = host.ready()
    if (!owner || !canRead()) return
    const query = {
      ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
      ...(requestedVersion === null ? {} : { version: requestedVersion }),
    }
    const client = createSfPlannerClient(owner.transport)
    const result = await client["domain.page.CAP22"](query, { signal }).catch(() => {
      console.error("N20 CAP22: authorized source read failed")
      return { kind: "transport-error", reason: "network" } as const
    })
    if (signal.aborted || generation !== host.generation() || !host.ready()) return
    if (result.kind !== "response") {
      setScreen({ state: "unavailable", problem: result.reason })
      return
    }
    if (result.body.status === "ok") {
      if (result.body.context.installationId !== owner.context.stamp.installationId ||
          result.body.context.projectId !== owner.context.stamp.projectId ||
          result.body.context.hostId !== owner.context.stamp.hostId ||
          result.body.context.principalRef !== owner.context.stamp.principalRef) {
        setScreen({ page: null, state: "denied" })
        host.invalidate("host-changed")
        return
      }
      setScreen("page", result.body)
      setScreen("problem", null)
      if (!screen.lockedOutcome) setScreen("state", result.body.value.data.selectedVersion ? "ready" : "empty")
      const source = currentValue()?.id
        ? result.body.value.data.rates.find((rate) => rate.id === currentValue()?.id) : undefined
      if (source && draft()) {
        draft()!.receiveRemote({
          baseVersion: source.revision,
          value: { id: source.id, cur: source.cur, rate: source.rate },
        })
      }
      return
    }
    if (result.body.status === "denied" || result.body.status === "unauthenticated") {
      setScreen({
        page: null, intent: null,
        state: result.body.status === "denied" ? "denied" : "session-expired",
      })
      setDraft(null)
      return
    }
    setScreen("state", result.body.status === "stale" ? "stale" :
      result.body.status === "invalid" || result.body.status === "needs-input" ? "invalid" : "unavailable")
    setScreen("problem", result.body.reason)
  }
  createEffect(() => {
    const generation = host.generation()
    const status = host.state().status
    const versionId = screen.versionId
    const year = props.route.query.year
    const controller = new AbortController()
    if (status !== "ready" || !host.ready() || !canRead()) {
      setScreen({ state: status === "denied" || status === "ready" ? "denied" : "loading", page: null, intent: null })
      setDraft(null)
    } else {
      void read(controller.signal, generation, versionId)
    }
    onCleanup(() => controller.abort())
    void year
  })
  const refresh = () => {
    void read(new AbortController().signal, host.generation(), screen.versionId)
  }
  const changeVersion = (next: string) => {
    if (next === screen.versionId) return
    if (!screen.page?.value.data.versions.some((row) => row.id === next)) return
    const snapshot = draft()?.snapshot()
    if (snapshot?.availability === "active" && snapshot.dirty &&
        !window.confirm(language.t("sf.cap22.discard-confirm"))) return
    draft()?.discard()
    setDraft(null)
    setLocalIntent(null)
    setScreen({ versionId: next, selection: null, intent: null, problem: null, state: "loading" })
  }
  const displayed = () => {
    const filter = screen.filter.trim().toLocaleLowerCase()
    const rows = (screen.page?.value.data.rates ?? []).filter((row) => !filter || row.cur.toLocaleLowerCase().includes(filter))
    if (screen.sort.kind === "none") return rows
    return [...rows].sort((left, right) => {
      const value = (row: FxRate) => screen.sort.kind === "field" && screen.sort.key === "rate" ? row.rate : row.cur
      // Rate text is presentation-only; no parsing/conversion on the client.
      const compare = String(value(left) ?? "").localeCompare(String(value(right) ?? ""), undefined, { numeric: true })
      return screen.sort.kind === "field" && screen.sort.direction === "desc" ? -compare : compare
    })
  }
  const versionFor = (id: string | null) =>
    screen.page?.value.versions[(activeVersionId() ?? "") + ":fx:" + (id ?? "")]?.version ??
    screen.page?.value.data.rates.find((rate) => rate.id === id)?.revision ?? 0
  const begin = (row?: FxRate) => {
    if (!can("save") || !activeVersionId()) return
    const owner = host.ready()
    if (!owner) return
    const value: RateDraft = row
      ? { id: row.id, cur: row.cur, rate: row.rate }
      : { id: null, cur: "", rate: "" }
    const local = row ? null : crypto.randomUUID() as SfIntentRef
    setLocalIntent(local)
    const controller = owner.drafts.acquire<RateDraft>({
      surfaceId: "CAP22",
      editScopeKey: activeVersionId() as SfEditScopeKey,
      identity: row ? { kind: "record", recordRef: ref(row.id) }
        : { kind: "new", newIntentRef: local! },
      baseVersion: row ? versionFor(row.id) : null,
      base: row ? value : null, value,
      revalidation: {
        operationId: "domain.page.CAP22",
        input: {
          ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
          version: activeVersionId()!,
        },
        fieldPaths: row ? ["id", "cur", "rate"] : ["versions", "rates"],
        actionIds: ["save"],
      },
    })
    setDraft(controller)
    setScreen({ selection: row?.id ?? null, intent: null, problem: null })
  }
  const discard = () => {
    const snapshot = draft()?.snapshot()
    if (snapshot?.availability === "active" && snapshot.dirty &&
        !window.confirm(language.t("sf.cap22.discard-confirm"))) return
    draft()?.discard()
    setDraft(null)
    setLocalIntent(null)
    setScreen({ intent: null, problem: null })
  }
  const prepare = (kind: Intent["kind"], id: string | null) => {
    if (!activeVersionId() || !can(kind)) return
    const value = currentValue()
    if (kind === "save" && (!value || !/^[A-Za-z]{3}$/.test(value.cur.trim()) ||
        value.cur.trim().toUpperCase() === "USD")) {
      draft()?.setPhase("validation-error")
      setScreen("problem", language.t("sf.cap22.field.cur.label"))
      return
    }
    if (kind === "save") draft()?.setPhase("reviewing")
    setScreen({ intent: { kind, id, version: versionFor(id), ref: crypto.randomUUID() }, problem: null })
  }
  const submit = async () => {
    const intent = screen.intent
    const owner = host.ready()
    const versionId = activeVersionId()
    if (!intent || !owner || !versionId || screen.busy || !can(intent.kind)) return
    const prior = draft()?.snapshot()
    if (intent.kind === "save" && (!prior || prior.availability !== "active" ||
        prior.conflict !== null || prior.pendingOperation !== null ||
        !Object.is(prior.baseVersion, intent.id === null ? null : intent.version))) {
      setScreen({ state: "conflict", problem: language.t("sf.common.conflict") })
      return
    }
    const client = createSfPlannerClient(owner.transport)
    const generation = host.generation()
    const options = { signal: new AbortController().signal, idempotencyKey: crypto.randomUUID() }
    const value = currentValue()
    const command = (() => {
      if (intent.kind === "delete") {
        const input = {
          page: "FX rates", action: "delete", version: intent.version,
          ...(intent.id ? { id: intent.id } : {}), values: { versionId },
        } as const
        return { input, call: () => client["domain.command.CAP22.delete"](input, options) }
      }
      const input = {
        page: "FX rates", action: "save", version: intent.version,
        ...(intent.id ? { id: intent.id } : {}),
        values: { versionId, cur: value?.cur, rate: value?.rate },
      } as const
      return { input, call: () => client["domain.command.CAP22.save"](input, options) }
    })()
    setScreen({ busy: true, problem: null })
    let digest: string
    try {
      digest = await hashReviewedCommand(command.input)
    } catch {
      setScreen({ busy: false, state: "unavailable", problem: language.t("sf.common.unavailable") })
      console.error("N20 CAP22: command fingerprint unavailable; write not submitted")
      return
    }
    if (generation !== host.generation() || !host.ready()) return
    const bindPending = () => {
      if (intent.kind !== "save") return
      draft()?.setPending({
        operationRef: ref(intent.ref) as Parameters<NonNullable<ReturnType<typeof draft>>["setPending"]>[0]["operationRef"],
        idempotencyKey: options.idempotencyKey,
        payloadDigest: digest,
        expectedVersion: intent.id === null ? null : intent.version,
      })
    }
    const result = await command.call().catch(() => {
      console.error("N20 CAP22: submitted command delivery failed; outcome unconfirmed")
      return { kind: "transport-error", reason: "outcome-unknown" } as const
    })
    if (generation !== host.generation() || !host.ready()) return
    setScreen("busy", false)
    if (result.kind !== "response") {
      if (result.reason !== "contract-unavailable" && result.reason !== "contract-mismatch") {
        bindPending()
        draft()?.setPhase("outcome-unknown")
        setScreen({ state: "outcome-unknown", lockedOutcome: true, problem: null })
      } else {
        setScreen({ state: "unavailable", problem: result.reason })
        draft()?.setPhase("failed")
      }
      return
    }
    if (!result.body.ok) {
      const status = result.body.status
      setScreen("state", status === 409 ? "conflict" : status === 403 ? "denied" :
        status === 404 ? "not-found" : status === 422 || status === 400 ? "invalid" : "unavailable")
      setScreen("problem", result.body.errors?.join("; ") ?? language.t("sf.cap22.errors"))
      if (status === 403) { setScreen({ page: null, intent: null }); setDraft(null) }
      if (status === 409) draft()?.setPhase("conflict")
      else draft()?.setPhase("validation-error")
      return
    }
    if (intent.kind === "save") {
      bindPending()
      draft()?.confirmSave({
        kind: "confirmed-without-projection",
        operationRef: ref(intent.ref) as Parameters<NonNullable<ReturnType<typeof draft>>["confirmSave"]>[0]["operationRef"],
        resultVersion: null,
      })
      if (draft()?.snapshot().availability === "confirmed-without-projection") setDraft(null)
    }
    setScreen({ intent: null, selection: null, problem: null, state: "loading" })
    await read(new AbortController().signal, generation, screen.versionId)
  }
  const rateText = (rate: FxRate["rate"]) => rate === null
    ? language.t("sf.cap22.no-rate") : String(rate)
  const oldSnapshot = (): SfReviewSnapshot | null => {
    if (!screen.intent?.id) return null
    const row = screen.page?.value.data.rates.find((item) => item.id === screen.intent?.id)
    return row ? {
      kind: "persisted", ref: ref(row.id), version: versionFor(row.id),
      fields: [
        reviewField("sf.cap22.field.code.label", row.cur),
        reviewField("sf.cap22.field.rate.label", rateText(row.rate)),
      ],
    } : null
  }
  const proposed = (): SfReviewSnapshot => {
    const intent = screen.intent!
    const value = currentValue()
    const original = oldSnapshot()
    return {
      kind: "draft", intentRef: (localIntent() ?? intent.ref) as SfIntentRef,
      sourceRef: intent.id ? ref(intent.id) : null, sourceVersion: intent.version,
      fields: intent.kind === "delete"
        ? (original && original.kind === "persisted" ? original.fields : [])
        : value ? [
          reviewField("sf.cap22.field.code.label", value.cur),
          reviewField("sf.cap22.field.rate.label", rateText(value.rate)),
        ] : [],
    }
  }
  return (
    <SfPageFrame titleKey={key("sf.cap22.title")}
      context={selectedVersion() ? [
        { id: "version", label: { key: key("sf.cap22.version") },
          value: { kind: "data", text: selectedVersion()!.name } },
        { id: "year", label: { key: key("sf.cap22.year") },
          value: { kind: "data", text: String(selectedVersion()!.year) } },
      ] : []}
      tabs={[]} activeTab={null}
      primaryAction={{
        id: "add-fx", labelKey: key("sf.cap22.primary"), tone: "primary",
        disabled: !can("save"), busy: screen.busy, onInvoke: () => begin(),
      }}
      secondaryActions={[]}
      density="comfortable" layout="work" onLayoutMode={() => undefined}
    >
      <SfStatePanel state={state()} messageKey={key(message())} onRetryRead={refresh}>
        <div class="sf-n20-fx" data-sf-surface="CAP22">
          <div class="sf-n20-fx-toolbar">
            <label>
              <span>{language.t("sf.cap22.version")}</span>
              <select class="mx-input" value={screen.versionId ?? selectedVersion()?.id ?? ""}
                disabled={screen.busy || screen.lockedOutcome}
                onChange={(event) => changeVersion(event.currentTarget.value)}>
                <For each={screen.page?.value.data.versions ?? []}>
                  {(version) => <option value={version.id}>{version.name} · {version.year}</option>}
                </For>
              </select>
            </label>
            <label>
              <span>{language.t("sf.cap22.search")}</span>
              <input type="search" class="mx-input" value={screen.filter}
                onInput={(event) => setScreen("filter", event.currentTarget.value)} />
            </label>
            <Show when={can("import-workbook")}>
              <A href="/orchestra/sf-imports/new" class="mx-link">
                {language.t("sf.cap22.action.import-workbook")}
              </A>
            </Show>
          </div>
          <section aria-label={language.t("sf.cap22.base")} class="mx-card sf-n20-fx-base">
            <h2>{language.t("sf.cap22.base")}</h2>
            <strong>{language.t("sf.cap22.fixed")}</strong>
            <p>{language.t("sf.cap22.description")}</p>
            <Show when={selectedVersion()?.locked}>
              <p role="status">{language.t("sf.cap22.locked")}</p>
            </Show>
          </section>
          <section aria-label={language.t("sf.cap22.rates")} class="sf-n20-fx-rates">
            <h2>{language.t("sf.cap22.rates")}</h2>
            <Show when={(screen.page?.value.data.rates.length ?? 0) > 0 && displayed().length === 0}>
              <p role="status">{language.t("sf.common.filterEmpty")}</p>
              <button type="button" class="mx-link" onClick={() => setScreen("filter", "")}>
                {language.t("sf.cap22.clear-filter")}
              </button>
            </Show>
            <SfDataTable<FxRate>
              rows={displayed()} getRowKey={(row) => ref(row.id)}
              columns={[
                { id: "cur", labelKey: key("sf.cap22.field.code.label"), align: "start",
                  widthPolicy: { kind: "flex", minPx: 110, weight: 1 }, sortKey: "cur",
                  render: (row) => <bdi>{row.cur}</bdi> },
                { id: "rate", labelKey: key("sf.cap22.field.rate.label"), align: "start",
                  widthPolicy: { kind: "flex", minPx: 120, weight: 2 }, sortKey: "rate",
                  render: (row) => <span data-sf-rate-state={row.rate === null ? "missing" : "known"}><bdi>{rateText(row.rate)}</bdi></span> },
              ]}
              selectedKey={screen.selection ? ref(screen.selection) : undefined}
              sort={screen.sort} onSort={(next) => setScreen("sort", next)}
              page={{ kind: "none", total: screen.page?.value.data.rates.length ?? null }}
              onPage={() => undefined}
              onSelect={(selected) => setScreen("selection", selected)}
              rowActions={() => [
                { id: "edit", labelKey: key("sf.common.edit"), tone: "secondary", disabled: !can("save"), busy: screen.busy },
                { id: "delete", labelKey: key("sf.cap22.action.delete"), tone: "danger", disabled: !can("delete"), busy: screen.busy },
              ]}
              onRowAction={(request) => {
                const row = screen.page?.value.data.rates.find((item) => item.id === request.recordRef)
                if (!row) return
                setScreen("selection", row.id)
                if (request.actionId === "edit") begin(row)
                if (request.actionId === "delete") prepare("delete", row.id)
              }}
              captionKey={key("sf.cap22.rates")}
              density="comfortable" state={screen.state}
            />
          </section>
          <section aria-label={language.t("sf.cap22.usage")} class="mx-card sf-n20-fx-usage">
            <h2>{language.t("sf.cap22.usage")}</h2>
            <p>{language.t("sf.cap22.rate-warning")}</p>
            <Show when={(screen.page?.value.data.warnings.length ?? 0) > 0}>
              <p role="status">{language.t("sf.cap22.warning")}</p>
              <ul>
                <For each={screen.page?.value.data.warnings ?? []}>
                  {(warning) => <li><bdi>{warning}</bdi></li>}
                </For>
              </ul>
            </Show>
            <Show when={(screen.page?.value.data.rates ?? []).some((row) => row.rate === null)}>
              <ul>
                <For each={(screen.page?.value.data.rates ?? []).filter((row) => row.rate === null)}>
                  {(row) => <li><bdi>{row.cur}</bdi>: {language.t("sf.cap22.no-rate")}</li>}
                </For>
              </ul>
            </Show>
          </section>
          <Show when={currentValue() && !screen.intent && !screen.lockedOutcome}>
            {(value) => (
              <form class="mx-card sf-n20-fx-editor" onSubmit={(event) => {
                event.preventDefault()
                prepare("save", value().id)
              }}>
                <h2>{language.t("sf.cap22.entry")}</h2>
                <label>
                  <span>{language.t("sf.cap22.field.cur.label")}</span>
                  <input class="mx-input" required maxLength={3} pattern="[A-Za-z]{3}"
                    value={value().cur} onInput={(event) =>
                      draft()?.edit({ ...value(), cur: event.currentTarget.value })} />
                </label>
                <label>
                  <span>{language.t("sf.cap22.field.rate.label")}</span>
                  <input class="mx-input" inputMode="decimal" type="text"
                    value={value().rate === null ? "" : String(value().rate)}
                    onInput={(event) => draft()?.edit({ ...value(), rate: event.currentTarget.value })} />
                </label>
                <p>{language.t("sf.cap22.rate-warning")}</p>
                <div class="sf-n20-fx-actions">
                  <button type="submit" class="mx-btn primary" disabled={!can("save") || screen.busy}>
                    {language.t("sf.common.review")}
                  </button>
                  <button type="button" class="mx-btn" onClick={discard}>
                    {language.t("sf.common.discard")}
                  </button>
                </div>
              </form>
            )}
          </Show>
          <Show when={screen.intent}>
            {(intent) => (
              <section class="sf-n20-fx-review" aria-label={language.t(
                intent().kind === "save" ? "sf.cap22.review-save" : "sf.cap22.review-delete",
              )}>
                <SfChangeReview
                  operation={{
                    ref: intent().ref as Parameters<typeof SfChangeReview>[0]["operation"]["ref"],
                    label: { key: key(intent().kind === "save" ? "sf.cap22.review-save" : "sf.cap22.review-delete") },
                    scope: { kind: "data", text: activeVersionId() ?? "" },
                  }}
                  base={oldSnapshot()} current={oldSnapshot()} proposed={proposed()}
                  effects={[]}
                  coverage={{
                    state: "partial", summary: { key: key("sf.common.partial") },
                    reasons: [], knownCount: null, expectedCount: null,
                  }}
                  blockingReasons={[]}
                  confirmation={{
                    kind: "admitted", labelKey: key(intent().kind === "save" ? "sf.cap22.action.save" : "sf.cap22.action.delete"),
                    purpose: intent().kind,
                    binding: {
                      kind: "catalog-command",
                      operationId: intent().kind === "save" ? "domain.command.CAP22.save" : "domain.command.CAP22.delete",
                      version: { kind: "record", expectedVersion: intent().version },
                      confirmation: "presentation-only",
                    },
                  }}
                  state={screen.busy ? "loading" : "ready"}
                  onConfirm={() => { void submit() }}
                  onRevise={() => { draft()?.setPhase("dirty"); setScreen("intent", null) }}
                  onCancel={() => { draft()?.setPhase("dirty"); setScreen("intent", null) }}
                />
                <Show when={intent().kind === "delete"}>
                  <p>{language.t("sf.cap22.delete-warning")}</p>
                </Show>
              </section>
            )}
          </Show>
          <Show when={screen.problem}>
            {(problem) => <p role="alert" class="sf-n20-fx-error"><bdi>{problem()}</bdi></p>}
          </Show>
        </div>
      </SfStatePanel>
    </SfPageFrame>
  )
}
