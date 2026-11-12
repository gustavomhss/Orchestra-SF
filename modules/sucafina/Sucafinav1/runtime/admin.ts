import type { RoleRow, Surface } from "../src/identity.ts"
import { emptyMap, setGroupName } from "../src/identity.ts"
import { DASHBOARD_PAGES } from "../src/nav.ts"
import { esc } from "../src/screen-shell.ts"
import type { Actor, Command, Environment, Result, Snapshot } from "./contract.ts"
import { changed, conflict, object, rows, text } from "./contract.ts"
import { fields, form } from "./ui.ts"

export function roleMap(snapshot: Snapshot, surface: Surface): RoleRow[] {
  if (snapshot.data.roleMap !== undefined && !Array.isArray(snapshot.data.roleMap))
    throw new Error("Invalid persisted role map")
  const stored = rows(snapshot.data.roleMap)
  return emptyMap()
    .filter((row) => row.surface === surface)
    .map((row) => {
      const value = stored.find((item) => item.surface === surface && item.role === row.role)
      if (
        value &&
        (!Number.isSafeInteger(value.version) ||
          Number(value.version) < 0 ||
          typeof value.by !== "string" ||
          (value.entra !== null && typeof value.entra !== "string"))
      )
        throw new Error("Invalid persisted role row")
      return value
        ? {
            ...row,
            entra: typeof value.entra === "string" ? value.entra : null,
            version: typeof value.version === "number" ? value.version : 0,
            by: text(value.by),
          }
        : row
    })
}

export function configure(
  snapshot: Snapshot,
  surface: Surface,
  actor: Actor,
  command: Command,
  environment: Environment,
): Result {
  if (!actor.canWrite || !actor.roles.includes("admin")) return { ok: false, status: 403 }
  if (command.action === "configure-group") {
    if (typeof command.values.role !== "string" || typeof command.values.entra !== "string")
      return { ok: false, status: 422 }
    const map = roleMap(snapshot, surface)
    const result = setGroupName(
      map,
      surface,
      command.values.role,
      command.values.entra,
      command.version,
      { id: actor.id, canWrite: actor.canWrite, roles: actor.roles.map((role) => ({ surface, role })) },
      environment.at,
      [],
    )
    if (!result.ok)
      return { ok: false, status: result.status === 409 ? 409 : 403, stored: result.stored, by: result.by }
    snapshot.data.roleMap = [...rows(snapshot.data.roleMap).filter((row) => row.surface !== surface), ...result.map]
    changed(
      snapshot,
      `group:${command.values.role}`,
      actor,
      environment.at,
      map.find((row) => row.role === command.values.role)?.entra,
      command.values.entra.trim() || null,
    )
    return { ok: true }
  }
  if (command.action === "configure-summaries") {
    if (surface !== "dashboard") return { ok: false, status: 403 }
    const selected = command.values.pages ?? []
    if (
      !Array.isArray(selected) ||
      selected.some((page) => typeof page !== "string" || !(DASHBOARD_PAGES as readonly string[]).includes(page))
    )
      return { ok: false, status: 422 }
    const previous = snapshot.data.summaries ?? []
    const stale = conflict(snapshot, "config:summaries", command, previous)
    if (stale) return stale
    snapshot.data.summaries = [...new Set(selected)]
    changed(snapshot, "config:summaries", actor, environment.at, previous, snapshot.data.summaries)
    return { ok: true }
  }
  if (command.action === "configure-budget-lines") {
    if (surface !== "dashboard") return { ok: false, status: 403 }
    const person = environment.directory.find((person) => person.id === command.values.person)
    const selected = command.values.lines ?? []
    const allowed = (["opexOwners", "capexProjects"] as const).flatMap((collection) =>
      rows(snapshot.data[collection])
        .filter(
          (row) =>
            (typeof row.id === "string" && row.id !== "") || (typeof row.id === "number" && Number.isFinite(row.id)),
        )
        .map((row) => `${collection}:${String(row.id)}`),
    )
    if (!person || !Array.isArray(selected) || selected.some((id) => typeof id !== "string" || !allowed.includes(id)))
      return { ok: false, status: 422 }
    const previous = object(snapshot.data.budgetLineIds)[person.id] ?? []
    const key = `config:budgetLineIds:${person.id}`
    const stale = conflict(snapshot, key, command, previous)
    if (stale) return stale
    snapshot.data.budgetLineIds = { ...object(snapshot.data.budgetLineIds), [person.id]: [...new Set(selected)] }
    changed(snapshot, key, actor, environment.at, previous, selected)
    return { ok: true }
  }
  if (command.action === "configure-assignment") {
    if (surface !== "dashboard" && surface !== "planner") return { ok: false, status: 403 }
    const person = environment.directory.find((person) => person.id === command.values.person)
    const field = surface === "dashboard" ? "assigned" : "domains"
    const raw = command.values[field] ?? []
    const values =
      typeof raw === "string"
        ? raw
            .split("\n")
            .map((value) => value.trim())
            .filter(Boolean)
        : raw
    if (
      !person ||
      !Array.isArray(values) ||
      values.some((value) => typeof value !== "string" || !value.trim()) ||
      (surface === "dashboard" &&
        values.some((value) => !["Operations", "security", "projects", "risks", "contracts"].includes(value)))
    )
      return { ok: false, status: 422 }
    const key = `config:access:${person.id}`
    const current = object(object(snapshot.data.access)[person.id])
    const stale = conflict(snapshot, key, command, current)
    if (stale) return stale
    const next = { ...current, [field]: [...new Set(values)] }
    snapshot.data.access = { ...object(snapshot.data.access), [person.id]: next }
    changed(snapshot, key, actor, environment.at, current, next)
    return { ok: true }
  }
  return { ok: false, status: 400 }
}

