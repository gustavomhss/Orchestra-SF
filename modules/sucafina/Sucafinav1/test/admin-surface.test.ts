import { afterEach, expect, test } from "bun:test"
import { writeFile } from "node:fs/promises"
import path from "node:path"
import { createMicrosoftInstallation } from "../local/entry.ts"
import { openLocalStore } from "../runtime/local-store.ts"
import type { Snapshot } from "../runtime/contract.ts"
import { applySfAdminChange, sfAdminPolicy, SF_SUPREME_ADMIN_GROUP_ID } from "../runtime/admin-surface.ts"
import { microsoftPolicy } from "../runtime/microsoft-policy.ts"
import { microsoftFixture, oid, other } from "./microsoft-login/oidc-fixture.ts"
import { privateFixture, listenerOrigin, publicOrigin } from "./microsoft-login/private-fixture.ts"

const persons = {
  Daniel: oid, Andre: other,
  Caio: "66666666-6666-4666-8666-666666666666",
  Pedro: "77777777-7777-4777-8777-777777777777",
  Gabriel: "88888888-8888-4888-8888-888888888888",
  Sofie: "99999999-9999-4999-8999-999999999999",
  Zico: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa",
}
const team = {
  contributors: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb",
  buyers: "cccccccc-cccc-4ccc-8ccc-cccccccccccc",
  approvers: "dddddddd-dddd-4ddd-8ddd-dddddddddddd",
  finance: "eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee",
}
const groupNames = new Map([
  [SF_SUPREME_ADMIN_GROUP_ID, "fla-supreme-admin"],
  [team.contributors, "Flamengo Operations"],
  [team.buyers, "Flamengo Procurement"],
  [team.approvers, "Flamengo Approvals"],
  [team.finance, "Flamengo Finance"],
])
const roles = {
  dashboard: { admin: "group:" + SF_SUPREME_ADMIN_GROUP_ID, contributor: "group:" + team.contributors, viewer: "group:" + team.finance },
  planner: { admin: "group:" + SF_SUPREME_ADMIN_GROUP_ID, finance: "group:" + team.finance },
  procurement: { admin: "group:" + SF_SUPREME_ADMIN_GROUP_ID, requester: "group:" + team.contributors,
    buyer: "group:" + team.buyers, approver: "group:" + team.approvers },
}
const config = microsoftPolicy({ groups: roles, grants: [] })
const directory = {
  users: [
    { id: oid, name: "Daniel", department: "Diretoria", jobTitle: "Owner", managerId: null, groupIds: [SF_SUPREME_ADMIN_GROUP_ID] },
    { id: other, name: "André", department: "Diretoria", jobTitle: "CIO", managerId: oid, groupIds: [SF_SUPREME_ADMIN_GROUP_ID] },
    { id: persons.Caio, name: "Caio", department: "Operações", jobTitle: "Requester", managerId: other, groupIds: [team.contributors] },
    { id: persons.Pedro, name: "Pedro", department: "Procurement", jobTitle: "Buyer", managerId: other, groupIds: [team.buyers] },
    { id: persons.Gabriel, name: "Gabriel", department: "Procurement", jobTitle: "Approver", managerId: other, groupIds: [team.approvers] },
    { id: persons.Sofie, name: "Sofie", department: "Financeiro", jobTitle: "Finance", managerId: other, groupIds: [team.finance] },
    { id: persons.Zico, name: "Zico", department: "Convidados", jobTitle: "", managerId: null, groupIds: [] },
  ],
  groups: [...groupNames].map(([id, name]) => ({ id, name, team: true })),
}
const snap = (): Snapshot => ({ data: {}, versions: {}, sequences: {}, audit: [], notices: [] })
const snaps = () => ({ dashboard: snap(), planner: snap(), procurement: snap() })
const form = (entries: Record<string, string | string[]>) => {
  const f = new FormData()
  for (const [key, value] of Object.entries(entries))
    for (const item of Array.isArray(value) ? value : [value]) f.append(key, item)
  return f
}
const now = "2026-11-16T23:00:00.000Z"
const cleanups: (() => Promise<void>)[] = []
afterEach(async () => { for (const finish of cleanups.splice(0).reverse()) await finish() })

