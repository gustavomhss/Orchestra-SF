import { EventV2 } from "@orchestra/core/event"
import { SessionOwner } from "@orchestra/core/session/owner"
import { OrchestraEventTransport } from "@orchestra/protocol/groups/event"
import { Permission } from "@orchestra/schema/permission"
import { Question } from "@orchestra/schema/question"
import { Session } from "@orchestra/schema/session"
import { SessionEvent } from "@orchestra/schema/session-event"
import { SessionTodo } from "@orchestra/schema/session-todo"
import { Effect, Queue, Schema, Stream } from "effect"
import { HttpServerResponse } from "effect/unstable/http"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { Sse } from "effect/unstable/encoding"
import { Api } from "../api"
import { openSessionAccess, sessionNamespace } from "../session-access"

export const encodeEvent = (data: unknown) => JSON.stringify(Schema.encodeUnknownSync(OrchestraEventTransport)(data))

/** A memo belongs to one subscriber's admitted projection, never to the whole server. */
export const eventFrames = (encode: (data: unknown) => string = encodeEvent) => {
  const frames = new WeakMap<object, string>()
  return (data: object): Sse.Event => {
    const cached = frames.get(data)
    const json = cached ?? encode(data)
    if (cached === undefined) frames.set(data, json)
    return { _tag: "Event", event: "message", id: undefined, data: json }
  }
}

// Bound item count and disconnect overflow; never silently lose an admitted event.
export const subscriberCapacity = 4096
const ownedTypes = new Set<string>([
  ...SessionEvent.Definitions, ...SessionTodo.Event.Definitions,
  ...Permission.Event.Definitions, ...Question.Event.Definitions,
].map((definition) => definition.type))

type SubscriberAccess = Readonly<{ owners: SessionOwner.Interface; scope: SessionOwner.Scope }>
class SessionStreamEnded extends Schema.TaggedErrorClass<SessionStreamEnded>()("Server.SessionStreamEnded", {}) {}

function eventType(data: object) {
  const type = "type" in data ? data.type : undefined
  return typeof type === "string" ? type : "unknown"
}

/** Only canonical Session-bearing definitions identify an owner; metadata and Location never do. */
const sessionFor = (event: EventV2.Payload) => {
  if (!ownedTypes.has(event.type)) return undefined
  const data = event.data
  if (!data || typeof data !== "object" || !("sessionID" in data)) return undefined
  return Schema.decodeUnknownOption(Session.ID)(data.sessionID).valueOrUndefined
}

const readable = (access: SubscriberAccess, event: EventV2.Payload) => Effect.gen(function* () {
  yield* access.owners.verify(access.scope)
  if (!ownedTypes.has(event.type)) return access.owners.owner(access.scope) === undefined
  const sessionID = sessionFor(event)
  return sessionID ? yield* access.owners.canRead(access.scope, sessionID) : false
})

const admittedEvents = (events: EventV2.Interface, access: SubscriberAccess) => Effect.gen(function* () {
  const queue = yield* Queue.dropping<EventV2.Payload, EventV2.SubscriberOverflowError | SessionStreamEnded>(subscriberCapacity)
  // Event callbacks execute in the publisher's fiber. Always use the captured
  // subscriber Scope, and check before retaining any payload in its queue.
  const unsubscribe = yield* events.listen((event) => Effect.gen(function* () {
    const sessionID = sessionFor(event)
    if (sessionID) {
      // canRead observes current policy before owner SQL and again afterward.
      // The dropping offer below cannot await external work; egress remains a
      // separate authority boundary when the subscriber consumes this payload.
      if (!(yield* access.owners.canRead(access.scope, sessionID))) return
    } else {
      // Preserve the existing checks for technical or malformed definitions.
      if (!(yield* readable(access, event))) return
      yield* access.owners.verify(access.scope)
    }
    const accepted = yield* Queue.offer(queue, event)
    if (!accepted) yield* Queue.fail(queue, new EventV2.SubscriberOverflowError({ capacity: subscriberCapacity }))
  }).pipe(Effect.catchCause(() => Queue.fail(queue, new SessionStreamEnded()).pipe(Effect.asVoid))))
  yield* Effect.addFinalizer(() => unsubscribe.pipe(Effect.andThen(Queue.shutdown(queue)), Effect.asVoid))
  return Stream.fromQueue(queue)
})

export const eventStream = (events: EventV2.Interface, frame = eventFrames(), access?: SubscriberAccess) => {
  const connected = { id: EventV2.ID.create(), type: "server.connected", data: {} }
  const skipped = new Set<string>()
  const output = Stream.unwrap(Effect.gen(function* () {
    if (access) yield* access.owners.authorize(access.scope, "read")
    // Register before the connected frame makes readiness observable.
    const live = yield* (access ? admittedEvents(events, access) : EventV2.allBounded(events, subscriberCapacity))
    return Stream.make(connected).pipe(Stream.concat(live))
  })).pipe(
    Stream.mapEffect((data) => Effect.gen(function* () {
      if (access) {
        yield* access.owners.authorize(access.scope, "read")
        // This connected object is generated here; a publisher cannot claim a public exception.
        if (data !== connected && !(yield* readable(access, data))) return undefined
      }
      const namespace = access ? yield* sessionNamespace(access.owners, access.scope) : undefined
      return yield* Effect.try({ try: () => frame(namespace ? { namespace, event: data } : data), catch: () => eventType(data) }).pipe(
        Effect.catch((type) => skipped.has(type) ? Effect.succeed(undefined) :
          Effect.logWarning("event stream skipped an event the public schema cannot name", { type }).pipe(
            Effect.andThen(Effect.sync(() => skipped.add(type))), Effect.as(undefined),
          )),
      )
    })),
    Stream.filter((event): event is Sse.Event => event !== undefined),
    Stream.pipeThroughChannel(Sse.encode()),
  )
  // Idle streams recheck their original authority too; logout/revocation cannot
  // keep a connection alive merely because no new business event is published.
  const heartbeat = Stream.tick("15 seconds").pipe(Stream.mapEffect(() =>
    access ? access.owners.authorize(access.scope, "read").pipe(Effect.as(": heartbeat\n\n")) :
      Effect.succeed(": heartbeat\n\n")))
  return output.pipe(Stream.merge(heartbeat, { haltStrategy: "left" }), Stream.encodeText)
}

export const EventHandler = HttpApiBuilder.group(Api, "server.event", (handlers) =>
  Effect.gen(function* () {
    const events = yield* EventV2.Service
    const owners = yield* SessionOwner.Service
    return handlers.handleRaw("event.subscribe", () => Effect.gen(function* () {
      const scope = yield* openSessionAccess(owners, "event.subscribe")
      return HttpServerResponse.stream(eventStream(events, eventFrames(), { owners, scope }), {
        contentType: "text/event-stream",
        headers: {
          "Cache-Control": "no-cache, no-transform",
          "X-Accel-Buffering": "no",
          "X-Content-Type-Options": "nosniff",
        },
      })
    }))
  }),
)
