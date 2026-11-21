import {
  SfPortfolioDecisionPortfolioEvaluate,
  SfPortfolioDecisionPortfolioPreview,
  SfPortfolioDecisionPortfolioRead,
  SfPortfolioDecisionPortfolioReconcile,
  SfPortfolioDecisionPortfolioResults,
  SfPortfolioDecisionPreparePortfolio,
  SfPortfolioDecisionPromotePortfolio,
  SfPortfolioDecisionSensitivityEvaluate,
  SfPortfolioDecisionSensitivityRead,
  SfPortfolioDecisionSensitivityUnits,
} from "@orchestra/schema/sucafina/portfolio"
import type { Schema } from "effect"
import type { SfCallOptions, SfTransport } from "./transport"

/**
 * A05: the ten source-locked portfolio/sensitivity calls.
 *
 * F02 alone owns URLs, origin, authentication, owner generation, abort handling,
 * idempotency keys and transport outcomes. No retry (especially after submit)
 * occurs here. Returned HTTP statuses, producer refusal reasons and canonical
 * envelopes stay intact; these methods do not interpret a read as a permission.
 */
export function createSfPortfolioClient(transport: SfTransport) {
  return Object.freeze({
    "portfolio.decision-portfolio-evaluate": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionPortfolioEvaluate.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionPortfolioEvaluate, input, options),
    "portfolio.decision-portfolio-preview": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionPortfolioPreview.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionPortfolioPreview, input, options),
    "portfolio.decision-portfolio-read": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionPortfolioRead.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionPortfolioRead, input, options),
    "portfolio.decision-portfolio-reconcile": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionPortfolioReconcile.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionPortfolioReconcile, input, options),
    "portfolio.decision-portfolio-results": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionPortfolioResults.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionPortfolioResults, input, options),
    "portfolio.decision-prepare-portfolio": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionPreparePortfolio.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionPreparePortfolio, input, options),
    "portfolio.decision-promote-portfolio": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionPromotePortfolio.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionPromotePortfolio, input, options),
    "portfolio.decision-sensitivity-evaluate": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionSensitivityEvaluate.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionSensitivityEvaluate, input, options),
    "portfolio.decision-sensitivity-read": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionSensitivityRead.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionSensitivityRead, input, options),
    "portfolio.decision-sensitivity-units": (
      input: Schema.Schema.Type<typeof SfPortfolioDecisionSensitivityUnits.input>, options: SfCallOptions,
    ) => transport.execute(SfPortfolioDecisionSensitivityUnits, input, options),
  })
}

export type SfPortfolioClient = ReturnType<typeof createSfPortfolioClient>
