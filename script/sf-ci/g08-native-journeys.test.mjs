import assert from "node:assert/strict"
import test from "node:test"
import { digest } from "./g08-private-evidence.mjs"
import { nativeTitles, nativeSuiteCases, nativeCaseIntent } from "../../packages/app-shell/e2e/sucafina/native/fixture/case-contract.ts"
import { verifyNativeReport, verifyNativeObservations, nativeReportReceipt, verifyOmni, verifyF04JUnit, f04Titles } from "./g08-native-journeys.mjs"

function report(suite = "U39", executed = true) {
  const groups = suite === "ALL" ? ["U15", "U39", "U40"] : [suite]
  const specs = groups.flatMap((group) => nativeTitles[group].map((title) => ({
    title, file: "sucafina/native/journeys/" + group.toLowerCase() + ".spec.ts", ok: true,
    tests: [{ projectName: "chromium", expectedStatus: "passed", status: "expected", annotations: [],
      results: executed ? [{ status: "passed", retry: 0, errors: [], attachments: [] }] : [] }],
  })))
  return { config: { workers: 1, projects: [{ name: "chromium", retries: 0, repeatEach: 1 }], grep: {} },
    errors: [], suites: [{ specs, suites: [] }],
    stats: { expected: specs.length, unexpected: 0, skipped: 0, flaky: 0 } }
}
test("list preserves50 original cases and never declares executed", () => {
  const result = verifyNativeReport(report("ALL", false), "ALL", false)
  assert.equal(result.length, 50)
  assert(result.every((item) => item.state === "LISTED_NOT_RUN"))
})
test("the three native reports retain6/22/22; no single combined executed invocation", () => {
  for (const [suite, count] of [["U15", 6], ["U39", 22], ["U40", 22]])
    assert.equal(verifyNativeReport(report(suite), suite, true).length, count)
  assert.throws(() => verifyNativeReport(report("ALL"), "ALL", true))
})
for (const mutation of ["missing", "duplicate", "extra", "wrong-file", "wrong-title", "skip", "flaky", "retry",
  "repeated", "wrong-project", "shard", "grep", "error", "attachment", "stats", "expected-failure", "workers", "list-executed"])
  test("report refuses " + mutation, () => {
    const value = report(), spec = value.suites[0].specs[0], entry = spec.tests[0], result = entry.results[0]
    switch (mutation) {
      case "missing": value.suites[0].specs.pop(); break
      case "duplicate": value.suites[0].specs[1] = structuredClone(spec); break
      case "extra": value.suites[0].specs.push(structuredClone(spec)); break
      case "wrong-file": spec.file = "synthetic.spec.ts"; break
      case "wrong-title": spec.title = "substitute"; break
      case "skip": result.status = "skipped"; break
      case "flaky": entry.status = "flaky"; break
      case "retry": result.retry = 1; break
      case "repeated": entry.results.push(structuredClone(result)); break
      case "wrong-project": value.config.projects[0].name = "other"; break
      case "shard": value.config.shard = { current: 1, total: 2 }; break
      case "grep": value.config.grep = "some"; break
      case "error": value.errors.push({ message: "failure" }); break
      case "attachment": result.attachments.push({ name: "raw-private-screenshot" }); break
      case "stats": value.stats.skipped = 1; break
      case "expected-failure": entry.expectedStatus = "failed"; break
      case "workers": value.config.workers = 2; break
    }
    assert.throws(() => verifyNativeReport(value, "U39", mutation !== "list-executed"))
  })
