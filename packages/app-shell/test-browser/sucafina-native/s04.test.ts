// S04 pure presentation-boundary checks; not an installed ACL or scanner E2E proof.
import { expect, test } from "bun:test"
import type { SfAttachment, SfAttachmentFieldProps, SfCopyKey, SfEvidence, SfFileAdmission, SfUiState } from "@/orchestra/chapters/sucafina/shared/evidence/types"
import type { SfRef, SfFileSelectionRef } from "@orchestra/schema/sucafina/context"
import { canInspectEvidence, canPresentEvidence } from "@/orchestra/chapters/sucafina/shared/evidence/guards"
import {
  canAdmitSelected,
  canRequestDownload,
  canRequestReferenceRemoval,
} from "@/orchestra/chapters/sucafina/shared/attachments/guards"

const acceptedFormats: SfAttachmentFieldProps["acceptedFormats"] = [
  { mediaType: "application/pdf", extensions: [".pdf"], label: { key: "sf.common.source" as SfCopyKey } },
]
const limit = { maxBytes: 2048, maxFiles: 2 }
const selected: SfFileAdmission = {
  kind: "selected", selectionRef: "selection-opaque" as SfFileSelectionRef,
  fileName: "source.pdf", bytes: 256, mediaType: "application/pdf",
}
const file = (status: SfAttachment["status"], canDownload = true, canRemoveReference = true): SfAttachment => ({
  ref: "asset-opaque" as SfRef, version: 3, fileName: "source.pdf",
  mediaType: "application/pdf", bytes: 256, status, canDownload, canRemoveReference,
})

test("S04: selected is not admitted; only explicit accepted selection can request admission", () => {
  expect(canAdmitSelected({ kind: "idle" }, acceptedFormats, limit, [])).toBe(false)
  expect(canAdmitSelected(selected, acceptedFormats, limit, [])).toBe(true)
  expect(canAdmitSelected({ kind: "admitting", selectionRef: "selection-opaque" as SfFileSelectionRef }, acceptedFormats, limit, [])).toBe(false)
  expect(canAdmitSelected({ kind: "admitted", attachmentRef: "asset-opaque" as SfRef }, acceptedFormats, limit, [])).toBe(false)
})

test("S04: blocked, scanner-unavailable and failed never become admission successes", () => {
  for (const kind of ["blocked", "scanner-unavailable", "failed"] as const) {
    expect(canAdmitSelected({ kind, reason: { key: "sf.common.unavailable" as SfCopyKey } }, acceptedFormats, limit, [])).toBe(false)
  }
})

test("S04: every configured limit and every format predicate is fail-closed", () => {
  expect(canAdmitSelected(selected, [], limit, [])).toBe(false)
  expect(canAdmitSelected({ ...selected, fileName: "fake.exe" }, acceptedFormats, limit, [])).toBe(false)
  expect(canAdmitSelected({ ...selected, mediaType: "text/plain" }, acceptedFormats, limit, [])).toBe(false)
  expect(canAdmitSelected({ ...selected, bytes: 2049 }, acceptedFormats, limit, [])).toBe(false)
  expect(canAdmitSelected({ ...selected, bytes: -1 }, acceptedFormats, limit, [])).toBe(false)
  expect(canAdmitSelected({ ...selected, bytes: 0 }, acceptedFormats, limit, [])).toBe(false)
  expect(canAdmitSelected(selected, acceptedFormats, { ...limit, maxBytes: 0 }, [])).toBe(false)
  expect(canAdmitSelected(selected, acceptedFormats, { ...limit, maxFiles: 0 }, [])).toBe(false)
  expect(canAdmitSelected(selected, acceptedFormats, limit, [file("admitted"), file("admitted")])).toBe(false)
})

test("S04: download and reference removal never trust a non-admitted status or stale flag", () => {
  expect(canRequestDownload(file("admitted", true))).toBe(true)
  expect(canRequestDownload(file("admitted", false))).toBe(false)
  expect(canRequestReferenceRemoval(file("admitted", true, false))).toBe(false)
  for (const status of ["blocked", "scanner-unavailable", "replaced", "revoked"] as const) {
    expect(canRequestDownload(file(status, true))).toBe(false)
    expect(canRequestReferenceRemoval(file(status, true, true))).toBe(false)
  }
})

test("S04: private evidence content is not exposed for revoked, unavailable or non-authorized UI states", () => {
  const message = { key: "sf.common.source" as SfCopyKey }
  const evidence: SfEvidence = {
    ref: "evidence-ref" as SfRef,
    source: {
      ref: "source-ref" as SfRef,
      version: "source-v1",
      label: { kind: "data", text: "Authorized source" },
      scope: { kind: "data", text: "Current owner" },
      coverage: { state: "complete", summary: message, reasons: [], knownCount: 1, expectedCount: 1 },
    },
    state: "confirmed",
    title: { kind: "data", text: "Private title" },
    excerpt: "Private excerpt",
    fields: [],
  }
  for (const state of ["denied", "session-expired", "unavailable", "outcome-unknown", "invalid", "not-found", "loading", "empty", "filtered-empty", "stale", "conflict"] as const satisfies readonly SfUiState[]) {
    expect(canPresentEvidence(state)).toBe(false)
    expect(canInspectEvidence(state, evidence)).toBe(false)
  }
  for (const state of ["ready", "partial"] as const satisfies readonly SfUiState[]) {
    expect(canPresentEvidence(state)).toBe(true)
    expect(canInspectEvidence(state, evidence)).toBe(true)
    expect(canInspectEvidence(state, { ...evidence, state: "candidate" })).toBe(true)
    expect(canInspectEvidence(state, { ...evidence, state: "stale" })).toBe(true)
    expect(canInspectEvidence(state, { ...evidence, state: "unavailable" })).toBe(false)
    expect(canInspectEvidence(state, { ...evidence, state: "revoked" })).toBe(false)
  }
})