test("Microsoft validator, CAS, audit from→to and anti-self-escalation on group binding", () => {
  const snapshots = snaps()
  const change = (principalRef: string, entries: Record<string, string | string[]>) => applySfAdminChange({
    snapshots, configured: config, directory, principalRef, form: form(entries), at: now,
  })
  const self = change(oid, { action: "group", surface: "planner", role: "finance",
    group: SF_SUPREME_ADMIN_GROUP_ID, version: "0" })
  expect(self).toEqual({ ok: false, status: 403 })
  expect(snapshots.planner.audit).toHaveLength(0)
  expect(change(persons.Caio, { action: "group", surface: "dashboard", role: "contributor",
    group: team.buyers, version: "0" })).toEqual({ ok: false, status: 403 })
  expect(change(oid, { action: "group", surface: "dashboard", role: "superuser",
    group: team.buyers, version: "0" })).toEqual({ ok: false, status: 422 })
  expect(change(oid, { action: "group", surface: "dashboard", role: "contributor",
    group: team.buyers, version: "0" })).toEqual({ ok: true })
  expect(sfAdminPolicy(snapshots, config).groups.dashboard.contributor).toBe("group:" + team.buyers)
  expect(snapshots.dashboard.audit).toEqual([expect.objectContaining({
    who: oid, name: "Daniel", at: now, record: "sf:access-admin:group:dashboard:contributor",
    was: "group:" + team.contributors, became: "group:" + team.buyers,
  })])
  expect(change(oid, { action: "group", surface: "dashboard", role: "contributor",
    group: team.approvers, version: "0" })).toEqual({ ok: false, status: 409 })
  expect(snapshots.dashboard.audit).toHaveLength(1)
})

test("profile grants are validated and atomically audited, cannot self-grant, and orphans can be revoked", () => {
  const snapshots = snaps()
  const change = (id: string, entries: Record<string, string | string[]>) => applySfAdminChange({
    snapshots, configured: config, directory, principalRef: id, form: form(entries), at: now,
  })
  expect(change(oid, { action: "grant", principalRef: oid, namespaces: ["cases"], version: "0" })).toEqual({ ok: false, status: 403 })
  expect(change(oid, { action: "grant", principalRef: persons.Pedro,
    operations: ["unadmitted.root"], version: "0" })).toEqual({ ok: false, status: 422 })
  expect(change(oid, { action: "grant", principalRef: persons.Pedro,
    namespaces: ["preferences"], operations: ["sf_work_list"], humanActions: ["views.read"], version: "0" })).toEqual({ ok: true })
  expect(sfAdminPolicy(snapshots, config).grants).toEqual([{
    principalRef: persons.Pedro, namespaces: ["preferences"], operations: ["sf_work_list"], humanActions: ["views.read"],
  }])
  expect(snapshots.dashboard.audit[0]).toMatchObject({ who: oid, name: "Daniel", was: null,
    became: { principalRef: persons.Pedro, namespaces: ["preferences"], operations: ["sf_work_list"], humanActions: ["views.read"] } })
  expect(change(oid, { action: "grant", principalRef: persons.Pedro,
    namespaces: ["preferences"], version: "0" })).toEqual({ ok: false, status: 409 })
  const orphan = "ffffffff-ffff-4fff-8fff-ffffffffffff"
  const same = sfAdminPolicy(snapshots, config)
  snapshots.dashboard.data.sfAdminGrants = [...same.grants, { principalRef: orphan, namespaces: [], operations: [], humanActions: [] }]
  expect(change(oid, { action: "remove-grant", principalRef: orphan, version: "0" })).toEqual({ ok: true })
  expect(sfAdminPolicy(snapshots, config).grants.some((grant) => grant.principalRef === orphan)).toBe(false)
  expect(snapshots.dashboard.audit.at(-1)).toMatchObject({ who: oid, record: "sf:access-admin:grant:" + orphan,
    became: null })
})

