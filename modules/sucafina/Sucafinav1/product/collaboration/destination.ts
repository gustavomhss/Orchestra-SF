import { digestSfValue } from "../contracts/canonical.ts"
import type { WorkListRequest } from "../contracts/operations.ts"
import type { DomainPortHost, PortResult } from "../contracts/ports.ts"
import type { TrustedDomainContext } from "../contracts/sf-execution.ts"
import type { createCollaborationWorkPort, WorkPresentationItem } from "./work-port.ts"

type Destination = NonNullable<WorkPresentationItem["destination"]>

/** The domain resolves its own current destination; collaboration never constructs a URL from an id. */
export function createWorkDestinationResolver(input: {
  work: Pick<ReturnType<typeof createCollaborationWorkPort>, "listPresentation">
  host: Pick<DomainPortHost, "revalidate">
  origin: string
  mount: string
  resolveDestination: (destination: Destination, context: TrustedDomainContext) => Promise<PortResult<{ href: string }>>
}) {
  return async (selection: WorkListRequest, actionRef: string, context: TrustedDomainContext): Promise<PortResult<{ href: string }>> => {
    if (typeof actionRef !== "string" || !actionRef.trim()) return { status: "unavailable", reason: "work-destination-unavailable" }
    const listed = await input.work.listPresentation(selection, context)
    if (listed.status !== "ok") return listed
    const matches = listed.value.items.filter((item) => item.actionRef === actionRef)
    const selected = matches[0]
    if (!selected?.destination || matches.length !== 1) return { status: "unavailable", reason: "work-destination-unavailable" }
    const located = await input.resolveDestination(selected.destination, context)
    if (located.status !== "ok") return located
    const href = located.value.href
    if (typeof href !== "string" || !href.trim() || href !== href.trim() || href.startsWith("//") || href.includes("\\") || href.includes("#") || /%2f|%5c/i.test(href) || !URL.canParse(input.origin) || !URL.canParse(href, input.origin)) return { status: "unavailable", reason: "work-destination-unavailable" }
    const origin = new URL(input.origin)
    const target = new URL(href, origin)
    if (!input.mount.startsWith("/") || (input.mount !== "/" && input.mount.endsWith("/")) || input.mount.includes("//") || input.mount.includes("\\") || /%2f|%5c|%2e/i.test(input.mount) || input.mount.split("/").some((part) => part === "." || part === "..") || origin.origin !== target.origin || origin.username || origin.password || origin.hash || origin.search || origin.pathname !== "/" || target.username || target.password || target.hash || (input.mount !== "/" && target.pathname !== input.mount && !target.pathname.startsWith(`${input.mount}/`))) return { status: "unavailable", reason: "work-destination-unavailable" }
    const again = await input.work.listPresentation(selection, context)
    if (again.status !== "ok") return { status: "unavailable", reason: "work-destination-unavailable" }
    const confirmed = again.value.items.filter((item) => item.actionRef === actionRef)
    if (confirmed.length !== 1 || digestSfValue(confirmed[0]) !== digestSfValue(selected) || !await input.host.revalidate(context)) return { status: "unavailable", reason: "work-destination-unavailable" }
    return { status: "ok", value: { href: `${target.pathname}${target.search}` } }
  }
}
