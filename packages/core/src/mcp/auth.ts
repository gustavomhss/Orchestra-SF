import { LayerNode } from "../effect/layer-node"
import path from "path"
import { serviceUse } from "../effect/service-use"
import { Global } from "../global"
import { Effect, Layer, Context, Option, Schema, SynchronizedRef } from "effect"
import { FSUtil } from "../fs-util"
import { EffectFlock } from "../util/effect-flock"
import { CredentialCipher } from "../credential/cipher"
import { CredentialVault } from "../credential/vault"
import { SessionOwner } from "../session/owner"
import { ConnectionAccess } from "@orchestra/schema/connection-access"

export const Tokens = Schema.Struct({
  accessToken: Schema.mutableKey(Schema.String),
  refreshToken: Schema.mutableKey(Schema.optional(Schema.String)),
  expiresAt: Schema.mutableKey(Schema.optional(Schema.Number)),
  scope: Schema.mutableKey(Schema.optional(Schema.String)),
})
export type Tokens = Schema.Schema.Type<typeof Tokens>

export const ClientInfo = Schema.Struct({
  clientId: Schema.mutableKey(Schema.String),
  clientSecret: Schema.mutableKey(Schema.optional(Schema.String)),
  clientIdIssuedAt: Schema.mutableKey(Schema.optional(Schema.Number)),
  clientSecretExpiresAt: Schema.mutableKey(Schema.optional(Schema.Number)),
})
export type ClientInfo = Schema.Schema.Type<typeof ClientInfo>

export const Entry = Schema.Struct({
  tokens: Schema.mutableKey(Schema.optional(Tokens)),
  clientInfo: Schema.mutableKey(Schema.optional(ClientInfo)),
  codeVerifier: Schema.mutableKey(Schema.optional(Schema.String)),
  oauthState: Schema.mutableKey(Schema.optional(Schema.String)),
  serverUrl: Schema.mutableKey(Schema.optional(Schema.String)),
})
export type Entry = Schema.Schema.Type<typeof Entry>

const decodeAuthData = Schema.decodeUnknownOption(Schema.Record(Schema.String, Entry))
const decodeAuthJson = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Record(Schema.String, Entry)))
type AuthData = Record<string, Entry>

/** The auth file is sealed under a key this process could not load. */
class LockedError extends Schema.TaggedErrorClass<LockedError>()("McpAuthLockedError", {}) {}

const filepath = path.join(Global.Path.data, "mcp-auth.json")
const lockKey = `mcp-auth:${filepath}`

export interface Interface {
  readonly all: () => Effect.Effect<Record<string, Entry>>
  readonly get: (mcpName: string) => Effect.Effect<Entry | undefined>
  readonly getForUrl: (mcpName: string, serverUrl: string) => Effect.Effect<Entry | undefined>
  readonly set: (mcpName: string, entry: Entry, serverUrl?: string) => Effect.Effect<void>
  readonly remove: (mcpName: string) => Effect.Effect<void>
  readonly updateTokens: (mcpName: string, tokens: Tokens, serverUrl?: string) => Effect.Effect<void>
  readonly updateClientInfo: (mcpName: string, clientInfo: ClientInfo, serverUrl?: string) => Effect.Effect<void>
  readonly updateCodeVerifier: (mcpName: string, codeVerifier: string) => Effect.Effect<void>
  readonly clearCodeVerifier: (mcpName: string) => Effect.Effect<void>
  readonly updateOAuthState: (mcpName: string, oauthState: string) => Effect.Effect<void>
  readonly getOAuthState: (mcpName: string) => Effect.Effect<string | undefined>
  readonly clearOAuthState: (mcpName: string) => Effect.Effect<void>
}

export class Service extends Context.Service<Service, Interface>()("@orchestra/McpAuth") {}

export const use = serviceUse(Service)

