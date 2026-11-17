import { roleMap } from "./admin.ts"
import { changed } from "./contract.ts"
import type { Snapshot } from "./contract.ts"
import { microsoftNamespaceOptions, microsoftPolicy, microsoftUuid } from "./microsoft-policy.ts"
import type { EntraGraphDirectory } from "./local-contract.ts"
import { emptyMap } from "../src/identity.ts"
import type { Surface } from "../src/identity.ts"
import { esc } from "../src/screen-shell.ts"
import { sfHumanActions } from "../product/integration/human-authority.ts"
import freeze from "../product/contracts/freeze-v1.json" with { type: "json" }

export const SF_SUPREME_ADMIN_GROUP_ID = "a739232b-d5cb-4f41-873b-4c9d2340831e"
export const sfSupremeRoleMap = Object.freeze([{
  surface: "dashboard" as const, role: "admin", entra: "group:" + SF_SUPREME_ADMIN_GROUP_ID,
  version: 0, by: "trusted-installation",
}])

type Snapshots = Record<Surface, Snapshot>
type Policy = ReturnType<typeof microsoftPolicy>
export type SfAdminConfiguration = Readonly<{ groups: Policy["groups"]; grants: Policy["grants"] }>
type Result = { ok: true } | { ok: false; status: 403 | 409 | 422 | 503 }

/** The store overrides only the trusted installation policy; HTTP/claims never become configuration. */
export function sfAdminPolicy(snapshots: Snapshots, configured: SfAdminConfiguration): Policy {
  const groups: Record<Surface, Record<string, string>> = { dashboard: {}, planner: {}, procurement: {} }
  for (const surface of ["dashboard", "planner", "procurement"] as const) {
    if (snapshots[surface].data.roleMap === undefined) {
      groups[surface] = { ...configured.groups[surface] }
      continue
    }
    for (const row of roleMap(snapshots[surface], surface)) if (row.entra !== null) groups[surface][row.role] = row.entra
  }
  const grants = snapshots.dashboard.data.sfAdminGrants === undefined
    ? configured.grants : snapshots.dashboard.data.sfAdminGrants
  return microsoftPolicy({ groups, grants })
}

/**
 * Validates and commits a single CAS command inside a caller-owned SERIALIZABLE
 * transactionAll. The caller MUST authorize the actual live Entra supreme group
 * before invoking. No Entra write capability exists. Graph is used as evidence
 * for target identity, group presence and no-self-escalation.
 */
