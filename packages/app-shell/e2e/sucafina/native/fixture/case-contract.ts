/** Closed original case inventory. Registration never means execution or a grant. */
export type NativeInstalledSuite = "U15" | "U39" | "U40"
export type NativeInstalledCase = "list" | "editable" | "denied" | "stale" | "lost" | "entry" | "empty" | "source" | "readonly" | "revoked" | "late"
export const nativeTitles = {
  "U15": [
    "CAP14 real authorized list reads Dashboard contracts and keeps filters on filtered-empty",
    "CAP14 real edit uses source version and only dashboard save; confirms after authorized reread",
    "CAP14 real denied second actor displays no unauthorized contract values or write control",
    "CAP14 real version conflict cannot be shown saved",
    "CAP14 real lost response does not automatically replay the command",
    "CAP14 real owner-scoped 320px reflow and keyboard reachability"
  ],
  "U39": [
    "reads the source through A01 with owner-scoped state, filter-empty and source metadata",
    "new record is a draft until explicit, version-bound change review",
    "320–1440 viewports, 200% typography and 400% reflow keep surface controls reachable",
    "206-AC01 create/edit/delete producer owner CAS and removed detail do not become an empty collection",
    "206-AC01 monthly entry create/edit preserves exact budget, actual, forecast, month and CAS",
    "206-AC01 annual distribution fields use producer's twelve rows and original versions",
    "206-AC01 year amount records hint, actual/forecast, clearing and immutable monthly source",
    "206-AC01 deviation severity and text use one original versioned record",
    "206-AC02 filter survives list/detail/back, source record remains selected and source metadata is original",
    "206-AC02 a genuinely empty original collection is empty, not filtered-empty, partial or not-found",
    "206-AC02 not-found deep link is distinct from empty and never resurrects a removed record",
    "206-AC01 authorized producer source link and 2026 identity, with CAP04-only import control",
    "206-AC02 real read-only principal sees source but no enabled mutation or private false affordance",
    "206-AC02 denied original Microsoft actor never renders private rows, draft or edit, and denial is not empty",
    "206-AC02 real producer revocation while editing erases private draft after a new host read",
    "206-AC02 real 409 with concurrent authenticated editor blocks stale review; no optimistic overwrite",
    "206-AC02 validation error does not dispatch and preserves missing, zero and original editor text",
    "206-AC02 real held producer POST is visibly submitting/pending, double confirmation cannot dispatch",
    "206-AC02 lost response remains outcome-unknown until original authorized refetch, never auto-retry",
    "206-AC02 late original GET after different Team/installation never leaks prior draft or owner",
    "206-AC03 complete forms, actions and keyboard at 320/768/1024/1280/1440 plus 200/400 percent reflow",
    "206-AC01 CAP04/CAP05 owner, project status, annual/monthly and deviation values mirror the source without totals"
  ],
  "U40": [
    "reads the source through A01 with owner-scoped state, filter-empty and source metadata",
    "new record is a draft until explicit, version-bound change review",
    "320–1440 viewports, 200% typography and 400% reflow keep surface controls reachable",
    "206-AC01 create/edit/delete producer owner CAS and removed detail do not become an empty collection",
    "206-AC01 monthly entry create/edit preserves exact budget, actual, forecast, month and CAS",
    "206-AC01 annual distribution fields use producer's twelve rows and original versions",
    "206-AC01 year amount records hint, actual/forecast, clearing and immutable monthly source",
    "206-AC01 deviation severity and text use one original versioned record",
    "206-AC02 filter survives list/detail/back, source record remains selected and source metadata is original",
    "206-AC02 a genuinely empty original collection is empty, not filtered-empty, partial or not-found",
    "206-AC02 not-found deep link is distinct from empty and never resurrects a removed record",
    "206-AC01 authorized producer source link and 2026 identity, with CAP04-only import control",
    "206-AC02 real read-only principal sees source but no enabled mutation or private false affordance",
    "206-AC02 denied original Microsoft actor never renders private rows, draft or edit, and denial is not empty",
    "206-AC02 real producer revocation while editing erases private draft after a new host read",
    "206-AC02 real 409 with concurrent authenticated editor blocks stale review; no optimistic overwrite",
    "206-AC02 validation error does not dispatch and preserves missing, zero and original editor text",
    "206-AC02 real held producer POST is visibly submitting/pending, double confirmation cannot dispatch",
    "206-AC02 lost response remains outcome-unknown until original authorized refetch, never auto-retry",
    "206-AC02 late original GET after different Team/installation never leaks prior draft or owner",
    "206-AC03 complete forms, actions and keyboard at 320/768/1024/1280/1440 plus 200/400 percent reflow",
    "206-AC01 CAP04/CAP05 owner, project status, annual/monthly and deviation values mirror the source without totals"
  ]
} as const

export const nativeSuiteCases = {
  U15: ["list", "editable", "denied", "stale", "lost"],
  U39: ["entry", "empty", "source", "readonly", "denied", "revoked", "stale", "late"],
  U40: ["entry", "empty", "source", "readonly", "denied", "revoked", "stale", "late"],
} as const
export const nativeSuiteCapability = { U15: "CAP14", U39: "CAP04", U40: "CAP05" } as const
const u15 = ["list", "editable", "denied", "stale", "lost", "list"] as const
const budget = ["entry", "entry", "entry", "entry", "entry", "entry", "entry", "entry", "entry",
  "empty", "entry", "source", "readonly", "denied", "revoked", "stale", "entry", "entry", "entry", "late", "entry", "entry"] as const
export function nativeSelectedCase(suite: NativeInstalledSuite, title: string): NativeInstalledCase {
  const at = nativeTitles[suite].findIndex((value) => value === title)
  if (at < 0) throw new Error("F04_UNKNOWN_ORIGINAL_CASE_TITLE")
  return (suite === "U15" ? u15 : budget)[at]!
}
export function nativeCaseIntent(caseId: NativeInstalledCase): "read" | "edit" | "denied" {
  if (caseId === "denied") return "denied"
  if (["list", "empty", "source", "readonly"].includes(caseId)) return "read"
  return "edit"
}
export function nativeRole(suite: NativeInstalledSuite): "u15" | "u39" | "u40" {
  return suite === "U15" ? "u15" : suite === "U39" ? "u39" : "u40"
}
