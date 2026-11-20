import { Option, Schema } from "effect"

const text = Schema.String.check(Schema.isMinLength(1))
const nonnegative = Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))
const result = Schema.Union([
  Schema.Struct({ ok: Schema.Literal(true), value: Schema.optionalKey(Schema.Unknown),
    warnings: Schema.optionalKey(Schema.Array(Schema.String)) }),
  Schema.Struct({ ok: Schema.Literal(false), status: Schema.Literals([400, 403, 404, 409, 422, 503]),
    errors: Schema.optionalKey(Schema.Array(Schema.String)),
    fieldErrors: Schema.optionalKey(Schema.Array(Schema.Struct({ field: Schema.String, message: Schema.String }))),
    stored: Schema.optionalKey(Schema.Unknown), by: Schema.optionalKey(Schema.String),
    currentVersionCAS: Schema.optionalKey(nonnegative) }),
])
const receipt = Schema.Struct({
  id: text, idempotencyKey: text, commandDigest: Schema.String.check(Schema.isPattern(/^[a-f0-9]{64}$/)),
  targetIncarnation: text, principalRef: text, surface: Schema.Literal("dashboard"),
  version: nonnegative, at: text, result,
})
export type SfDashboardApplicationOutcome = Readonly<{
  id: string; at: string; version: number; status: "applied" | "conflict" | "failed"
}>

/** A generic status:ok or a partial result is not an original CommandReceipt.
 * All authority and exact-intent proof remains in the canonical receipt reader.
 */
export function decodeSfDashboardApplicationOutcome(value: unknown, principalRef: string): SfDashboardApplicationOutcome | undefined {
  const decoded = Schema.decodeUnknownOption(receipt, { onExcessProperty: "error" })(value)
  if (Option.isNone(decoded) || decoded.value.principalRef !== principalRef ||
    !Number.isFinite(Date.parse(decoded.value.at))) return
  const original = decoded.value
  return { id: original.id, at: original.at, version: original.version,
    status: original.result.ok ? "applied" : original.result.status === 409 ? "conflict" : "failed" }
}
