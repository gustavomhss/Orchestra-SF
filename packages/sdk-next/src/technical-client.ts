import type { Orchestra } from "@orchestra/client/effect"
import { UnauthorizedError } from "@orchestra/protocol/errors"
import { Session } from "@orchestra/schema/session"
import { Effect, Schema, Stream } from "effect"

/** Embedded operator clients expose technical sessions only. Installed clients use their own admitted transport. */
export function requireTechnicalClient(client: Effect.Success<ReturnType<typeof Orchestra.make>>) {
  const denied = () => new UnauthorizedError({ message: "Corporate sessions require an installed Microsoft transport" })
  const technical = <A extends { readonly namespace?: unknown }>(value: A) =>
    value.namespace === undefined ? Effect.succeed(value) : Effect.fail(denied())
  return {
    ...client,
    sessions: {
      ...client.sessions,
      create: (...input: Parameters<typeof client.sessions.create>) => client.sessions.create(...input).pipe(Effect.flatMap(technical)),
      get: (...input: Parameters<typeof client.sessions.get>) => client.sessions.get(...input).pipe(Effect.flatMap(technical)),
      fork: (...input: Parameters<typeof client.sessions.fork>) => client.sessions.fork(...input).pipe(Effect.flatMap(technical)),
      list: (...input: Parameters<typeof client.sessions.list>) => client.sessions.list(...input).pipe(Effect.flatMap(technical)),
      history: (...input: Parameters<typeof client.sessions.history>) => client.sessions.history(...input).pipe(Effect.flatMap(technical)),
      active: () => client.sessions.active().pipe(Effect.flatMap((value) => {
        if ("namespace" in value && value.namespace !== undefined) return Effect.fail(denied())
        return Effect.try({
          try: () => Schema.decodeUnknownSync(Schema.Record(Session.ID, Schema.Struct({ type: Schema.Literal("running") })))(
            "data" in value ? value.data : value),
          catch: denied,
        })
      })),
      events: (...input: Parameters<typeof client.sessions.events>) => client.sessions.events(...input).pipe(
        Stream.mapEffect((frame) => "event" in frame ? Effect.fail(denied()) : Effect.succeed(frame)),
      ),
    },
    messages: {
      ...client.messages,
      list: (...input: Parameters<typeof client.messages.list>) => client.messages.list(...input).pipe(Effect.flatMap(technical)),
    },
    events: { subscribe: () => client.events.subscribe().pipe(
      Stream.mapEffect((frame) => "event" in frame ? Effect.fail(denied()) : Effect.succeed(frame)),
    ) },
  }
}
