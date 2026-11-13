#!/usr/bin/env python3
"""Validate the campaign's structure only; never execute or certify the product."""
from __future__ import annotations

import argparse
from collections import defaultdict, deque
from datetime import date, datetime, timezone
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import sys


FAMILIES = ("dod", "invariants", "quality_standards", "completeness_criteria", "success_criteria")


def validate(plan: dict) -> tuple[list[dict], list[dict], dict]:
    failures, warnings = [], []
    definitions: dict[str, str] = {}

    def require(condition, code, location, detail):
        if not condition:
            failures.append({"code": code, "location": location, "detail": detail})

    def define(item, location):
        ident = item.get("id") if isinstance(item, dict) else None
        require(isinstance(ident, str) and bool(ident.strip()), "INVALID_ID", location, "Definition needs a nonempty string id")
        if not isinstance(ident, str) or not ident:
            return
        require(ident not in definitions, "DUPLICATE_ID", location, f"{ident} already defined at {definitions.get(ident)}")
        definitions.setdefault(ident, location)

    def sequence(items, prefix, count, location, start=1):
        require(isinstance(items, list), "INVALID_LIST", location, "Expected a list")
        items = items if isinstance(items, list) else []
        require(len(items) == count, "COUNT_MISMATCH", location, f"Expected {count}; observed {len(items)}")
        expected = {f"{prefix}{n:02}" for n in range(start, start + count)}
        actual = {x.get("id") for x in items if isinstance(x, dict)}
        require(actual == expected, "ID_SET_MISMATCH", location, f"Missing={sorted(expected-actual)}; unexpected={sorted(str(x) for x in actual-expected)}")
        for index, item in enumerate(items):
            define(item, f"{location}[{index}]")
        return items

    def refs(values, valid, location, nonempty=False):
        require(isinstance(values, list), "INVALID_REFS", location, "References must be a list")
        if not isinstance(values, list):
            return
        if nonempty:
            require(bool(values), "EMPTY_REFS", location, "At least one reference is required")
        for value in values:
            require(isinstance(value, str) and value in valid, "DANGLING_REF", location, f"Unknown reference: {value}")

    def axioms(entity, location):
        block = entity.get("axioms", {})
        require(isinstance(block, dict), "INVALID_AXIOMS", location, "Expected an axioms object")
        if not isinstance(block, dict):
            return
        for family in FAMILIES:
            rows = block.get(family)
            require(isinstance(rows, list) and bool(rows), "MISSING_AXIOM_FAMILY", f"{location}.{family}", "Every level needs all five nonempty local families")
            if not isinstance(rows, list):
                continue
            for index, row in enumerate(rows):
                where = f"{location}.{family}[{index}]"
                define(row, where)
                require(isinstance(row, dict) and isinstance(row.get("text"), str) and bool(row["text"].strip()), "EMPTY_AXIOM", where, "Axiom needs nonempty text")

    duration = plan.get("timebox", {}).get("duration_minutes", 120)
    require(duration == 120, "DURATION_MISMATCH", "timebox.duration_minutes", "This plan targets 120 minutes")

    def window(value, location):
        valid = isinstance(value, list) and len(value) == 2 and all(isinstance(x, int) and not isinstance(x, bool) for x in value)
        require(valid, "INVALID_WINDOW", location, "Expected [start_minute,end_minute] integers")
        if valid:
            require(0 <= value[0] <= value[1] <= duration, "WINDOW_RANGE", location, "Window must be ordered within the campaign")

    define(plan, "campaign")
    axioms(plan, "campaign.axioms")
    wps = sequence(plan.get("work_packages"), "WP", 15, "work_packages", start=0)
    wp_ids = {w.get("id") for w in wps}
    tasks = {}
    for wp in wps:
        wid = wp.get("id", "?")
        axioms(wp, f"{wid}.axioms")
        window(wp.get("build_window"), f"{wid}.build_window")
        require("schedule" not in wp, "DUPLICATE_SCHEDULE", wid, "Use the canonical build/proof windows")
        for task in wp.get("tasks", []):
            tid = task.get("id", "?")
            define(task, f"{wid}.tasks.{tid}")
            require(bool(re.fullmatch(re.escape(str(wid)) + r"\.T\d{2}", str(tid))), "TASK_NAMESPACE", tid, "Task id must belong to its WP")
            require(task.get("owner") == wid and task.get("ownership_ref") == wid, "TASK_OWNER", tid, "Owner and ownership_ref must name the containing WP")
            tasks[tid] = task
            axioms(task, f"{tid}.axioms")
            window(task.get("build_window"), f"{tid}.build_window")
            window(task.get("proof_window"), f"{tid}.proof_window")
            require("schedule" not in task, "DUPLICATE_SCHEDULE", tid, "Legacy schedule must not conflict with canonical windows")
            for check in task.get("checks", []):
                define(check, f"{tid}.checks")
                require(isinstance(check.get("text"), str) and bool(check["text"].strip()), "EMPTY_CHECK", tid, "Check needs text")
    require(len(tasks) == 71, "COUNT_MISMATCH", "tasks", f"Expected71; observed{len(tasks)}")
    task_ids = set(tasks)

    contracts = sequence(plan.get("contracts"), "C", 14, "contracts")
    evidence = sequence(plan.get("evidence", {}).get("packages"), "E", 18, "evidence.packages")
    journeys = sequence(plan.get("journeys"), "J", 13, "journeys")
    contract_ids = {x["id"] for x in contracts}
    evidence_ids = {x["id"] for x in evidence}
    journey_ids = {x["id"] for x in journeys}
    for contract in contracts:
        require(contract.get("definition_owner") in wp_ids, "CONTRACT_OWNER", contract["id"], "Definition owner must exist")
        refs(contract.get("producers"), wp_ids, contract["id"] + ".producers", True)
        refs(contract.get("consumers"), wp_ids, contract["id"] + ".consumers", True)
    for package in evidence:
        refs(package.get("owners"), wp_ids, package["id"] + ".owners", True)
    for journey in journeys:
        refs(journey.get("tasks"), task_ids, journey["id"] + ".tasks", True)

    coverage = plan.get("coverage", {})
    rows_by_kind = {}
    for key, prefix, count in [("requirements", "R", 41), ("capabilities", "CAP", 28), ("ai_capabilities", "IA", 18)]:
        rows_by_kind[key] = sequence(coverage.get(key), prefix, count, "coverage." + key)
        for row in rows_by_kind[key]:
            refs(row.get("tasks"), task_ids, row["id"] + ".tasks", True)
            if "owner" in row:
                require(row["owner"] in wp_ids, "COVERAGE_OWNER", row["id"], "Coverage owner must exist")
            if "journeys" in row:
                refs(row["journeys"], journey_ids, row["id"] + ".journeys")
            if "journey" in row:
                require(row["journey"] in journey_ids, "DANGLING_REF", row["id"], "Unknown journey")
    req_ids = {x["id"] for rows in rows_by_kind.values() for x in rows}
    for chart in coverage.get("charts", []):
        define(chart, "coverage.charts")
        require(chart.get("task") in task_ids, "DANGLING_REF", chart.get("id", "chart"), "Unknown chart task")
    if "journeys" in coverage:
        require(coverage["journeys"] == journeys, "DERIVED_DRIFT", "coverage.journeys", "Journey mirror differs from canonical journeys")

    gates = plan.get("gates", [])
    gate_ids = {g.get("gate") for g in gates}
    require(len(gate_ids) == len(gates), "DUPLICATE_GATE", "gates", "Gate names must be unique")
    minutes = [g.get("minute") for g in gates]
    require(all(isinstance(x, int) and 0 <= x <= duration for x in minutes) and minutes == sorted(minutes), "GATE_TIMELINE", "gates", "Gate minutes must be ordered within duration")
    outgoing, indegree = defaultdict(list), {tid: 0 for tid in task_ids}
    for tid, task in tasks.items():
        refs(task.get("depends_on", []), task_ids, tid + ".depends_on")
        for dep in task.get("depends_on", []):
            if dep not in tasks:
                continue
            outgoing[dep].append(tid)
            indegree[tid] += 1
            left, right = tasks[dep].get("build_window"), task.get("build_window")
            if isinstance(left, list) and isinstance(right, list) and len(left) == len(right) == 2:
                require(left[1] <= right[0], "DEPENDENCY_TIME", tid, f"Build dependency{dep}ends after this task starts")
        for key in ("integrates_with", "integration_dependencies"):
            if key in task:
                refs(task[key], task_ids, tid + "." + key)
        refs(task.get("evidence_packages", []), evidence_ids, tid + ".evidence_packages", True)
        refs(task.get("journeys", []), journey_ids, tid + ".journeys")
        refs(task.get("requirements", []), req_ids, tid + ".requirements")
        if "acceptance_requires" in task:
            refs(task["acceptance_requires"], task_ids | gate_ids, tid + ".acceptance_requires")
    queue, visited = deque(t for t, degree in indegree.items() if degree == 0), []
    while queue:
        tid = queue.popleft()
        visited.append(tid)
        for consumer in outgoing[tid]:
            indegree[consumer] -= 1
            if indegree[consumer] == 0:
                queue.append(consumer)
    require(len(visited) == len(tasks), "BUILD_DAG_CYCLE", "depends_on", f"Unresolved nodes: {sorted(task_ids-set(visited))}")

    ownership = plan.get("ownership", {})
    assignments = ownership.get("work_packages", [])
    require({x.get("id") for x in assignments} == wp_ids and len(assignments) == len(wps), "OWNERSHIP_COVERAGE", "ownership", "Exactly one assignment perWP")
    exact_owners, prefixes = defaultdict(set), []
    exceptions = {}
    for entry in ownership.get("exact_exceptions", []):
        path, owner = entry.get("path"), entry.get("owner")
        require(owner in wp_ids and isinstance(path, str), "OWNERSHIP_EXCEPTION", "ownership.exact_exceptions", "Exception needs valid path and owner")
        require(path not in exceptions, "DUPLICATE_EXCEPTION", str(path), "Only one exact exception per path")
        exceptions[path] = owner
    def valid_path(path):
        return isinstance(path, str) and bool(path) and not path.startswith("/") and "\\" not in path and ".." not in PurePosixPath(path).parts
    excluded = ownership.get("excluded_prefixes", [])
    for entry in assignments:
        wid = entry.get("id")
        require(bool(re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+){0,2}", entry.get("branch", ""))), "BRANCH_FORMAT", str(wid), "Feature branch uses at most three lowercase words")
        for path in entry.get("existing_files", []):
            require(valid_path(path), "INVALID_PATH", str(wid), str(path))
            exact_owners[path].add(wid)
            if any(path.startswith(prefix) for prefix in excluded):
                require(exceptions.get(path) == wid, "EXCLUDED_WRITE", str(wid), f"{path} needs an exact authorized exception")
        for prefix in entry.get("new_prefixes", []):
            require(valid_path(prefix) and prefix.endswith("/"), "INVALID_PREFIX", str(wid), str(prefix))
            require(not any(prefix.startswith(x) or x.startswith(prefix) for x in excluded), "EXCLUDED_PREFIX_WRITE", str(wid), str(prefix))
            prefixes.append((prefix, wid))
    for path, owners in exact_owners.items():
        require(len(owners) == 1, "MULTIPLE_WRITERS", path, str(sorted(owners)))
        for prefix, owner in prefixes:
            if path.startswith(prefix):
                require(owners == {owner} or exceptions.get(path) in owners, "EXACT_PREFIX_COLLISION", path, f"Prefix belongs to{owner}")
    for index, (prefix, owner) in enumerate(prefixes):
        for other, second_owner in prefixes[index+1:]:
            if owner != second_owner:
                require(not (prefix.startswith(other) or other.startswith(prefix)), "PREFIX_COLLISION", prefix, f"{owner} overlaps {second_owner}:{other}")
    for path, owner in exceptions.items():
        require(valid_path(path) and owner in exact_owners.get(path, set()), "EXCEPTION_NOT_OWNED", str(path), "Exact exception must be present in its owner's files")
    for wp in wps:
        wid = wp["id"]
        declared = next((x for x in assignments if x.get("id") == wid), None)
        require(wp.get("ownership") == declared, "OWNERSHIP_MIRROR_DRIFT", wid, "WP ownership differs from canonical manifesto")
        refs(wp.get("evidence_packages", []), evidence_ids, wid + ".evidence_packages", True)
        for key in ("contract_reads", "contract_provides"):
            values = wp.get(key, [])
            require(isinstance(values, list), "INVALID_CONTRACT_REFS", wid + "." + key, "Expected list")
            for value in values if isinstance(values, list) else []:
                for cid in re.findall(r"\bC\d{2}\b", str(value)):
                    require(cid in contract_ids, "UNKNOWN_CONTRACT", wid + "." + key, cid)

    try:
        date.fromisoformat(plan.get("authored_at", ""))
    except (ValueError, TypeError):
        require(False, "INVALID_DATE", "authored_at", "Expected valid ISO calendar date")
    baseline = plan.get("baseline", {})
    require(bool(re.fullmatch(r"[0-9a-f]{40}", str(baseline.get("commit", "")))), "INVALID_COMMIT", "baseline.commit", "Expected40hexSHA")
    if "verified_head" in baseline:
        require(baseline["verified_head"] == baseline.get("commit"), "BASELINE_MISMATCH", "baseline", "verified_head differs from pinned commit")
    counts = {"work_packages": len(wps), "tasks": len(tasks), "contracts": len(contracts), "evidence_packages": len(evidence), "journeys": len(journeys), "requirements": len(rows_by_kind["requirements"]), "capabilities": len(rows_by_kind["capabilities"]), "ai_capabilities": len(rows_by_kind["ai_capabilities"]), "unique_defined_ids": len(definitions)}
    return failures, warnings, counts


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--plan", type=Path, default=Path(__file__).resolve().parent.parent / "campaign.json")
    parser.add_argument("--output", type=Path)
    args = parser.parse_args()
    output = args.output or args.plan.parent / "validation.json"
    raw = args.plan.read_bytes()
    try:
        plan = json.loads(raw)
        failures, warnings, counts = validate(plan)
    except (ValueError, KeyError, TypeError, AttributeError) as error:
        failures, warnings, counts = [{"code": "INVALID_PLAN_SHAPE", "location": "campaign", "detail": str(error)}], [], {}
    result = {"status": "PLAN_STRUCTURE_PASS" if not failures else "PLAN_STRUCTURE_FAIL", "plan_path": str(args.plan.resolve()), "plan_sha256": hashlib.sha256(raw).hexdigest(), "checked_at": datetime.now(timezone.utc).isoformat(), "counts": counts, "failures": failures, "warnings": warnings, "limitations": ["Structural validation of planning data only; no product code, tests, inference, Relay run, CI, browser, deploy or business action was executed.", "Axiom presence and nonempty text do not prove quality, semantic completeness or satisfaction.", "References and ownership are checked against this plan, not against a live Git tree or actual permissions.", "Contract references are validated by canonical ID where a Cxx token is present; TypeScript signatures, exports, runtime compatibility and prose semantics are not compiled or proven.", "The120minute windows are internally checked, not empirically demonstrated estimates; resource effort and CI duration are not benchmarked.", "Consumer integration edges are checked for valid targets; only depends_on is required to form an acyclic build DAG."]}
    output.write_text(json.dumps(result, ensure_ascii=False, indent=2) + "\n")
    print(json.dumps({"status": result["status"], "output": str(output), "counts": counts, "failures": failures}, ensure_ascii=False))
    return 0 if not failures else 1


if __name__ == "__main__":
    sys.exit(main())
