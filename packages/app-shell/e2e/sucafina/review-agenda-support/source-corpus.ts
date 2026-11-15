/** Synthetic business sources only; no review, agenda, selector or preserved output is seeded. */
export const firstAgendaCorpus = {
  baselineId: "reports-agenda-baseline",
  candidateId: "reports-agenda-candidate",
  baselineName: "Reports baseline",
  candidateName: "Reports candidate",
  requestTitle: "Reports agenda purchase",
} as const

export function firstAgendaVersions(year: number) {
  return [
    { id: firstAgendaCorpus.baselineId, name: firstAgendaCorpus.baselineName, forecast: 100 },
    { id: firstAgendaCorpus.candidateId, name: firstAgendaCorpus.candidateName, forecast: 110 },
  ].map(({ id, name, forecast }) => ({
    id, name, year, closed: 0,
    lines: [{
      id: "reports-agenda-license", name: "Reports agenda license", sec: "opex", el: "licenses", cur: "USD",
      b: Array(12).fill(100), a: Array(12).fill(null), f: Array(12).fill(forecast),
    }],
    fx: [], hc: { positions: [], rates: [], hrAF: {} }, projects: [], lists: {},
  }))
}