async function fixture() {
  const disk = await privateFixture()
  cleanups.push(disk.close)
  const provider = await microsoftFixture({ claims: { roles: ["admin"] } })
  provider.account.name = "Daniel"
  provider.account.groups.splice(0, provider.account.groups.length, SF_SUPREME_ADMIN_GROUP_ID)
  provider.second.name = "André"
  provider.second.groups.splice(0, provider.second.groups.length, SF_SUPREME_ADMIN_GROUP_ID)
  for (const person of directory.users) {
    if (person.id === oid || person.id === other) continue
    provider.accounts.set(person.id, { id: person.id, name: person.name, groups: [...person.groupIds] })
  }
  provider.hooks.before = async (request) => {
    const url = new URL(request.url)
    if (url.origin !== "https://graph.microsoft.com") return undefined
    if (url.pathname === "/v1.0/users") return Response.json({ value: directory.users.map((person) => ({
      id: person.id, displayName: person.name, department: person.department, jobTitle: person.jobTitle,
    })) })
    if (url.pathname === "/v1.0/groups") return Response.json({ value: directory.groups.map((group) => ({
      id: group.id, displayName: group.name, resourceProvisioningOptions: group.team ? ["Team"] : [],
    })) })
    const members = /^\/v1\.0\/groups\/([a-f0-9-]{36})\/transitiveMembers$/.exec(url.pathname)
    if (members) return Response.json({ value: directory.users
      .filter((person) => person.groupIds.includes(members[1]!)).map((person) => ({ id: person.id, "@odata.type": "#microsoft.graph.user" })) })
    const manager = /^\/v1\.0\/users\/([a-f0-9-]{36})\/manager$/.exec(url.pathname)
    if (manager) {
      const found = directory.users.find((person) => person.id === manager[1])
      return found?.managerId ? Response.json({ id: found.managerId, "@odata.type": "#microsoft.graph.user" }) :
        new Response(null, { status: 404 })
    }
    return undefined
  }
  await writeFile(disk.file, JSON.stringify({ ...disk.config, groups: roles, grants: [] }))
  const app = await createMicrosoftInstallation({ origin: listenerOrigin }, disk.file, disk.environment, {
    fetch: provider.fetch, now: () => new Date(provider.clock.value),
  })
  cleanups.push(async () => app.dispose())
  const store = await openLocalStore(path.join(disk.directory, "business-microsoft"))
  cleanups.push(store.dispose)
  const request = async (route: string, init: RequestInit = {}) => {
    const response = await app.handler(new Request(publicOrigin + route, init))
    if (!response) throw new Error("Missing installation response")
    return response
  }
  async function login(id: string) {
    const begin = await request("/sucafina/auth/login")
    expect(begin.status).toBe(303)
    const location = begin.headers.get("location")!
    const url = new URL(location)
    const code = await provider.issueCode(location, id)
    const loginCookie = begin.headers.getSetCookie().find((entry) => entry.includes("_login="))!.split(";")[0]
    const finish = await request("/sucafina/auth/callback?state=" + url.searchParams.get("state") + "&code=" + code, {
      headers: { cookie: loginCookie },
    })
    expect(finish.status).toBe(303)
    return finish.headers.getSetCookie().find((entry) => entry.includes("_session="))!.split(";")[0]
  }
  const get = (cookie: string, route = "/sucafina/admin/access") => request(route, { headers: { cookie } })
  const post = (cookie: string, parameters: URLSearchParams) => request("/sucafina/admin/access", {
    method: "POST", headers: { cookie, origin: publicOrigin, "content-type": "application/x-www-form-urlencoded" },
    body: parameters,
  })
  return { provider, request, login, get, post, store }
}

