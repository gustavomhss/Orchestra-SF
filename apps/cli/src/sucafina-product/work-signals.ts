import { createHmac } from "node:crypto"
import { digestSfValue } from "../../../../modules/sucafina/Sucafinav1/product/contracts/canonical.ts"
import type { WorkSignals } from "../../../../modules/sucafina/Sucafinav1/product/collaboration/work-port.ts"
import { encodeCaseRef } from "../../../../modules/sucafina/Sucafinav1/product/decisions/case-port.ts"
import { createSfWorkRefIssuer, createSfWorkSignalList } from "../../../../modules/sucafina/Sucafinav1/product/decision-memory/signal-work.ts"
import type { createSfBusinessServices } from "./business-services.ts"
import type { createSfMemoryServices } from "./memory-services.ts"

/** Root-private derivation from the already configured durable asset key. */
export function deriveSfWorkRefKey(installationId: string, signingKey: Uint8Array | undefined) {
  return installationId.trim() && signingKey && signingKey.length >= 32
    ? new Uint8Array(createHmac("sha256", signingKey).update("sf-host-work-key-v1\0").update(installationId).digest()) : undefined
}

type CaseRef = { id: string; incarnation: string; version: number }

/** A work selection owns its actual case scope for one complete canonical C17 read. */
export function createSfWorkSignals(input: {
  business: Pick<ReturnType<typeof createSfBusinessServices>, "host" | "cases" | "context" | "collaboration" | "withCase">
  memory: Pick<ReturnType<typeof createSfMemoryServices>, "registry" | "materiality">
  origin: string
  mount: string
  workRefKey: Uint8Array | undefined
}): WorkSignals {
  const { business, memory } = input
  const host = business.host
  const issuer = input.workRefKey ? createSfWorkRefIssuer({ key: new Uint8Array(input.workRefKey), revalidate: host.revalidate }) : undefined
  return async (selectionRef, period, call) => {
    const source = host.requestFor(call)
    const identity = source && requestIdentity(source), binding = digestSfValue([call.kind, call.binding])
    const current = () => !!source && !source.signal.aborted && host.requestFor(call) === source && requestIdentity(source) === identity &&
      digestSfValue([call.kind, call.binding]) === binding
    try {
      if (!issuer || !current() || !await host.revalidate(call)) return { status: "unavailable" }
      const selected = await business.collaboration.caseSelection?.resolveCase(selectionRef, period, call)
      if (selected?.status !== "ok" || !current()) return { status: "unavailable" }
      const caseRef = structuredClone(selected.caseRef)
      let refused = false
      const canonical = createSfWorkSignalList({ host, cases: business.cases, registry: memory.registry,
        materiality: (id, context) => memory.materiality(caseRef, id, context), issueWorkRef: issuer,
        resolveSelection: async (ref, requested, context) => {
          const found = await business.collaboration.caseSelection?.resolveCase(ref, requested, context)
          return context === call && found?.status === "ok" && digestSfValue(found.caseRef) === digestSfValue(caseRef) && current()
            ? found : { status: "unavailable" }
        },
        authorizeBinding: async (record, projection, refs, context) => {
          const scope = await business.collaboration.selections.resolve(selectionRef, period, context)
          const membership = scope.status === "ok" ? await business.collaboration.selections.contains(scope.value, refs, context) : undefined
          const evidence = await business.context.context({ refs }, context)
          const allowed = context === call && current() && record.selection.recipientRef === context.binding.principalRef &&
            record.selection.caseRef.id === caseRef.id && record.selection.caseRef.incarnation === caseRef.incarnation &&
            record.selection.caseRef.version <= caseRef.version && projection.case.version === caseRef.version &&
            !!sfWorkCaseDestination(record.selection.destination, caseRef, input) && membership?.status === "ok" && membership.value &&
            refs.length > 0 && evidence.length === refs.length && evidence.every((entry, index) => entry.state === "fresh" &&
              !!entry.authorizedProjection && !!entry.currentRef && entry.accessRevision === context.binding.accessRevision &&
              digestSfValue(entry.ref) === digestSfValue(refs[index]) && digestSfValue(entry.currentRef) === digestSfValue(entry.ref)) &&
            await host.revalidate(call) && current()
          if (!allowed) refused = true
          return allowed
        },
      })
      const read = async () => {
        const result = await canonical(selectionRef, period, call)
        return result.status === "ok" && !refused && current() ? { status: "ok" as const, value: result.signals }
          : { status: "unavailable" as const, reason: "work-signals-unavailable" }
      }
      if (call.kind === "native" && (call.binding.caseId !== caseRef.id || call.binding.caseIncarnation !== caseRef.incarnation || call.binding.caseVersion !== caseRef.version))
        return { status: "unavailable" }
      const result = call.kind === "ui" ? await business.withCase(call, caseRef, {}, read) : await read()
      return result.status === "ok" && !refused && await host.revalidate(call) && current()
        ? { status: "ok", signals: structuredClone(result.value) } : { status: "unavailable" }
    } catch { return { status: "unavailable" } }
  }
}

/** Persisted destinations may only reopen the exact, currently authorized case. */
export function sfWorkCaseDestination(value: string, caseRef: CaseRef, input: { origin: string; mount: string }) {
  if (typeof value !== "string" || !value.trim() || value !== value.trim() || value.startsWith("//") || value.includes("\\") || value.includes("#") ||
    /%2f|%5c/i.test(value) || !URL.canParse(value, input.origin)) return undefined
  const url = new URL(value, input.origin)
  if (url.origin !== input.origin || url.username || url.password || url.hash ||
    !["dashboard", "planner", "procurement"].some((surface) => url.pathname === `${input.mount}/${surface}`) ||
    [...url.searchParams.keys()].some((key) => !["sf", "caseRef"].includes(key) || url.searchParams.getAll(key).length !== 1) ||
    url.searchParams.get("sf") !== "workbench-case" || url.searchParams.get("caseRef") !== encodeCaseRef(caseRef)) return undefined
  return `${url.pathname}${url.search}`
}

function requestIdentity(request: Request) { return digestSfValue({ method: request.method, url: request.url, headers: [...request.headers] }) }
