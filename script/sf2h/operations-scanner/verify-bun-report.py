#!/usr/bin/env python3
"""Validate saved Bun JUnit data; print a JSON summary and exit nonzero on failure."""
import argparse
import hashlib
import json
import re
from pathlib import Path
import xml.etree.ElementTree as ET

parser = argparse.ArgumentParser(description=__doc__)
parser.add_argument("report", type=Path)
args = parser.parse_args()
summary = {
    "schema_version": 1, "status": "FAIL", "report": str(args.report),
    "report_sha256": None, "scope": "DATA_ONLY_JUNIT_VALIDATION",
    "tests_executed_by_verifier": False, "issues": [], "counts": {}, "cases": [],
    "limitations": [
        "Validates supplied XML only; does not prove product coverage, assertions or run provenance.",
        "Only explicitly identifiable hooks and Omni control cases are excluded from product counts.",
        "Bun represents TODO as skipped; todo_identified counts explicit TODO markers only.",
    ],
}
try:
    raw = args.report.read_bytes()
    summary["report_sha256"] = hashlib.sha256(raw).hexdigest()
    if b"<!DOCTYPE" in raw.upper():
        raise ValueError("JUnit report must not contain a DOCTYPE")
    root = ET.fromstring(raw)
    for element in root.iter():
        element.tag = element.tag.rsplit("}", 1)[-1]
    if root.tag not in {"testsuite", "testsuites"}:
        raise ValueError("Expected a testsuite or testsuites root")
    parents = {child: parent for parent in root.iter() for child in parent}
    records = {}
    for case in root.iter("testcase"):
        if parents.get(case) is None or parents[case].tag != "testsuite":
            raise ValueError("Every testcase must be directly inside a testsuite")
        file = case.get("file", "")
        ancestor = parents.get(case)
        while not file and ancestor is not None:
            file, ancestor = ancestor.get("file", ""), parents.get(ancestor)
        name, classname = case.get("name", ""), case.get("classname", "")
        tags = {child.tag for child in case}
        status = case.get("status", "").lower()
        todo = "todo" in tags or status == "todo" or any(
            child.tag == "skipped" and child.get("message", "").strip().upper() == "TODO"
            for child in case
        )
        skipped = todo or "skipped" in tags or status in {"skipped", "disabled", "notrun"}
        control = bool(re.fullmatch(r"\(?\s*(before|after)(all|each)(\(\))?( hook)?\s*\)?", name.lower()))
        control = control or name.lower().startswith("omni positive control") or any(
            value.replace("\\", "/").rsplit("/", 1)[-1] == "test-omni-control.ts"
            for value in (file, classname)
        )
        records[case] = {
            "name": name, "classname": classname, "file": file,
            "failures": int("failure" in tags), "errors": int("error" in tags),
            "skipped": int(skipped), "todo_identified": int(todo),
            "executed": int(not skipped), "known_control_or_hook": int(control),
            "product_executed": int(not skipped and not control),
        }

    def counts(cases):
        return {"tests": len(cases), **{
            key: sum(records[case][key] for case in cases)
            for key in ("failures", "errors", "skipped", "todo_identified", "executed",
                        "known_control_or_hook", "product_executed")
        }}

    summary["counts"] = counts(list(records))
    summary["cases"] = list(records.values())
    summary["suites"] = []
    for suite in (element for element in root.iter() if element.tag in {"testsuite", "testsuites"}):
        actual = counts(list(suite.iter("testcase")))
        advertised = {key: suite.get(key) for key in ("tests", "failures", "errors", "skipped") if key in suite.attrib}
        summary["suites"].append({"name": suite.get("name", ""), "actual": actual, "advertised": advertised})
        for key, value in advertised.items():
            if not re.fullmatch(r"[0-9]+", value) or int(value) != actual[key]:
                summary["issues"].append(f"{suite.tag} {suite.get('name', '')!r}: {key}={value!r}, actual={actual[key]}")
    if any(element.tag in {"failure", "error"} for element in root.iter()):
        summary["issues"].append("Report contains failure/error elements")
    if summary["counts"]["product_executed"] < 1:
        summary["issues"].append("No executed non-skipped product testcase was reported")
except (OSError, ET.ParseError, ValueError) as error:
    summary["issues"].append(str(error))
summary["status"] = "PASS" if not summary["issues"] else "FAIL"
print(json.dumps(summary, indent=2, ensure_ascii=False))
raise SystemExit(0 if summary["status"] == "PASS" else 1)
