import { createEffect, For, on, onCleanup, Show } from "solid-js"
import { createStore, unwrap } from "solid-js/store"
import { Option, Schema } from "effect"
import { useLanguage } from "@/context/language"
import type { SF_U18_COPY } from "@/i18n/orchestra-chapters/sf-u18"
import { createSfDecisionsClient } from "@orchestra/client/sucafina/decisions"
import { SfRecordedChoiceIntent, type SfTransport } from "@orchestra/client/sucafina/transport"
import { SfDecisions } from "@orchestra/schema/sucafina/decisions"
import { useSfCase, sfOperationReady } from "../cases/model"

type Compare = Extract<Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-compare"]["output"]>, { status: "ok" }>["value"]
type Controls = Extract<Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.controls.read"]["output"]>, { status: "ok" }>["value"]
type Rule = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-criteria"]["input"]>
type Choice = Schema.Schema.Type<(typeof SfDecisions.operations)["decisions.decision-choose"]["input"]>
type RuleEvidence = NonNullable<Controls["selected"]>["evidence"]
type Scope = { transport: SfTransport; owner: string; generation: number; stamp: string; case: string }
type Intent = { scope: Scope; body: Choice; key: string }
type Phase = "editing" | "inspecting" | "comparing" | "loading-rule" | "saving-rule" | "choosing" | "unknown" | "reconcile"

/** Human choices preserve the original C10 comparison and C08 result.
 * The renderer selects references and displays producer facts; it calculates
 * neither financial totals nor approval, coverage or comparison outcomes.
 */
