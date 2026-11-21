import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { BusinessPorts } from "../../../../modules/sucafina/Sucafinav1/product/contracts/ports.ts"
import type { TrustedDomainContext, TrustedUiContext } from "../../../../modules/sucafina/Sucafinav1/product/contracts/sf-execution.ts"
type Run = BusinessPorts["routines"]["run"]
type RunInput = Parameters<Run>[0]
export type SfRoutineNativeHumanRunCommand = Readonly<{
  caseRef: Readonly<RunInput["caseRef"]>
  input: Readonly<RunInput>
}>

/** The same JSON shape A09 passed to human.admit; a C15 selector is NOT its substitute. */
export function sfRoutineHumanRunCommand219(value: RunInput): SfRoutineNativeHumanRunCommand {
  const selected = Object.freeze({ ...value.caseRef })
  return Object.freeze({
    caseRef: selected,
    input: Object.freeze({ ...structuredClone(value), caseRef: Object.freeze({ ...value.caseRef }) }),
  })
}

/**
 * First-party original-Request human-command boundary for the already installed C07 producer.
 * This does not allocate a Task/Session/owner, add an approval, or advertise Schedule readiness.
 * A09's withCase and C07's actual native owner checks remain independently mandatory.
 */
export function createSfRoutineHumanRun219(input: {
  readonly run: Run
  readonly requestFor: (context: TrustedDomainContext) => Request | undefined
  readonly authorize: (context: TrustedUiContext, command: SfRoutineNativeHumanRunCommand) => Promise<boolean>
  readonly current: () => boolean
}): Run {
  const denied = (): Awaited<ReturnType<Run>> =>
    ({ status: "denied", reason: "routine-human-origin-unavailable" })
  return async (value, context) => {
    // Resident calls retain their existing capability/entryMode fences; never turn them into human commands.
    if (context.kind !== "ui") return input.run(value, context)
    const request = input.requestFor(context)
    if (!request || request.method !== "POST" || request.signal.aborted || !input.current()) return denied()
    const command = sfRoutineHumanRunCommand219(value)
    const contextDigest = digestSfValue(context.binding)
    const headersDigest = digestSfValue([...request.headers])
    const commandDigest = digestSfValue(command)
    const live = () => input.current() && !request.signal.aborted && input.requestFor(context) === request &&
      digestSfValue(context.binding) === contextDigest &&
      digestSfValue([...request.headers]) === headersDigest && digestSfValue(command) === commandDigest
    const authorized = () => input.authorize(context, command).catch(() => false)
    if (!live() || !await authorized() || !live()) return denied()
    const result = await input.run(value, context)
    // Cancellation, identity/policy rotation and human-intent revocation must win over a late response.
    return live() && await authorized() && live() ? result : denied()
  }
}
