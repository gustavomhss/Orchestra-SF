#!/usr/bin/env python3
"""Collect advisory JUnit timings without changing acceptance reports or receipts."""
import argparse
import hashlib
import json
import math
from pathlib import Path, PurePosixPath
import re
import sys
from xml.etree import ElementTree

LIMIT = 16 * 1024 * 1024
SAFE = 9007199254740991
CONCLUSIONS = {"success", "failure", "cancelled", "timed_out"}


def fail(message):
    raise ValueError("SF_CI_TIMINGS: " + message)


def metadata(source):
    required = {"headSha", "runId", "runAttempt", "jobName", "suiteId", "directory", "status", "conclusionScope"}
    if type(source) is not dict:
        fail("source must be an object")
    if set(source) - required - {"shardIndex", "shardCount"} or not required <= set(source):
        fail("invalid source fields")
    if not isinstance(source["headSha"], str) or not re.fullmatch(r"[a-f0-9]{40}", source["headSha"]):
        fail("invalid source SHA")
    for key in ("runId", "runAttempt"):
        if type(source[key]) is not int or not 0 < source[key] <= SAFE:
            fail("invalid " + key)
    if not isinstance(source["jobName"], str) or not re.fullmatch(r"[A-Za-z_][A-Za-z0-9_-]{0,99}", source["jobName"]):
        fail("invalid job name")
    if not isinstance(source["suiteId"], str) or not re.fullmatch(r"[A-Za-z0-9][A-Za-z0-9_-]{0,63}", source["suiteId"]):
        fail("invalid suite ID")
    if not isinstance(source["directory"], str) or (source["directory"] != "." and (
            not re.fullmatch(r"[A-Za-z0-9_./-]+", source["directory"]) or source["directory"].startswith("/")
            or any(part in {"", ".", ".."} for part in source["directory"].split("/")))):
        fail("invalid suite directory")
    if not isinstance(source["status"], str) or not isinstance(source["conclusionScope"], str) or source["status"] not in CONCLUSIONS or source["conclusionScope"] not in {"test-step", "test-command"}:
        fail("invalid conclusion or conclusion scope")
    if ("shardIndex" in source) != ("shardCount" in source):
        fail("incomplete shard identity")
    if "shardIndex" in source and (type(source["shardIndex"]) is not int or type(source["shardCount"]) is not int
            or not 1 <= source["shardIndex"] <= source["shardCount"] <= SAFE):
        fail("invalid shard identity")
    return dict(source)


def seconds(value):
    if value is None:
        return None
    try:
        result = float(value)
    except (TypeError, ValueError):
        fail("invalid testcase time")
    if not math.isfinite(result) or not 0 <= result <= SAFE:
        fail("invalid testcase time")
    return result


def filename(value, file_root):
    if not value:
        return None
    if file_root is not None and value.startswith("/"):
        try:
            value = str(PurePosixPath(value).relative_to(PurePosixPath(str(file_root))))
        except ValueError:
            fail("testcase file is outside the supplied file root")
    if value.startswith("./"):
        value = value[2:]
    if not re.fullmatch(r"[A-Za-z0-9_./-]+", value) or value.startswith("/") or any(
            part in {"", ".", ".."} for part in value.split("/")):
        fail("unsafe testcase file")
    return value


