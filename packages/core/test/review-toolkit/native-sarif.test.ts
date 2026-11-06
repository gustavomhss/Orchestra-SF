import { expect, test } from "bun:test"
import { ReviewNativeSarif } from "../../src/review-toolkit/native-sarif"

const options: ReviewNativeSarif.Options = {
  pack: "fixture", version: "1.0.0", root: "C:\\projection",
  paths: [{ file: "src\\input.js", path: "src\\original.js" }], rules: ["rule"],
}
const report = (uri = "src/input.js") => JSON.stringify({
  version: "2.1.0", runs: [{ tool: { driver: { name: "fixture", version: "1.0.0" } }, results: [{
    ruleId: "rule", message: { text: "finding" }, locations: [{ physicalLocation: {
      artifactLocation: { uri }, region: { startLine: 1 },
    } }],
  }] }],
})

test("native mapping validates Windows containment and maps normalized SARIF paths", () => {
  expect(ReviewNativeSarif.parse(report("src/input%20file.js"), options).status).toBe("acquisition-error")
  expect(ReviewNativeSarif.parse(report(), { ...options, paths: [{ file: "src/input.js", path: "..\\outside" }] }).status).toBe("acquisition-error")
  expect(ReviewNativeSarif.parse(report(), { ...options, paths: [{ file: "src/input.js", path: "\\\\server\\share" }] }).status).toBe("acquisition-error")
})

test("native URI decoding preserves literal POSIX backslashes", () => {
  const posix: ReviewNativeSarif.Options = { pack: "fixture", version: "1.0.0", root: "/native", paths: [{ file: "literal\\name.js", path: "source\\name.js" }], rules: ["rule"] }
  expect(ReviewNativeSarif.parse(report("literal\\name.js"), posix)).toMatchObject({ status: "ok", results: [{ path: "source\\name.js" }] })
  expect(ReviewNativeSarif.parse(report("literal%5Cname.js"), posix)).toMatchObject({ status: "ok", results: [{ path: "source\\name.js" }] })
  expect(ReviewNativeSarif.parse(report("literal%ZZ.js"), posix).status).toBe("acquisition-error")
})

test("native URI decoding rejects encoded separators and file authority aliases", () => {
  const posix: ReviewNativeSarif.Options = { pack: "fixture", version: "1.0.0", root: "/native", paths: [{ file: "foo/bar", path: "source.js" }], rules: ["rule"] }
  expect(ReviewNativeSarif.parse(report("foo%2Fbar"), posix).status).toBe("acquisition-error")
  expect(ReviewNativeSarif.parse(report("file://evil/native/foo/bar"), posix).status).toBe("acquisition-error")
  expect(ReviewNativeSarif.parse(report("foo%25bar"), { ...posix, paths: [{ file: "foo%bar", path: "source.js" }] })).toMatchObject({ status: "ok" })
})

test("native envelope rejects malformed invocation shapes and preserves encoded normalized paths", () => {
  const valid = JSON.parse(report("src/input%20file.js"))
  const encodedOptions = { ...options, paths: [{ file: "src/input file.js", path: "src/original.js" }] }
  expect(ReviewNativeSarif.parse(JSON.stringify(valid), encodedOptions)).toMatchObject({ status: "ok", results: [{ path: "src/original.js" }] })
  for (const invocations of ["bad", [null], [{ toolExecutionNotifications: {} }], [{ executionSuccessful: "yes" }]]) {
    expect(ReviewNativeSarif.parse(JSON.stringify({ ...valid, runs: [{ ...valid.runs[0], invocations }] }), encodedOptions).status).toBe("acquisition-error")
  }
})
