import { expect, test } from "bun:test"
import { digestSfEvidenceRef } from "../../../product/contracts/canonical.ts"
import type { BusinessEvidenceRef } from "../../../product/contracts/business-context.ts"
import type { CollaborationThread } from "../../../product/collaboration/threads.ts"
import { isThread } from "../../../product/collaboration/threads.ts"
import { threadMessageContext } from "../../../product/collaboration/thread-context.ts"

function signed<T extends BusinessEvidenceRef>(ref: T): T {
  return { ...ref, refDigest: digestSfEvidenceRef(ref) }
}

test("message bases preserve immutable document and case supplements and reject their remapping", () => {
  const period = { start: "2026-01-01", end: "2026-01-31" }
  const source = signed<Extract<BusinessEvidenceRef, { kind: "record" }>>({ schema: "sf-evidence-v1", refId: "source", installationId: "i", projectId: "p", refDigest: "", kind: "record", evidenceLevel: "observed", target: { surface: "dashboard", recordType: "projects", recordId: "project", incarnation: "source-inc", version: 1, fields: ["name", "status"], period, projectionDigest: "a".repeat(64) } })
  const document = signed<Extract<BusinessEvidenceRef, { kind: "document" }>>({ schema: "sf-evidence-v1", refId: "document", installationId: "i", projectId: "p", refDigest: "", kind: "document", evidenceLevel: "observed", target: { documentId: "doc", incarnation: "doc-inc", revision: 1, blobDigest: { algorithm: "sha256", value: "b".repeat(64) }, segment: { start: 0, end: 12, unit: "utf16", textDigest: { algorithm: "sha256", value: "c".repeat(64) } } } })
  const event = signed<Extract<BusinessEvidenceRef, { kind: "case-event" }>>({ schema: "sf-evidence-v1", refId: "event", installationId: "i", projectId: "p", refDigest: "", kind: "case-event", evidenceLevel: "decision", target: { caseId: "case", caseIncarnation: "case-inc", caseVersion: 1, eventId: "event", outputDigest: "d".repeat(64), evidenceRefs: [source] } })
  const message = { id: "message", incarnation: "message-inc", version: 1, authorRef: "person", body: "Please inspect the source and supporting document.", createdAt: "2026-11-14T00:00:00Z" }
  const thread: CollaborationThread = { id: "thread", kind: "comment", sourceRef: source.refId, sourceIncarnation: source.target.incarnation, observedVersion: 1, period, state: "open", messages: [message], evidenceRefs: [source, document, event] }
  expect(isThread(thread)).toBe(true)
  expect(threadMessageContext(thread, message)?.evidenceRefs).toEqual([source, document, event])
  const current = signed({ ...source, target: { ...source.target, version: 2, projectionDigest: "e".repeat(64) } })
  const basis = { sourceRef: current.refId, sourceIncarnation: current.target.incarnation, observedVersion: 2, period, evidenceRefs: [current, document, event] }
  const answered = { ...message, id: "reply", incarnation: "reply-inc", sourceContext: basis }
  expect(threadMessageContext(thread, answered)).toEqual(basis)
  expect(isThread({ ...thread, messages: [message, answered] })).toBe(true)
  const recipientScoped = signed({ ...current, target: { ...current.target, incarnation: "recipient-scoped-inc" } })
  // Structural metadata cannot establish the physical identity; the reader's real reissuer must prove that.
  expect(threadMessageContext(thread, { ...answered, sourceContext: { ...basis, sourceIncarnation: recipientScoped.target.incarnation, evidenceRefs: [recipientScoped, document, event] } })?.sourceIncarnation).toBe("recipient-scoped-inc")
  expect(threadMessageContext(thread, { ...answered, sourceContext: { ...basis, sourceIncarnation: "mismatched-incarnation", evidenceRefs: [recipientScoped, document, event] } })).toBeUndefined()
  const replacedDocument = signed({ ...document, target: { ...document.target, revision: 2 } })
  expect(threadMessageContext(thread, { ...answered, sourceContext: { ...basis, evidenceRefs: [current, replacedDocument, event] } })).toBeUndefined()
  const replacedEvent = signed({ ...event, target: { ...event.target, eventId: "different-event" } })
  expect(threadMessageContext(thread, { ...answered, sourceContext: { ...basis, evidenceRefs: [current, document, replacedEvent] } })).toBeUndefined()
  expect(isThread({ ...thread, messages: [message, { ...answered, sourceContext: { ...basis, evidenceRefs: [current, document] } }] })).toBe(false)
  expect(isThread({ ...thread, evidenceRefs: [source, { ...source, refId: "malformed-extra", target: { ...source.target, fields: null } }], messages: [answered] })).toBe(false)
})
