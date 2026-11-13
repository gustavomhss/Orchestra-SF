import { addReportTextSlides } from "../product/reviews/report-layout.ts"
import { projectDashboardSource } from "../product/dashboard/port.ts"
import { computeBudgetTotals, dashboardMoney, socClosureValue } from "../src/dashboard-accounts.ts"
import type { BudgetData } from "../src/dashboard-accounts.ts"
import { dashboardPages } from "../src/nav.ts"
import { wordScript } from "../src/surfaces.ts"
import type { Actor, Environment, Snapshot } from "./contract.ts"
import { finite, object, rows, text } from "./contract.ts"
import type { ArtifactResult } from "./artifact.ts"

type Topic = {
  title: string
  subtitle?: string
  bullets: string[]
  metrics: { label: string; value: string }[]
  table: string[][]
}
const COLLECTIONS: Record<string, string> = {
  "Hot Topics & Actions": "hotTopics",
  "OPEX Detail": "opexOwners",
  "CAPEX Projects": "capexProjects",
  "Headcount Overview": "members",
  "Team Structure": "leaders",
  "Talent Review": "members",
  "Portfolio Dashboard": "projects",
  "All Projects": "projects",
  "IT Operations": "opsTickets",
  "IT Security KPIs": "secKpi",
  "IT Risks": "risks",
  "Vendor Contracts": "contracts",
  "Stakeholder Management": "stakeholders",
}

