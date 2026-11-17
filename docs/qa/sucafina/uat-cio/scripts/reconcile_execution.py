#!/usr/bin/env python3
"""Fail-closed, local-only projection of reviewed UAT evidence; NEVER executes product stories.

Usage: reconcile_execution.py --check
       reconcile_execution.py --record /private/sanitized-case.json --evidence-ref QA-RUN-ALIAS
Records remain outside Git; only safe aliases, SHA-256 digests and statuses are committed.
"""
import argparse
import csv
from datetime import datetime, timedelta
import hashlib
import io
import json
import os
from pathlib import Path
import re
import sys
import tempfile

ROOT = Path(__file__).resolve().parent.parent
TRACE = "QA-TRACEABILITY.json"
SURFACES = "MATRIX-70-SURFACES.csv"
ROUTES = "MATRIX-165-ROUTES.csv"
PROBES = "ROUTE-TEST-CASES.csv"
PROBES_JSONL = "ROUTE-TEST-CASES.jsonl"
OPERATIONS = "OPERATIONS-306-CONTRACT-MAP.csv"
ALLOWED = {
    "NOT_RUN", "PASSED_WITH_EVIDENCE", "FAILED_PRODUCT",
    "BLOCKED_CAPABILITY", "BLOCKED_ENVIRONMENT", "NOT_APPLICABLE_APPROVED",
}
TERMINAL = ALLOWED - {"NOT_RUN"}
EXECUTED = {"PASSED_WITH_EVIDENCE", "FAILED_PRODUCT"}
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA64 = re.compile(r"^[0-9a-f]{64}$")
ALIAS = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{1,90}$")
REASON = re.compile(r"^[A-Z][A-Z0-9_]{1,79}$")


def demand(ok, message):
    if not ok:
        raise ValueError(message)


def digest(data):
    if isinstance(data, str):
        data = data.encode("utf-8")
    return hashlib.sha256(data).hexdigest()


def utc(value, field):
    demand(isinstance(value, str), field + " must be UTC")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(field + " must be ISO8601 UTC") from exc
    demand(parsed.tzinfo is not None and parsed.utcoffset() == timedelta(0),
           field + " must include explicit UTC offset")


def jlines(filename):
    return [json.loads(s) for s in (ROOT / filename).read_text(encoding="utf-8").splitlines() if s.strip()]


def readcsv(name):
    with (ROOT / name).open(encoding="utf-8-sig", newline="") as handle:
        reader = csv.DictReader(handle)
        return reader.fieldnames, list(reader)


def rendercsv(name, fields, rows):
    buf = io.StringIO(newline="")
    writer = csv.DictWriter(buf, fieldnames=fields, lineterminator="\n")
    writer.writeheader()
    writer.writerows(rows)
    raw = (ROOT / name).read_bytes()
    prefix = b"\xef\xbb\xbf" if raw.startswith(b"\xef\xbb\xbf") else b""
    return prefix + buf.getvalue().encode("utf-8")


def index_source():
    ids = {s["id"] for s in jlines("stories_70x2.jsonl") + jlines("stories_e2e.jsonl")}
    routes = {s["case_id"] for s in jlines(PROBES_JSONL)}
    _, ops = readcsv(OPERATIONS)
    operations = {s["operation_id"] for s in ops}
    demand(len(ids) == 185 and len(routes) == 825 and len(operations) == 306,
           "inventories drifted; reconcile source before evidence")
    return {"stories": ids, "route_probes": routes, "operations": operations}


def empty_index():
    return {
        "schema": "sf-uat-execution-index-v1",
        "candidate_sha": None,
        "stories": {},
        "route_probes": {},
        "operations": {},
    }


def parse_index(trace, inventories):
    idx = trace.get("execution_index", empty_index())
    demand(idx.get("schema") == "sf-uat-execution-index-v1", "unknown execution index schema")
    for kind in ("stories", "route_probes", "operations"):
        demand(isinstance(idx.get(kind), dict), kind + " is not a map")
        demand(set(idx[kind]) <= inventories[kind], kind + " contains unknown case IDs")
        for key, record in idx[kind].items():
            attempts = record.get("attempts")
            demand(isinstance(attempts, list) and len(attempts) > 0, "empty attempts for " + key)
            seen = set()
            for a in attempts:
                demand(a.get("status") in TERMINAL, "invalid status in " + key)
                demand(a.get("attempt_id") not in seen, "duplicate attempt ID in " + key)
                seen.add(a["attempt_id"])
                demand(bool(SHA64.fullmatch(a.get("record_sha256", ""))), "invalid evidence digest")
                demand(a.get("product_commit_sha") == idx.get("candidate_sha"), "mixed candidate SHAs")
    if any(idx[kind] for kind in ("stories", "route_probes", "operations")):
        demand(bool(SHA40.fullmatch(idx.get("candidate_sha") or "")), "candidate SHA not pinned")
    return idx


