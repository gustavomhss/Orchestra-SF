import { createNativeGateway } from "../../../src/native.ts"
import { emptyMap, plugGroup, resolve } from "../../src/identity.ts"
import type { Surface } from "../../src/identity.ts"
import type { Command, Snapshot } from "../../runtime/contract.ts"
import { object } from "../../runtime/contract.ts"
import { empty, testPersistence } from "./persistence.ts"

export type FlowPerson = {
  token: string
  id: string
  name: string
  roles: readonly { surface: Surface; role: string }[]
  canWrite?: false
  access?: Partial<Record<Surface, { assigned?: string[]; domains?: string[] }>>
}

/** In-process native HTTP and real role resolution; not SSO, cookies or durable-storage proof. */
export function nativeWriteFlow(input: {
  people: readonly FlowPerson[]
  initial?: Partial<Record<Surface, Snapshot>>
  at?: string
  bankKey?: Uint8Array
}) {
  const origin = "https://native-flow.example"
  const mount = "/api/sucafina"
  const group = (surface: Surface, role: string) => `fixture:${surface}:${role}`
  const roles = emptyMap().reduce(
    (map, row) => plugGroup(map, row.surface, row.role, group(row.surface, row.role)),
    emptyMap(),
  )
  const storage = testPersistence(input.initial)
  const people = new Map(input.people.map((person) => [person.token, person]))
  const generated = { value: 0 }
  Array.of<Surface>("dashboard", "planner", "procurement").forEach((surface) => {
    storage.state[surface].data.roleMap = structuredClone(roles)
    storage.state[surface].data.access = {
      ...object(storage.state[surface].data.access),
      ...Object.fromEntries(input.people.flatMap((person) =>
        person.access?.[surface] ? [[person.id, structuredClone(person.access[surface])]] : [],
      )),
    }
  })
  const handler = createNativeGateway(mount, {
    persistence: storage.persistence,
    authenticate: async (request, context) => {
      if (!context) return null
      const header = request.headers.get("authorization")
      const person = header?.startsWith("Bearer ") ? people.get(header.slice(7)) : undefined
      if (!person) return null
      const memberships = new Set(person.roles.map((row) => group(row.surface, row.role)))
      const actor = resolve(person.id, context.roleMap.map((row) => ({ ...row })), (id) => memberships.has(id))
      return person.canWrite === false ? { ...actor, canWrite: false } : actor
    },
    environment: async () => ({
      at: input.at ?? "2026-03-15T12:00:00Z",
      id: () => `fixture-generated-${++generated.value}`,
      directory: input.people.map((person) => ({ id: person.id, name: person.name })),
      bankKey: input.bankKey ?? new Uint8Array(32).fill(7),
    }),
    maxJsonBytes: 2 * 1024 * 1024,
  })
  return {
    storage,
    read(surface: Surface, page: string, token: string, query: Record<string, string> = {}) {
      return handler(new Request(`${origin}${mount}/${surface}/state?${new URLSearchParams({ ...query, page })}`, {
        headers: { authorization: `Bearer ${token}` },
      }))
    },
    command(surface: Surface, command: Command, token: string) {
      return handler(new Request(`${origin}${mount}/${surface}/commands`, {
        method: "POST",
        headers: { authorization: `Bearer ${token}`, origin, "content-type": "application/json" },
        body: JSON.stringify(command),
      }))
    },
  }
}