export function controls(
  snapshot: Snapshot,
  surface: Surface,
  page: string,
  actor: Actor,
  environment: Environment,
): string {
  if (!actor.roles.includes("admin")) return ""
  const disabled = !actor.canWrite
  const groups = roleMap(snapshot, surface)
    .map((row) =>
      form(
        page,
        "configure-group",
        row.role,
        row.version,
        `<input type="hidden" name="role" value="${esc(row.role)}">` +
          fields([{ name: "entra", label: `${row.role} — Entra group`, value: row.entra }]),
        "Save group",
        disabled,
      ),
    )
    .join("")
  const summaries =
    surface === "dashboard"
      ? form(
          page,
          "configure-summaries",
          "",
          snapshot.versions["config:summaries"]?.version ?? 0,
          `<fieldset><legend>Additional viewer summaries</legend>${DASHBOARD_PAGES.map((name, index) => `<label><input type="checkbox" name="pages.${index}" data-choice="true" value="${esc(name)}"${Array.isArray(snapshot.data.summaries) && snapshot.data.summaries.includes(name) ? " checked" : ""}>${esc(name)}</label>`).join("")}</fieldset>`,
          "Save summaries",
          disabled,
        )
      : ""
  const people = environment.directory
    .map((person) => {
      const access = object(object(snapshot.data.access)[person.id])
      const field = surface === "dashboard" ? "assigned" : "domains"
      const names = Array.isArray(access[field]) ? access[field] : []
      const assignments =
        surface === "dashboard"
          ? `<fieldset><legend>Contributor modules</legend>${["Operations", "security", "projects", "risks", "contracts"].map((name, index) => `<label><input type="checkbox" name="assigned.${index}" data-choice="true" value="${esc(name)}"${names.includes(name) ? " checked" : ""}>${esc(name)}</label>`).join("")}</fieldset>`
          : fields([
              {
                name: "domains",
                label: "Budget owner domains (one per line)",
                type: "textarea",
                value: names.join("\n"),
              },
            ])
      const assignment =
        surface === "procurement"
          ? ""
          : form(
              page,
              "configure-assignment",
              person.id,
              snapshot.versions[`config:access:${person.id}`]?.version ?? 0,
              `<input type="hidden" name="person" value="${esc(person.id)}"><strong>${esc(person.name)}</strong>${assignments}`,
              "Save assignment",
              disabled,
            )
      const lines =
        surface === "dashboard"
          ? form(
              page,
              "configure-budget-lines",
              person.id,
              snapshot.versions[`config:budgetLineIds:${person.id}`]?.version ?? 0,
              `<input type="hidden" name="person" value="${esc(person.id)}"><strong>${esc(person.name)}</strong><fieldset><legend>Editable budget rows</legend>${(
                ["opexOwners", "capexProjects"] as const
              )
                .flatMap((collection) =>
                  rows(snapshot.data[collection])
                    .filter(
                      (row) =>
                        (typeof row.id === "string" && row.id !== "") ||
                        (typeof row.id === "number" && Number.isFinite(row.id)),
                    )
                    .map((row) => ({ collection, row })),
                )
                .map(
                  (item, index) =>
                    `<label><input type="checkbox" name="lines.${index}" data-choice="true" value="${esc(`${item.collection}:${String(item.row.id)}`)}"${Array.isArray(object(snapshot.data.budgetLineIds)[person.id]) && (object(snapshot.data.budgetLineIds)[person.id] as unknown[]).includes(`${item.collection}:${String(item.row.id)}`) ? " checked" : ""}>${item.collection === "opexOwners" ? "OPEX" : "CAPEX"} — ${esc(text(item.row.name) || "Unnamed budget row")}</label>`,
                )
                .join("")}</fieldset>`,
              "Save budget access",
              disabled,
            )
          : ""
      return assignment + lines
    })
    .join("")
  return `<details><summary>Access and configuration</summary>${groups}${summaries}${people}</details>`
}
