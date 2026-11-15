import { For, Show, type JSX } from "solid-js"
import { SfPeople } from "@orchestra/schema/sucafina/people"
import { createSfPeopleClient } from "@orchestra/client/sucafina/people"
import type { SfSurfaceProps } from "../../context/contracts"
import { SfPageFrame } from "../../shared/frame"
import { SfStatePanel } from "../../shared/states"
import { sfCommonKey, useSfPresentation } from "../../shared/frame/presentation"
import type { SfCopyKey } from "../../shared/frame"
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
  const { t } = useSfPresentation()
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
  const metric = (labelKey: string, value: string | number | undefined) => (
    <Show when={value !== undefined}>
      <div class="sf-people-stat">
        <dt>{t(key(labelKey))}</dt>
        <dd>{value}</dd>
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
        { id: "installation", label: { key: key("sf.u03.installation") },
          value: { kind: "data", text: snapshot()!.context.stamp.installationId } },
        { id: "year", label: { key: key("sf.u03.year") },
          value: { kind: "data", text: String(snapshot()!.value.selection.year ?? "") } },
      ] : []}
      tabs={[]} activeTab={null}
      // I00/125 owns route builders. The caption is presented, but no leaf
      // fabricates an owner-aware href or performs an unsafe cross-owner jump.
      primaryAction={{
        id: "open-team-structure", labelKey: key("sf.cap06.primary"),
        tone: "primary", disabled: true, busy: false,
        reasonKey: sfCommonKey("sf.common.unavailable"), onInvoke: () => undefined,
      }}
      secondaryActions={[]} density="comfortable" layout="reading"
      onLayoutMode={() => undefined}
    >
      <SfStatePanel
        state={session.ui()} messageKey={stateMessage()}
        onRetryRead={() => { void session.reload() }}
      >
        <Show when={data()}>
          {(current) => (
            <>
              <section class="sf-people-section" aria-label={t(key("sf.cap06.title"))}>
                <h2>{t(key("sf.u03.authorizedHeadcount"))}</h2>
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
                <h2>{t(key("sf.u03.leaders"))}</h2>
                <div class="sf-people-table-region" role="region"
                  aria-label={t(key("sf.u03.leaders"))} tabindex="0">
                  <table class="sf-people-table">
                    <caption>{t(key("sf.u03.leaders"))}</caption>
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
    </SfPageFrame>
  )
}
