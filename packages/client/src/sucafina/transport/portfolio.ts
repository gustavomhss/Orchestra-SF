import { Option, Schema } from "effect"
import type { SfOperationId } from "@orchestra/schema/sucafina/common"
import { SfPortfolio } from "@orchestra/schema/sucafina/portfolio"

/**
 * A05's original portfolio HTTP consumer accepts the installed dashboard page.
 * Its closed input has no route selector. Resolve that page separately from the
 * unchanged source input; this is neither producer readiness nor an IO grant.
 */
export function sfPortfolioSourceSurface(
  operationId: SfOperationId,
  input: unknown,
): "dashboard" | undefined {
  const source = Object.values(SfPortfolio).find((operation) => operation.operationId === operationId)
  if (!source) return undefined
  const schema: Schema.Top = source.input
  const parsed = Schema.decodeUnknownOption(Schema.toType(schema), { onExcessProperty: "error" })(input)
  return Option.isSome(parsed) ? "dashboard" : undefined
}
