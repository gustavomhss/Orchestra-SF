import { expect, test } from "bun:test"
import { dispatchSfCapability } from "../../../product/host-binding/capability-dispatch.ts"
import { digestSfValue } from "../../../product/contracts/canonical.ts"
import { decodeSfOperationInput, decodeSfOperationOutput } from "../../../product/contracts/schema-admission.ts"
import { encodeCaseRef } from "../../../product/decisions/case-port.ts"
import { available } from "./relations-fixture.ts"
import { createThreadActorsFixture } from "./thread-actors-fixture.ts"

test("sf_handoff_prepare uses the shared authorized handler and real case/action without applying a domain command", async () => {
  const fixture = await createThreadActorsFixture()
  try {
    const project = await fixture.issueProject(fixture.author)
    const topic = available(await fixture.records.issue({ page: "Hot Topics & Actions", recordType: "hotTopics", recordId: "topic", fields: ["status"], period: { start: "2026-11-13", end: "2026-11-13" } }, fixture.author))
    const draft = { objective: "Prepare the existing canonical action", horizon: fixture.period, currency: "USD", criteria: ["Keep the selected action identity"], sourceRefs: [project, topic] }
    const admittedCase = available(await fixture.ui.admit(fixture.request("person"), "sf_case_draft", digestSfValue(draft)))
    if (!await fixture.ui.validate(admittedCase, "sf_case_draft", digestSfValue(draft))) throw new Error("case admission unavailable")
    const decision = available(await fixture.cases.draft(draft, admittedCase))
    const payload = { caseRef: encodeCaseRef(decision), actionRef: topic.refId, sourceRefs: [project, topic] }
    const call = available(await fixture.ui.admit(fixture.request("person"), "sf_handoff_prepare", digestSfValue(payload)))
    const before = await fixture.snapshots()
    const run = (context: typeof call) => dispatchSfCapability({ operation: "sf_handoff_prepare", payload, context, descriptors: fixture.port.capabilities, authority: fixture.domainAuthority, validateInput: (_descriptor, input) => decodeSfOperationInput("sf_handoff_prepare", input).ok, validateOutput: (_descriptor, value) => value.status !== "ok" || decodeSfOperationOutput("sf_handoff_prepare", value.result).ok })
    expect(await run(call)).toMatchObject({ status: "ok", result: { ...payload, domainApplied: false } })
    expect(await fixture.snapshots()).toEqual(before)
    expect(await fixture.port.relations.storageVersion(fixture.author)).toEqual({ status: "ok", value: 0 })
    // An actual context admitted for a different operation is not a grant for this call.
    expect((await run(fixture.author)).status).not.toBe("ok")
    fixture.actors.person!.enabled = false
    expect((await run(call)).status).not.toBe("ok")
  } finally {
    await fixture.dispose()
  }
})
