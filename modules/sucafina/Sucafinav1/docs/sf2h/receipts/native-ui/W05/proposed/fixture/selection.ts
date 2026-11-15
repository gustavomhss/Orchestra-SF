// PROPOSED SOURCE: destination packages/app-shell/e2e/sucafina/native/fixture/selection.ts
/** Pure filename detection for I00's production Playwright config.
 * Detection alone is NOT test collection, mounting, or successful execution.
 * Only 120 can dispatch the selected exact specs in GitHub Actions.
 */
export function nativeSpecSelected(args: readonly string[]): boolean {
  if (args.includes("--list")) return false
  return args.some((argument) => {
    const normalized = argument.replaceAll("[\\\\/]", "/").replaceAll("\\.", ".").replaceAll("\\", "/")
    return /(?:^|\/)e2e\/sucafina\/native\/(?!fixture\/)[^ ]+\.spec\.ts(?:\$|:\d+(?::\d+)?)?$/.test(normalized)
  })
}