export function SfRecordChoice(props: { caseRef: string }) {
  const source = useSfCase(() => props.caseRef)
  const language = useLanguage()
  const t = (key: string) => language.t(("sf.ui38.author." + key) as keyof typeof SF_U18_COPY)
  const record = () => source.read.state === "ready" ? source.read.projection?.case : undefined
  const [ui, setUi] = createStore<{
    phase: Phase; baseline: string; alternative: string; criteria: readonly string[]; reason: string; message: string
    comparison?: Compare; criterion: string; operator: "" | "lte" | "gte" | "eq"; limit: string
    evidence: readonly string[]; rule?: { criterionId: string; expectedVersion: number; evidence: RuleEvidence }
  }>({ phase: "editing", baseline: "", alternative: "", criteria: [], reason: "", message: "",
    criterion: "", operator: "", limit: "", evidence: [] })
  let pending: AbortController | undefined
  let intention: Intent | undefined
  let retainedKey: string | undefined
  let retainedStamp: string | undefined
  const ownerKey = () => {
    const owner = source.owner.state()
    return owner.status === "ready" ? owner.ownerKey : undefined
  }
  const caseVersion = () => {
    const current = record()
    return current ? JSON.stringify([current.id, current.incarnation, current.version]) : ""
  }
  const scope = (): Scope | undefined => {
    const ready = source.owner.ready(), owner = ownerKey(), selected = caseVersion()
    return ready && owner && selected ? { transport: ready.transport, owner, generation: source.owner.generation(),
      stamp: JSON.stringify(ready.context.stamp), case: selected } : undefined
  }
  const current = (expected: Scope, abort: AbortController) => {
    const now = scope()
    return !abort.signal.aborted && !!now && now.transport === expected.transport && now.owner === expected.owner &&
      now.generation === expected.generation && now.stamp === expected.stamp && now.case === expected.case
  }
  const readyFor = (operation: string) => {
    const ready = source.owner.ready()
    return !!ready && sfOperationReady(ready.context, operation)
  }
  const locked = () => ui.phase !== "editing"
  const alternative = (id: string) => {
    const matches = record()?.alternatives.filter((item) => item.id === id) ?? []
    return matches.length === 1 ? matches[0] : undefined
  }
  const caseRef = () => {
    const selected = record()
    return selected && { id: selected.id, incarnation: selected.incarnation, version: selected.version }
  }
  const sameCase = (ref: { id: string; incarnation: string; version: number }) =>
    JSON.stringify([ref.id, ref.incarnation, ref.version]) === caseVersion()
  const pairReady = () => !!alternative(ui.baseline) && !!alternative(ui.alternative) &&
    ui.baseline !== ui.alternative && ui.criteria.length > 0 &&
    record()?.criteria.every((item) => !item.required || ui.criteria.includes(item.id)) === true
  const resetComparison = () => setUi({ comparison: undefined, rule: undefined, criterion: "",
    operator: "", limit: "", evidence: [], message: "" })
  const begin = () => {
    const snapshot = scope()
    if (!snapshot) return undefined
    pending?.abort()
    const abort = new AbortController()
    pending = abort
    return { snapshot, abort }
  }
  const forgetRetained = () => {
    if (!retainedKey) return
    try { sessionStorage.removeItem(retainedKey) } catch { /* No new command is authorized by cleanup. */ }
    retainedKey = undefined
    retainedStamp = undefined
  }
  const storageKey = () => {
    const ready = source.owner.ready()
    return ready ? JSON.stringify(["sf-native-choice-intent/1", ready.context.stamp.hostId,
      ready.context.stamp.installationId, ready.context.stamp.projectId,
      ready.context.stamp.principalRef, props.caseRef]) : undefined
  }
  const retain = (original: Intent) => {
    const key = storageKey(), ready = source.owner.ready()
    if (!key || !ready || JSON.stringify(ready.context.stamp) !== original.scope.stamp) return false
    const claim: Schema.Schema.Type<typeof SfRecordedChoiceIntent> = structuredClone(unwrap({
      schema: "sf-recorded-choice-intent/1" as const, caseRef: props.caseRef, owner: ready.context.stamp,
      key: original.key, body: original.body,
    }))
    try {
      sessionStorage.setItem(key, JSON.stringify(claim))
      retainedKey = key
      retainedStamp = original.scope.stamp
      return true
    } catch { return false }
  }
  const inspectRetained = () => {
    const key = storageKey(), ready = source.owner.ready(), selected = record()
    if (!key || !ready || !selected) return
    let raw: string | null
    try { raw = sessionStorage.getItem(key) }
    catch { setUi({ phase: "reconcile", message: "retentionUnavailable" }); return }
    if (!raw) return
    retainedKey = key
    let candidate: unknown
    try { candidate = JSON.parse(raw) }
    catch { setUi({ phase: "reconcile", message: "recoveryUnavailable" }); return }
    const decoded = Schema.decodeUnknownOption(Schema.toType(SfRecordedChoiceIntent), { onExcessProperty: "error" })(candidate)
    if (Option.isNone(decoded) || decoded.value.caseRef !== props.caseRef ||
        decoded.value.body.caseRef.id !== selected.id || decoded.value.body.caseRef.incarnation !== selected.incarnation ||
        !(["hostId", "installationId", "projectId", "principalRef", "policyVersion", "accessRevision"] as const)
          .every((field) => decoded.value.owner[field] === ready.context.stamp[field])) {
      forgetRetained()
      setUi({ phase: "reconcile", message: "recoveryUnavailable" })
      return
    }
    const claim = decoded.value, inspect = ready.transport.inspectRecordedChoice
    retainedStamp = JSON.stringify(ready.context.stamp)
    setUi({ phase: "inspecting", reason: claim.body.reason, alternative: claim.body.alternativeId,
      criteria: claim.body.criteria, message: "inspecting" })
    if (!inspect) { setUi({ phase: "reconcile", message: "recoveryUnavailable" }); return }
    const context = begin()
    if (!context) return
    void inspect(claim, { signal: context.abort.signal }).then((reply) => {
      if (!current(context.snapshot, context.abort)) return
      const choices = record()?.choices.filter((choice) => reply.status === "ready" && choice.id === reply.choiceId) ?? []
      if (reply.status !== "ready" || choices.length !== 1) {
        setUi({ phase: "reconcile", message: "recoveryUnavailable" })
        return
      }
      intention = { scope: context.snapshot, body: structuredClone(claim.body), key: claim.key }
      setUi({ phase: "unknown", message: "recordedRetained",
        comparison: { request: claim.body.comparison, comparison: choices[0]!.comparison } })
    }).catch(() => {
      if (current(context.snapshot, context.abort)) setUi({ phase: "reconcile", message: "recoveryUnavailable" })
    })
  }
  createEffect(on(() => [source.owner.generation(), ownerKey(), props.caseRef, caseVersion(),
    source.owner.state().status, JSON.stringify(source.owner.ready()?.context.stamp)] as const, () => {
    pending?.abort()
    intention = undefined
    const owner = source.owner.state(), ready = source.owner.ready()
    if (["denied", "unauthenticated", "context-mismatch"].includes(owner.status) ||
        ready && retainedStamp && JSON.stringify(ready.context.stamp) !== retainedStamp) forgetRetained()
    setUi({ phase: "editing", baseline: "", alternative: "", criteria: record()?.criteria.map((item) => item.id) ?? [],
      reason: "", message: "", comparison: undefined, rule: undefined, criterion: "", operator: "", limit: "", evidence: [] })
    inspectRetained()
  }))
  onCleanup(() => pending?.abort())

  const compare = async () => {
    const selected = caseRef()
    if (locked() || !selected || !pairReady() || !readyFor("decisions.decision-compare")) return
    const context = begin()
    if (!context) return
    const input = structuredClone(unwrap({ caseRef: selected, baselineAlternativeId: ui.baseline,
      alternativeId: ui.alternative, criteria: ui.criteria }))
    resetComparison()
    setUi("phase", "comparing")
    try {
      const reply = await createSfDecisionsClient(context.snapshot.transport)["decisions.decision-compare"](input,
        { signal: context.abort.signal })
      if (!current(context.snapshot, context.abort)) return
      if (reply.kind !== "response" || reply.status !== 200 || reply.body.status !== "ok") {
        setUi("message", "unavailable")
        return
      }
      const value = reply.body.value
      if (value.request.scenarioRefs.length !== 2 || value.request.scenarioRefs[0] === value.request.scenarioRefs[1] ||
        JSON.stringify(value.request.criteria) !== JSON.stringify(input.criteria) ||
        value.comparison.baselineResultRef !== value.request.scenarioRefs[0] ||
        value.comparison.alternativeResultRef !== value.request.scenarioRefs[1]) {
        setUi("message", "changed")
        return
      }
      setUi({ comparison: value, message: value.comparison.criterionResults.some((item) =>
        item.reason === "criterion-rule-unavailable") ? "ruleMissing" : "compared" })
    } catch { if (current(context.snapshot, context.abort)) setUi("message", "unavailable") }
    finally { if (current(context.snapshot, context.abort)) setUi("phase", "editing") }
  }
  const loadRule = async () => {
    const comparison = ui.comparison, selected = record()
    if (locked() || !comparison || !selected || !ui.criteria.includes(ui.criterion) ||
      !readyFor("decisions.controls.read") || !readyFor("decisions.decision-criteria")) return
    const context = begin()
    if (!context) return
    setUi({ phase: "loading-rule", rule: undefined, evidence: [], message: "" })
    try {
      const reply = await createSfDecisionsClient(context.snapshot.transport)["decisions.controls.read"](
        { case: props.caseRef }, { signal: context.abort.signal })
      if (!current(context.snapshot, context.abort)) return
      if (reply.kind !== "response" || reply.status !== 200 || reply.body.status !== "ok") {
        setUi("message", "unavailable"); return
      }
      const controls = reply.body.value, admitted = controls.selected
      const stamp = source.owner.ready()?.context.stamp
      if (!admitted || admitted.ref !== props.caseRef || !sameCase(admitted.caseRef) ||
        controls.accessRevision !== stamp?.accessRevision || !controls.actions.includes("decisions.criteria") ||
        admitted.decision.currency !== selected.currency ||
        JSON.stringify(admitted.decision.horizon) !== JSON.stringify(selected.horizon)) {
        setUi("message", "changed"); return
      }
      const revision = admitted.rules.filter((item) => item.id === ui.criterion)
      const expectedVersion = revision.length === 1 ? revision[0]?.expectedVersion : undefined
      const ids = [ui.baseline, ui.alternative]
      if (expectedVersion === undefined || !Number.isSafeInteger(expectedVersion) || expectedVersion < 0 ||
        !ids.every((id, index) => admitted.scenarios.some((item) =>
          item.alternativeId === id && item.ref === comparison.request.scenarioRefs[index]))) {
        setUi("message", "changed"); return
      }
      const alternatives = ids.flatMap((id) => admitted.decision.alternatives.filter((item) => item.id === id))
      if (alternatives.length !== 2 || alternatives[0]?.id !== ids[0] || alternatives[1]?.id !== ids[1]) {
        setUi("message", "changed"); return
      }
      const refs = alternatives.flatMap((item) => [...item.result.sourceRefs, ...item.result.costCoverage.evaluatedSourceRefs,
        ...item.result.costCoverage.entries.flatMap((entry) => entry.status === "pending" ? [] : entry.evidenceRefs)])
      const evidence = admitted.evidence.filter((entry) => refs.some((ref) => ref.refDigest === entry.evidence.refDigest))
      if (!evidence.length) { setUi("message", "noEvidence"); return }
      setUi({ rule: { criterionId: ui.criterion, expectedVersion, evidence }, message: "ruleLoaded" })
    } catch { if (current(context.snapshot, context.abort)) setUi("message", "unavailable") }
    finally { if (current(context.snapshot, context.abort)) setUi("phase", "editing") }
  }
  const saveRule = async () => {
    const selected = record(), rule = ui.rule, ref = caseRef(), numeric = Number(ui.limit)
    if (locked() || !selected || !ref || !rule || ui.criterion !== rule.criterionId || !ui.comparison ||
      !ui.operator || ui.limit.trim() === "" || !Number.isFinite(numeric) || !ui.evidence.length ||
      !readyFor("decisions.decision-criteria")) return
    const evidence = rule.evidence.filter((entry) => ui.evidence.includes(entry.evidence.refDigest)).map((entry) => entry.evidence)
    if (evidence.length !== ui.evidence.length) return
    const context = begin()
    if (!context) return
    const body: Rule = structuredClone(unwrap({ caseRef: ref, criterionId: rule.criterionId,
      metricRef: "planner:known-subtotal-difference", operator: ui.operator, value: numeric,
      unit: selected.currency, period: selected.horizon, evidenceRefs: evidence, expectedRuleVersion: rule.expectedVersion }))
    setUi("phase", "saving-rule")
    try {
      const reply = await createSfDecisionsClient(context.snapshot.transport)["decisions.decision-criteria"](body,
        { signal: context.abort.signal, idempotencyKey: crypto.randomUUID() })
      if (!current(context.snapshot, context.abort)) return
      if (reply.kind !== "response") { setUi({ phase: "unknown", message: "ruleUnknown" }); return }
      if (reply.status !== 200 || reply.body.status !== "ok" || !reply.body.value.ruleRef ||
        reply.body.value.version !== body.expectedRuleVersion + 1) {
        setUi("message", "unavailable"); return
      }
      resetComparison()
      setUi("message", "ruleSaved")
    } catch { if (current(context.snapshot, context.abort)) setUi({ phase: "unknown", message: "ruleUnknown" }) }
    finally { if (current(context.snapshot, context.abort) && ui.phase === "saving-rule") setUi("phase", "editing") }
  }
  const canChoose = () => pairReady() && !!ui.comparison && !!ui.reason.trim() &&
    !ui.comparison.comparison.criterionResults.some((item) => item.reason === "criterion-rule-unavailable") &&
    readyFor("decisions.decision-choose")
  const choose = async (retry = false) => {
    if (retry ? ui.phase !== "unknown" || !intention : locked() || !canChoose()) return
    const selected = alternative(ui.alternative), ref = caseRef(), compared = ui.comparison
    if (!retry && (!selected || !ref || !compared)) return
    const context = begin()
    if (!context) return
    if (!retry && selected && ref && compared) {
      const body: Choice = structuredClone(unwrap({ caseRef: ref, alternativeId: selected.id,
        alternativeVersion: selected.version, comparison: compared.request, criteria: compared.request.criteria, reason: ui.reason.trim() }))
      intention = { scope: context.snapshot, body, key: crypto.randomUUID() }
      if (!retain(intention)) { intention = undefined; setUi("message", "retentionUnavailable"); return }
    }
    const original = intention
    if (!original || !current(original.scope, context.abort)) return
    setUi({ phase: "choosing", message: "" })
    try {
      const reply = await createSfDecisionsClient(original.scope.transport)["decisions.decision-choose"](original.body,
        { signal: context.abort.signal, idempotencyKey: original.key, ...(retry ? { retry: "same-intent" as const } : {}) })
      if (!current(original.scope, context.abort)) return
      if (reply.kind !== "response") { setUi({ phase: "unknown", message: "choiceUnknown" }); return }
      if (reply.status !== 200 || reply.body.status !== "ok") {
        intention = undefined; forgetRetained(); setUi({ phase: "reconcile", message: "refused" }); return
      }
      const committed = reply.body.value.caseRef
      if (committed.id !== original.body.caseRef.id || committed.incarnation !== original.body.caseRef.incarnation ||
        committed.version !== original.body.caseRef.version + 1) {
        setUi({ phase: "unknown", message: "choiceUnknown" }); return
      }
      intention = undefined
      forgetRetained()
      source.reload()
    } catch { if (current(original.scope, context.abort)) setUi({ phase: "unknown", message: "choiceUnknown" }) }
  }

  return <section class="mx-card sf-u18-author" data-sf-choice-author data-sf-case-ref={props.caseRef}
    data-sf-case-version={record()?.version}>
    <h2>{t("title")}</h2>
    <Show when={record()} fallback={<p role="status">{t("unavailable")}</p>}>{(selected) => <>
      <p>{selected().objective}</p>
      <p>{t("boundary")}</p>
      <form onSubmit={(event) => { event.preventDefault(); void choose() }}>
        <fieldset disabled={locked()}>
          <legend>{t("pair")}</legend>
          <For each={["baseline", "alternative"] as const}>{(field) => <label>{t(field)}
            <select name={field} value={ui[field]} onChange={(event) => {
              if (locked()) return; setUi(field, event.currentTarget.value); resetComparison()
            }}><option value="">{t("select")}</option><For each={selected().alternatives}>{(item) =>
              <option value={item.id}>{item.title}</option>}</For></select>
          </label>}</For>
          <fieldset><legend>{t("criteria")}</legend><For each={selected().criteria}>{(item) =>
            <label><input type="checkbox" name="criteria" value={item.id} checked={ui.criteria.includes(item.id)}
              required={item.required} onChange={(event) => {
                if (locked()) return
                setUi("criteria", event.currentTarget.checked ? [...ui.criteria, item.id] : ui.criteria.filter((id) => id !== item.id))
                resetComparison()
              }} />{item.description}{item.required ? " · " + t("required") : ""}</label>
          }</For></fieldset>
          <button type="button" class="mx-btn" disabled={!pairReady() || !readyFor("decisions.decision-compare")}
            onClick={() => void compare()}>{t("compare")}</button>
          <Show when={ui.comparison}>{(compared) => <section data-sf-choice-comparison aria-label={t("comparison")}>
            <p>{t("comparison")}: {compared().comparison.comparisonStatus}</p>
            <p>{t("knownDifference")}: {compared().comparison.knownDifference ?? t("missing")}</p>
            <p>{t("completeDifference")}: {compared().comparison.completeDifference ?? t("missing")}</p>
            <For each={compared().comparison.criterionResults}>{(criterion) =>
              <p>{selected().criteria.find((item) => item.id === criterion.criterionId)?.description ?? criterion.criterionId}: {criterion.state} · {criterion.reason}</p>
            }</For>
            <ul><For each={compared().comparison.unresolvedConditions}>{(condition) => <li>{condition}</li>}</For></ul>
          </section>}</Show>
          <Show when={ui.comparison}>
            <fieldset><legend>{t("numericRule")}</legend><p>{t("numericExplanation")}</p>
              <label>{t("criterion")}<select value={ui.criterion} onChange={(event) => {
                if (locked()) return; setUi({ criterion: event.currentTarget.value, rule: undefined, evidence: [], operator: "", limit: "" })
              }}><option value="">{t("select")}</option><For each={selected().criteria.filter((item) => ui.criteria.includes(item.id))}>{(item) =>
                <option value={item.id}>{item.description}</option>}</For></select></label>
              <button type="button" class="mx-btn" disabled={!ui.criterion || !readyFor("decisions.decision-criteria")}
                onClick={() => void loadRule()}>{t("loadRule")}</button>
              <Show when={ui.rule}>{(rule) => <>
                <p>{selected().currency} · {selected().horizon.start} – {selected().horizon.end} · {t("ruleVersion")}: {rule().expectedVersion}</p>
                <label>{t("evidence")}<select multiple value={[...ui.evidence]} onChange={(event) => {
                  if (!locked()) setUi("evidence", Array.from(event.currentTarget.selectedOptions, (option) => option.value))
                }}><For each={rule().evidence}>{(entry) => <option value={entry.evidence.refDigest}>{entry.label}</option>}</For></select></label>
                <label>{t("condition")}<select value={ui.operator} onChange={(event) => {
                  const value = event.currentTarget.value
                  if (!locked() && (value === "" || value === "lte" || value === "gte" || value === "eq")) setUi("operator", value)
                }}><option value="">{t("select")}</option><option value="lte">{t("atMost")}</option>
                  <option value="gte">{t("atLeast")}</option><option value="eq">{t("equal")}</option></select></label>
                <label>{t("limit")} {selected().currency}<input type="number" step="any" value={ui.limit}
                  onInput={(event) => { if (!locked()) setUi("limit", event.currentTarget.value) }} /></label>
                <button type="button" class="mx-btn" disabled={!ui.operator || !ui.evidence.length || ui.limit.trim() === ""}
                  onClick={() => void saveRule()}>{t("saveRule")}</button>
              </>}</Show>
            </fieldset>
          </Show>
          <label>{t("reason")}<textarea name="reason" value={ui.reason}
            onInput={(event) => { if (!locked()) setUi("reason", event.currentTarget.value) }} /></label>
          <button type="submit" class="mx-btn-primary" disabled={!canChoose()}>{t("choose")}</button>
        </fieldset>
      </form>
      <Show when={ui.phase === "unknown" && intention}>
        <button type="button" class="mx-btn" onClick={() => void choose(true)}>{t("retry")}</button>
      </Show>
      <Show when={ui.phase === "reconcile"}><button type="button" class="mx-btn" onClick={source.reload}>{t("refresh")}</button></Show>
      <Show when={ui.message}><p role="status">{t(ui.message)}</p></Show>
      <section aria-label={t("history")}><h3>{t("history")}</h3>
        <Show when={selected().choices.length} fallback={<p>{t("noChoices")}</p>}>
          <For each={selected().choices}>{(choice) => <article data-sf-choice-id={choice.id}>
            <h4>{selected().alternatives.find((item) => item.id === choice.alternativeId)?.title ?? choice.alternativeId}</h4>
            <p>{choice.reason}</p><p>{choice.principalRef} · {choice.at}</p>
            <dl><dt>{t("knownSubtotal")}</dt><dd>{choice.result.knownSubtotal ?? t("missing")} {choice.result.currency}</dd>
              <dt>{t("completeTotal")}</dt><dd>{choice.result.total ?? t("missing")}</dd>
              <dt>{t("knownDifference")}</dt><dd>{choice.comparison.knownDifference ?? t("missing")}</dd>
              <dt>{t("comparison")}</dt><dd>{choice.comparisonStatus}</dd>
              <dt>{t("coverage")}</dt><dd>{choice.costCoverage.coverageState}</dd></dl>
            <p>{choice.result.horizon.start} – {choice.result.horizon.end}</p>
            <ul><For each={choice.result.unresolvedConditions}>{(condition) => <li>{condition}</li>}</For></ul>
            <ul aria-label={t("pendingCategories")}><For each={choice.costCoverage.entries}>{(entry) => <li>{entry.categoryId} · {entry.status}
              {entry.status === "pending" ? " · " + entry.reason : ""}</li>}</For></ul>
            <Show when={choice.scenario.operations.length === 0}><p>{t("noOperations")}</p></Show>
          </article>}</For>
        </Show>
      </section>
    </>}</Show>
  </section>
}
