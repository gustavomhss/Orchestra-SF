#!/usr/bin/env python3
"""Fail-closed JUnit identity/count verifier for protected Azure F04/AM execution.

This validates an ACTUAL process output. It does not assert Entra authentication,
native producer behavior, deployment, or independent review by itself.
"""
import hashlib
import json
import re
import sys
from pathlib import Path
from xml.etree import ElementTree as ET


def require(value, code):
    if not value:
        raise ValueError(code)


def local(tag):
    return tag.rsplit("}", 1)[-1]


def main():
    require(len(sys.argv) == 3, "F04_JUNIT_USAGE_REPORT_AND_PROOF_ID")
    path = Path(sys.argv[1])
    mode = sys.argv[2]
    catalog = json.loads((Path(__file__).parent / "catalog.json").read_text())
    require(catalog["schema"] == "sf2h.f04-am-proofs-catalog.v1" and
            mode in catalog and mode != "schema", "F04_JUNIT_UNKNOWN_PROOF")
    spec = catalog[mode]
    raw = path.read_bytes()
    require(0 < len(raw) <= 32 * 1024 * 1024, "F04_JUNIT_MISSING_OR_OVERSIZE")
    require(b"<!DOCTYPE" not in raw.upper() and b"<!ENTITY" not in raw.upper(),
            "F04_JUNIT_EXTERNAL_ENTITIES_DISALLOWED")
    root = ET.fromstring(raw)
    require(local(root.tag) in ("testsuite", "testsuites"), "F04_JUNIT_ROOT_INVALID")
    parents = {child: parent for parent in root.iter() for child in parent}
    cases = []
    for case in root.iter():
        if local(case.tag) != "testcase":
            continue
        parent = parents.get(case)
        require(parent is not None and local(parent.tag) == "testsuite",
                "F04_JUNIT_TESTCASE_NOT_IN_SUITE")
        ancestors = []
        p = parent
        while p is not None:
            if local(p.tag) == "testsuite":
                ancestors.append(p.attrib.get("name", ""))
                if p.attrib.get("file"):
                    ancestors.append(p.attrib["file"])
            p = parents.get(p)
        name = case.attrib.get("name", "")
        classname = case.attrib.get("classname", "")
        tags = {local(child.tag) for child in case}
        status = case.attrib.get("status", "").lower()
        control = bool(re.fullmatch(r"\(?\s*(before|after)(all|each)(\(\))?( hook)?\s*\)?",
                                    name.lower()))
        control = control or name.lower().startswith("omni positive control") or (
            "test-omni-control.ts" in classname)
        require(not {"failure", "error", "skipped", "todo"}.intersection(tags) and
                status not in ("skipped", "disabled", "notrun", "todo"),
                "F04_JUNIT_FAILED_SKIPPED_OR_TODO_CASE")
        if control:
            continue
        # Bun can attach its path to a testcase rather than the testsuite.
        # A reported source file still needs a concrete executed testcase.
        identity = " ".join(ancestors + [case.attrib.get("file", ""), classname, name]).replace("\\", "/")
        require(bool(name.strip()), "F04_JUNIT_TESTCASE_UNNAMED")
        cases.append({"name": name, "identity": identity})
    require(len(cases) > 0, "F04_JUNIT_NO_EXECUTED_PRODUCT_TESTS")
    for suite in root.iter():
        if local(suite.tag) not in ("testsuite", "testsuites"):
            continue
        descendants = [v for v in suite.iter() if local(v.tag) == "testcase"]
        for attribute in ("tests", "failures", "errors", "skipped"):
            reported = suite.attrib.get(attribute)
            if reported is None:
                continue
            require(re.fullmatch(r"\d+", reported) is not None,
                    "F04_JUNIT_NONNUMERIC_SUITE_TOTAL")
            observed = (len(descendants) if attribute == "tests" else sum(
                1 for v in descendants
                if (attribute == "skipped" and (
                    any(local(c.tag) == "skipped" for c in v) or
                    v.attrib.get("status", "").lower() in ("skipped", "disabled", "notrun", "todo")
                )) or (attribute != "skipped" and
                        any(local(c.tag) == attribute[:-1] for c in v))
            ))
            require(int(reported) == observed, "F04_JUNIT_ADVERTISED_COUNT_DRIFT")
    if mode == "q01":
        require(len(cases) == spec["expectedCount"], "F04_Q01_MUST_EXECUTE_EXACTLY_THREE")
        for expected in spec["caseIds"]:
            require(sum(expected in c["name"] for c in cases) == 1,
                    "F04_Q01_MISSING_OR_DUPLICATED_REQUIRED_NEGATIVE")
        require(all(sum(key in c["name"] for key in spec["caseIds"]) == 1 for c in cases),
                "F04_Q01_UNDECLARED_CASE")
    elif mode in ("u39", "u40"):
        require(len(cases) == spec["expectedCount"], "F04_JOURNEY_CASE_COUNT_CHANGED")
        require(all(spec["file"].split("/")[-1] in c["identity"] for c in cases),
                "F04_JOURNEY_TEST_FROM_WRONG_FILE")
        require(len(set(c["identity"] for c in cases)) == len(cases),
                "F04_JOURNEY_DUPLICATE_CASE_ID")
    elif mode.startswith("am"):
        expected = spec["files"]
        require(len(expected) > 0 and len(cases) >= len(expected),
                "F04_AM_INCOMPLETE_SELECTION")
        for selected in expected:
            name = selected.rsplit("/", 1)[-1]
            require(sum(name in c["identity"] for c in cases) > 0,
                    "F04_AM_SELECTED_FILE_NOT_EXECUTED")
        require(all(sum(selected.rsplit("/", 1)[-1] in c["identity"]
                        for selected in expected) == 1 for c in cases),
                "F04_AM_UNDECLARED_OR_AMBIGUOUS_TEST_FILE")
    else:
        raise ValueError("F04_JUNIT_UNSUPPORTED_PROOF")
    return {
        "schema": "sf2h.release-proof-junit-validation.v1",
        "status": "TEST_CASES_VERIFIED_NOT_LIVE_ACCEPTANCE",
        "proofId": mode,
        "reportSha256": hashlib.sha256(raw).hexdigest(),
        "caseCount": len(cases),
        "cases": [case["name"] for case in cases],
        "declaredFiles": [spec["file"]] if "file" in spec else spec["files"],
        "skipped": 0, "failed": 0, "todo": 0,
    }


try:
    print(json.dumps(main(), indent=2, ensure_ascii=False))
except Exception as exc:
    print(json.dumps({"schema": "sf2h.release-proof-junit-validation.v1",
                      "status": "REJECTED",
                      "reason": (str(exc) if isinstance(
                          exc, (ValueError, ET.ParseError, OSError, KeyError))
                          else "F04_JUNIT_UNEXPECTED_VALIDATION_FAILURE")}), file=sys.stderr)
    sys.exit(2)
