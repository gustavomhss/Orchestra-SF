import path from "node:path"
import { AppProcess } from "@orchestra/core/process"
import { LayerNode } from "@orchestra/core/effect/layer-node"
import { Effect } from "effect"
import installation from "../../../../modules/sucafina/Sucafinav1/local/entry.ts"
import { createResidentAiBundle } from "../../../../modules/sucafina/Sucafinav1/product/ai/resident.ts"
import type { CreateSfHostRuntime, SfHostRuntime } from "../../../../modules/sucafina/Sucafinav1/product/contracts/host-context.ts"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { probeSfAtlasScanner } from "../../../../modules/sucafina/Sucafinav1/product/host-binding/atlas-scanner.ts"
import { createSfBusinessServices } from "../../src/sucafina-product/business-services.ts"
import atlasPackage from "../../../../modules/atlas/boundary/package.json" with { type: "json" }
import freeze from "../../../../modules/sucafina/Sucafinav1/product/contracts/freeze-v1.json" with { type: "json" }

export { nativeSfLocalInstallation } from "../../../../modules/sucafina/Sucafinav1/local/entry.ts"

type Preparation = { cookie: string; caseRef: { id: string; incarnation: string; version: number } }

/**
 * Fixture-only preparation over the original installed authority and persistence.
 * The one private stdin command publishes an existing ledger event; it adds no HTTP
 * route and never runs from a page read, recall or the production installation.
 */
export default async function memoryInstallation(context: Parameters<typeof installation>[0]) {
  const createHostRuntime = context.createHostRuntime
  if (!createHostRuntime) throw new Error("Memory preparation requires the original native host factory")
  const owner: { input?: Parameters<CreateSfHostRuntime>[0]; runtime?: SfHostRuntime } = {}
  // The loader normally derives this from the selected factory's directory.
  // Delegating from a fixture must retain the original resident asset directory.
  const sourceRoot = path.resolve(import.meta.dir, "../../../../modules/sucafina/Sucafinav1/product/ai")
  const installed = await installation({
    ...context, sourceRoot,
    createHostRuntime: async (input) => {
      if (owner.input) throw new Error("Memory preparation requires one original native owner")
      owner.input = input
      const runtime = await createHostRuntime(input)
      owner.runtime = runtime
      return runtime
    },
  })
  const stop = new AbortController()
  const progress = { stage: "input", reason: "unavailable" }
  const preparation = (async () => {
    const command = await readPreparation(stop.signal)
    progress.stage = "owner"
    const input = owner.input
    const runtime = owner.runtime
    const authority = runtime?.services?.()
    if (!input || !runtime?.identity() || !authority || input.authMode !== "local-operator")
      throw new Error("The original native owner is unavailable for memory preparation")
    const request = new Request(input.origin + input.mount + "/dashboard", {
      method: "POST", headers: { cookie: command.cookie, origin: input.origin },
      signal: AbortSignal.any([stop.signal, AbortSignal.timeout(40_000)]),
    })
    progress.stage = "scanner"
    const scanner = await Effect.runPromise(Effect.scoped(Effect.gen(function* () {
      const process = yield* AppProcess.Service
      return yield* Effect.promise(() => probeSfAtlasScanner(process))
    })).pipe(Effect.provide(LayerNode.compile(AppProcess.node))), { signal: stop.signal })
    if (!scanner || request.signal.aborted) throw new Error("The canonical Atlas scanner is unavailable")
    progress.stage = "manifest"
    const bundle = await createResidentAiBundle({ root: sourceRoot, manifestPath: path.join(sourceRoot, "manifests/resident.json") })
    if (authority.selected.some((selected) => selected.manifestDigest !== bundle.manifestDigest))
      throw new Error("The original resident manifest changed before memory preparation")
    const business = createSfBusinessServices({ authority, persistence: input.persistence, proposalCoverageWrites: new WeakSet() })
    try {
      business.initializeAtlas(scanner, { boundaryVersion: atlasPackage.version, schemaVersion: freeze.canonicalSha256,
        manifestVersion: bundle.manifestDigest, skillVersion: digestSfValue(bundle.skills
          .map((skill) => ({ id: skill.id, version: skill.version, sourceDigest: skill.sourceDigest }))) })
      progress.stage = "admission"
      const payload = { caseRef: encodeCaseRef(command.caseRef) }
      const digest = digestSfValue(payload)
      const admitted = await authority.ui.admit(request, "sf_case_read", digest)
      if (admitted.status !== "ok") throw new Error("The operator did not admit memory preparation")
      const call = admitted.value
      try {
        if (!await authority.ui.validate(call, "sf_case_read", digest))
          throw new Error("The operator memory preparation intent changed")
        progress.stage = "case"
        const current = await business.cases.read(payload, call)
        if (current.status !== "ok" || current.value.case.id !== command.caseRef.id ||
            current.value.case.incarnation !== command.caseRef.incarnation || current.value.case.version !== command.caseRef.version)
          throw new Error("The original selected precedent changed")
        const events = current.value.events.filter((event) => event.kind === "choice-recorded" &&
          event.caseRef.id === command.caseRef.id && event.caseRef.incarnation === command.caseRef.incarnation &&
          event.caseRef.version === command.caseRef.version)
        if (events.length !== 1) throw new Error("The selected precedent requires one real recorded choice")
        progress.stage = "ledger"
        const before = await authority.state.read(request, "outbox", (state) => structuredClone({
          cases: state.cases, outbox: state.outbox, casesVersion: state.versions.cases,
        }))
        if (before.status !== "ok") throw new Error("The original ledger outbox is unavailable")
        const candidates = Object.entries(before.value.outbox).filter(([, entry]) =>
          entry.eventRef.target.caseId === command.caseRef.id && entry.eventRef.target.caseIncarnation === command.caseRef.incarnation &&
          entry.eventRef.target.eventId === events[0]!.id && entry.eventRef.target.caseVersion === command.caseRef.version)
        const selected = candidates.length === 1 ? candidates[0] : undefined
        if (!selected || selected[1].state !== "pending" || selected[1].writerPrincipalRef !== call.binding.principalRef)
          throw new Error("The selected real ledger event is not pending for this operator")
        progress.stage = "publication"
        const receipt = await business.context.emitFromLedger(selected[1].eventRef, call)
        const reasons = ["authority-unavailable", "outbox-unavailable", "case-unavailable", "projection-unavailable",
          "source-unavailable", "scanner-or-source-fence-unavailable", "source-fence-unavailable", "source-changed-before-commit",
          "stale-authority-or-ledger", "atlas-partition-invalid", "atlas-event-unavailable", "source-event-unavailable",
          "historical-snapshot-conflict", "commit-unavailable", "scanner-blocked"]
        progress.reason = receipt.reason && reasons.includes(receipt.reason) ? receipt.reason : receipt.status
        if (receipt.status !== "committed" || receipt.scanner.status !== "clean" || receipt.scanner.name !== scanner.spec.name)
          throw new Error("The canonical Atlas writer did not commit the selected precedent")
        progress.stage = "receipt"
        const after = await authority.state.read(request, "outbox", (state) => structuredClone({
          cases: state.cases, outbox: state.outbox, casesVersion: state.versions.cases,
        }))
        if (after.status !== "ok") throw new Error("The published ledger receipt is unavailable")
        const settled = after.value.outbox[selected[0]]
        if (!settled || settled.state !== "settled" || digestSfValue(settled.receipt) !== digestSfValue(receipt) ||
            after.value.casesVersion !== before.value.casesVersion ||
            digestSfValue(after.value.cases) !== digestSfValue(before.value.cases) ||
            digestSfValue(Object.entries(after.value.outbox).filter(([key]) => key !== selected[0])) !==
              digestSfValue(Object.entries(before.value.outbox).filter(([key]) => key !== selected[0])) ||
            !await authority.ui.revalidate(call))
          throw new Error("The canonical publication did not preserve the original cases and unrelated outbox")
      } finally { authority.ui.finish(call) }
    } finally {
      // This facade only owns its bindings and caches; the installed authority,
      // persistence and native runtime remain owned by the original installation.
      business.dispose()
    }
  })().then(
    () => { process.stdout.write("SF_NATIVE_MEMORY_COMMITTED\n") },
    () => {
      if (!stop.signal.aborted) {
        // Credentials, case identifiers and private content never cross stdout.
        process.stderr.write("Native memory fixture preparation failed\n")
        process.stdout.write("SF_NATIVE_MEMORY_FAILED " + progress.stage + " " + progress.reason + "\n")
      }
    },
  )
  return {
    ...installed,
    async dispose() {
      stop.abort()
      await preparation
      await installed.dispose()
    },
  }
}

