import { AsyncLocalStorage } from "node:async_hooks"
import { digestSfValue } from "../contracts/canonical.ts"
import type { DomainPortHost } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"

export type PortfolioReadHost = Pick<DomainPortHost, "revalidate"> & Partial<Pick<DomainPortHost, "persistence" | "requestFor">>
type Scope = { persistence: DomainPortHost["persistence"]; request: Request; authority: string; open: boolean }
const reads = new AsyncLocalStorage<Scope>()

/** A real host reads the complete proof under one fresh LocalStore snapshot.
 * Nested readers may join only a root created here. The outer transaction must
 * accept every nested read before its value escapes; a swallowed write poisons it.
 * Ports without persistence keep their existing independent observation contract.
 * This does not give remote evidence providers snapshot or authorization semantics. */
export async function readPortfolioSnapshot<T extends boolean | { status: string }>(host: PortfolioReadHost, context: TrustedDomainContext, incoming: unknown, work: () => Promise<T>, refused: T): Promise<T> {
  if (!host.persistence || !host.requestFor) return work()
  try {
    const persistence = host.persistence
    const transaction = persistence.transaction
    const currentSnapshots = persistence.currentSnapshots
    const requestFor = host.requestFor
    const revalidate = host.revalidate
    const request = requestFor.call(host, context)
    if (!request || request.signal.aborted || !currentSnapshots) return refused
    const authority = digestSfValue({ kind: context.kind, binding: context.binding })
    const payload = digestSfValue(incoming)
    const fingerprint = () => {
      const headers: [string, string][] = []
      request.headers.forEach((value, name) => headers.push([name, value]))
      return digestSfValue({ method: request.method, url: request.url, headers: headers.sort(([left], [right]) => left.localeCompare(right)) })
    }
    const source = fingerprint()
    const unchanged = () => !request.signal.aborted && host.persistence === persistence && host.requestFor === requestFor && host.revalidate === revalidate &&
      persistence.transaction === transaction && persistence.currentSnapshots === currentSnapshots && requestFor.call(host, context) === request && fingerprint() === source &&
      digestSfValue({ kind: context.kind, binding: context.binding }) === authority && digestSfValue(incoming) === payload
    const inherited = reads.getStore()
    if (currentSnapshots.call(persistence)) {
      if (!inherited?.open || inherited.persistence !== persistence || inherited.request !== request || inherited.authority !== authority || !unchanged()) return refused
      const value = await work()
      if (typeof value === "boolean" ? !value : value.status !== "ok") return value
      return unchanged() && await revalidate.call(host, context) && unchanged() && inherited.open ? value : refused
    }
    const scope = { persistence, request, authority, open: true }
    let invocations = 0
    let accepted = false
    try {
      const result = await persistence.transaction<{ valid: true; value: T } | { valid: false }>("dashboard", async () => reads.run(scope, async () => {
        invocations++
        if (invocations !== 1 || !currentSnapshots.call(persistence) || !unchanged()) return { commit: false, value: { valid: false as const } }
        const value = await work()
        const rejected = typeof value === "boolean" ? !value : value.status !== "ok"
        accepted = unchanged() && (rejected || await revalidate.call(host, context)) && unchanged() && !!currentSnapshots.call(persistence)
        return { commit: false, value: accepted ? { valid: true as const, value } : { valid: false as const } }
      }), { signal: request.signal })
      // No external awaited callback may follow this point. LocalStore already
      // rejected poisoned/unjoined reads before returning this captured value.
      return accepted && invocations === 1 && unchanged() && result.valid ? result.value : refused
    } finally {
      scope.open = false
    }
  } catch {
    return refused
  }
}
