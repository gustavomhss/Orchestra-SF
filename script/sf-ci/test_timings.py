"""Data boundary tests for the advisory timing collector; no product tests rerun."""
import contextlib
import hashlib
import io
import json
from pathlib import Path
import tempfile
import unittest

import timings


def source(**changes):
    value = {
        "headSha": "a" * 40, "runId": 123, "runAttempt": 1, "jobName": "unit-sf",
        "suiteId": "CI-SF", "directory": "modules/sucafina", "status": "success",
        "conclusionScope": "test-step", "shardIndex": 2, "shardCount": 8,
    }
    value.update(changes)
    return value


REPORT = b'<testsuite tests="1" failures="0" errors="0" skipped="0" file="test/one.test.ts"><testcase name="one" time="0.25"/></testsuite>'


class TimingsTests(unittest.TestCase):
    def test_preserves_case_times_file_attribution_and_provenance(self):
        raw = """<testsuites tests="3" failures="0" errors="0" skipped="0">
          <testsuite file="./test/z.test.ts" tests="2">
            <testcase name="café &amp; açúcar" classname="group" time="0.125"/>
            <testcase name="zero" time="0"/>
          </testsuite>
          <testsuite tests="1"><testcase name="file override" file="test/a.test.ts" time="2.5"/></testsuite>
        </testsuites>""".encode()
        result = timings.collect_junit(raw, source())
        self.assertEqual(result["capture"], "complete")
        self.assertFalse(result["partial"])
        self.assertFalse(result["acceptanceEvidence"])
        self.assertEqual(result["source"], source())
        self.assertEqual(result["reportSha256"], hashlib.sha256(raw).hexdigest())
        self.assertEqual(result["measurement"], "junit-case-seconds")
        self.assertEqual(result["caseColumns"], ["name", "classname", "status", "seconds"])
        self.assertEqual([item["path"] for item in result["files"]], ["test/a.test.ts", "test/z.test.ts"])
        self.assertEqual(result["files"][1]["cases"], [["café & açúcar", "group", "passed", 0.125], ["zero", "", "passed", 0.0]])
        self.assertEqual(result["files"][1]["knownCaseSeconds"], 0.125)
        self.assertEqual(result["knownCaseSeconds"], 2.625)
        self.assertEqual(result["counts"], {"cases": 3, "passed": 3, "failed": 0, "skipped": 0, "missingTimes": 0})

    def test_missing_time_is_null_and_never_imputed_to_zero(self):
        result = timings.collect_junit(REPORT.replace(b' time="0.25"', b""), source())
        self.assertEqual(result["capture"], "partial")
        self.assertIn("missing-case-duration", result["reasons"])
        self.assertIsNone(result["files"][0]["cases"][0][3])
        self.assertEqual(result["files"][0]["missingTimes"], 1)
        self.assertEqual(result["knownCaseSeconds"], 0)

    def test_unattributed_and_skipped_cases_remain_visible(self):
        raw = b'<testsuite tests="2" skipped="1"><testcase name="unknown" time="1"/><testcase name="todo" time="0"><skipped/></testcase></testsuite>'
        result = timings.collect_junit(raw, source())
        self.assertTrue(result["partial"])
        self.assertIn("skipped-cases", result["reasons"])
        self.assertIn("unattributed-cases", result["reasons"])
        self.assertEqual(result["files"], [])
        self.assertEqual(result["counts"]["skipped"], 1)
        self.assertEqual(len(result["unattributedCases"]), 2)

    def test_failure_and_focused_green_cannot_claim_complete_capture(self):
        failed = REPORT.replace(b'failures="0"', b'failures="1"').replace(b'/>', b'><failure message="real failure"/></testcase>')
        result = timings.collect_junit(failed, source(status="failure"))
        self.assertEqual(result["counts"]["failed"], 1)
        self.assertTrue(result["partial"])
        self.assertIn("non-success-conclusion", result["reasons"])
        self.assertEqual(result["files"][0]["knownCaseSeconds"], 0.25)
        focused = timings.collect_junit(REPORT, source(), partial=True)
        self.assertTrue(focused["partial"])
        self.assertEqual(focused["reasons"], ["declared-partial"])

    def test_missing_report_diagnoses_failure_but_rejects_success(self):
        for status in ["failure", "cancelled", "timed_out"]:
            with self.subTest(status=status):
                result = timings.collect_junit(None, source(status=status))
                self.assertEqual(result["capture"], "missing")
                self.assertTrue(result["partial"])
                self.assertIsNone(result["reportSha256"])
                self.assertIn("missing-report", result["reasons"])
                self.assertEqual(result["counts"]["cases"], 0)
        with self.assertRaisesRegex(ValueError, "successful execution has no JUnit"):
            timings.collect_junit(None, source())

    def test_invalid_provenance_and_shard_identity_are_rejected(self):
        changes = [
            {"headSha": "deadbeef"}, {"runId": True}, {"runAttempt": 0}, {"runId": 2 ** 53},
            {"jobName": "sf/test-1"}, {"suiteId": "CI SF"}, {"directory": "../outside"},
            {"directory": "/absolute"}, {"directory": "test//nested"}, {"directory": []},
            {"status": "in_progress"}, {"status": []}, {"conclusionScope": "workflow"},
            {"shardIndex": 0}, {"shardCount": 1}, {"shardIndex": True}, {"unexpected": "field"},
        ]
        for change in changes:
            with self.subTest(change=change), self.assertRaisesRegex(ValueError, "SF_CI_TIMINGS"):
                timings.collect_junit(REPORT, source(**change))
        for field in ["headSha", "runAttempt", "directory", "shardCount"]:
            value = source()
            del value[field]
            with self.subTest(missing=field), self.assertRaisesRegex(ValueError, "SF_CI_TIMINGS"):
                timings.collect_junit(REPORT, value)
        with self.assertRaises(ValueError):
            timings.collect_junit(REPORT, [])
        with self.assertRaises(ValueError):
            timings.collect_junit(REPORT, source(), partial="false")

    def test_xml_must_be_bounded_well_formed_and_without_entities(self):
        invalid = [
            b"<testsuite>", b"<unexpected/>", b"\xff\xfe\x00",
            b'<!DOCTYPE testsuite [<!ENTITY x "expansion">]><testsuite><testcase name="&x;"/></testsuite>',
            b"x" * (timings.LIMIT + 1), "<testsuite/>",
        ]
        for raw in invalid:
            with self.subTest(size=len(raw)), self.assertRaisesRegex(ValueError, "SF_CI_TIMINGS"):
                timings.collect_junit(raw, source(status="failure"))

    def test_invalid_or_overflowing_times_fail_instead_of_weakening_weights(self):
        for value in ["-1", "NaN", "Infinity", "-Infinity", "abc", "", "1e999", str(2 ** 53)]:
            raw = REPORT.replace(b'0.25', value.encode())
            with self.subTest(time=value), self.assertRaisesRegex(ValueError, "testcase time"):
                timings.collect_junit(raw, source())
        raw = ('<testsuite file="test/file.test.ts"><testcase name="a" time="%s"/><testcase name="b" time="%s"/></testsuite>'
               % (timings.SAFE, timings.SAFE)).encode()
        with self.assertRaisesRegex(ValueError, "duration overflow"):
            timings.collect_junit(raw, source())

    def test_advertised_counts_and_statuses_cannot_contradict_cases(self):
        invalid = [
            REPORT.replace(b'tests="1"', b'tests="2"'),
            REPORT.replace(b'failures="0"', b'failures="1"'),
            REPORT.replace(b'tests="1"', b'tests="-1"'),
            REPORT.replace(b'/>', b'><failure/></testcase>'),
            REPORT.replace(b'/>', b'><failure/><skipped/></testcase>'),
            REPORT.replace(b'/>', b'><failure/><error/></testcase>'),
            REPORT.replace(b'name="one"', b'name="one" status="failed"'),
            REPORT.replace(b'name="one"', b'name="one" status="mystery"'),
            REPORT.replace(b'name="one"', b'name=""'),
            b'<testsuites><testcase name="outside suite" time="1"/></testsuites>',
            b'<testsuite tests="0"/>',
        ]
        for raw in invalid:
            with self.subTest(raw=raw), self.assertRaisesRegex(ValueError, "SF_CI_TIMINGS"):
                timings.collect_junit(raw, source())

    def test_paths_are_relative_to_an_explicit_root_and_cannot_escape(self):
        raw = REPORT.replace(b"test/one.test.ts", b"/work/modules/sucafina/test/one.test.ts")
        result = timings.collect_junit(raw, source(), file_root=Path("/work/modules/sucafina"))
        self.assertEqual(result["files"][0]["path"], "test/one.test.ts")
        for file in ["/other/test.ts", "../test.ts", "test/../test.ts", "test//test.ts", r"test\test.ts"]:
            raw = REPORT.replace(b"test/one.test.ts", file.encode())
            with self.subTest(file=file), self.assertRaisesRegex(ValueError, "SF_CI_TIMINGS"):
                timings.collect_junit(raw, source(), file_root=Path("/work/modules/sucafina"))
        with self.assertRaisesRegex(ValueError, "unsafe testcase file"):
            timings.collect_junit(REPORT.replace(b"test/one.test.ts", b"/work/test.ts"), source())

    def test_success_after_non_test_step_failure_stays_an_explicit_partial_observation(self):
        result = timings.collect_junit(REPORT, source(status="failure"))
        self.assertEqual(result["source"]["conclusionScope"], "test-step")
        self.assertEqual(result["counts"]["passed"], 1)
        self.assertTrue(result["partial"])
        self.assertEqual(result["counts"]["failed"], 0)

    def test_cli_reads_existing_report_and_keeps_acceptance_bytes_untouched(self):
        with tempfile.TemporaryDirectory() as directory:
            report = Path(directory) / "report.xml"
            output = Path(directory) / "performance" / "timings.json"
            report.write_bytes(REPORT)
            args = [
                "--report", str(report), "--output", str(output),
                "--source-sha", "a" * 40, "--run-id", "123", "--run-attempt", "2",
                "--job-name", "test", "--suite", "CI-SF", "--directory", "modules/sucafina",
                "--conclusion", "success", "--partial",
            ]
            with contextlib.redirect_stdout(io.StringIO()) as stdout:
                self.assertEqual(timings.main(args), 0)
            self.assertEqual(report.read_bytes(), REPORT)
            result = json.loads(output.read_text())
            self.assertEqual(result["source"]["runAttempt"], 2)
            self.assertNotIn("shardIndex", result["source"])
            self.assertTrue(result["partial"])
            self.assertIn("SF_CI_TIMINGS", stdout.getvalue())
            same_output = list(args)
            same_output[same_output.index("--output") + 1] = str(report)
            with self.assertRaisesRegex(ValueError, "separate from"):
                timings.main(same_output)
            self.assertEqual(report.read_bytes(), REPORT)

    def test_cli_can_preserve_a_missing_failure_report_without_running_tests(self):
        with tempfile.TemporaryDirectory() as directory:
            output = Path(directory) / "timings.json"
            with contextlib.redirect_stdout(io.StringIO()):
                result = timings.main([
                    "--report", str(Path(directory) / "missing.xml"), "--output", str(output),
                    "--source-sha", "a" * 40, "--run-id", "123", "--run-attempt", "1",
                    "--job-name", "unit-sf", "--suite", "CI-SF", "--directory", "modules/sucafina",
                    "--conclusion", "failure", "--shard-index", "2", "--shard-count", "8",
                ])
            self.assertEqual(result, 0)
            self.assertEqual(json.loads(output.read_text())["capture"], "missing")


if __name__ == "__main__":
    unittest.main()
