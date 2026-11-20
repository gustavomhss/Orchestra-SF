export * as AuthorityGeneration from "./authority-generation"

import { Context, Effect, Exit } from "effect"
import { createHash, randomUUID } from "node:crypto"
import { resolve } from "node:path"

export class GenerationError extends Error {
  readonly _tag = "AuthorityGenerationError"
  constructor(readonly reason: "unavailable" | "stale-generation" | "writer-required") {
    super("SF authority generation: " + reason)
  }
}

export interface Interface {
  /** Undefined means a positively identified technical store, never a failed policy read. */
  readonly current: Effect.Effect<number | undefined, GenerationError>
  readonly verifyGeneration: (expected: number) => Effect.Effect<boolean, GenerationError>
  /** Wrap the whole SQL transaction; release only after commit or rollback. */
  readonly withWriter: <A, E, R>(expected: number, effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E | GenerationError, R>
}

export class Service extends Context.Service<Service, Interface>()("@orchestra/AuthorityGeneration") {}

export interface WriterLease {
  readonly generation: number
  /** Synchronous, current proof from the private control store. No cached permission or clock-only lease. */
  readonly verify: () => boolean
  readonly release: (outcome: "completed" | "failed") => Effect.Effect<void, GenerationError>
}

export interface Source {
  readonly storageID: string
  readonly current: Effect.Effect<number | undefined, GenerationError>
  readonly verifyGeneration: Interface["verifyGeneration"]
  readonly acquire: (expected: number) => Effect.Effect<WriterLease, GenerationError>
}

type Proof = Readonly<{ storageID: string; generation: number; verify: () => boolean }>
const proofs = new WeakSet<object>()
const Writer = Context.Reference<Proof | undefined>("@orchestra/AuthorityGeneration/Writer", { defaultValue: () => undefined })
const memoryStores = new WeakMap<object, string>()
const valid = (value: number) => Number.isSafeInteger(value) && value >= 1

/** Shared with the SQL adapter; in-memory connections never borrow another database's identity. */
export function storageID(native: object, filename: string): string {
  if (filename !== ":memory:") return createHash("sha256").update(resolve(filename)).digest("hex")
  const known = memoryStores.get(native)
  if (known) return known
  const value = randomUUID()
  memoryStores.set(native, value)
  return value
}

function live(proof: Proof | undefined, storage: string, generation?: number): proof is Proof {
  if (!proof || !proofs.has(proof) || proof.storageID !== storage ||
      generation !== undefined && proof.generation !== generation) return false
  try { return proof.verify() === true } catch { return false }
}

/** A SQL adapter may inspect this private fiber proof, but cannot construct or transport one. */
export function writerFor(context: Context.Context<never>, storage: string, generation?: number): Proof | undefined {
  const proof = Context.get(context, Writer)
  return live(proof, storage, generation) ? proof : undefined
}

export function make(source: Source): Interface {
  if (!source.storageID) throw new GenerationError("unavailable")
  const current = source.current.pipe(Effect.flatMap((value) => value === undefined || valid(value)
    ? Effect.succeed(value) : Effect.fail(new GenerationError("unavailable"))))
  const verifyGeneration: Interface["verifyGeneration"] = (expected) => valid(expected)
    ? source.verifyGeneration(expected).pipe(Effect.map((value) => value === true))
    : Effect.succeed(false)
  const withWriter: Interface["withWriter"] = (expected, effect) => Effect.gen(function* () {
    if (!valid(expected)) return yield* Effect.fail(new GenerationError("stale-generation"))
    const inherited = yield* Writer
    if (inherited) {
      if (!live(inherited, source.storageID, expected))
        return yield* Effect.fail(new GenerationError("writer-required"))
      // Reentrant publication shares the outer lease; it cannot renew a revoked Request or commit separately.
      return yield* effect
    }
    return yield* Effect.acquireUseRelease(
      source.acquire(expected),
      (lease) => Effect.gen(function* () {
        if (lease.generation !== expected || !lease.verify()) return yield* Effect.fail(new GenerationError("stale-generation"))
        const proof = Object.freeze({ storageID: source.storageID, generation: expected, verify: lease.verify })
        proofs.add(proof)
        return yield* effect.pipe(
          Effect.provideService(Writer, proof),
          Effect.ensuring(Effect.sync(() => proofs.delete(proof))),
        )
      }),
      (lease, exit) => lease.release(Exit.isSuccess(exit) ? "completed" : "failed").pipe(Effect.orDie),
    )
  })
  return Object.freeze({ current, verifyGeneration, withWriter })
}
