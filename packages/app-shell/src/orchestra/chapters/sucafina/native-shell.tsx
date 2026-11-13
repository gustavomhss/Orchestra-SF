import { For, Show } from "solid-js"
import { useLanguage } from "@/context/language"
import type { SF_NATIVE_SHELL_COPY } from "@/i18n/orchestra-chapters/sucafina-native-shell"
import { MxPage } from "../kit"
import type { NativeShellProps } from "./shell-contract"

const PAGE_LABELS: Readonly<Record<string, keyof typeof SF_NATIVE_SHELL_COPY>> = {
  "Executive Dashboard": "sucafina.native.shell.page.executiveDashboard",
  "Budget Overview": "sucafina.native.shell.page.budgetOverview",
  "OPEX Detail": "sucafina.native.shell.page.opexDetail",
  "CAPEX Projects": "sucafina.native.shell.page.capexProjects",
  "Headcount Overview": "sucafina.native.shell.page.headcountOverview",
  "Team Structure": "sucafina.native.shell.page.teamStructure",
  "Talent Review": "sucafina.native.shell.page.talentReview",
  "Hot Topics & Actions": "sucafina.native.shell.page.hotTopics",
  "Portfolio Dashboard": "sucafina.native.shell.page.portfolioDashboard",
  "All Projects": "sucafina.native.shell.page.allProjects",
  "IT Risks": "sucafina.native.shell.page.itRisks",
  "Stakeholder Management": "sucafina.native.shell.page.stakeholderManagement",
  "IT Performance Contract": "sucafina.native.shell.page.itPerformanceContract",
  "IT Operations": "sucafina.native.shell.page.itOperations",
  "IT Security KPIs": "sucafina.native.shell.page.itSecurityKpis",
  "Vendor Contracts": "sucafina.native.shell.page.vendorContracts",
  "Overview": "sucafina.native.shell.page.overview",
  "OPEX": "sucafina.native.shell.page.opex",
  "CAPEX": "sucafina.native.shell.page.capex",
  "Versions": "sucafina.native.shell.page.versions",
  "Headcount": "sucafina.native.shell.page.headcount",
  "Entities & allocations": "sucafina.native.shell.page.entitiesAllocations",
  "FX rates": "sucafina.native.shell.page.fxRates",
  "Dashboard": "sucafina.native.shell.page.dashboard",
  "Requests": "sucafina.native.shell.page.requests",
  "My approvals": "sucafina.native.shell.page.myApprovals",
  "Suppliers": "sucafina.native.shell.page.suppliers",
  "Settings": "sucafina.native.shell.page.settings",
}

export function NativeShell(props: NativeShellProps) {
  const language = useLanguage()
  const pageLabel = (page: string) => Object.hasOwn(PAGE_LABELS, page) ? language.t(PAGE_LABELS[page]!) : page
  const state = () => props.controller.state()
  const busy = () => state().loading || state().saving
  const labels = { dashboard: "sucafina.native.shell.surfaceDashboard", planner: "sucafina.native.shell.surfacePlanner", procurement: "sucafina.native.shell.surfaceProcurement" } as const

  return (
    <MxPage id="sucafina" title={state().page ? pageLabel(state().page!.page) : "Sucafina"} description={language.t("sucafina.native.shell.description")}>
      <div class="mx-card">
        <div class="mx-fields">
          <label class="mx-field">
            <span>{language.t("sucafina.native.shell.application")}</span>
            <select
              value={props.surface}
              disabled={props.surfaces.length === 0}
              onChange={(event) => {
                const surface = props.surfaces.find((item) => item === event.currentTarget.value)
                if (surface) props.onSurface(surface)
              }}
            >
              <For each={props.surfaces}>{(surface) => <option value={surface}>{language.t(labels[surface])}</option>}</For>
            </select>
          </label>
          <Show when={state().page}>
            {(page) => (
              <label class="mx-field">
                <span>{language.t("sucafina.native.shell.page")}</span>
                <select
                  value={page().page}
                  onChange={(event) => {
                    const selected = event.currentTarget.value
                    if (page().pages.includes(selected)) props.onPage(selected)
                  }}
                >
                  <For each={page().pages}>{(item) => <option value={item}>{pageLabel(item)}</option>}</For>
                </select>
              </label>
            )}
          </Show>
        </div>
        <Show when={state().page}>
          {(page) => (
            <>
              <div class="mx-meta">
                <IdentityPhrase translation="sucafina.native.shell.signedIn" name={page().actor.name} />
                <Show when={!page().actor.canWrite}><span class="mx-badge">{language.t("sucafina.native.shell.readOnly")}</span></Show>
                <Show when={state().draft}><span class="mx-badge">{language.t("sucafina.native.shell.unsaved")}</span></Show>
              </div>
              {props.filters}
            </>
          )}
        </Show>
        <div class="mx-meta">
          <button
            type="button"
            class="mx-btn primary"
            disabled={busy() || !state().page?.actor.canWrite || !state().draft || state().draft?.page !== state().page?.page}
            onClick={() => void props.controller.save()}
          >
            {language.t("sucafina.native.shell.save")}
          </button>
          <button type="button" class="mx-btn" disabled={busy()} onClick={() => void props.controller.refresh()}>
            {language.t("sucafina.native.shell.refresh")}
          </button>
          <Show when={state().draft || state().conflict}>
            <button type="button" class="mx-btn" disabled={busy()} onClick={() => void props.controller.discardDraft()}>
              {language.t("sucafina.native.shell.discard")}
            </button>
          </Show>
          <Show when={state().saving}><span role="status">{language.t("sucafina.native.shell.saving")}</span></Show>
          <Show when={state().loading}><span role="status">{language.t("sucafina.native.shell.loading")}</span></Show>
        </div>
      </div>
      <Show when={state().warnings.length > 0}>
        <div class="mx-card" role="status">
          <For each={state().warnings}>{(warning) => <p>{warning}</p>}</For>
        </div>
      </Show>
      <Show when={state().error}>
        {(error) => (
          <div class="mx-empty" role="alert">
            <strong>{error().message}</strong>
            <For each={error().detail?.errors}>{(detail) => <p>{detail}</p>}</For>
          </div>
        )}
      </Show>
      <Show when={state().conflict}>
        {(conflict) => (
          <div class="mx-empty" role="alert">
            <strong>{language.t("sucafina.native.shell.conflict")}</strong>
            <p>{conflict().message}</p>
            <Show when={conflict().detail?.by}>{(by) => <p><IdentityPhrase translation="sucafina.native.shell.changedBy" name={by()} /></p>}</Show>
          </div>
        )}
      </Show>
      <Show when={state().page} fallback={
        <Show when={!state().loading && !state().error && !state().conflict}>
          <div class="mx-empty" role="status">{language.t("sucafina.native.shell.noPage")}</div>
        </Show>
      }>
        {(page) => props.children(page())}
      </Show>
    </MxPage>
  )
}

function IdentityPhrase(props: { translation: "sucafina.native.shell.signedIn" | "sucafina.native.shell.changedBy"; name: string }) {
  const language = useLanguage()
  const parts = () => language.t(props.translation, { name: "\uFFF0" }).split("\uFFF0")
  return <span>{parts()[0]}<bdi>{props.name}</bdi>{parts()[1]}</span>
}