const legacyLayer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const fs = yield* FSUtil.Service
    const flock = yield* EffectFlock.Service
    const cipher = yield* CredentialCipher.Service

    const write = (data: AuthData) => fs.writeJson(filepath, cipher.seal(JSON.stringify(data)), 0o600)

    // The file holds one sealed JSON string; a plain object is a file written before encryption, which is read and
    // sealed in place. A file that cannot be parsed or decodes to the wrong shape is moved aside, never overwritten,
    // so a later write cannot wipe every MCP login. A sealed file no loaded key opens (the keychain prompt was declined
    // or timed out, so this process fell back to the key file) is left in place and the read fails, so no write
    // replaces it. Any other read failure stops here instead of reading as empty.
    const read = Effect.fn("McpAuth.read")(function* () {
      const file = yield* fs.readJson(filepath).pipe(
        Effect.map((json) => {
          if (typeof json !== "string") return { legacy: true, locked: false, data: decodeAuthData(json) }
          const plain = CredentialCipher.isSealed(json) ? cipher.open(json) : undefined
          return {
            legacy: false,
            locked: CredentialCipher.isSealed(json) && plain === undefined,
            data: Option.flatMap(Option.fromUndefinedOr(plain), decodeAuthJson),
          }
        }),
        Effect.catchReason("PlatformError", "NotFound", () =>
          Effect.succeed({ legacy: false, locked: false, data: Option.some<AuthData>({}) }),
        ),
        Effect.catchTag("FileSystemError", () =>
          Effect.succeed({ legacy: false, locked: false, data: Option.none<AuthData>() }),
        ),
      )
      if (file.locked) {
        yield* Effect.logError(
          "mcp-auth.json is encrypted with a key this process could not load; it is left untouched. Restart Orchestra and allow the keychain prompt",
          { path: filepath },
        )
        return yield* new LockedError()
      }
      if (Option.isNone(file.data)) {
        const aside = `${filepath}.corrupt-${Date.now()}`
        yield* fs.rename(filepath, aside)
        yield* Effect.logError("mcp-auth.json could not be read and was moved aside; MCP servers need a new login", {
          path: aside,
        })
        return {} as AuthData
      }
      const data: AuthData = { ...file.data.value }
      if (file.legacy) yield* write(data)
      return data
    })

    const all = Effect.fn("McpAuth.all")(function* () {
      // A locked file reads as no logins; writes still fail, so the file is never replaced.
      return yield* read().pipe(
        Effect.catchTag("McpAuthLockedError", () => Effect.succeed({} as AuthData)),
        flock.withLock(lockKey),
        Effect.orDie,
      )
    })

    const mutate = Effect.fn("McpAuth.mutate")(function* (update: (data: AuthData) => AuthData | undefined) {
      yield* Effect.gen(function* () {
        const next = update(yield* read())
        if (!next) return
        yield* write(next).pipe(Effect.orDie)
      }).pipe(flock.withLock(lockKey), Effect.orDie)
    })

    const get = Effect.fn("McpAuth.get")(function* (mcpName: string) {
      const data = yield* all()
      return data[mcpName]
    })

    const getForUrl = Effect.fn("McpAuth.getForUrl")(function* (mcpName: string, serverUrl: string) {
      const entry = yield* get(mcpName)
      if (!entry) return undefined
      if (!entry.serverUrl) return undefined
      if (entry.serverUrl !== serverUrl) return undefined
      return entry
    })

    const set = Effect.fn("McpAuth.set")(function* (mcpName: string, entry: Entry, serverUrl?: string) {
      yield* mutate((data) => ({
        ...data,
        [mcpName]: serverUrl ? { ...entry, serverUrl } : entry,
      }))
    })

    const remove = Effect.fn("McpAuth.remove")(function* (mcpName: string) {
      yield* mutate((data) => {
        const next = { ...data }
        delete next[mcpName]
        return next
      })
    })

    const updateField = <K extends keyof Entry>(field: K, spanName: string) =>
      Effect.fn(`McpAuth.${spanName}`)(function* (mcpName: string, value: NonNullable<Entry[K]>, serverUrl?: string) {
        yield* mutate((data) => {
          const entry = data[mcpName] ?? {}
          entry[field] = value
          if (serverUrl) entry.serverUrl = serverUrl
          return { ...data, [mcpName]: entry }
        })
      })

    const clearField = (field: keyof Entry, spanName: string) =>
      Effect.fn(`McpAuth.${spanName}`)(function* (mcpName: string) {
        yield* mutate((data) => {
          const entry = data[mcpName]
          if (!entry) return undefined
          delete entry[field]
          return { ...data, [mcpName]: entry }
        })
      })

    const updateTokens = updateField("tokens", "updateTokens")
    const updateClientInfo = updateField("clientInfo", "updateClientInfo")
    const updateCodeVerifier = updateField("codeVerifier", "updateCodeVerifier")
    const updateOAuthState = updateField("oauthState", "updateOAuthState")
    const clearCodeVerifier = clearField("codeVerifier", "clearCodeVerifier")
    const clearOAuthState = clearField("oauthState", "clearOAuthState")

    const getOAuthState = Effect.fn("McpAuth.getOAuthState")(function* (mcpName: string) {
      const entry = yield* get(mcpName)
      return entry?.oauthState
    })

    return Service.of({
      all,
      get,
      getForUrl,
      set,
      remove,
      updateTokens,
      updateClientInfo,
      updateCodeVerifier,
      clearCodeVerifier,
      updateOAuthState,
      getOAuthState,
      clearOAuthState,
    })
  }),
)

