import { Event } from "@orchestra/schema/event"
import { EventManifest } from "@orchestra/schema/event-manifest"
import { Location } from "@orchestra/schema/location"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import type { Definition } from "@orchestra/schema/event"
import { Schema } from "effect"
import { HttpApiEndpoint, HttpApiGroup, HttpApiSchema, OpenApi } from "effect/unstable/httpapi"

const fields = {
  id: Event.ID,
  metadata: Schema.optional(Schema.Record(Schema.String, Schema.Unknown)),
  durable: Schema.optional(Schema.Struct({ aggregateID: Schema.String, seq: Schema.Int, version: Schema.Int })),
  location: Schema.optional(Location.Ref),
}

const schema = <const Definitions extends ReadonlyArray<Definition>>(definitions: Definitions) =>
  Schema.Union([
    ...definitions,
    ...(definitions.some((definition) => definition.type === "server.connected")
      ? []
      : [
          Schema.Struct({
            ...fields,
            type: Schema.Literal("server.connected"),
            data: Schema.Struct({}),
          }).annotate({ identifier: "V2Event.server.connected" }),
        ]),
  ]).annotate({ identifier: "V2Event" })

const make = <const Definitions extends ReadonlyArray<Definition>>(definitions: Definitions) => {
  const EventSchema = schema(definitions)
  const Transport = Schema.Union([EventSchema, Schema.Struct({ namespace: TeamProfile.SessionNamespaceTransport, event: EventSchema })])
    .annotate({ identifier: "V2EventTransport" })
  return {
    schema: EventSchema,
    transport: Transport,
    group: HttpApiGroup.make("server.event")
      .add(
        HttpApiEndpoint.get("event.subscribe", "/api/event", {
          success: HttpApiSchema.StreamSse({ data: Transport }),
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "v2.event.subscribe",
            summary: "Subscribe to events",
            description: "Subscribe to native event payloads for the server.",
          }),
        ),
      )
      .annotateMerge(OpenApi.annotations({ title: "events", description: "Experimental event stream route." })),
  }
}

export const makeEventGroup = <const Definitions extends ReadonlyArray<Definition>>(definitions: Definitions) =>
  make(definitions).group

const event = make(EventManifest.ServerDefinitions)
export const EventGroup = event.group
export const OrchestraEvent = event.schema
export type OrchestraEvent = typeof OrchestraEvent.Type
export type OrchestraEventEncoded = typeof OrchestraEvent.Encoded

/** Namespace labels are added at the admitted HTTP boundary, outside canonical event payloads. */
export const OrchestraEventTransport = event.transport
export type OrchestraEventTransport = typeof OrchestraEventTransport.Type
export type OrchestraEventTransportEncoded = typeof OrchestraEventTransport.Encoded
