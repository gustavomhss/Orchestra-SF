import { expect } from "bun:test"
import { SessionSchema } from "@orchestra/core/session/schema"
import { Effect } from "effect"
import resident from "../../../../product/ai/manifests/resident.json" with { type: "json" }
import { digestSfValue } from "../../../../product/contracts/canonical.ts"
import { decodeSfOperationOutput } from "../../../../product/contracts/schema-admission.ts"
import type { SfOperationInputMap } from "../../../../product/contracts/operations.ts"
import { object } from "../../../../runtime/contract.ts"
import { dispatchWp12Ui } from "../../wp12/native-mission-harness.ts"
import type { Wp12CompletedNativeMission, Wp12NativeMissionContext } from "../../wp12/native-mission-harness.ts"

const digest64 = /^[a-f0-9]{64}$/

/**
 * An observer of ACTUAL completed provider messages and C16 call receipts.
 * This never authors a Session, synthetic tool transcript, receipt, grant,
 * model reply, C08 admission or ToolRegistry. The caller supplies a completed
 * WP12 native run, already verified and persisted by the production host.
 *
 * A native success cannot be deduced from the distributed manifest or the
 * caller's requiredTools array. Only completed assistant tool parts count.
 */
export async function observeNativeC16(context: Wp12NativeMissionContext, completed: Wp12CompletedNativeMission,
  required: readonly string[]) {
  if (!context.services.analyses) throw new Error("Real analysis run reader unavailable")
  const read = await context.human("analysis.read", { runRef: completed.runRef },
    (call) => context.services.analyses!.read(call, completed.runRef))
  if (read.status !== "ok" || read.value.state !== "ready" || !read.value.native)
    throw new Error("Native C16 observer requires a persisted ready run with source receipt")
  expect(read.value.caseRef).toEqual(completed.caseRef)
  expect(read.value.principalRef).toBe(context.principalRef)
  expect(read.value.accessRevision).toBe(completed.accessRevision)
  expect(read.value.native.skillReceipt).toEqual(completed.receipt)
  const messages = await Effect.runPromise(context.session.messages({
    sessionID: SessionSchema.ID.make(completed.receipt.nativeSessionId),
  }))
  const tools = messages.flatMap((message) =>
    message.type === "assistant" && message.time.completed && !message.error
      ? message.content.flatMap((part) => {
          if (part.type !== "tool" || part.state.status !== "completed") return []
          const structured = object(part.state.structured)
          const receipt = object(structured.receipt)
          if (structured.status !== "ok" || receipt.kind !== "native" ||
            receipt.operation !== part.name || receipt.callId !== part.id ||
            receipt.runId !== completed.runRef || receipt.nativeSessionId !== completed.receipt.nativeSessionId ||
            receipt.principalRef !== context.principalRef || receipt.accessRevision !== completed.accessRevision ||
            typeof receipt.inputDigest !== "string" || !digest64.test(receipt.inputDigest) ||
            receipt.inputDigest !== digestSfValue(part.state.input) ||
            typeof receipt.resultDigest !== "string" || !digest64.test(receipt.resultDigest) ||
            typeof receipt.handlerExport !== "string" || !receipt.handlerExport ||
            !Number.isSafeInteger(receipt.providerGeneration))
            return []
          const decoded = decodeSfOperationOutput(part.name as keyof SfOperationInputMap, structured.result)
          if (!decoded.ok || receipt.resultDigest !== digestSfValue(decoded.value))
            throw new Error(`C16 output/receipt does not match public domain schema: ${part.name}`)
          const descriptor = context.business.descriptors.find((item) => item.id === part.name)
          if (descriptor && descriptor.handlerExport !== receipt.handlerExport)
            throw new Error(`C16 handler export differs from real product descriptor: ${part.name}`)
          const route = resident.operation_call_routes.find((item) =>
            item.operation_id === part.name && item.profile_id === completed.receipt.profileId &&
            item.skill_id === completed.receipt.skillId)
          return [{
            operation: part.name, handlerExport: receipt.handlerExport, toolCallId: part.id,
            input: structuredClone(part.state.input),
            inputDigest: receipt.inputDigest, resultDigest: receipt.resultDigest,
            outputRef: typeof structured.outputRef === "string" ? structured.outputRef : null,
            sourceDigest: completed.receipt.sourceDigest, instructionsDigest: completed.receipt.instructionsDigest,
            profileId: completed.receipt.profileId, skillId: completed.receipt.skillId,
            nativeSessionId: completed.receipt.nativeSessionId, runRef: completed.runRef,
            principalRef: receipt.principalRef, accessRevision: receipt.accessRevision,
            caseRef: completed.caseRef, providerGeneration: receipt.providerGeneration,
            canonicalRoute: !!route, consumerCandidates: route?.consumer_tasks ?? [],
          }]
        })
      : [])
  for (const operation of required)
    expect(tools.some((entry) => entry.operation === operation)).toBe(true)
  expect(new Set(tools.map((entry) => entry.toolCallId)).size).toBe(tools.length)
  expect(tools.map((entry) => entry.toolCallId).toSorted()).toEqual([...completed.toolCallIds].toSorted())
  for (const tool of tools)
    console.info("SF_AM02_NATIVE_C16_TOOL:" + JSON.stringify({
      githubSha: process.env.GITHUB_SHA ?? null, ...Object.fromEntries(Object.entries(tool).filter(([key]) => key !== "input")),
      actualModel: completed.actualModel, providerTurnObserved: true,
      sameRunAsPersistedContribution: true, source: "real-SessionV2-completed-assistant-message",
      consumerClaim: "NOT_RUN_UNLESS_REOPENED_BY_DRIVER",
    }))
  return tools
}