export function applySfAdminChange(input: {
  snapshots: Snapshots
  configured: SfAdminConfiguration
  directory: EntraGraphDirectory
  principalRef: string
  form: FormData
  at: string
}): Result {
  const { snapshots, configured, directory, principalRef, form, at } = input
  const actorId = principalRef.toLowerCase()
  const actor = directory.users.find((person) => person.id === actorId)
  if (!actor) return { ok: false, status: 503 }
  if (!actor.groupIds.includes(SF_SUPREME_ADMIN_GROUP_ID)) return { ok: false, status: 403 }
  if (form.getAll("action").length !== 1 || form.getAll("version").length !== 1 ||
    typeof form.get("action") !== "string" || typeof form.get("version") !== "string") return { ok: false, status: 422 }
  const rawVersion = form.get("version")
  if (!/^(0|[1-9][0-9]*)$/.test(rawVersion as string)) return { ok: false, status: 422 }
  const expected = Number(rawVersion)
  if (!Number.isSafeInteger(expected)) return { ok: false, status: 422 }
  const action = form.get("action")
  let policy: Policy
  try { policy = sfAdminPolicy(snapshots, configured) }
  catch { return { ok: false, status: 503 } }
  const authorisedActor = { id: actorId, roles: ["admin"], canWrite: true }
  const audit = (snapshot: Snapshot, key: string, oldValue: unknown, newValue: unknown) => {
    changed(snapshot, key, authorisedActor, at, oldValue, newValue)
    snapshot.audit[snapshot.audit.length - 1]!.name = actor.name
  }
  if (action === "group") {
    if (form.getAll("surface").length !== 1 || form.getAll("role").length !== 1 ||
      form.getAll("group").length !== 1) return { ok: false, status: 422 }
    const surface = form.get("surface")
    const role = form.get("role")
    const target = form.get("group")
    if (typeof surface !== "string" || typeof role !== "string" || typeof target !== "string" ||
      !emptyMap().some((row) => row.surface === surface && row.role === role) ||
      (target !== "" && (!microsoftUuid.test(target) || !directory.groups.some((group) => group.id === target.toLowerCase()))))
      return { ok: false, status: 422 }
    const typedSurface = surface as Surface
    const oldValue = policy.groups[typedSurface][role] ?? null
    const newValue = target ? "group:" + target.toLowerCase() : null
    if (newValue === oldValue) return { ok: false, status: 422 }
    const key = "sf:access-admin:group:" + surface + ":" + role
    const snapshot = snapshots[typedSurface]
    if ((snapshot.versions[key]?.version ?? 0) !== expected) return { ok: false, status: 409 }
    const nextGroups: Record<Surface, Record<string, string>> = {
      dashboard: { ...policy.groups.dashboard }, planner: { ...policy.groups.planner },
      procurement: { ...policy.groups.procurement },
    }
    if (newValue === null) delete nextGroups[typedSurface][role]
    else nextGroups[typedSurface][role] = newValue
    // If this would change ANY of the supreme actor's effective roles, deny it:
    // no self-escalation and no accidental self-lockout via a role binding.
    const actorRoles = (groups: typeof nextGroups) => new Set(
      emptyMap().filter((row) => {
        const groupRef = groups[row.surface][row.role]
        return groupRef?.startsWith("group:") && actor.groupIds.includes(groupRef.slice(6))
      }).map((row) => row.surface + ":" + row.role))
    const before = actorRoles(policy.groups)
    const after = actorRoles(nextGroups)
    if (before.size !== after.size || [...before].some((value) => !after.has(value)))
      return { ok: false, status: 403 }
    try { microsoftPolicy({ groups: nextGroups, grants: policy.grants }) }
    catch { return { ok: false, status: 422 } }
    const currentRows = snapshot.data.roleMap === undefined
      ? emptyMap().filter((row) => row.surface === typedSurface).map((row) => ({
          ...row, entra: policy.groups[typedSurface][row.role] ?? null,
        }))
      : roleMap(snapshot, typedSurface)
    snapshot.data.roleMap = currentRows.map((row) => row.role === role
      ? { ...row, entra: newValue, version: row.version + 1, by: actorId } : row)
    audit(snapshot, key, oldValue, newValue)
    return { ok: true }
  }
  if (action === "grant" || action === "remove-grant") {
    if (form.getAll("principalRef").length !== 1) return { ok: false, status: 422 }
    const target = form.get("principalRef")
    if (typeof target !== "string" || !microsoftUuid.test(target)) return { ok: false, status: 422 }
    const targetId = target.toLowerCase()
    // Supreme status is not an editable business grant, and nobody may modify their own grants.
    if (targetId === actorId) return { ok: false, status: 403 }
    const current = policy.grants.find((entry) => entry.principalRef === targetId) ?? null
    const targetPerson = directory.users.find((person) => person.id === targetId)
    if (action === "grant" && !targetPerson) return { ok: false, status: 422 }
    if (action === "remove-grant" && !current) return { ok: false, status: 422 }
    const key = "sf:access-admin:grant:" + targetId
    if ((snapshots.dashboard.versions[key]?.version ?? 0) !== expected) return { ok: false, status: 409 }
    const read = (name: string) => form.getAll(name).map((value) => {
      if (typeof value !== "string") throw new Error("Non-text scope")
      return value
    })
    let next: Policy
    try {
      const namespaces = action === "grant" ? read("namespaces") : []
      const operations = action === "grant" ? read("operations") : []
      const humanActions = action === "grant" ? read("humanActions") : []
      const remaining = policy.grants.filter((grant) => grant.principalRef !== targetId)
      const replacement = namespaces.length || operations.length || humanActions.length
        ? [{ principalRef: targetId, namespaces, operations, humanActions }] : []
      next = microsoftPolicy({ groups: policy.groups, grants: [...remaining, ...replacement] })
    } catch { return { ok: false, status: 422 } }
    const became = next.grants.find((entry) => entry.principalRef === targetId) ?? null
    if (JSON.stringify(current) === JSON.stringify(became)) return { ok: false, status: 422 }
    snapshots.dashboard.data.sfAdminGrants = next.grants.map((grant) => ({
      principalRef: grant.principalRef, namespaces: [...grant.namespaces],
      operations: [...grant.operations], humanActions: [...grant.humanActions ?? []],
    }))
    audit(snapshots.dashboard, key, current, became)
    return { ok: true }
  }
  return { ok: false, status: 422 }
}

