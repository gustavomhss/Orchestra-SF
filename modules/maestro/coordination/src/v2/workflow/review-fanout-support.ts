export * as ReviewFanoutSupportV2 from "./review-fanout-support"

import { Effect } from "effect"
import { ReviewCatalog } from "@orchestra/core/review/catalog"
import { ReviewRoute } from "@orchestra/core/review/route"
import { ReviewRouting } from "@orchestra/core/review/routing"
import { Tool } from "@orchestra/core/tool/tool"
import type { ReviewResultV2 } from "../../governance/review-result"
import type { ReviewFanoutV2 } from "./review-fanout"

type Input = ReviewFanoutV2.Input
type Tier = ReviewCatalog.Catalog["route"]["tiers"][number]
type Lens = ReviewRouting.Lens
type Entry = Extract<ReviewResultV2.EntryRecord, { status: "eligible" }>

type Routed = {
  readonly record: ReviewRouting.Record
  readonly runs: (lens: Lens, open: ReadonlyArray<{ readonly lens: string }>) => boolean
}

export function routeOf(input: Input) {
  return Effect.try({
    try: (): Routed => {
      const delta = ReviewRoute.route(input.request, input.base, input.head, input.catalog)
      const first = input.firstRound?.routing
      if (!first) return { record: delta, runs: () => true }
      // A rereview reuses the first round's route; the delta can only add lenses and packs to it.
      const fresh = delta.lenses.filter((lens) => !first.lenses.some((other) => other.id === lens.id))
      const record: ReviewRouting.Record = {
        ...first,
        profile: delta.profile,
        lenses: [...first.lenses, ...fresh],
        packs: [...first.packs, ...delta.packs.filter((pack) => !first.packs.some((other) => other.id === pack.id))],
        deviations: [],
      }
      return {
        record,
        runs: (lens: Lens, open: ReadonlyArray<{ readonly lens: string }>) =>
          open.some((finding) => finding.lens === lens.id) || fresh.some((other) => other.id === lens.id),
      }
    },
    catch: (error) =>
      new Tool.Failure({
        message:
          error instanceof ReviewRoute.RouteError
            ? `ReviewRequestRejected: ${error.code}. ${error.message}`
            : `ReviewRequestRejected: route-failed. ${String(error)}`,
      }),
  })
}

// Model additions are appended with their quotes; a confirmed or added overlay routes its lenses and packs.
export function applyEntry(record: ReviewRouting.Record, entry: Entry, catalog: ReviewCatalog.Catalog) {
  const overlays = record.overlays.map((overlay): ReviewRouting.Overlay => {
    if (overlay.source !== "content") return overlay
    const confirmed = entry.overlays.confirmed.find((item) => item.id === overlay.id)
    if (confirmed) return { ...overlay, confirmed: confirmed.quote }
    const declined = entry.overlays.declined.find((item) => item.id === overlay.id)
    return declined ? { ...overlay, declined: declined.reason } : overlay
  })
  const known = (id: string) => catalog.overlays.some((overlay) => overlay.id === id)
  const added = entry.overlays.added.filter((item) => known(item.id) && !overlays.some((overlay) => overlay.id === item.id))
  const confirmed = entry.overlays.confirmed.filter((item) =>
    record.overlays.some((overlay) => overlay.id === item.id && overlay.source === "content"),
  )
  const routedBy = [...confirmed, ...added]
  const lenses = routedBy.flatMap((item) =>
    (catalog.overlays.find((overlay) => overlay.id === item.id)?.lenses ?? []).map((id) => ({ id, because: `overlay:${item.id}`, quote: item.quote })),
  )
  const order = catalog.route.tiers.map((tier) => tier.id)
  const raise = entry.raise && order.indexOf(entry.raise.tier) === order.indexOf(record.tier.id) + 1 ? entry.raise : undefined
  const profile = catalog.route.profiles.find((item) => item.id === record.profile.id)
  const raised = raise
    ? (profile?.lenses[runTier(catalog, raise.tier).id] ?? []).map((id) => ({ id, because: `tier:${raise.tier}`, quote: raise.quote }))
    : []
  const appended = [...lenses, ...raised]
    .filter((lens, index, all) => all.findIndex((other) => other.id === lens.id) === index)
    .filter((lens) => !record.lenses.some((other) => other.id === lens.id))
    .flatMap((lens): ReviewRouting.Lens[] => {
      const node = catalog.lenses.find((item) => item.id === lens.id)?.node
      return node ? [{ id: lens.id, node, because: lens.because, source: "model", quote: lens.quote }] : []
    })
  const packs = routedBy
    .flatMap((item) => (catalog.overlays.find((overlay) => overlay.id === item.id)?.checks ?? []).map((id) => ({ id, quote: item.quote })))
    .filter((pack, index, all) => all.findIndex((other) => other.id === pack.id) === index)
    .filter((pack) => !record.packs.some((other) => other.id === pack.id))
    .flatMap((pack): ReviewRouting.Pack[] => {
      const lane = catalog.packs.find((item) => item.id === pack.id)?.lane
      return lane ? [{ id: pack.id, lane, status: "routed", source: "model", quote: pack.quote }] : []
    })
  return {
    record: {
      ...record,
      tier: raise ? { ...record.tier, raise: { id: raise.tier, source: "model" as const, quote: raise.quote } } : record.tier,
      overlays: [...overlays, ...added.map((item): ReviewRouting.Overlay => ({ id: item.id, source: "model", quote: item.quote }))],
      lenses: [...record.lenses, ...appended],
      packs: [...record.packs, ...packs],
    },
    deviations: [
      ...entry.overlays.added
        .filter((item) => !known(item.id))
        .map((item) => deviation("entry", "overlay-unknown", `the lead added overlay ${item.id}, which the catalog lacks`)),
      ...(entry.raise && !raise
        ? [deviation("entry", "raise-refused", `the lead asked for tier ${entry.raise.tier}; only one step above ${record.tier.id} is allowed`)]
        : []),
    ],
  }
}

export function runTier(catalog: ReviewCatalog.Catalog, id: string): Tier {
  const tier = catalog.route.tiers.find((item) => item.id === id)
  const run = tier?.built ? tier : catalog.route.tiers.find((item) => item.id === tier?.runs && item.built)
  if (!run) throw new Error(`Review tier ${id} has no built tier to run`)
  return run
}

export function deviation(stage: ReviewRouting.Deviation["stage"], kind: string, detail: string, session?: string): ReviewRouting.Deviation {
  return { kind, stage, detail, ...(session ? { session } : {}) }
}
