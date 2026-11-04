import { Effect } from "effect"

/** Await an in-flight copy write and install its undo before cancellation can release the probe's permit. */
export const withSnapshotMutation = <A, E, R, E2, R2>(
  change: Effect.Effect<void, E2, R2>,
  undo: Effect.Effect<void>,
  use: Effect.Effect<A, E, R>,
) =>
  Effect.acquireUseRelease(
    change,
    () => use,
    () => undo,
  )