/**
 * Real same-principal/domain replay of completed native read-only calls.
 * The payload comes from SessionMessage.ToolState.Completed.input, not a
 * test-provided model reply. UI admission and the capability descriptor
 * execute a SECOND time through the installed public product dispatch.
 * An unavailable or differently versioned source fails; there is no
 * compensating catalog/receipt made in the driver.
 *
 * Native agent/tool and authorized UI alone are not a separate independent
 * SDK-MCP transport witness for final AM02.
 */
export async function compareObservedNativeWithUi(context: Wp12NativeMissionContext,
  completed: Wp12CompletedNativeMission,
  tools: Awaited<ReturnType<typeof observeNativeC16>>,
  required: readonly string[]) {
  const rows = []
  for (const operation of required) {
    const fromNative = tools.find((entry) => entry.operation === operation)
    if (!fromNative) throw new Error(`Missing actual native ${operation} invocation`)
    if (!fromNative.canonicalRoute || fromNative.profileId !== completed.receipt.profileId ||
      fromNative.skillId !== completed.receipt.skillId ||
      fromNative.runRef !== completed.runRef ||
      fromNative.inputDigest !== digestSfValue(fromNative.input))
      throw new Error(`Native ${operation} was not admitted by frozen C15/C16 routing`)
    const fresh = await context.ui("sf_case_read", { caseRef: completed.caseRef },
      (call) => context.business.cases.read({ caseRef: completed.caseRef }, call))
    if (fresh.status !== "ok" || fresh.value.case.version !== completed.caseRef.version)
      throw new Error(`Native/UI ${operation} case version or authorization changed`)
    const ui = await dispatchWp12Ui(context, operation, fromNative.input)
    if (ui.status !== "ok") throw new Error(`Authorized live UI ${operation} did not return a real result: ${ui.status}`)
    const receipt = object(ui.receipt)
    expect(receipt.kind).toBe("ui")
    expect(receipt.operation).toBe(fromNative.operation)
    expect(receipt.handlerExport).toBe(fromNative.handlerExport)
    expect(receipt.principalRef).toBe(fromNative.principalRef)
    expect(receipt.accessRevision).toBe(fromNative.accessRevision)
    expect(receipt.inputDigest).toBe(fromNative.inputDigest)
    expect(receipt.resultDigest).toBe(fromNative.resultDigest)
    const decoded = decodeSfOperationOutput(operation as keyof SfOperationInputMap, ui.result)
    if (!decoded.ok || digestSfValue(decoded.value) !== fromNative.resultDigest)
      throw new Error(`Real UI/native ${operation} domain output diverged`)
    const witness = {
      githubSha: process.env.GITHUB_SHA ?? null, operation,
      caseRef: completed.caseRef, principalRef: fromNative.principalRef,
      accessRevision: fromNative.accessRevision,
      profileId: fromNative.profileId, skillId: fromNative.skillId,
      runRef: completed.runRef, nativeSessionId: completed.receipt.nativeSessionId,
      toolCallId: fromNative.toolCallId, handlerExport: fromNative.handlerExport,
      sourceDigest: completed.receipt.sourceDigest,
      inputDigest: fromNative.inputDigest, resultDigest: fromNative.resultDigest,
      actualModel: completed.actualModel, consumerOutputRef: completed.output.id,
      uiDomainEntered: true, nativeProviderTurnObserved: true,
      sameCaseAndInputOutputDigest: true, thirdTransportMcpParityNotClaimed: true,
    }
    console.info("SF_AM02_NATIVE_UI_PARITY:" + JSON.stringify(witness))
    rows.push(witness)
  }
  return rows
}