def latest(idx, kind, case_id):
    entry = idx[kind].get(case_id)
    return entry["attempts"][-1] if entry else None


def status(idx, kind, case_id):
    entry = latest(idx, kind, case_id)
    return entry["status"] if entry else "NOT_RUN"


def validate_record(rec, inventories):
    demand(rec.get("schema") == "sf-uat-evidence-v1", "wrong evidence schema")
    case_id = rec.get("case_id")
    kinds = [kind for kind, ids in inventories.items() if case_id in ids]
    demand(len(kinds) == 1, "case_id absent or ambiguous in UAT catalog")
    st = rec.get("status")
    demand(st in TERMINAL, "NOT_RUN or pre-proof may not be imported as execution")
    for key in ("attempt_id", "operator_alias", "actor_role"):
        demand(isinstance(rec.get(key), str) and ALIAS.fullmatch(rec[key]),
               key + " must be a safe alias, not UPN/ID")
    for key in ("timestamp_utc",):
        utc(rec.get(key), key)
    for key in ("product_commit_sha", "git_tree_sha"):
        demand(bool(SHA40.fullmatch(rec.get(key) or "")), key + " must be full Git SHA")
    for key in ("installed_artifact_sha256",):
        demand(bool(SHA64.fullmatch(rec.get(key) or "")), key + " must be SHA-256")
    demand(bool(rec.get("actual_result")), "observed actual_result required")
    demand(rec.get("reason_code") is None or bool(REASON.fullmatch(rec["reason_code"])),
           "reason_code must be a safe constant (no free text or private IDs)")
    if st in {"BLOCKED_CAPABILITY", "BLOCKED_ENVIRONMENT", "FAILED_PRODUCT"}:
        demand(bool(rec.get("reason_code")), "blocked/failed requires reason_code")
        demand(bool(rec.get("sanitized_trace_ref") or rec.get("screenshots_or_video_refs")),
               "failure/block requires a secured witness")
    if st == "FAILED_PRODUCT":
        demand(bool(rec.get("defect_id")), "failed case requires defect reference")
    if st == "NOT_APPLICABLE_APPROVED":
        demand(bool(rec.get("owner_approval_ref")), "N/A requires owner's signed approval")
    if st in {"PASSED_WITH_EVIDENCE", "NOT_APPLICABLE_APPROVED"}:
        for key in ("reviewed_by", "signed_at_utc"):
            demand(bool(rec.get(key)), "admitted result requires reviewer/signature: " + key)
        demand(bool(ALIAS.fullmatch(rec["reviewed_by"])), "reviewer must be safe alias")
        utc(rec["signed_at_utc"], "signed_at_utc")
        demand(rec["reviewed_by"] != rec["operator_alias"], "independent review required")
    if st == "PASSED_WITH_EVIDENCE":
        demand(rec.get("authenticated_session_proven") is True,
               "PASS requires independently observed authentication/session")
        demand(rec.get("authorization_snapshot_ref") not in (None, "", "STORE_SECURELY_NOT_IN_GIT"),
               "PASS needs secure authorization snapshot")
        demand(bool(rec.get("policy_revision")), "PASS needs policy revision")
        for key in ("before_source_sha256", "after_source_sha256"):
            demand(bool(SHA64.fullmatch(rec.get(key) or "")), "PASS requires " + key)
        demand(bool(rec.get("sanitized_trace_ref") or rec.get("screenshots_or_video_refs")),
               "PASS must link actual observable evidence")
        effect = rec.get("effect_class")
        demand(effect in ("READ_ONLY", "MUTATION", "DENIAL", "COMPOSITE"),
               "PASS must explicitly classify READ_ONLY/MUTATION/DENIAL/COMPOSITE")
        if effect in ("MUTATION", "COMPOSITE"):
            demand(bool(rec.get("business_receipt_id_redacted")),
                   "PASS of mutation/composite requires real business receipt")
        if effect == "DENIAL":
            demand(bool(rec.get("negative_no_commit_proof")),
                   "PASS of denial requires no-commit proof")
        if effect == "READ_ONLY":
            demand(rec.get("before_source_sha256") == rec.get("after_source_sha256"),
                   "read-only story must not mutate its source")
    if rec.get("live_tenant_observed"):
        demand(st in EXECUTED and bool(SHA64.fullmatch(rec.get("deployment_proof_sha256") or "")),
               "live tenant claim requires verified deployment proof digest")
    return kinds[0]


