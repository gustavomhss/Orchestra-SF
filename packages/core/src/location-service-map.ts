import { Context, Data, Effect, Layer, LayerMap, Schema, Scope } from "effect"
import { LayerNode } from "./effect/layer-node"
import { Node } from "./effect/app-node"
import { Location } from "./location"
import type { LocationError, LocationServices } from "./location-services"
import type { SessionOwner } from "./session/owner"

/** Cache storage is private: every acquisition and invalidation passes current owner admission. */
export type Interface = Pick<LayerMap.LayerMap<Location.Ref, LocationServices, LocationError>, "get" | "contextEffect" | "invalidate">

export class Service extends Context.Service<Service, Interface>()("@orchestra/example/LocationServiceMap") {
  static get(ref: Location.Ref) {
    return Layer.unwrap(Effect.map(Service, (locations) => locations.get(ref)))
  }
}

export const node = LayerNode.unbound(Service, Node.tags.values.global)

type ScopedMap<A, E> = Pick<LayerMap.LayerMap<Location.Ref, A, E>, "get" | "contextEffect" | "invalidate">
class CacheKey extends Data.Class<{
  readonly directory: Location.Ref["directory"]
  readonly workspaceID: Location.Ref["workspaceID"]
  readonly binding: SessionOwner.LocationBinding | undefined
}> {}

/** Production cache wrapper. An opaque request lease partitions all mutable services. */
export function makeScoped<A, E, R>(
  owners: SessionOwner.Interface,
  lookup: (ref: Location.Ref) => Layer.Layer<A, E, R>,
) {
  return Effect.gen(function* () {
    const locations = yield* LayerMap.make(
      (key: CacheKey) => {
        const layer = lookup(Location.Ref.make({ directory: key.directory, ...(key.workspaceID === undefined ? {} : { workspaceID: key.workspaceID }) }))
        // RcMap owns the acquisition fiber; restore only the captured request's private lease.
        return key.binding ? Layer.effectContext(key.binding.bind(Layer.build(layer))) : layer
      },
      { idleTimeToLive: "60 minutes" },
    )
    const keyFor = (ref: Location.Ref) => {
      // Copy technical placement before the first await. It never supplies owner authority.
      const copied = { directory: ref.directory, ...(ref.workspaceID === undefined ? {} : { workspaceID: ref.workspaceID }) }
      return Effect.gen(function* () {
        const sealed = yield* Schema.decodeUnknownEffect(Location.Ref)(copied).pipe(Effect.orDie)
        const binding = yield* owners.location.pipe(Effect.orDie)
        return new CacheKey({ directory: sealed.directory, workspaceID: sealed.workspaceID, binding })
      })
    }
    const contextEffect: ScopedMap<A, E>["contextEffect"] = (ref) => {
      const key = keyFor(ref)
      return Effect.gen(function* () {
        const current = yield* key
        const read = locations.contextEffect(current)
        return yield* (current.binding ? current.binding.bind(read) : read)
      })
    }
    const facade: ScopedMap<A, E> = {
      get: (ref) => Layer.effectContext(contextEffect(ref)),
      contextEffect,
      invalidate: (ref) => Effect.flatMap(keyFor(ref), (key) => locations.invalidate(key)),
    }
    return facade
  })
}

/** Lazy acquisitions must see the completed application's exports, not a constructor's partial context. */
export function withGlobalContext<A, E, R>(
  layer: Layer.Layer<A, E, R>,
  globalContext: Effect.Effect<Context.Context<never>>,
) {
  return layer.pipe(
    Layer.flatMap((context) => {
      const locations = Context.getUnsafe(context, Service)
      const contextEffect = (ref: Location.Ref) =>
        // Wait before entering the cache: early constructor forks must not retain a partial acquisition.
        globalContext.pipe(
          Effect.flatMap((globals) =>
            locations
              .contextEffect(ref)
              .pipe(Effect.updateContext((current: Context.Context<Scope.Scope>) => Context.merge(current, globals))),
          ),
        )
      return Layer.succeedContext(
        Context.add(context, Service, {
          ...locations,
          get: (ref) => Layer.effectContext(contextEffect(ref)),
          contextEffect,
        }),
      )
    }),
  )
}

export * as LocationServiceMap from "./location-service-map"