function observations() {
  const manifest = { schema: "sf2h.native-installed-manifest.v2", candidateSha: "a".repeat(40),
    invocation: { treeSha: "b".repeat(40), runId: "1", runAttempt: "1", role: "u39",
      invocationId: "c".repeat(32), archiveSha256: "d".repeat(64) }, actors: { requester: "controlled-metadata-only" } }
  const selected = { schema: "sf2h.native-selected-installation.v2", suite: "U39",
    candidateSha: manifest.candidateSha, invocation: manifest.invocation, manifestSha256: digest(JSON.stringify(manifest)),
    selections: nativeSuiteCases.U39.map((caseId) => ({ caseId, actor: "requester", target: { fixture: "metadata-" + caseId },
      intent: nativeCaseIntent(caseId) })) }
  const inventory = verifyNativeReport(report(), "U39", true)
  const cases = inventory.map((item) => {
    const input = selected.selections.find((entry) => entry.caseId === item.caseId)
    const callback = item.caseId === "stale" || item.caseId === "revoked"
    return { schema: "sf2h.native-case-observation.v2", suite: "U39", number: item.number,
      candidateSha: manifest.candidateSha, invocation: manifest.invocation, caseId: item.caseId,
      titleSha256: item.titleSha256, bodyCompleted: true, actor: input.actor,
      principalRef: manifest.actors.requester, target: input.target, selectedManifestSha256: digest(JSON.stringify(selected)),
      cleanup: { completed: true, ownPagesClosed: 1, originalPagesPreserved: true,
        callback: { cleanupCompleted: true, cleanupScope: "OWN_PAGES_AND_CALLBACK_CHANGES_ONLY",
          ownedPagesClosed: callback ? 1 : 0, callbackRestorations: callback ? 1 : 0 } } }
  })
  const detached = { schema: "sf2h.native-browser-detached.v2", candidateSha: manifest.candidateSha,
    invocation: manifest.invocation, contextsPreserved: true, clientDisconnected: true }
  return { manifest, selected, inventory, cases, detached }
}
test("metadata joins report and all actual fixture observers without promoting LIVE", () => {
  const f = observations()
  assert.equal(verifyNativeObservations(f.manifest, f.selected, f.inventory, f.cases, f.detached).cases, 22)
  const receipt = nativeReportReceipt({ suite: "U39", source: { sha: "a".repeat(40), tree: "b".repeat(40) },
    invocation: f.manifest.invocation, inventory: f.inventory, bindings: {}, files: [] })
  for (const field of ["installed", "liveQualified", "g08Closed", "finalCandidate", "productionCutover"])
    assert.equal(receipt[field], false)
})
for (const mutation of ["missing-case", "missing-callback", "cleanup", "owner", "principal", "invocation", "detached", "selected-hash"])
  test("original fixture join refuses " + mutation, () => {
    const f = observations()
    switch (mutation) {
      case "missing-case": f.cases.pop(); break
      case "missing-callback": f.cases.find((entry) => entry.caseId === "revoked").cleanup.callback.callbackRestorations = 0; break
      case "cleanup": f.cases[0].cleanup.completed = false; break
      case "owner": f.cases[0].target = { fixture: "other" }; break
      case "principal": f.cases[0].principalRef = "other"; break
      case "invocation": f.cases[0].invocation = { ...f.manifest.invocation, runId: "2" }; break
      case "detached": f.detached.clientDisconnected = false; break
      case "selected-hash": f.cases[0].selectedManifestSha256 = "9".repeat(64); break
    }
    assert.throws(() => verifyNativeObservations(f.manifest, f.selected, f.inventory, f.cases, f.detached))
  })
test("declared Omni requires one fresh original control and refuses FAIL/off/replay/duplicate", () => {
  const nonce = "a".repeat(32), line = "omni positive control [" + nonce + "]: not applicable"
  assert.equal(verifyOmni(line, nonce).verdict, "not applicable")
  for (const bad of ["", line + "\n" + line, line.replace(nonce, "b".repeat(32)),
    line.replace("not applicable", "off"), line.replace("not applicable", "FAIL")])
    assert.throws(() => verifyOmni(bad, nonce))
})

function f04xml() {
  const file = "test-browser/sucafina-native/transport-integration.test.ts"
  return '<?xml version="1.0"?><testsuites tests="3" failures="0" skipped="0"><testsuite file="' + file +
    '" tests="3" failures="0" skipped="0"><properties><property name="ci" value="https://github.com/gustavomhss/Orchestra-SF/actions/runs/1" />' +
    '<property name="commit" value="' + "a".repeat(40) + '" /></properties>' +
    f04Titles.map((title) => '<testcase name="' + title + '" file="' + file + '" />').join("") + "</testsuite></testsuites>"
}
test("F04 accepts only the exact three original Bun controls with original C/run properties", () => {
  assert.equal(verifyF04JUnit(f04xml(), { sha: "a".repeat(40), runId: "1" }).length, 3)
})
for (const mutation of ["missing", "duplicate", "skip", "failure", "wrong-commit", "wrong-run", "wrong-file", "extra-case", "xml-entity"])
  test("F04 refuses " + mutation, () => {
    let xml = f04xml()
    switch (mutation) {
      case "missing": xml = xml.replace(/<testcase[^>]*\/>/, ""); break
      case "duplicate": xml = xml.replace(f04Titles[1], f04Titles[0]); break
      case "skip": xml = xml.replace('skipped="0"', 'skipped="1"'); break
      case "failure": xml = xml.replace("</testsuite>", "<failure /></testsuite>"); break
      case "wrong-commit": xml = xml.replace("a".repeat(40), "b".repeat(40)); break
      case "wrong-run": xml = xml.replace("/runs/1", "/runs/2"); break
      case "wrong-file": xml = xml.replaceAll("transport-integration.test.ts", "replacement.test.ts"); break
      case "extra-case": xml = xml.replace("</testsuite>", '<testcase name="extra" /></testsuite>'); break
      case "xml-entity": xml = "<!DOCTYPE bad>" + xml; break
    }
    assert.throws(() => verifyF04JUnit(xml, { sha: "a".repeat(40), runId: "1" }))
  })