def summary(rec, evidence_ref, source_bytes):
    def safe(key):
        s = rec.get(key)
        return s if isinstance(s, str) and ALIAS.fullmatch(s) else None
    return {
        "attempt_id": rec["attempt_id"],
        "record_sha256": digest(source_bytes),
        "evidence_ref": evidence_ref,
        "timestamp_utc": rec["timestamp_utc"],
        "product_commit_sha": rec["product_commit_sha"],
        "actor_role": rec["actor_role"],
        "operator_alias": rec["operator_alias"],
        "reviewer_alias": safe("reviewed_by"),
        "status": rec["status"],
        "reason_code": rec.get("reason_code"),
        "defect_id": safe("defect_id"),
        "before_source_sha256": rec.get("before_source_sha256"),
        "after_source_sha256": rec.get("after_source_sha256"),
        "receipt_sha256": digest(rec["business_receipt_id_redacted"]) if rec.get("business_receipt_id_redacted") else None,
        "live_tenant_observed": bool(rec.get("live_tenant_observed")),
        "deployment_proof_sha256": rec.get("deployment_proof_sha256") if rec.get("live_tenant_observed") else None,
    }


def project(idx):
    updates = {}
    fields, surface_rows = readcsv(SURFACES)
    for row in surface_rows:
        row["primary_execution"] = status(idx, "stories", row["primary_story"])
        row["negative_execution"] = status(idx, "stories", row["negative_story"])
    updates[SURFACES] = rendercsv(SURFACES, fields, surface_rows)

    fields, probes = readcsv(PROBES)
    probe_groups = {}
    for row in probes:
        row["status"] = status(idx, "route_probes", row["case_id"])
        key = (row["surface_id"], row["route_kind"], row["pattern"])
        probe_groups.setdefault(key, []).append(row)
    updates[PROBES] = rendercsv(PROBES, fields, probes)
    demand(len(probe_groups) == 165 and all(len(v) == 5 for v in probe_groups.values()),
           "route probes must be exactly five per route")

    original = (ROOT / PROBES_JSONL).read_text(encoding="utf-8")
    revised = []
    for line in original.splitlines(keepends=True):
        if not line.strip():
            revised.append(line)
            continue
        entry = json.loads(line)
        goal = status(idx, "route_probes", entry["case_id"])
        if entry["status"] != goal:
            change = re.sub(r'("status"\s*:\s*)"[^"]+"',
                            lambda match: match.group(1) + json.dumps(goal), line, count=1)
            demand(change != line, "unable to update JSONL status for " + entry["case_id"])
            line = change
        revised.append(line)
    updates[PROBES_JSONL] = "".join(revised).encode("utf-8")

    fields, routes = readcsv(ROUTES)
    for row in routes:
        key = (row["surface_id"], row["route_kind"], row["pattern"])
        matches = probe_groups.get(key)
        demand(matches is not None, "route not found in probe source")
        statuses = {item["status"] for item in matches}
        if "FAILED_PRODUCT" in statuses:
            aggregate = "FAILED_PRODUCT"
        elif "BLOCKED_CAPABILITY" in statuses:
            aggregate = "BLOCKED_CAPABILITY"
        elif "BLOCKED_ENVIRONMENT" in statuses:
            aggregate = "BLOCKED_ENVIRONMENT"
        elif statuses == {"PASSED_WITH_EVIDENCE"}:
            aggregate = "PASSED_WITH_EVIDENCE"
        elif statuses == {"NOT_APPLICABLE_APPROVED"}:
            aggregate = "NOT_APPLICABLE_APPROVED"
        else:
            aggregate = "NOT_RUN"  # unfinished five-probe route is NEVER passed
        row["execution_status"] = aggregate
        row["evidence_id"] = ";".join(item["case_id"] for item in matches if item["status"] != "NOT_RUN")
    updates[ROUTES] = rendercsv(ROUTES, fields, routes)

    fields, ops = readcsv(OPERATIONS)
    for row in ops:
        row["execution_status"] = status(idx, "operations", row["operation_id"])
    updates[OPERATIONS] = rendercsv(OPERATIONS, fields, ops)
    return updates


