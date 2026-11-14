/** Synthetic source records, never a supplied C02/C05 projection or rendered report. */
export function reportsCorpus(today = new Date().toISOString().slice(0, 10)) {
  const year = Number(today.slice(0, 4))
  if (!/^\d{4}-\d{2}-\d{2}$/.test(today) || year < 2024 || year > 2027)
    throw new Error("The installed Dashboard supports reporting years 2024–2027")
  const projects = Array.from({ length: 25 }, (_, index) => {
    const number = String(index + 1).padStart(2, "0")
    return {
      id: `reports-project-${number}`,
      name: `Reports project ${number}`,
      desc: `Isolated Reports source ${number}`,
      status: "Planning", risk: "Low", priority: "Medium", pm: "Reports operator",
      start: `${year}-01-01`, end: `${year}-12-31`, budget: 100 + index, spent: 0, pct: 0,
      notes: index === 24
        ? `${"Long human project note with preserved punctuation & <source>. ".repeat(36)}REPORTS_LONG_NOTE_END`
        : `Project note ${number}`,
      milestones: [],
    }
  })
  const entries = Array.from({ length: 12 }, (_, index) => ({
    id: `reports-opex-${String(index + 1).padStart(2, "0")}`,
    ownerId: "reports-opex", year, month: index + 1, budget: 100, actual: 100, forecast: 110,
  }))
  return {
    today, year,
    annual: { start: `${year}-01-01`, end: `${year}-12-31` },
    january: { start: `${year}-01-01`, end: `${year}-01-31` },
    forecastField: `budgetMetrics.${year}.totalForecast`,
    before: 1320, after: 1400,
    projects,
    data: {
      opexOwners: [{ id: "reports-opex", name: "Reports budget", budget: 1200 }],
      opexEntries: entries, capexProjects: [], capexEntries: [],
      projects, hotTopics: [], leaders: [], members: [],
    },
  }
}

export type ReportsCorpus = ReturnType<typeof reportsCorpus>