const htmlEscape = (value: string) => esc(value)
const input = (name: string, value: string) =>
  '<input type="hidden" name="' + htmlEscape(name) + '" value="' + htmlEscape(value) + '">'
const checklist = (name: string, choices: readonly string[], current: readonly string[]) =>
  '<div class="sf-checkgrid">' + choices.map((value) =>
    '<label><input type="checkbox" name="' + name + '" value="' + htmlEscape(value) + '"' +
    (current.includes(value) ? ' checked' : '') + '> ' + htmlEscape(value) + '</label>').join("") + '</div>'

/** Renders only from the complete authorized Graph snapshot and the validated installation policy. */
export function renderSfAdminAccess(input: {
  mount: string
  directory: EntraGraphDirectory
  snapshots: Snapshots
  configured: SfAdminConfiguration
  actorId: string
}): string {
  const { mount, directory, snapshots, configured } = input
  const policy = sfAdminPolicy(snapshots, configured)
  const groupsById = new Map(directory.groups.map((group) => [group.id, group]))
  const usersById = new Map(directory.users.map((person) => [person.id, person]))
  const groupNames = (ids: readonly string[]) => ids.length
    ? ids.map((id) => {
        const group = groupsById.get(id)
        return '<span class="sf-chip">' + htmlEscape(group ? group.name + (group.team ? " · Teams" : " · grupo") : id + " · não localizado") + '</span>'
      }).join(" ")
    : '<span class="sf-muted">Sem grupo</span>'
  const inherited = (ids: readonly string[]) => emptyMap().flatMap((row) => {
    const binding = policy.groups[row.surface][row.role]
    return binding && ids.includes(binding.slice(6))
      ? [row.surface + " / " + row.role] : []
  })
  const personRows = (users: typeof directory.users) => '<div class="sf-table"><table><thead><tr>' +
    '<th>Pessoa (Object ID Entra)</th><th>Cargo</th><th>Times e grupos (Graph)</th>' +
    '<th>Herda do time</th><th>Concedido ao perfil (grants)</th></tr></thead><tbody>' +
    users.map((person) => {
      const grant = policy.grants.find((entry) => entry.principalRef === person.id)
      const granted = grant
        ? 'Namespaces: ' + grant.namespaces.length + ' · Operations: ' + grant.operations.length + ' · Human actions: ' + (grant.humanActions?.length ?? 0)
        : 'Nenhum'
      const key = "sf:access-admin:grant:" + person.id
      const version = snapshots.dashboard.versions[key]?.version ?? 0
      const options = checklist("namespaces", microsoftNamespaceOptions, grant?.namespaces ?? []) +
        '<h4>Operations (catálogo congelado)</h4>' + checklist("operations", freeze.operations.map((operation) => operation.operation), grant?.operations ?? []) +
        '<h4>Human actions</h4>' + checklist("humanActions", sfHumanActions, grant?.humanActions ?? [])
      const self = person.id === input.actorId
      const editor = self ? '<p class="sf-muted">Autoedição de grants bloqueada.</p>' :
        '<details><summary>Editar permissões diretas</summary><form method="post" action="' + mount + '/admin/access">' +
        inputField("grant", person.id, version) + options + '<button type="submit">Salvar grants do perfil</button></form>' +
        (grant ? '<form method="post" action="' + mount + '/admin/access">' + inputField("remove-grant", person.id, version) +
          '<button class="sf-danger" type="submit">Revogar grants do perfil</button></form>' : '') +
        '</details>'
      return '<tr><td><strong>' + htmlEscape(person.name) + '</strong><small>' + htmlEscape(person.id) + '</small>' + editor + '</td>' +
        '<td>' + htmlEscape(person.jobTitle || "Não informado") + '</td><td>' + groupNames(person.groupIds) + '</td>' +
        '<td>' + (inherited(person.groupIds).map((role) => '<span class="sf-chip">' + htmlEscape(role) + '</span>').join(" ") || '<span class="sf-muted">Nenhum</span>') +
        '</td><td>' + htmlEscape(granted) + '</td></tr>'
    }).join("") + '</tbody></table></div>'
  const grouped = new Map<string, typeof directory.users[number][]>()
  for (const person of directory.users) {
    const key = person.department || "Departamento não informado"
    const list = grouped.get(key) ?? []
    list.push(person)
    grouped.set(key, list)
  }
  const departments = [...grouped.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([name, people]) =>
    '<section class="sf-card" data-department="' + htmlEscape(name) + '"><h3>' + htmlEscape(name) + ' <small>' + people.length + ' pessoas</small></h3>' +
    personRows(people.toSorted((a, b) => a.name.localeCompare(b.name))) + '</section>').join("")
  const seen = new Set<string>()
  const children = (managerId: string) => directory.users.filter((person) => person.managerId === managerId)
    .toSorted((a, b) => a.name.localeCompare(b.name))
  const tree = (person: typeof directory.users[number], path: Set<string>): string => {
    if (path.has(person.id) || seen.has(person.id)) return ""
    seen.add(person.id)
    const next = new Set([...path, person.id])
    const subordinates = children(person.id).map((child) => tree(child, next)).filter(Boolean)
    return '<li><strong>' + htmlEscape(person.name) + '</strong> — ' + htmlEscape(person.jobTitle || "Cargo não informado") +
      ' <small>(' + htmlEscape(person.department || "Sem departamento") + ')</small>' +
      (subordinates.length ? '<ul>' + subordinates.join("") + '</ul>' : '') + '</li>'
  }
  const roots = directory.users.filter((person) => !person.managerId || !usersById.has(person.managerId) || person.id === person.managerId)
    .toSorted((a, b) => a.name.localeCompare(b.name))
  const chart = [...roots, ...directory.users].map((person) => tree(person, new Set())).filter(Boolean).join("")
  const groupEntries = emptyMap().map((row) => {
    const assigned = policy.groups[row.surface][row.role] ?? ""
    const selected = assigned ? assigned.slice(6) : ""
    const key = "sf:access-admin:group:" + row.surface + ":" + row.role
    const version = snapshots[row.surface].versions[key]?.version ?? 0
    const unknown = selected && !groupsById.has(selected)
    const available = directory.groups.map((group) => '<option value="' + htmlEscape(group.id) + '"' +
      (selected === group.id ? ' selected' : '') + '>' +
      htmlEscape(group.name + (group.team ? " (Teams)" : " (grupo)") + " — " + group.id) + '</option>').join("")
    return '<tr><td>' + htmlEscape(row.surface) + '</td><td>' + htmlEscape(row.role) + '</td><td>' +
      '<form method="post" action="' + mount + '/admin/access">' + input("action", "group") + input("surface", row.surface) +
      input("role", row.role) + input("version", String(version)) + '<label class="sr-only" for="sf-group-' +
      htmlEscape(row.surface + "-" + row.role.replaceAll(" ", "-")) + '">Grupo atribuído a ' + htmlEscape(row.role) + '</label>' +
      '<select id="sf-group-' + htmlEscape(row.surface + "-" + row.role.replaceAll(" ", "-")) + '" name="group">' +
      '<option value=""' + (!selected ? ' selected' : '') + '>Sem grupo atribuído</option>' +
      (unknown ? '<option value="' + htmlEscape(selected) + '" selected>ÓRFÃO: ' + htmlEscape(selected) + '</option>' : '') +
      available + '</select><button type="submit">Aplicar</button></form></td></tr>'
  }).join("")
  const orphanGrants = policy.grants.filter((grant) => !usersById.has(grant.principalRef))
  const orphanGroups = Object.entries(policy.groups).flatMap(([surface, roles]) =>
    Object.entries(roles).filter(([, ref]) => !groupsById.has(ref.slice(6))).map(([role, ref]) =>
      '<li>' + htmlEscape(surface + " / " + role + " -> " + ref) + '</li>')).join("")
  const orphans = '<section class="sf-card" data-orphans><h2>Auditoria: permissões órfãs</h2>' +
    '<p>Grants cujo principalRef (Object ID) já não aparece no diretório completo do Graph. Nenhuma limpeza é automática.</p>' +
    (orphanGrants.length ? '<ul>' + orphanGrants.map((grant) => {
      const version = snapshots.dashboard.versions["sf:access-admin:grant:" + grant.principalRef]?.version ?? 0
      return '<li><code>' + htmlEscape(grant.principalRef) + '</code> — ' +
        grant.namespaces.length + ' namespaces, ' + grant.operations.length + ' operações, ' +
        (grant.humanActions?.length ?? 0) + ' ações humanas' +
        '<form method="post" action="' + mount + '/admin/access">' + inputField("remove-grant", grant.principalRef, version) +
        '<button class="sf-danger" type="submit">Revogar grant órfão</button></form></li>'
    }).join("") + '</ul>' : '<p data-no-orphans>Nenhum grant órfão identificado.</p>') +
    '<h3>Vínculos com grupos ausentes</h3>' + (orphanGroups ? '<ul>' + orphanGroups + '</ul>' : '<p>Nenhum.</p>') + '</section>'
  return '<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">' +
    '<title>Administração de acessos · Sucafina</title>' +
    '<style>body{margin:0;background:#f4f7f9;color:#142534;font:14px/1.5 system-ui,sans-serif}' +
    'header{background:#101e38;color:#fff;padding:22px 4vw}header a{color:#c7e4ff;margin-right:24px}' +
    'main{max-width:1600px;margin:auto;padding:24px 4vw}.sf-card{background:#fff;border:1px solid #dbe4eb;border-radius:14px;padding:20px;margin:22px 0}' +
    'h1,h2,h3{line-height:1.2}.sf-table{overflow:auto}table{border-collapse:collapse;width:100%;min-width:940px}td,th{text-align:left;vertical-align:top;border-bottom:1px solid #e3eaf0;padding:12px}th{background:#f6fafc}' +
    'small{display:block;color:#687585;font-size:11px;overflow-wrap:anywhere}.sf-chip{display:inline-block;margin:2px;padding:2px 7px;border-radius:12px;background:#e6f0fa;color:#153559}' +
    '.sf-muted{color:#788899}.sf-danger{color:#a21d1d}.sf-checkgrid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:5px;max-height:230px;overflow:auto;border:1px solid #dce4ed;padding:12px}' +
    'details{margin-top:10px}form{margin:8px 0}button,select{padding:7px;border:1px solid #9ab0c4;border-radius:6px}button{cursor:pointer;background:#eef6ff}select{max-width:430px;width:100%}' +
    'form button{margin-left:7px}.sr-only{position:absolute;left:-10000px}code{overflow-wrap:anywhere}ul{padding-left:24px}</style></head><body>' +
    '<header><a href="' + mount + '/dashboard">← Workbench</a><span>Entra / Teams • configuração de acesso</span><h1>Administração de acessos</h1>' +
    '<p>Visível apenas a fla-supreme-admin. O Teams/Entra é somente leitura; apenas vínculos e grants são persistidos no installation store.</p></header>' +
    '<main data-sf-admin-access="supreme"><section class="sf-card"><h2>Organização → departamentos → pessoas</h2>' +
    '<p>Fonte: Microsoft Graph, sem cadastro manual. Object ID do Entra é a chave estável de cada perfil. ' +
    directory.users.length + ' pessoas; ' + directory.groups.length + ' grupos.</p></section>' + departments +
    '<section class="sf-card"><h2>Organograma (manager do Graph)</h2><ul>' + chart + '</ul></section>' +
    '<section class="sf-card"><h2>Herança por time → papel por tela</h2><p>Somente os 15 papéis de ROWS podem ser vinculados. Uma pessoa herda cada papel pela pertença transitive ao grupo Entra selecionado.</p>' +
    '<div class="sf-table"><table><thead><tr><th>Tela</th><th>Papel autorizado</th><th>Grupo Entra / Teams</th></tr></thead><tbody>' +
    groupEntries + '</tbody></table></div></section>' + orphans + '</main></body></html>'
}

function inputField(action: string, id: string, version: number) {
  return input("action", action) + input("principalRef", id) + input("version", String(version))
}

/** Bounded, browser-native form submission; CSRF + supreme membership are checked by the mounted handler. */
export async function readSfAdminForm(request: Request): Promise<FormData | null> {
  if (!request.headers.get("content-type")?.toLowerCase().startsWith("application/x-www-form-urlencoded")) return null
  const stream = request.body?.getReader()
  if (!stream) return null
  const chunks: Uint8Array[] = []
  let total = 0
  try {
    while (true) {
      const part = await stream.read()
      if (part.done) break
      total += part.value.length
      if (total > 65536) { await stream.cancel(); return null }
      chunks.push(part.value)
    }
    const merged = new Uint8Array(total)
    let offset = 0
    for (const chunk of chunks) { merged.set(chunk, offset); offset += chunk.length }
    const params = new URLSearchParams(new TextDecoder("utf-8", { fatal: true }).decode(merged))
    const form = new FormData()
    for (const [name, value] of params) form.append(name, value)
    return form
  } catch { return null }
  finally { stream.releaseLock() }
}
