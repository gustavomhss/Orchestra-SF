import { expect, test } from "bun:test"
import { DateTime, Schema } from "effect"
import { Event } from "@orchestra/schema/event"
import { Session } from "@orchestra/schema/session"
import { SessionEvent } from "@orchestra/schema/session-event"
import { TeamProfile } from "@orchestra/schema/sucafina/team-profile"
import { OrchestraEvent, OrchestraEventTransport } from "../src/groups/event"
import { SessionEventTransport } from "../src/groups/session"

const namespace = Schema.decodeUnknownSync(TeamProfile.SessionNamespace)({
  version: 1,
  owner: { profile: { installationId: "transport-fixture", tenantId: "11111111-1111-4111-8111-111111111111",
    teamObjectId: "22222222-2222-4222-8222-222222222222" },
    principal: { tenantId: "11111111-1111-4111-8111-111111111111", principalObjectId: "33333333-3333-4333-8333-333333333333" } },
  authorityGeneration: 7,
})
const event = SessionEvent.Renamed.make({
  id: Event.ID.create(), type: "session.next.renamed",
  data: { sessionID: Session.ID.make("ses_transport"), timestamp: DateTime.nowUnsafe(), title: "Original canonical data" },
  durable: { aggregateID: "ses_transport", seq: 5, version: 1 },
})

test("corporate event transport adds its current namespace outside unchanged durable and live event bytes", () => {
  const durable = Schema.encodeSync(SessionEvent.Durable)(event)
  const live = Schema.encodeSync(OrchestraEvent)(event)
  const sessionWire = Schema.encodeSync(SessionEventTransport)({ namespace, event })
  const globalWire = Schema.encodeSync(OrchestraEventTransport)({ namespace, event })
  if (!("event" in sessionWire) || !("event" in globalWire)) throw new Error("Corporate wrapper required")
  expect(JSON.stringify(sessionWire.event)).toBe(JSON.stringify(durable))
  expect(JSON.stringify(globalWire.event)).toBe(JSON.stringify(live))
  expect(sessionWire.namespace).toEqual(namespace)
  expect(globalWire.namespace).toEqual(namespace)
  expect(Schema.decodeUnknownSync(SessionEventTransport)(sessionWire)).toEqual({ namespace, event })
  expect(Schema.decodeUnknownSync(OrchestraEventTransport)(globalWire)).toEqual({ namespace, event })
})

test("explicit technical transport retains legacy events and rejects malformed corporate labels", () => {
  expect(Schema.encodeSync(SessionEventTransport)(event)).toEqual(Schema.encodeSync(SessionEvent.Durable)(event))
  expect(Schema.encodeSync(OrchestraEventTransport)(event)).toEqual(Schema.encodeSync(OrchestraEvent)(event))
  for (const malformed of [
    { ...namespace, authorityGeneration: 0 },
    { ...namespace, version: 2 },
    { ...namespace, role: "admin" },
    { ...namespace, owner: { ...namespace.owner, profile: { installationId: "partial" } } },
  ]) {
    expect(() => Schema.decodeUnknownSync(SessionEventTransport)({ namespace: malformed,
      event: Schema.encodeSync(SessionEvent.Durable)(event) })).toThrow()
  }
})
