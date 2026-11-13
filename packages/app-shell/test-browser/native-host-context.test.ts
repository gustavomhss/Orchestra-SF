import { expect, test } from "bun:test"
import { createRoot, createSignal, onCleanup } from "solid-js"
import { ServerConnection } from "../src/context/server"
import { createServerContextCache } from "../src/context/global"

const pinned: ServerConnection.Http = {
  type: "http",
  http: { url: "https://own.example.test", username: "owner", password: "synthetic-own-secret" },
  authToken: true,
  displayName: "Pinned host",
}
const foreign: ServerConnection.Http = {
  type: "http",
  http: { url: "https://foreign.example.test", username: "stranger", password: "synthetic-foreign-secret" },
  displayName: "Foreign host",
}

function mountCache(initial: ServerConnection.Any[], pin?: ServerConnection.Http) {
  return createRoot((dispose) => {
    const [servers, setServers] = createSignal(initial)
    const created: ServerConnection.Any[] = []
    const disposed: ServerConnection.Key[] = []
    const ensure = createServerContextCache(servers, (server) => {
      created.push(structuredClone(server))
      onCleanup(() => disposed.push(ServerConnection.key(server)))
      return { server }
    }, pin)
    return { dispose, setServers, ensure, created, disposed }
  })
}

test("pinned cache eagerly constructs only the canonical host when the server list contains a foreign host", () => {
  const cache = mountCache([pinned, foreign], pinned)
  try {
    expect(cache.created).toHaveLength(1)
    expect(cache.created[0]).toMatchObject({
      type: "http",
      http: { url: pinned.http.url, username: pinned.http.username, password: pinned.http.password },
      authToken: true,
      displayName: "Pinned host",
    })
    expect(ServerConnection.key(cache.created[0]!)).toBe(ServerConnection.key(pinned))
  } finally {
    cache.dispose()
  }
})

test("explicit ensure rejects a foreign pinned host before invoking the SDK factory", () => {
  const cache = mountCache([pinned], pinned)
  try {
    expect(() => cache.ensure(foreign)).toThrow(/PinnedServerMismatch|pinned server/i)
    expect(cache.created).toHaveLength(1)
    const message = (() => {
      try {
        cache.ensure(foreign)
      } catch (error) {
        return error instanceof Error ? error.message : String(error)
      }
      return ""
    })()
    expect(message).not.toContain(foreign.http.url)
    expect(message).not.toContain(foreign.http.password)
    expect(cache.created).toHaveLength(1)
  } finally {
    cache.dispose()
  }
})

test("same-origin edited credentials canonicalize to the pin and keep stable context identity", () => {
  const cache = mountCache([], pinned)
  const edited: ServerConnection.Http = {
    ...pinned,
    http: { ...pinned.http, username: "edited-user", password: "synthetic-edited-secret" },
    authToken: false,
    displayName: "Edited host",
  }
  try {
    const first = cache.ensure(edited)
    expect(cache.created).toHaveLength(1)
    expect(cache.created[0]).toMatchObject({
      type: "http",
      http: { url: pinned.http.url, username: pinned.http.username, password: pinned.http.password },
      authToken: true,
      displayName: "Pinned host",
    })
    expect(cache.ensure(edited)).toBe(first)
    expect(cache.created).toHaveLength(1)
    expect(cache.disposed).toEqual([])
  } finally {
    cache.dispose()
  }
})

test("foreign list changes neither construct nor dispose the pinned context; owner cleanup disposes it", () => {
  const cache = mountCache([pinned], pinned)
  const context = cache.ensure(pinned)
  expect(cache.created).toHaveLength(1)
  cache.setServers([foreign])
  expect(cache.created).toHaveLength(1)
  expect(cache.disposed).toEqual([])
  expect(cache.ensure(pinned)).toBe(context)
  expect(cache.disposed).toEqual([])
  cache.dispose()
  expect(cache.disposed).toEqual([ServerConnection.key(pinned)])
})

test("unpinned cache retains transient inputs and replaces edited same-key credentials", () => {
  const cache = mountCache([])
  const edited: ServerConnection.Http = {
    ...pinned,
    http: { ...pinned.http, password: "synthetic-next-secret" },
  }
  try {
    expect(cache.created).toHaveLength(0)
    const transient = cache.ensure(pinned)
    expect(cache.created).toHaveLength(1)
    cache.setServers([edited])
    const current = cache.ensure(pinned)
    expect(current).not.toBe(transient)
    expect(cache.created).toHaveLength(2)
    expect(cache.created[1]).toMatchObject({ http: { url: edited.http.url, password: edited.http.password } })
    expect(cache.disposed).toEqual([ServerConnection.key(pinned)])
  } finally {
    cache.dispose()
  }
})

test("unpinned cache disposes list-owned contexts on removal and can recreate a stale transient input", () => {
  const cache = mountCache([pinned])
  try {
    expect(cache.created).toHaveLength(1)
    cache.setServers([])
    expect(cache.disposed).toEqual([ServerConnection.key(pinned)])
    const transient = cache.ensure(pinned)
    expect(cache.created).toHaveLength(2)
    expect(transient.server).toMatchObject({ http: { url: pinned.http.url, password: pinned.http.password } })
    expect(cache.disposed).toEqual([ServerConnection.key(pinned)])
  } finally {
    cache.dispose()
  }
})
