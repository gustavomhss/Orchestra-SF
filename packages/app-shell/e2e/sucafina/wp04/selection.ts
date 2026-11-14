/** Recognize only this declared fixture prerequisite; never modify Playwright's test selection. */
export function wp04BrowserSelected(args: readonly string[]) {
  return args.some((argument) => {
    // test-ci-request.ts passes anchored filename regexes with this separator class.
    const path = argument.replaceAll("[\\\\/]", "/").replaceAll("\\.", ".").replaceAll("\\", "/").replace(/:\d+(?::\d+)?$/, "")
    return ["e2e/sucafina/wp04/procurement.spec.ts", "e2e/sucafina/operations.spec.ts"]
      .some((filename) => path.endsWith(filename) || path.endsWith(filename + "$"))
  })
}