export async function createReport(
  snapshot: Snapshot,
  actor: Actor,
  environment: Environment,
  options: {
    format: "pptx" | "docx"
    year: number
    title?: string
    topics: string[]
  },
): Promise<ArtifactResult> {
  if (!Number.isInteger(options.year) || options.year < 2024 || options.year > 2027 || !options.topics.length || !["pptx", "docx"].includes(options.format) || new Set(options.topics).size !== options.topics.length)
    return {
      ok: false,
      status: 422,
      errors: ["Select a valid year, format and at least one distinct topic."],
    }
  const allowed = dashboardPages(
    actor,
    Array.isArray(snapshot.data.summaries)
      ? snapshot.data.summaries.filter((entry): entry is string => typeof entry === "string")
      : [],
  )
  if (
    options.topics.some(
      (topic) => !(topic === "Executive Summary" ? allowed.includes("Executive Dashboard") : allowed.includes(topic)),
    ) ||
    (options.topics.includes("Talent Review") && !actor.roles.includes("admin"))
  )
    return { ok: false, status: 403 }
  const topics = options.topics.map((name) => topic(snapshot, actor, environment, name, options.year, allowed.includes("Budget Overview")))
  const title = options.title || "Sucafina IT — CIO Dashboard Report"
  if (options.format === "docx") {
    const script = wordScript(title, options.year, environment.at, topics.map((selected) => ({ ...selected, bullets: selected.table.length ? selected.table.map((row) => row.join(" · ")) : selected.bullets })))
    if (!script.ok) return { ok: false, status: 422, errors: ["Select at least one topic."] }
    const { Document, Packer, Paragraph, HeadingLevel, Footer, PageNumber, TextRun, AlignmentType } = await import("docx")
    const paragraphs = [
      new Paragraph({ text: script.title, heading: HeadingLevel.TITLE }),
      new Paragraph(script.line),
      new Paragraph("A review of the selected IT dashboard topics and their recorded figures."),
      new Paragraph(`Selection order: ${options.topics.join(" → ")}. Annual and monthly measures use FY ${options.year}; record lists show the authorized state captured at ${environment.at}.`),
    ]
    const sections = script.sections.flatMap((section) => [
      new Paragraph({ text: section.heading, heading: HeadingLevel.HEADING_1 }),
      ...(section.subtitle ? [new Paragraph(section.subtitle)] : []),
      ...section.bullets.map((bullet) => new Paragraph(bullet)),
      ...(section.figures ? [new Paragraph(`Key figures to reference: ${section.figures}`)] : []),
    ])
    const document = new Document({
      creator: "Sucafina",
      title,
      styles: { default: { document: { run: { font: "Aptos", size: 22, color: "243C30" }, paragraph: { spacing: { after: 120, line: 280 }, widowControl: true } }, heading1: { run: { color: "173D2C", size: 30 }, paragraph: { spacing: { before: 260, after: 160 }, keepNext: true } } },
      sections: [{
        properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
        footers: { default: new Footer({ children: [new Paragraph({ alignment: AlignmentType.RIGHT, children: [new TextRun("Dashboard report · Page "), new TextRun({ children: [PageNumber.CURRENT] }), new TextRun(" of "), new TextRun({ children: [PageNumber.TOTAL_PAGES] })] })] }) },
        children: [...paragraphs, ...sections],
      }],
    })
    return {
      ok: true,
      name: script.file,
      type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      bytes: new Uint8Array(await Packer.toBuffer(document)),
    }
  }
  const { default: PptxGenJS } = await import("pptxgenjs")
  const presentation = new PptxGenJS()
  presentation.layout = "LAYOUT_WIDE"
  presentation.author = "Sucafina"
  presentation.title = title
  presentation.subject = `IT Dashboard · FY ${options.year}`
  for (const selected of topics) {
    const records = selected.table.length ? selected.table.map((row) => row.join(" · ")) : selected.bullets
    addReportTextSlides(presentation, selected.title, [
      ...(selected.subtitle ? [selected.subtitle] : []),
      ...selected.metrics.map((metric) => `${metric.label} ${metric.value}`),
      ...(records.length ? records : ["No records."]),
    ], `FY ${options.year} · ${environment.at.slice(0, 10)}`)
  }
  addReportTextSlides(presentation, "Selected content", [
    title,
    `Selection order: ${options.topics.join(" → ")}.`,
    `Annual and monthly measures use FY ${options.year}; record lists show the authorized state captured at ${environment.at}.`,
    ...topics.map((selected) => `${selected.title}: ${selected.table.length ? `${selected.table.length} presented source row(s)` : `${selected.bullets.length} factual note(s)`}; ${selected.metrics.length} metric(s).`),
  ], "Dashboard report")
  const output = await presentation.write({ outputType: "uint8array" })
  if (!(output instanceof Uint8Array)) throw new Error("Unexpected presentation output")
  return {
    ok: true,
    name: `${title.replace(/[^a-z0-9]+/gi, "_") || "CIO_Report"}.pptx`,
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    bytes: output,
  }
}

function topic(snapshot: Snapshot, actor: Actor, environment: Environment, name: string, year: number, canReadBudget: boolean): Topic {
  const data = projectDashboardSource(snapshot, actor, environment, name === "Executive Summary" ? "Executive Dashboard" : name)
  if (!data) return { title: name, bullets: ["This topic is unavailable for the current access and context."], metrics: [], table: [] }
  if (name === "Executive Dashboard" || name === "Executive Summary" || name === "Budget Overview") {
    if (!canReadBudget) return { title: name, bullets: ["Budget figures are unavailable for this selection."], metrics: [], table: [] }
    const totals = computeBudgetTotals(budget(data), year)
    return {
      title: name,
      bullets: ["Budget, actual and forecast figures cover all twelve months."],
      metrics: [
        { label: "Budget", value: dashboardMoney(totals.totalBudget) },
        { label: "Actual", value: dashboardMoney(totals.totalActual) },
        { label: "Forecast", value: dashboardMoney(totals.totalForecast) },
        { label: "OPEX budget", value: dashboardMoney(totals.opexBudget) },
        { label: "CAPEX budget", value: dashboardMoney(totals.capexBudget) },
      ],
      table: [],
    }
  }
  if (name === "IT Performance Contract") {
    const contract = object(data.itperf)
    const items = rows(contract.items)
    return {
      title: name,
      bullets: items.map((item) => text(item.name) || text(item.title)),
      metrics: [],
      table: items.map((item) => [text(item.name) || text(item.title), text(item.owner), text(item.status)]),
    }
  }
  if (name === "IT Operations") {
    const entries = rows(data.opsTickets).filter((entry) => finite(entry.year) === year).sort((left, right) => finite(left.month) - finite(right.month))
    const configured = Array.isArray(data.opsCats)
      ? data.opsCats
          .map((category) => (typeof category === "string" ? category : text(object(category).key)))
          .filter((category) => category.length > 0)
      : []
    const categories = configured.length
      ? configured
      : ["IT Security", "Infrastructure", "Application", "IT Operations", "Others (Beyers OT)"]
    const measurements = entries.flatMap((entry) => [...new Set(categories)].flatMap((category) => ["Incidents", "Service Requests"].map((type) => [
      `${year}-${String(entry.month).padStart(2, "0")}`,
      category,
      type,
      `Opened: ${display(entry[`${category}|${type}|Open`]) || "unavailable"}`,
      `Closed: ${display(entry[`${category}|${type}|Closed`]) || "unavailable"}`,
      `Initial balance: ${display(entry[`${category}|${type}|Initial Balance`]) || "unavailable"}`,
    ])))
    return {
      title: name,
      subtitle: `Monthly source measurements · FY ${year}. YTD totals are unavailable from this source projection; no aggregate is inferred.`,
      bullets: [
        entries.length
          ? `IT Operations contains ${entries.length} monthly source record(s). Missing measurements remain unavailable; a measured zero remains zero.`
          : `No IT Operations ticket data has been entered yet for ${year}.`,
      ],
      metrics: [
        { label: "Months w/ Data", value: String(entries.length) },
      ],
      table: measurements,
    }
  }
  if (name === "IT Security KPIs") {
    const entries = rows(data.secKpi)
      .filter((entry) => finite(entry.year) === year)
      .sort((left, right) => finite(left.month) - finite(right.month))
    const latest = entries.at(-1)
    const severity = (key: string) => {
      const value = latest?.[key]
      return typeof value === "number" || typeof value === "string" || value === null ? value : undefined
    }
    const closure = latest
      ? socClosureValue({
          socCritical: severity("socCritical"),
          socHigh: severity("socHigh"),
          socMedium: severity("socMedium"),
          socLow: severity("socLow"),
          socPending: severity("socPending"),
          socClosure: severity("socClosure"),
        })
      : null
    const percentage = (value: unknown) => {
      const formatted = display(value)
      return formatted ? `${formatted}%` : "—"
    }
    const training = percentage(latest?.training)
    const patch = percentage(latest?.patch)
    const month = latest
      ? new Intl.DateTimeFormat("en", { month: "long", timeZone: "UTC" }).format(
          new Date(Date.UTC(year, finite(latest.month) - 1, 1)),
        )
      : undefined
    return {
      title: name,
      subtitle: `Latest reported month · FY ${year}`,
      bullets: [
        latest
          ? `Security KPIs for ${month} ${year} show ${training} awareness training completion and ${patch} patch compliance.`
          : `No IT Security KPI data has been entered yet for ${year}.`,
      ],
      metrics: [
        { label: "Awareness Training", value: training },
        { label: "Patch Compliance", value: patch },
        { label: "SOC Closure", value: percentage(closure) },
        { label: "Scan Coverage", value: percentage(latest?.scan) },
        { label: "Awareness Assessment", value: percentage(latest?.assessment) },
      ],
      table: [],
    }
  }
  const records = rows(data[COLLECTIONS[name]])
  const columns =
    name === "Talent Review"
      ? ["name", "status", "cls", "outlook", "notes"]
      : name === "Hot Topics & Actions"
        ? ["action", "status", "priority", "due"]
        : name === "Headcount Overview"
          ? ["name", "title", "type", "status"]
          : name === "Vendor Contracts"
            ? ["vendor", "name", "amount", "renewType"]
            : ["name", "title", "status", "priority", "notes", "comments", "due"]
  return {
    title: name,
    bullets: records.map((record) =>
      columns
        .map((column) => display(record[column]))
        .filter(Boolean)
        .join(" · "),
    ),
    metrics: [{ label: "Records", value: String(records.length) }],
    table: records.map((record) => columns.map((column) => display(record[column]))),
  }
}
function display(value: unknown) {
  return typeof value === "string" ? value : typeof value === "number" && Number.isFinite(value) ? String(value) : ""
}
function budget(data: Record<string, unknown>): BudgetData {
  const owners = (value: unknown) =>
    rows(value).map((row) => ({
      id: String(row.id ?? ""),
      budget: finite(row.budget),
    }))
  const entries = (value: unknown) =>
    rows(value).map((row) => ({
      year: finite(row.year),
      month: finite(row.month),
      ownerId: row.ownerId == null ? undefined : String(row.ownerId),
      projId: row.projId == null ? undefined : String(row.projId),
      projectId: row.projectId == null ? undefined : String(row.projectId),
      budget: finite(row.budget),
      actual: finite(row.actual),
      forecast: finite(row.forecast),
    }))
  return {
    opexOwners: owners(data.opexOwners),
    opexEntries: entries(data.opexEntries),
    capexProjects: owners(data.capexProjects),
    capexEntries: entries(data.capexEntries),
  }
}
