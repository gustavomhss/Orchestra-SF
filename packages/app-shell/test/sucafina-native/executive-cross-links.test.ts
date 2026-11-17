import { describe, expect, test } from "bun:test"
import type { SfContext } from "@orchestra/schema/sucafina/context"
import { sfExecutiveLinkAllowed } from "../../src/orchestra/chapters/sucafina/cross-links"

const ready = (operationId: SfContext["availability"][number]["operations"][number]["operationId"]) => ({
  operationId, state: "ready", reason: null, operational: true,
}) as const

const access: SfContext = {
  stamp: {
    installationId: "installation-one", projectId: "project-one", hostId: "host-one",
    principalRef: "principal-one", policyVersion: "policy-one", accessRevision: "access-one",
  },
  contractRevision: "sf-native-ui/1", authMode: "microsoft",
  destinations: [
    { capabilityId: "CAP02", surface: "dashboard", page: "Hot Topics & Actions",
      canRead: true, allowedActionIds: ["save"] },
    { capabilityId: "CAP10", surface: "dashboard", page: "All Projects",
      canRead: true, allowedActionIds: [] },
    { capabilityId: "CAP13", surface: "dashboard", page: "Risks",
      canRead: true, allowedActionIds: [] },
    { capabilityId: "CAP15", surface: "dashboard", page: "Stakeholders",
      canRead: true, allowedActionIds: [] },
  ],
  availability: [
    { family: "domain-read", resource: "CAP02", state: "ready",
      operations: [ready("domain.page.CAP02"), ready("domain.command.CAP02.save")] },
    { family: "domain-read", resource: "CAP10", state: "ready",
      operations: [ready("domain.page.CAP10")] },
    { family: "domain-read", resource: "CAP13", state: "ready",
      operations: [ready("domain.page.CAP13")] },
    { family: "domain-read", resource: "CAP15", state: "ready",
      operations: [ready("domain.page.CAP15")] },
    { family: "domain-read", resource: "relations", state: "ready",
      operations: [ready("collaboration.relation-read"), ready("collaboration.relation-create")] },
    { family: "reviews", resource: "agenda", state: "ready",
      operations: [ready("projection.review"), ready("dashboard.dashboard-agenda"),
        ready("dashboard.dashboard-review-preserve")] },
  ],
}

describe("WS-8 executive source/target grants", () => {
  test("only actual grants admit canonical record targets", () => {
    expect(sfExecutiveLinkAllowed(access, { kind: "project", ref: "project-17" })).toBe(true)
    expect(sfExecutiveLinkAllowed(access, { kind: "risk", ref: "risk-17" })).toBe(true)
    expect(sfExecutiveLinkAllowed(access, { kind: "stakeholder", ref: "person-17" })).toBe(true)
    expect(sfExecutiveLinkAllowed(access, { kind: "topic", ref: "topic-17" })).toBe(true)
    expect(sfExecutiveLinkAllowed({ ...access, destinations: [] }, { kind: "risk", ref: "risk-17" })).toBe(false)
    expect(sfExecutiveLinkAllowed({ ...access, availability: [] }, { kind: "topic", ref: "topic-17" })).toBe(false)
  })
  test("creating an agenda or action requires exact operation authority", () => {
    expect(sfExecutiveLinkAllowed(access, { kind: "agenda" })).toBe(true)
    expect(sfExecutiveLinkAllowed(access, { kind: "new-topic" })).toBe(true)
    const noPreserve = { ...access, availability: access.availability.filter((row) => row.resource !== "agenda") }
    expect(sfExecutiveLinkAllowed(noPreserve, { kind: "agenda" })).toBe(false)
    const noSave = { ...access, destinations: access.destinations.map((row) =>
      row.capabilityId === "CAP02" ? { ...row, allowedActionIds: [] } : row) }
    expect(sfExecutiveLinkAllowed(noSave, { kind: "new-topic" })).toBe(false)
  })
  test("project-to-note and risk-to-topic require both source and relation writer", () => {
    const project = { kind: "relations", source: { kind: "project", ref: "project-17" } } as const
    const risk = { kind: "relations", source: { kind: "risk", ref: "risk-17" } } as const
    expect(sfExecutiveLinkAllowed(access, project)).toBe(true)
    expect(sfExecutiveLinkAllowed(access, risk)).toBe(true)
    const noRelationWrite = { ...access, availability: access.availability.filter((row) => row.resource !== "relations") }
    expect(sfExecutiveLinkAllowed(noRelationWrite, project)).toBe(false)
    expect(sfExecutiveLinkAllowed(noRelationWrite, risk)).toBe(false)
    expect(sfExecutiveLinkAllowed({ ...access, destinations: access.destinations.filter((row) => row.capabilityId !== "CAP10") }, project)).toBe(false)
  })
})
