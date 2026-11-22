import { useNavigate } from "@solidjs/router"
import { For, Show, type JSX } from "solid-js"
import { SfPeople } from "@orchestra/schema/sucafina/people"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame"
import { sfEntryDestinationRequest } from "../../navigation-state"
import { createPeopleSession } from "../structure/session"
import "../structure/people.css"

type HeadcountResponse = typeof SfPeople.operations["domain.page.CAP06"]["output"]["Type"]
type HeadcountData = Extract<HeadcountResponse, { status: "ok" }>["value"]["data"]
const key = (value: string) => value as SfCopyKey

/**
 * U03 / CAP06. All statistics and breakdowns are server-produced A10 fields:
 * no frontend recomputation of attrition, staff ratio, tenure or headcount.
 */
export function SfPeopleOverviewView(props: SfSurfaceProps<"CAP06">): JSX.Element {
  const { t, locale } = useSfPresentation()
  const navigate = useNavigate()
  const session = createPeopleSession<HeadcountData>("CAP06", () => props.route.href,
    (transport, signal) => {
      const selection = {
        ...(props.route.query.year === undefined ? {} : { year: props.route.query.year }),
        ...(props.route.query.month === undefined ? {} : { month: props.route.query.month }),
      }
      return createSfPeopleClient(transport)["domain.page.CAP06"](selection, { signal })
    })
  const snapshot = () => session.ready()
  const data = () => snapshot()?.value.data
  const structureDenied = () => {
    const active = snapshot()
    if (!active) return false
    const destination = active.context.destinations.find((item) =>
      item.capabilityId === "CAP07" && item.surface === "dashboard")
    const resource = active.context.availability.find((item) =>
      item.family === "domain-read" && item.resource === "CAP07")
    return !destination?.canRead || resource?.state === "denied"
  }
  const structureHref = () => structureDenied() ? undefined : sfEntryDestinationRequest(props.route, "CAP07")
  const metric = (labelKey: string, value: string | number | undefined) => (
    <Show when={value !== undefined}>
      <div class="sf-people-stat">
        <dt>{t(key(labelKey))}</dt>
        <dd>{typeof value === "number" ? new Intl.NumberFormat(locale(), { maximumFractionDigits: 2 }).format(value) : value}</dd>
      </div>
    </Show>
  )
  const stateMessage = () => session.ui() === "denied" ? sfCommonKey("sf.common.noAccess") :
    session.ui() === "session-expired" ? sfCommonKey("sf.common.loginAgain") :
    session.ui() === "unavailable" ? sfCommonKey("sf.common.unavailable") :
    session.ui() === "stale" ? sfCommonKey("sf.common.stale") :
    session.ui() === "invalid" ? sfCommonKey("sf.common.invalidLink") :
    sfCommonKey("sf.common.loading")

  return (
    <SfPageFrame
      titleKey={key("sf.cap06.title")}
      context={snapshot() ? [
        { id: "year", label: { key: key("sf.u03.year") },
          value: { kind: "data", text: String(snapshot()!.value.selection.year ?? "") } },
      ] : []}
      tabs={[]} activeTab={null}
      primaryAction={structureHref() ? {
        id: "open-team-structure", labelKey: key("sf.cap06.primary"),
        tone: "primary", disabled: false, busy: false,
        onInvoke: () => {
          const href = structureHref()
          if (href) navigate(href)
        },
      } : undefined}
      secondaryActions={[]} density="comfortable" layout="reading"
      onLayoutMode={() => undefined}
    >
      <div class="sf-people-workspace" data-sf-wave="three" data-sf-surface="CAP06">
      <p class="sf-people-lead">{t(key("sf.u03.design.overviewLead"))}</p>
      <SfStatePanel
        state={session.ui()} messageKey={stateMessage()}
        onRetryRead={() => { void session.reload() }}
      >
        <Show when={data()}>
          {(current) => (
            <>
              <section class="sf-people-section" aria-label={t(key("sf.cap06.title"))}>
                <div class="sf-people-section-heading"><div>
                  <h2>{t(key("sf.u03.authorizedHeadcount"))}</h2>
                  <p>{t(key("sf.u03.design.source"))}</p>
                </div></div>
                <dl class="sf-people-stats" data-sf-metrics="headcount">
                  {metric("sf.u03.metrics.active", current().metrics.active)}
                  {metric("sf.u03.metrics.terminated", current().metrics.terminated)}
                  {metric("sf.u03.metrics.attrition", current().metrics.attritionYtd)}
                  {metric("sf.u03.metrics.tenure", current().metrics.averageTenureMonths)}
                  {metric("sf.u03.metrics.ratio", current().metrics.staffRatio)}
                  {metric("sf.u03.metrics.contractors", current().metrics.contractors)}
                  {metric("sf.u03.metrics.employees", current().metrics.employees)}
                  {metric("sf.u03.metrics.talent", current().metrics.talent)}
                </dl>
              </section>
              <section class="sf-people-section" aria-label={t(key("sf.u03.leaders"))}>
                <div class="sf-people-section-heading"><div>
                  <h2>{t(key("sf.u03.leaders"))}</h2>
                  <p>{t(key("sf.u03.design.leadersLead"))}</p>
                </div></div>
                <div class="sf-people-table-region" role="region"
                  aria-label={t(key("sf.u03.leaders"))} tabindex="0">
                  <table class="sf-people-table">
                    <caption class="sf-people-sr-only">{t(key("sf.u03.leaders"))}</caption>
                    <thead><tr>
                      <th scope="col">{t(key("sf.u03.leader"))}</th>
                      <th scope="col">{t(key("sf.u03.metrics.active"))}</th>
                      <Show when={current().metrics.talent !== undefined}>
                        <th scope="col">{t(key("sf.u03.talentActive"))}</th>
                      </Show>
                    </tr></thead>
                    <tbody>
                      <For each={current().byLeader}>
                        {(leader) => <tr data-sf-ref={leader.id}>
                          <th scope="row">{leader.name || t(key("sf.u03.noLeader"))}</th>
                          <td>{leader.active}</td>
                          <Show when={current().metrics.talent !== undefined}>
                            <td>{leader.talentActive}</td>
                          </Show>
                        </tr>}
                      </For>
                    </tbody>
                  </table>
                </div>
              </section>
            </>
          )}
        </Show>
      </SfStatePanel>
      </div>
    </SfPageFrame>
  )
}