test("mounted HTTPS admin read renders Graph departments, manager, team inheritance and direct grants only to supremes", async () => {
  const f = await fixture()
  const daniel = await f.login(oid)
  const andre = await f.login(other)
  const caio = await f.login(persons.Caio)
  const pedro = await f.login(persons.Pedro)
  const zico = await f.login(persons.Zico)
  for (const cookie of [daniel, andre]) {
    const response = await f.get(cookie)
    expect(response.status).toBe(200)
    const html = await response.text()
    for (const label of ["Administração de acessos", "Organização", "Financeiro", "Procurement", "Caio", "Sofie",
      "Manager", "Organograma", "Herda do time", "Concedido ao perfil", "Órfãs", "Flamengo Operations"])
      expect(html.toLowerCase()).toContain(label.toLowerCase())
    expect(html).toContain("data-sf-admin-access=\"supreme\"")
    expect(html).not.toContain("synthetic-access-")
    expect(html).not.toContain("synthetic-refresh-")
  }
  for (const cookie of [zico, caio, pedro]) {
    expect((await f.get(cookie)).status).toBe(403)
    const forbiddenPost = await f.post(cookie, new URLSearchParams({
      action: "grant", principalRef: persons.Pedro, version: "0", namespaces: "preferences",
    }))
    expect(forbiddenPost.status).toBe(403)
    expect((await forbiddenPost.text())).not.toContain("Flamengo")
  }
  expect((await f.get(daniel, "/sucafina/dashboard")).status).toBe(200)
  const dashboard = await f.get(daniel, "/sucafina/dashboard")
  expect(await dashboard.text()).toContain("data-sf-admin-link")
  const noSupreme = await f.get(caio, "/sucafina/dashboard")
  expect(await noSupreme.text()).not.toContain("data-sf-admin-link")
  const none = await f.get(zico, "/sucafina/dashboard")
  expect(await none.text()).not.toContain("data-sf-admin-link")
  expect(f.provider.requests.some((entry) => entry.url.includes("/v1.0/users/") && entry.url.includes("/manager"))).toBe(true)
  expect(f.provider.requests.some((entry) => entry.url.includes("/transitiveMembers"))).toBe(true)
})

test("mounted form applies role/grant CAS to private installation store, rejects self and preserves Graph read-only", async () => {
  const f = await fixture()
  const daniel = await f.login(oid)
  const post = (params: Record<string, string>) => f.post(daniel, new URLSearchParams(params))
  expect((await f.get(daniel)).status).toBe(200)
  const write = await post({ action: "group", surface: "dashboard", role: "contributor",
    group: team.buyers, version: "0" })
  expect(write.status).toBe(303)
  const grant = await post({ action: "grant", principalRef: persons.Pedro,
    version: "0", namespaces: "preferences", operations: "sf_work_list", humanActions: "views.read" })
  expect(grant.status).toBe(303)
  const dashboard = await f.store.transaction("dashboard", async (snapshot) => ({
    commit: false, value: { groups: snapshot.data.roleMap, grants: snapshot.data.sfAdminGrants, audit: snapshot.audit },
  }))
  expect(JSON.stringify(dashboard.groups)).toContain(team.buyers)
  expect(JSON.stringify(dashboard.grants)).toContain(persons.Pedro)
  expect(dashboard.audit.some((row) => row.record === "sf:access-admin:grant:" + persons.Pedro)).toBe(true)
  expect((await post({ action: "group", surface: "planner", role: "finance",
    group: SF_SUPREME_ADMIN_GROUP_ID, version: "0" })).status).toBe(403)
  expect((await post({ action: "grant", principalRef: oid,
    version: "0", namespaces: "cases" })).status).toBe(403)
  expect((await post({ action: "grant", principalRef: persons.Pedro,
    version: "0", operations: "not-a-real-operation" })).status).toBe(409)
  const html = await (await f.get(daniel)).text()
  expect(html).toContain("1 · Operations: 1 · Human actions: 1")
  expect(f.provider.requests.filter((entry) => entry.url.startsWith("https://graph.microsoft.com") &&
    !["GET", "POST"].includes(entry.method))).toHaveLength(0)
  expect(f.provider.requests.some((entry) => /^https:\/\/graph.microsoft.com\/v1.0\/groups\/.test(entry.url) &&
    entry.method !== "GET")).toBe(false)
})