def collect_junit(raw, source, partial=False, file_root=None):
    source = metadata(source)
    if raw is not None and (not isinstance(raw, bytes) or len(raw) > LIMIT):
        fail("JUnit must be bounded bytes")
    if type(partial) is not bool:
        fail("partial must be boolean")
    reasons = []
    if partial:
        reasons.append("declared-partial")
    if source["status"] != "success":
        reasons.append("non-success-conclusion")
    result = {
        "schemaVersion": 1, "kind": "SF_TEST_TIMINGS", "measurement": "junit-case-seconds",
        "unit": "seconds", "acceptanceEvidence": False, "source": source,
        "reportSha256": hashlib.sha256(raw).hexdigest() if raw is not None else None,
        "caseColumns": ["name", "classname", "status", "seconds"],
        "files": [], "unattributedCases": [],
    }
    if raw is None:
        if source["status"] == "success":
            fail("successful execution has no JUnit report")
        result.update({"capture": "missing", "partial": True, "reasons": reasons + ["missing-report"],
                       "counts": {"cases": 0, "passed": 0, "failed": 0, "skipped": 0, "missingTimes": 0},
                       "knownCaseSeconds": 0})
        return result
    try:
        document = raw.decode("utf-8-sig")
    except UnicodeDecodeError:
        fail("JUnit must be UTF-8")
    if re.search(r"<!\s*(DOCTYPE|ENTITY)\b", document, re.I):
        fail("JUnit declarations or entities are not admitted")
    try:
        root = ElementTree.fromstring(document)
    except ElementTree.ParseError:
        fail("invalid JUnit XML")
    for element in root.iter():
        element.tag = element.tag.rsplit("}", 1)[-1]
    if root.tag not in {"testsuite", "testsuites"}:
        fail("invalid JUnit root")
    parents = {child: parent for parent in root.iter() for child in parent}
    groups = {}
    records = {}
    counts = {"cases": 0, "passed": 0, "failed": 0, "skipped": 0, "missingTimes": 0}
    for case in root.iter("testcase"):
        if parents.get(case) is None or parents[case].tag != "testsuite":
            fail("testcase is not directly inside a testsuite")
        name = case.get("name")
        if not name:
            fail("testcase name is missing")
        tags = {child.tag for child in case}
        skipped = bool(tags & {"skipped", "todo"}) or case.get("status", "").lower() in {"skipped", "disabled", "notrun", "todo"}
        failed = bool(tags & {"failure", "error"})
        advertised_status = case.get("status", "").lower()
        if advertised_status not in {"", "run", "passed", "success", "failure", "failed", "error", "skipped", "disabled", "notrun", "todo"}:
            fail("unknown testcase status")
        if advertised_status in {"failure", "failed", "error"} and not failed or advertised_status in {"passed", "success"} and (failed or skipped):
            fail("testcase status disagrees with its elements")
        if skipped and failed or "failure" in tags and "error" in tags:
            fail("contradictory testcase status")
        status = "skipped" if skipped else "failure" if "failure" in tags else "error" if "error" in tags else "passed"
        time = seconds(case.get("time"))
        file = case.get("file", "")
        ancestor = parents[case]
        while not file and ancestor is not None:
            file = ancestor.get("file", "")
            ancestor = parents.get(ancestor)
        file = filename(file, file_root)
        record = [name, case.get("classname", ""), status, time]
        records[case] = status
        counts["cases"] += 1
        counts["skipped" if skipped else "failed" if failed else "passed"] += 1
        counts["missingTimes"] += int(time is None)
        if file is None:
            result["unattributedCases"].append(record)
        else:
            groups.setdefault(file, []).append(record)
    for suite in root.iter():
        if suite.tag not in {"testsuite", "testsuites"}:
            continue
        states = [records[case] for case in suite.iter("testcase")]
        actual = {"tests": len(states), "failures": states.count("failure"),
                  "errors": states.count("error"), "skipped": states.count("skipped")}
        for key, count in actual.items():
            advertised = suite.get(key)
            if advertised is not None and (not re.fullmatch(r"[0-9]+", advertised) or int(advertised) != count):
                fail("advertised JUnit " + key + " count disagrees")
    if source["status"] == "success" and (counts["failed"] or not counts["cases"] or
            any(element.tag in {"failure", "error"} for element in root.iter())):
        fail("successful conclusion contradicts JUnit cases")
    if not counts["cases"]:
        reasons.append("no-cases")
    if counts["missingTimes"]:
        reasons.append("missing-case-duration")
    if counts["skipped"]:
        reasons.append("skipped-cases")
    if result["unattributedCases"]:
        reasons.append("unattributed-cases")
    for file in sorted(groups):
        cases = groups[file]
        total = math.fsum(case[3] for case in cases if case[3] is not None)
        if not math.isfinite(total) or total > SAFE:
            fail("file duration overflow")
        result["files"].append({"path": file, "knownCaseSeconds": total,
                                "missingTimes": sum(case[3] is None for case in cases), "cases": cases})
    total = math.fsum(case[3] for cases in [*groups.values(), result["unattributedCases"]]
                      for case in cases if case[3] is not None)
    if not math.isfinite(total) or total > SAFE:
        fail("total duration overflow")
    result.update({"capture": "partial" if reasons else "complete", "partial": bool(reasons),
                   "reasons": reasons, "counts": counts, "knownCaseSeconds": total})
    return result


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    for name in ("report", "output", "source-sha", "run-id", "run-attempt", "job-name", "suite", "conclusion"):
        parser.add_argument("--" + name, required=True)
    parser.add_argument("--conclusion-scope", default="test-step", choices=["test-step", "test-command"])
    parser.add_argument("--shard-index", type=int)
    parser.add_argument("--shard-count", type=int)
    parser.add_argument("--file-root", type=Path)
    parser.add_argument("--directory", default=".")
    parser.add_argument("--partial", action="store_true")
    args = parser.parse_args(argv)
    source = {"headSha": args.source_sha, "runId": int(args.run_id), "runAttempt": int(args.run_attempt),
              "jobName": args.job_name, "suiteId": args.suite, "directory": args.directory, "status": args.conclusion,
              "conclusionScope": args.conclusion_scope}
    if args.shard_index is not None or args.shard_count is not None:
        source.update({"shardIndex": args.shard_index, "shardCount": args.shard_count})
    metadata(source)
    report = Path(args.report)
    output = Path(args.output)
    if output.resolve() == report.resolve() or (output.exists() and report.exists() and output.samefile(report)):
        fail("output must be separate from the JUnit report")
    if report.exists() and report.stat().st_size > LIMIT:
        fail("JUnit exceeds the size limit")
    raw = report.read_bytes() if report.exists() else None
    result = collect_junit(raw, source, args.partial, args.file_root)
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(result, ensure_ascii=False, separators=(",", ":"), allow_nan=False) + "\n", encoding="utf-8")
    print("SF_CI_TIMINGS " + json.dumps({"capture": result["capture"], "files": len(result["files"]),
                                      "cases": result["counts"]["cases"], "partial": result["partial"]}))
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except (OSError, ValueError) as error:
        print(str(error), file=sys.stderr)
        raise SystemExit(2)

