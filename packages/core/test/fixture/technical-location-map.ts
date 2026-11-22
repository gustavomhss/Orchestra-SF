import type { Location } from "@orchestra/core/location"
import { Effect, LayerMap, RcMap } from "effect"

/** Existing technical fixtures expose the public map surface, without exposing cache storage as a service. */
export function technicalLocationMap<A, E>(locations: LayerMap.LayerMap<Location.Ref, A, E>) {
  return {
    get: locations.get,
    contextEffect: locations.contextEffect,
    invalidate: locations.invalidate,
    keys: RcMap.keys(locations.rcMap).pipe(Effect.map((refs) => Object.freeze(Array.from(refs)))),
  }
}