def projected_trace(original, idx, updates):
    trace = json.loads(json.dumps(original))  # do not mutate before all checks succeed
    trace["execution_index"] = idx
    attempts = [
        latest(idx, kind, key)
        for kind in ("stories", "route_probes", "operations")
        for key in idx[kind]
    ]
    trace["executed_tests"] = sum(a["status"] in EXECUTED for a in attempts)
    trace["live_tenant_tests"] = sum(a["status"] in EXECUTED and a["live_tenant_observed"] for a in attempts)
    trace["not_run"] = not bool(attempts)
    trace["go_live_approved"] = False
    if attempts:
        trace["status"] = "PRODUCT_EXECUTION_IN_PROGRESS_NOT_GO_LIVE"
    for name in trace["file_sha256"]:
        data = updates.get(name)
        if data is None:
            data = (ROOT / name).read_bytes()
        trace["file_sha256"][name] = digest(data)
    return trace


def assert_consistent(trace, idx, updates):
    for name, expected in updates.items():
        demand((ROOT / name).read_bytes() == expected, name + " not synchronized with evidence ledger")
    expected = projected_trace(trace, idx, updates)
    for key in ("execution_index", "executed_tests", "live_tenant_tests", "not_run", "go_live_approved", "file_sha256"):
        if key == "execution_index" and key not in trace and not any(idx[k] for k in ("stories", "route_probes", "operations")):
            continue  # original design version is valid before the first execution
        demand(trace.get(key) == expected[key], "QA-TRACEABILITY.json out of sync: " + key)
    if any(idx[k] for k in ("stories", "route_probes", "operations")):
        demand(trace.get("status") == expected["status"], "execution status header out of sync")


def save_files(updates, trace):
    outputs = dict(updates)
    outputs[TRACE] = (json.dumps(trace, ensure_ascii=False, indent=2) + "\n").encode("utf-8")
    staged = []
    try:
        for name, data in outputs.items():
            with tempfile.NamedTemporaryFile(mode="wb", dir=ROOT / Path(name).parent,
                                             prefix=".uat-", delete=False) as temp:
                temp.write(data)
                staged.append((Path(temp.name), ROOT / name))
        for source, dest in staged:
            os.replace(source, dest)
    finally:
        for source, _ in staged:
            source.unlink(missing_ok=True)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    exclusive = parser.add_mutually_exclusive_group(required=True)
    exclusive.add_argument("--check", action="store_true")
    exclusive.add_argument("--record", type=Path)
    parser.add_argument("--evidence-ref", help="Opaque sanitized alias of the private, immutable evidence")
    args = parser.parse_args()
    trace = json.loads((ROOT / TRACE).read_text(encoding="utf-8"))
    inventories = index_source()
    idx = parse_index(trace, inventories)
    if args.check:
        assert_consistent(trace, idx, project(idx))
        print("UAT_RECONCILED: CSV + JSONL + QA-TRACEABILITY agree (product NOT executed by this command)")
        return
    demand(args.evidence_ref is not None and bool(ALIAS.fullmatch(args.evidence_ref)),
           "need safe evidence reference alias, never a token/path/UPN")
    source_bytes = args.record.read_bytes()
    rec = json.loads(source_bytes)
    kind = validate_record(rec, inventories)
    candidate = idx["candidate_sha"]
    if candidate:
        demand(candidate == rec["product_commit_sha"], "different installed SHA: new reviewed campaign required")
    else:
        idx["candidate_sha"] = rec["product_commit_sha"]
    case_id = rec["case_id"]
    entry = idx[kind].setdefault(case_id, {"attempts": []})
    incoming = summary(rec, args.evidence_ref, source_bytes)
    for attempt in entry["attempts"]:
        if attempt["attempt_id"] == incoming["attempt_id"]:
            demand(attempt == incoming, "attempt_id collision: refusing overwrite of evidence")
            break
    else:
        entry["attempts"].append(incoming)
    updates = project(idx)
    newtrace = projected_trace(trace, idx, updates)
    save_files(updates, newtrace)
    assert_consistent(newtrace, idx, project(idx))
    print("UAT_RECONCILED:", case_id, incoming["status"], "record_sha256=" + incoming["record_sha256"])


if __name__ == "__main__":
    try:
        main()
    except (ValueError, KeyError, OSError, json.JSONDecodeError) as exc:
        print("UAT_RECONCILIATION_REJECTED: " + str(exc), file=sys.stderr)
        raise SystemExit(2) from None
