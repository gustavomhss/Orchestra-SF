export * as ReviewRoundV2 from "./review-round"

import { Option, Schema } from "effect"
import { ReviewCatalog } from "@orchestra/core/review/catalog"
import { ReviewRouting } from "@orchestra/core/review/routing"
import type { MaestroEvent } from "@orchestra/schema/maestro-event"
import { ReviewResultV2 } from "../governance/review-result"

// Durable host routing on the receipt. Not a private store, a model input, or a card parse.

export const VERSION = "host-round-v1"
export const LIMIT = 4 * 1024 * 1024

const decodeRouting = Schema.decodeUnknownOption(ReviewRouting.Record)
const decodeJson = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)
const decodeFinding = Schema.decodeUnknownOption(ReviewResultV2.Finding)
const strict = { onExcessProperty: "error" } as const

export type HostRound = { readonly version: typeof VERSION; readonly routing: string }

type Bound = {
  readonly reviewMethodVersion: string
  readonly routingDigest: string | undefined
  readonly catalogDigest: string | undefined
}

export function publish(routing: ReviewRouting.Record, bound: Bound):
  | { readonly status: "ok"; readonly hostRound: HostRound }
  | { readonly status: "corrupt" | "mismatch" | "too-large" } {
  const decoded = Option.getOrUndefined(decodeRouting(routing, strict))
  if (!decoded) return { status: "corrupt" }
  if (!agrees(decoded, bound)) return { status: "mismatch" }
  const text = canonicalJson(decoded)
  if (Buffer.byteLength(text, "utf8") > LIMIT) return { status: "too-large" }
  return { status: "ok", hostRound: { version: VERSION, routing: text } }
}

export function read(receipt: {
  readonly reviewMethodVersion: string
  readonly routingDigest?: string
  readonly catalogDigest?: string
  readonly hostRound?: HostRound
  readonly findings: ReadonlyArray<MaestroEvent.Review.Finding>
}):
  | { readonly status: "ok"; readonly routing: ReviewRouting.Record; readonly findings: ReadonlyArray<ReviewResultV2.Finding> }
  | { readonly status: "unavailable" | "corrupt" | "mismatch" } {
  if (!receipt.hostRound) return { status: "unavailable" }
  if (receipt.hostRound.version !== VERSION || Buffer.byteLength(receipt.hostRound.routing, "utf8") > LIMIT)
    return { status: "corrupt" }
  const routing = Option.getOrUndefined(Option.flatMap(decodeJson(receipt.hostRound.routing), (value) => decodeRouting(value, strict)))
  if (!routing) return { status: "corrupt" }
  if (!agrees(routing, receipt)) return { status: "mismatch" }
  const findings = receipt.findings.flatMap((finding) => Option.toArray(decodeFinding(finding, strict)))
  if (findings.length !== receipt.findings.length) return { status: "corrupt" }
  return { status: "ok", routing, findings }
}

function agrees(routing: ReviewRouting.Record, bound: Bound) {
  const tier = builtTier(ReviewRouting.tier(routing))
  const catalog = bound.catalogDigest?.replace(/^sha256:/, "")
  if (!tier || bound.routingDigest === undefined || catalog === undefined) return false
  if (ReviewResultV2.method({ profile: routing.profile.id, tier }) !== bound.reviewMethodVersion) return false
  if (bound.routingDigest !== ReviewRouting.digest(routing)) return false
  return catalog === routing.catalog
}

// The method names the built tier `ReviewRouting.tier` runs. An unbuilt raise still records that built tier.
function builtTier(id: string) {
  const tier = ReviewCatalog.current.route.tiers.find((item) => item.id === id)
  if (tier?.built) return tier.id
  return ReviewCatalog.current.route.tiers.find((item) => item.id === tier?.runs && item.built)?.id
}

function canonicalJson(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(",")}]`
  if (value && typeof value === "object") {
    return `{${Object.entries(value)
      .filter((item) => item[1] !== undefined)
      .sort((left, right) => (left[0] < right[0] ? -1 : left[0] > right[0] ? 1 : 0))
      .map((item) => `${JSON.stringify(item[0])}:${canonicalJson(item[1])}`)
      .join(",")}}`
  }
  return JSON.stringify(value)
}
