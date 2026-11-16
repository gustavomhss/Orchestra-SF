import { inspectProof233Hosted, type HostedInput233 } from "./hosted-driver.ts"

/**
 * Read-only operator:
 * bun modules/sucafina/Sucafinav1/test/product/proof233/driver.ts /protected/verified-actions-input.json
 * The input MUST originate from authenticated GitHub Actions readbacks supplied
 * by the authorized dispatcher, never from a locally manufactured provider log.
 *
 * A zero exit below means ONLY the submitted envelope has no structural gaps;
 * it is NEVER AM01/AM02/AM03 PASS or C/G7/D/G8 approval.
 */
if (import.meta.main) {
  const file = process.argv[2]
  if (!file) throw new Error("233: requires a real dispatcher-verified Actions envelope; source catalog is insufficient")
  const input: HostedInput233 = await Bun.file(file).json()
  const result = await inspectProof233Hosted(input)
  console.log(JSON.stringify(result, null, 2))
  if (result.hosted.gaps.length || result.AM01.missingSelectors.length ||
      result.AM02.structuralQualification !== "QUALIFIED_NOT_FINAL" ||
      !result.AM03.sourceToRunCorrelation?.structurallyCorrelatable) process.exitCode = 1
}