/** Owner-bound calls never construct the global file/key service or seal a legacy JSON file. */
export const admittedLayer = Layer.effect(Service, Effect.gen(function* () {
  const owners = yield* SessionOwner.Service
  const fs = yield* FSUtil.Service
  const flock = yield* EffectFlock.Service
  const retained = SynchronizedRef.makeUnsafe<Interface | undefined>(undefined)
  const legacy = SynchronizedRef.modifyEffect(retained, (current) => current
    ? Effect.succeed([current, current] as const)
    : Service.use((service) => Effect.succeed(service)).pipe(
      Effect.provide(legacyLayer.pipe(Layer.provide(CredentialCipher.layer))),
      Effect.provideService(FSUtil.Service, fs),
      Effect.provideService(EffectFlock.Service, flock),
      Effect.map((service) => [service, service] as const),
    ))
  const use = <A>(
    corporate: (vault: CredentialVault.Interface) => Effect.Effect<A, CredentialVault.Denied>,
    technical: (service: Interface) => Effect.Effect<A>,
  ): Effect.Effect<A> => { const origin = new Error("DIAGNOSTIC McpAuth use call").stack; return Effect.gen(function* () {
    const scope = yield* owners.open().pipe(Effect.orDie)
    const vault = yield* owners.connections(scope).pipe(Effect.orDie)
    if (vault) return yield* corporate(vault).pipe(Effect.orDie)
    const value = yield* technical(yield* legacy)
    yield* owners.verify(scope).pipe(Effect.orDie)
    return value
  }).pipe(Effect.tapDefect(() => Effect.logError(origin))) }
  const selected = (mcpName: string): ConnectionAccess.Key => Object.freeze({
    category: "mcp", resourceId: Schema.decodeUnknownSync(ConnectionAccess.Identifier)(mcpName), id: "primary",
  })
  const value = (stored: CredentialVault.Stored | undefined) => {
    if (!stored || stored.metadata.state === "removed") return Effect.succeed(undefined)
    return Schema.decodeUnknownEffect(Schema.fromJsonString(Entry))(stored.encodedValue)
      .pipe(Effect.mapError(() => new CredentialVault.Denied({ reason: "invalid-value" })))
  }
  const get = (mcpName: string) => {
    const key = selected(mcpName)
    return use((vault) => vault.read(key).pipe(Effect.flatMap(value)), (service) => service.get(mcpName))
  }
  const mutate = (key: ConnectionAccess.Key, update: (current: Entry | undefined) => Entry | undefined) =>
    (vault: CredentialVault.Interface) => Effect.gen(function* () {
      const stored = yield* vault.read(key)
      const entry = update(yield* value(stored))
      if (!entry) return
      yield* vault.write({
        key, label: key.resourceId, encodedValue: Schema.encodeSync(Schema.fromJsonString(Entry))(entry),
        expectedRevision: stored?.metadata.revision ?? 0,
        action: stored?.metadata.state === "active" ? "update" : "create",
      })
    })
  const set = (mcpName: string, entry: Entry, serverUrl?: string) => {
    const key = selected(mcpName)
    const encoded = Schema.encodeSync(Schema.fromJsonString(Entry))(entry)
    return use(mutate(key, () => ({ ...Schema.decodeUnknownSync(Schema.fromJsonString(Entry))(encoded),
      ...(serverUrl === undefined ? {} : { serverUrl }) })),
      (service) => service.set(mcpName, Schema.decodeUnknownSync(Schema.fromJsonString(Entry))(encoded), serverUrl))
  }
  const updateField = <K extends keyof Entry>(
    field: K, technical: (service: Interface, name: string, value: NonNullable<Entry[K]>, url?: string) => Effect.Effect<void>,
  ) => (mcpName: string, input: NonNullable<Entry[K]>, serverUrl?: string) => {
      const key = selected(mcpName)
      const copied = structuredClone(input)
      const update = (entry: Entry | undefined) => ({ ...entry, [field]: copied, ...(serverUrl === undefined ? {} : { serverUrl }) })
      return use(mutate(key, update), (service) => technical(service, mcpName, copied, serverUrl))
    }
  const clearField = (field: keyof Entry, technical: (service: Interface, name: string) => Effect.Effect<void>) => (mcpName: string) => {
    const key = selected(mcpName)
    const update = (entry: Entry | undefined) => {
      if (!entry) return undefined
      const next = { ...entry }
      delete next[field]
      return next
    }
    return use(mutate(key, update), (service) => technical(service, mcpName))
  }
  return Service.of({
    all: () => use((vault) => Effect.gen(function* () {
      const records = yield* vault.list("mcp")
      const pairs = yield* Effect.forEach(records, (record) => Effect.gen(function* () {
        if (record.key.id !== "primary") return yield* new CredentialVault.Denied({ reason: "invalid-value" })
        const entry = yield* vault.read(record.key).pipe(Effect.flatMap(value))
        return entry ? [record.key.resourceId, entry] as const : undefined
      }))
      return Object.fromEntries(pairs.filter((pair): pair is readonly [string, Entry] => pair !== undefined))
    }), (service) => service.all()),
    get,
    getForUrl: (mcpName, serverUrl) => get(mcpName).pipe(Effect.map((entry) =>
      entry?.serverUrl && entry.serverUrl === serverUrl ? entry : undefined)),
    set,
    remove: (mcpName) => {
      const key = selected(mcpName)
      return use((vault) => Effect.gen(function* () {
        const stored = yield* vault.read(key)
        if (stored) yield* vault.remove({ key, expectedRevision: stored.metadata.revision })
      }), (service) => service.remove(mcpName))
    },
    updateTokens: updateField("tokens", (service, name, value, url) => service.updateTokens(name, value, url)),
    updateClientInfo: updateField("clientInfo", (service, name, value, url) => service.updateClientInfo(name, value, url)),
    updateCodeVerifier: updateField("codeVerifier", (service, name, value) => service.updateCodeVerifier(name, value)),
    clearCodeVerifier: clearField("codeVerifier", (service, name) => service.clearCodeVerifier(name)),
    updateOAuthState: updateField("oauthState", (service, name, value) => service.updateOAuthState(name, value)),
    getOAuthState: (mcpName) => get(mcpName).pipe(Effect.map((entry) => entry?.oauthState)),
    clearOAuthState: clearField("oauthState", (service, name) => service.clearOAuthState(name)),
  })
}))
export const node = LayerNode.make({ service: Service, layer: admittedLayer, deps: [FSUtil.node, EffectFlock.node, SessionOwner.node] })

export * as McpAuth from "./auth"
