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
  if (!Number.isInteger(options.year) || options.year < 2024 || options.year > 2027 || !options.topics.length)
    return {
      ok: false,
      status: 422,
      errors: ["Select a valid year and at least one topic."],
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
  const topics = options.topics.map((name) => topic(snapshot, actor, environment, name, options.year))
  const title = options.title || "Sucafina IT — CIO Dashboard Report"
  if (options.format === "docx") {
    const script = wordScript(title, options.year, environment.at, topics)
    if (!script.ok) return { ok: false, status: 422, errors: ["Select at least one topic."] }
    const { Document, Packer, Paragraph, HeadingLevel } = await import("docx")
    const paragraphs = [
      new Paragraph({ text: script.title, heading: HeadingLevel.TITLE }),
      new Paragraph(script.line),
      new Paragraph("A review of the selected IT dashboard topics and their recorded figures."),
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
      sections: [{ children: [...paragraphs, ...sections] }],
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
    const slide = presentation.addSlide()
    slide.background = { color: "F3F6F2" }
    slide.addText(selected.title, {
      x: 0.6,
      y: 0.35,
      w: 12.1,
      h: 0.6,
      color: "173D2C",
      fontSize: 27,
      bold: true,
    })
    slide.addText(`FY ${options.year} · ${environment.at.slice(0, 10)}`, {
      x: 0.6,
      y: 1.0,
      w: 12,
      h: 0.25,
      fontSize: 10,
      color: "607469",
    })
    const metrics = selected.metrics.slice(0, 6)
    metrics.forEach((metric, index) =>
      slide.addText(`${metric.label}\n${metric.value}`, {
        x: 0.6 + (index % 3) * 4.1,
        y: 1.45 + Math.floor(index / 3) * 0.8,
        w: 3.8,
        h: 0.7,
        fontSize: 15,
        color: "173D2C",
        margin: 0.08,
        fill: { color: "FFFFFF" },
      }),
    )
    const table = selected.table.slice(0, 12)
    if (table.length)
      slide.addTable(
        table.map((row) => row.map((cell) => ({ text: cell }))),
        {
          x: 0.6,
          y: metrics.length > 3 ? 3.2 : 2.4,
          w: 12.1,
          h: 3.7,
          fontSize: 10,
          color: "243C30",
          border: { type: "solid", color: "DCE5DA", pt: 0.3 },
          fill: { color: "FFFFFF" },
          margin: 0.06,
        },
      )
    else
      slide.addText(
        selected.bullets
          .slice(0, 12)
          .map((bullet) => `• ${bullet}`)
          .join("\n") || "No records.",
        {
          x: 0.6,
          y: 3.2,
          w: 12,
          h: 3,
          fontSize: 17,
          color: "243C30",
          breakLine: true,
        },
      )
  }
  const output = await presentation.write({ outputType: "uint8array" })
  if (!(output instanceof Uint8Array)) throw new Error("Unexpected presentation output")
  return {
    ok: true,
    name: `${title.replace(/[^a-z0-9]+/gi, "_") || "CIO_Report"}.pptx`,
    type: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    bytes: output,
  }
}

function topic(snapshot: Snapshot, actor: Actor, environment: Environment, name: string, year: number): Topic {
  if (name === "Executive Dashboard" || name === "Executive Summary" || name === "Budget Overview") {
    const totals = computeBudgetTotals(budget(snapshot.data), year)
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
    const contract = object(snapshot.data.itperf)
    const items = rows(contract.items)
    return {
      title: name,
      bullets: items.map((item) => text(item.name) || text(item.title)),
      metrics: [],
      table: items.map((item) => [text(item.name) || text(item.title), text(item.owner), text(item.status)]),
    }
  }
  if (name === "IT Operations") {
    const entries = rows(snapshot.data.opsTickets).filter((entry) => finite(entry.year) === year)
    const configured = Array.isArray(snapshot.data.opsCats)
      ? snapshot.data.opsCats
          .map((category) => (typeof category === "string" ? category : text(object(category).key)))
          .filter((category) => category.length > 0)
      : []
    const categories = configured.length
      ? configured
      : ["IT Security", "Infrastructure", "Application", "IT Operations", "Others (Beyers OT)"]
    const total = (measure: string) =>
      entries.reduce(
        (entryTotal, entry) =>
          entryTotal +
          categories.reduce(
            (categoryTotal, category) =>
              categoryTotal +
              ["Incidents", "Service Requests"].reduce(
                (typeTotal, type) => typeTotal + finite(entry[`${category}|${type}|${measure}`]),
                0,
              ),
            0,
          ),
        0,
      )
    const opened = total("Open")
    const closed = total("Closed")
    return {
      title: name,
      subtitle: `Ticket Volume · FY ${year}`,
      bullets: [
        entries.length
          ? `IT Operations recorded ${opened} ticket(s) opened and ${closed} closed year-to-date across ${entries.length} month(s) of data.`
          : `No IT Operations ticket data has been entered yet for ${year}.`,
      ],
      metrics: [
        { label: "Tickets Opened YTD", value: entries.length ? String(opened) : "—" },
        { label: "Tickets Closed YTD", value: entries.length ? String(closed) : "—" },
        { label: "Months w/ Data", value: String(entries.length) },
      ],
      table: [],
    }
  }
  if (name === "IT Security KPIs") {
    const entries = rows(snapshot.data.secKpi)
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
  const records = rows(snapshot.data[COLLECTIONS[name]])
  if (["Talent Review", "Headcount Overview"].includes(name)) {
    for (const member of records)
      snapshot.audit.push({
        who: actor.id,
        at: environment.at,
        record: `members:${String(member.id ?? "")}`,
        was: null,
        became: { read: true, member: String(member.id ?? "") },
      })
  }
  const columns =
    name === "Talent Review"
      ? ["name", "status", "cls", "outlook", "notes"]
      : name === "Hot Topics & Actions"
        ? ["action", "status", "priority", "due"]
        : name === "Headcount Overview"
          ? ["name", "title", "type", "status"]
          : name === "Vendor Contracts"
            ? ["vendor", "name", "amount", "renewType"]
            : ["name", "title", "status", "priority"]
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
