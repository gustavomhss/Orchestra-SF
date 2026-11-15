import { createSfPortfolioHttp } from "../portfolio-http.ts"

/**
 * A05 / source port adapter. Only the ten catalogued POST JSON operations are
 * associated with this family. The original producer performs all ingress,
 * origin/CSRF checks, human admission, case CAS, source replay and refusal
 * serialization. Do not rebuild or clone Request or reimplement an engine here.
 *
 * I00 mounts this through the existing F02 native router after its identity
 * ingress guard and installation selection. This is not another HTTP server.
 */
export const sfPortfolioNativeOperations = Object.freeze({
  "portfolio.decision-portfolio-evaluate": "decision-portfolio-evaluate",
  "portfolio.decision-portfolio-preview": "decision-portfolio-preview",
  "portfolio.decision-portfolio-read": "decision-portfolio-read",
  "portfolio.decision-portfolio-reconcile": "decision-portfolio-reconcile",
  "portfolio.decision-portfolio-results": "decision-portfolio-results",
  "portfolio.decision-prepare-portfolio": "decision-prepare-portfolio",
  "portfolio.decision-promote-portfolio": "decision-promote-portfolio",
  "portfolio.decision-sensitivity-evaluate": "decision-sensitivity-evaluate",
  "portfolio.decision-sensitivity-read": "decision-sensitivity-read",
  "portfolio.decision-sensitivity-units": "decision-sensitivity-units",
} as const)

export type SfPortfolioNativeOperationId = keyof typeof sfPortfolioNativeOperations

/**
 * Delegates the ORIGINAL Request to the legacy JSON producer. Malformed known
 * operations (duplicate sf, extra query keys, wrong method/body) deliberately
 * reach the original validator, which refuses them. Unknown operations stay
 * outside this adapter and must be rejected by the closed F02 router.
 */
export function createSfPortfolioNativeAdapter(input: Parameters<typeof createSfPortfolioHttp>[0]) {
  const producer = createSfPortfolioHttp(input)
  const accepted = new Set<string>(Object.values(sfPortfolioNativeOperations))
  return (request: Request, surface: string): Promise<Response | undefined> => {
    const selected = new URL(request.url).searchParams.get("sf")
    if (!selected || !accepted.has(selected)) return Promise.resolve(undefined)
    return producer(request, surface)
  }
}