async function readPreparation(signal: AbortSignal): Promise<Preparation> {
  const reader = Bun.stdin.stream().getReader()
  const cancel = () => { void reader.cancel().catch(() => undefined) }
  signal.addEventListener("abort", cancel, { once: true })
  const chunks: Uint8Array[] = []
  const size = { value: 0 }
  try {
    for (;;) {
      const next = await reader.read()
      if (signal.aborted) throw new Error("Memory preparation was cancelled")
      if (next.done) break
      size.value += next.value.byteLength
      if (size.value > 8192) throw new Error("Memory preparation input exceeds its private bound")
      chunks.push(next.value)
    }
    const raw: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(Buffer.concat(chunks)))
    if (!raw || typeof raw !== "object" || Array.isArray(raw) || Object.keys(raw).length !== 2 ||
        !("cookie" in raw) || typeof raw.cookie !== "string" || !raw.cookie || raw.cookie.length > 4096 ||
        !("caseRef" in raw) || !raw.caseRef || typeof raw.caseRef !== "object" || Array.isArray(raw.caseRef) ||
        Object.keys(raw.caseRef).length !== 3 || !("id" in raw.caseRef) || typeof raw.caseRef.id !== "string" || !raw.caseRef.id ||
        !("incarnation" in raw.caseRef) || typeof raw.caseRef.incarnation !== "string" || !raw.caseRef.incarnation ||
        !("version" in raw.caseRef) || typeof raw.caseRef.version !== "number" || !Number.isSafeInteger(raw.caseRef.version) || raw.caseRef.version < 1)
      throw new Error("Memory preparation requires the original operator session and exact case reference")
    return { cookie: raw.cookie, caseRef: { id: raw.caseRef.id, incarnation: raw.caseRef.incarnation, version: raw.caseRef.version } }
  } finally {
    signal.removeEventListener("abort", cancel)
    await reader.cancel().catch(() => undefined)
    reader.releaseLock()
  }
}
