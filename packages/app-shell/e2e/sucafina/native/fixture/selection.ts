/** Selection predicate only. A matching filename does NOT start an installed host,
 * collect a spec, or prove a real session. I00 owns shared Playwright registration.
 */
export function nativeSpecSelected(args: readonly string[]): boolean {
  if (args.some((argument) => argument === "--list" || argument.startsWith("--list="))) return false
  return args.some((argument) => {
    // Playwright receives literal paths, escaped CLI regex paths, and Windows paths.
    const normalized = argument.replace(/\\([./])/g, "$1").replaceAll("\\", "/")
    return /(?:^|\/)e2e\/sucafina\/native\/(?!fixture\/)(?:[A-Za-z0-9._-]+\/)*[A-Za-z0-9._-]+\.spec\.ts(?::\d+(?::\d+)?)?\$?$/.test(normalized)
  })
}
