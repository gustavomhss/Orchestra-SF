#!/usr/bin/env python3
"""Evaluate the 13 capability and 8 environment preflight stories.

The evaluator consumes reviewed story classification plus sanitized observations
from an exact installed candidate. It can emit only BLOCKED_CAPABILITY,
BLOCKED_ENVIRONMENT, READY_FOR_EXECUTION, or PRECHECK_INCOMPLETE. It never emits
PASS, executes a journey, grants authority, or writes the repository ledger.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timedelta
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any

SELECTION_SCHEMA = "sf-blocked-harness-selection-v1"
OBSERVATIONS_SCHEMA = "sf-blocked-harness-observations-v1"
BUNDLE_SCHEMA = "sf-blocked-harness-bundle-v1"
RESULT_SCHEMA = "sf-blocked-harness-result-v1"
EXPECTED_CAPABILITY = 13
EXPECTED_ENVIRONMENT = 8
EXPECTED_TOTAL = EXPECTED_CAPABILITY + EXPECTED_ENVIRONMENT
CAPABILITY_KINDS = {
    "operation_catalog",
    "route_manifest",
    "installed_feature",
    "policy",
    "producer_port",
    "release_promotion",
}
ENVIRONMENT_KINDS = {
    "tenant",
    "actor",
    "vm",
    "fault_injection",
    "dr_restore",
    "performance",
    "browser",
    "external_service",
}
OBSERVED_STATES = {"PRESENT", "ABSENT", "UNAVAILABLE"}
RESULT_STATES = {
    "BLOCKED_CAPABILITY",
    "BLOCKED_ENVIRONMENT",
    "READY_FOR_EXECUTION",
    "PRECHECK_INCOMPLETE",
}
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA64 = re.compile(r"^[0-9a-f]{64}$")
STORY_ID = re.compile(r"^SF-[A-Z0-9-]+$")
SAFE_ALIAS = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.-]{1,90}$")
SAFE_REF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:/@#-]{1,190}$")
REASON = re.compile(r"^[A-Z][A-Z0-9_]{1,79}$")
REQUIREMENT_ID = re.compile(r"^[A-Z][A-Z0-9_.-]{1,79}$")
FORBIDDEN_KEYS = {
    "token",
    "access_token",
    "refresh_token",
    "id_token",
    "client_secret",
    "password",
    "cookie",
    "set_cookie",
    "authorization_header",
}
ROOT = Path(__file__).resolve().parents[2]


def demand(condition: bool, message: str) -> None:
    if not condition:
        raise ValueError(message)


def canonical(value: Any) -> bytes:
    return json.dumps(
        value,
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")


def digest(value: Any) -> str:
    raw = value if isinstance(value, bytes) else canonical(value)
    return hashlib.sha256(raw).hexdigest()


def reject_secret_keys(value: Any, path: str = "$") -> None:
    if isinstance(value, dict):
        for key, child in value.items():
            demand(isinstance(key, str), f"{path} contains a non-string key")
            demand(key.lower() not in FORBIDDEN_KEYS, f"{path}.{key} is a secret-bearing key")
            reject_secret_keys(child, f"{path}.{key}")
    elif isinstance(value, list):
        for index, child in enumerate(value):
            reject_secret_keys(child, f"{path}[{index}]")


def utc(value: Any, field: str) -> None:
    demand(isinstance(value, str), f"{field} must be ISO8601 UTC")
    try:
        parsed = datetime.fromisoformat(value.replace("Z", "+00:00"))
    except ValueError as exc:
        raise ValueError(f"{field} must be ISO8601 UTC") from exc
    demand(parsed.tzinfo is not None and parsed.utcoffset() == timedelta(0),
           f"{field} must include an explicit UTC offset")


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path.name}:{number} is invalid JSON") from exc
        demand(isinstance(row, dict), f"{path.name}:{number} is not an object")
        result.append(row)
    return result


def load_inventory(root: Path = ROOT) -> dict[str, dict[str, Any]]:
    rows = read_jsonl(root / "stories_70x2.jsonl") + read_jsonl(root / "stories_e2e.jsonl")
    inventory: dict[str, dict[str, Any]] = {}
    for row in rows:
        story_id = row.get("id")
        demand(isinstance(story_id, str) and STORY_ID.fullmatch(story_id) is not None,
               "story source contains an invalid ID")
        demand(story_id not in inventory, f"duplicate story ID {story_id}")
        inventory[story_id] = row
    demand(len(inventory) == 185, f"expected 185 source stories, found {len(inventory)}")
    return inventory


def validate_selection(
    selection: dict[str, Any],
    inventory: dict[str, dict[str, Any]],
) -> dict[str, dict[str, Any]]:
    expected_keys = {
        "schema",
        "candidate_sha",
        "candidate_tree_sha",
        "installed_artifact_sha256",
        "classification_source_ref",
        "classification_source_sha256",
        "stories",
    }
    demand(set(selection) == expected_keys, "selection fields must match the closed v1 contract")
    demand(selection.get("schema") == SELECTION_SCHEMA, "unknown selection schema")
    demand(bool(SHA40.fullmatch(selection.get("candidate_sha") or "")), "invalid candidate SHA")
    demand(bool(SHA40.fullmatch(selection.get("candidate_tree_sha") or "")), "invalid candidate tree SHA")
    demand(bool(SHA64.fullmatch(selection.get("installed_artifact_sha256") or "")),
           "invalid installed artifact SHA-256")
    demand(bool(SAFE_REF.fullmatch(selection.get("classification_source_ref") or "")),
           "invalid classification source reference")
    demand(bool(SHA64.fullmatch(selection.get("classification_source_sha256") or "")),
           "invalid classification source digest")

    stories = selection.get("stories")
    demand(isinstance(stories, list) and len(stories) == EXPECTED_TOTAL,
           f"selection must contain exactly {EXPECTED_TOTAL} stories")
    result: dict[str, dict[str, Any]] = {}
    counts = {"BLOCKED_CAPABILITY": 0, "BLOCKED_ENVIRONMENT": 0}
    for story in stories:
        demand(isinstance(story, dict), "selection story must be an object")
        demand(set(story) == {
            "id", "classification", "classification_evidence_ref", "actor_role", "requirements"
        }, "selection story fields must match the closed v1 contract")
        story_id = story.get("id")
        classification = story.get("classification")
        demand(isinstance(story_id, str) and STORY_ID.fullmatch(story_id) is not None,
               "selection contains an invalid story ID")
        demand(story_id in inventory, f"unknown story {story_id}")
        demand(story_id not in result, f"duplicate story {story_id}")
        demand(classification in counts, f"invalid classification for {story_id}")
        demand(bool(SAFE_REF.fullmatch(story.get("classification_evidence_ref") or "")),
               f"invalid classification evidence reference for {story_id}")
        demand(bool(SAFE_ALIAS.fullmatch(story.get("actor_role") or "")),
               f"invalid actor_role for {story_id}")
        demand(inventory[story_id].get("status") == "DESIGNED_NOT_EXECUTED",
               f"{story_id} is no longer in source design state")
        requirements = story.get("requirements")
        demand(isinstance(requirements, list) and requirements,
               f"{story_id} must declare at least one requirement")
        seen_requirements: set[str] = set()
        allowed_kinds = CAPABILITY_KINDS if classification == "BLOCKED_CAPABILITY" else ENVIRONMENT_KINDS
        for requirement in requirements:
            demand(isinstance(requirement, dict), f"{story_id} has a non-object requirement")
            demand(set(requirement) == {"id", "kind", "blocked_reason_code", "description"},
                   f"{story_id} requirement fields do not match the closed v1 contract")
            requirement_id = requirement.get("id")
            demand(isinstance(requirement_id, str)
                   and REQUIREMENT_ID.fullmatch(requirement_id) is not None,
                   f"{story_id} has an invalid requirement ID")
            demand(requirement_id not in seen_requirements,
                   f"{story_id} duplicates requirement {requirement_id}")
            seen_requirements.add(requirement_id)
            demand(requirement.get("kind") in allowed_kinds,
                   f"{story_id}/{requirement_id} uses a requirement kind from the wrong class")
            demand(bool(REASON.fullmatch(requirement.get("blocked_reason_code") or "")),
                   f"{story_id}/{requirement_id} has an invalid blocked reason")
            demand(isinstance(requirement.get("description"), str)
                   and 3 <= len(requirement["description"]) <= 500,
                   f"{story_id}/{requirement_id} has an invalid description")
        counts[classification] += 1
        result[story_id] = story
    demand(counts["BLOCKED_CAPABILITY"] == EXPECTED_CAPABILITY,
           f"expected {EXPECTED_CAPABILITY} capability stories")
    demand(counts["BLOCKED_ENVIRONMENT"] == EXPECTED_ENVIRONMENT,
           f"expected {EXPECTED_ENVIRONMENT} environment stories")
    reject_secret_keys(selection)
    return result


def validate_observations(
    observations: dict[str, Any],
    selection: dict[str, Any],
    stories: dict[str, dict[str, Any]],
) -> dict[tuple[str, str], dict[str, Any]]:
    expected_keys = {
        "schema",
        "candidate_sha",
        "candidate_tree_sha",
        "installed_artifact_sha256",
        "observed_at_utc",
        "operator_alias",
        "attempt_alias",
        "probe_bundle_sha256",
        "observations",
    }
    demand(set(observations) == expected_keys,
           "observation fields must match the closed v1 contract")
    demand(observations.get("schema") == OBSERVATIONS_SCHEMA, "unknown observations schema")
    for key in ("candidate_sha", "candidate_tree_sha", "installed_artifact_sha256"):
        demand(observations.get(key) == selection.get(key), f"observation {key} does not match selection")
    utc(observations.get("observed_at_utc"), "observed_at_utc")
    demand(bool(SAFE_ALIAS.fullmatch(observations.get("operator_alias") or "")),
           "operator_alias must be a safe alias")
    demand(bool(SAFE_ALIAS.fullmatch(observations.get("attempt_alias") or "")),
           "attempt_alias must be a safe alias")
    demand(bool(SHA64.fullmatch(observations.get("probe_bundle_sha256") or "")),
           "probe_bundle_sha256 must be SHA-256")

    expected_pairs = {
        (story_id, requirement["id"])
        for story_id, story in stories.items()
        for requirement in story["requirements"]
    }
    rows = observations.get("observations")
    demand(isinstance(rows, list), "observations must be a list")
    indexed: dict[tuple[str, str], dict[str, Any]] = {}
    for row in rows:
        demand(isinstance(row, dict), "observation row must be an object")
        demand(set(row) == {
            "story_id", "requirement_id", "state", "sanitized_trace_ref", "observed_value_sha256"
        }, "observation row fields must match the closed v1 contract")
        pair = (row.get("story_id"), row.get("requirement_id"))
        demand(pair in expected_pairs, f"unexpected observation {pair}")
        demand(pair not in indexed, f"duplicate observation {pair}")
        demand(row.get("state") in OBSERVED_STATES, f"invalid observation state for {pair}")
        demand(bool(SAFE_REF.fullmatch(row.get("sanitized_trace_ref") or "")),
               f"invalid sanitized trace reference for {pair}")
        demand(bool(SHA64.fullmatch(row.get("observed_value_sha256") or "")),
               f"invalid observed value digest for {pair}")
        indexed[pair] = row
    demand(set(indexed) == expected_pairs, "one or more requirements lack an observation")
    reject_secret_keys(observations)
    return indexed


def safe_attempt_id(attempt_alias: str, story_id: str) -> str:
    candidate = f"{attempt_alias}-{story_id.lower()}"
    if len(candidate) <= 90:
        return candidate
    return f"{attempt_alias[:65]}-{hashlib.sha256(story_id.encode()).hexdigest()[:16]}"


def build_record(
    story: dict[str, Any],
    status: str,
    blocker: dict[str, Any],
    requirement: dict[str, Any],
    selection: dict[str, Any],
    observations: dict[str, Any],
) -> dict[str, Any]:
    record = {
        "schema": "sf-uat-evidence-v1",
        "case_id": story["id"],
        "status": status,
        "attempt_id": safe_attempt_id(observations["attempt_alias"], story["id"]),
        "operator_alias": observations["operator_alias"],
        "actor_role": story["actor_role"],
        "timestamp_utc": observations["observed_at_utc"],
        "product_commit_sha": selection["candidate_sha"],
        "git_tree_sha": selection["candidate_tree_sha"],
        "installed_artifact_sha256": selection["installed_artifact_sha256"],
        "actual_result": (
            f"Preflight observed required {requirement['kind']} as {blocker['state']} on the exact "
            "installed candidate; the user journey did not start."
        ),
        "reason_code": requirement["blocked_reason_code"],
        "sanitized_trace_ref": blocker["sanitized_trace_ref"],
        "preflight_probe_bundle_sha256": observations["probe_bundle_sha256"],
        "observed_value_sha256": blocker["observed_value_sha256"],
        "live_tenant_observed": False,
    }
    reject_secret_keys(record)
    return record


def evaluate(
    inventory: dict[str, dict[str, Any]],
    selection: dict[str, Any],
    observations: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    stories = validate_selection(selection, inventory)
    observed = validate_observations(observations, selection, stories)
    results: dict[str, dict[str, Any]] = {}
    records: dict[str, dict[str, Any]] = {}
    counts = {state: 0 for state in RESULT_STATES}

    for story_id in sorted(stories):
        story = stories[story_id]
        requirements = {requirement["id"]: requirement for requirement in story["requirements"]}
        rows = [observed[(story_id, requirement_id)] for requirement_id in requirements]
        classification = story["classification"]
        blocker: dict[str, Any] | None = None
        if classification == "BLOCKED_CAPABILITY":
            blocker = next((row for row in rows if row["state"] == "ABSENT"), None)
            if blocker is not None:
                result_state = "BLOCKED_CAPABILITY"
            elif any(row["state"] == "UNAVAILABLE" for row in rows):
                result_state = "PRECHECK_INCOMPLETE"
            else:
                result_state = "READY_FOR_EXECUTION"
        else:
            blocker = next((row for row in rows if row["state"] != "PRESENT"), None)
            result_state = "BLOCKED_ENVIRONMENT" if blocker is not None else "READY_FOR_EXECUTION"

        result = {
            "schema": RESULT_SCHEMA,
            "story_id": story_id,
            "classification": classification,
            "classification_evidence_ref": story["classification_evidence_ref"],
            "result": result_state,
            "candidate_sha": selection["candidate_sha"],
            "candidate_tree_sha": selection["candidate_tree_sha"],
            "installed_artifact_sha256": selection["installed_artifact_sha256"],
            "observed_at_utc": observations["observed_at_utc"],
            "journey_executed": False,
            "requirements": [
                {
                    "id": requirement_id,
                    "kind": requirements[requirement_id]["kind"],
                    "state": observed[(story_id, requirement_id)]["state"],
                    "sanitized_trace_ref": observed[(story_id, requirement_id)]["sanitized_trace_ref"],
                    "observed_value_sha256": observed[(story_id, requirement_id)]["observed_value_sha256"],
                }
                for requirement_id in sorted(requirements)
            ],
        }
        reject_secret_keys(result)
        results[story_id] = result
        counts[result_state] += 1
        if result_state in {"BLOCKED_CAPABILITY", "BLOCKED_ENVIRONMENT"}:
            demand(blocker is not None, "blocked result lacks blocker")
            requirement = requirements[blocker["requirement_id"]]
            records[story_id] = build_record(
                story, result_state, blocker, requirement, selection, observations
            )

    manifest_entries = []
    for story_id in sorted(results):
        entry = {
            "story_id": story_id,
            "result": results[story_id]["result"],
            "result_path": f"results/{story_id}.json",
            "result_sha256": digest(results[story_id]),
            "record_path": None,
            "record_sha256": None,
        }
        if story_id in records:
            entry["record_path"] = f"records/{story_id}.json"
            entry["record_sha256"] = digest(records[story_id])
        manifest_entries.append(entry)

    manifest = {
        "schema": BUNDLE_SCHEMA,
        "candidate_sha": selection["candidate_sha"],
        "candidate_tree_sha": selection["candidate_tree_sha"],
        "installed_artifact_sha256": selection["installed_artifact_sha256"],
        "classification_source_ref": selection["classification_source_ref"],
        "classification_source_sha256": selection["classification_source_sha256"],
        "selection_sha256": digest(selection),
        "observations_sha256": digest(observations),
        "probe_bundle_sha256": observations["probe_bundle_sha256"],
        "story_count": len(results),
        "classification_counts": {
            "BLOCKED_CAPABILITY": EXPECTED_CAPABILITY,
            "BLOCKED_ENVIRONMENT": EXPECTED_ENVIRONMENT,
        },
        "result_counts": counts,
        "journeys_executed": 0,
        "pass_claims": 0,
        "entries": manifest_entries,
    }
    reject_secret_keys(manifest)
    return manifest, results, records


def ensure_private_output(output: Path, root: Path) -> None:
    resolved_output = output.resolve()
    resolved_root = root.resolve()
    try:
        resolved_output.relative_to(resolved_root)
    except ValueError:
        return
    raise ValueError("blocked harness output must remain outside the repository")


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
                         encoding="utf-8")
    temporary.replace(path)


def write_bundle(
    output: Path,
    manifest: dict[str, Any],
    results: dict[str, dict[str, Any]],
    records: dict[str, dict[str, Any]],
    root: Path = ROOT,
) -> None:
    ensure_private_output(output, root)
    demand(not output.exists() or not any(output.iterdir()), "output directory already contains files")
    output.mkdir(parents=True, exist_ok=True)
    for story_id, result in sorted(results.items()):
        write_json(output / "results" / f"{story_id}.json", result)
    for story_id, record in sorted(records.items()):
        write_json(output / "records" / f"{story_id}.json", record)
    write_json(output / "manifest.json", manifest)


def check_bundle(directory: Path) -> dict[str, Any]:
    manifest_path = directory / "manifest.json"
    demand(manifest_path.is_file(), "manifest.json is missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    demand(manifest.get("schema") == BUNDLE_SCHEMA, "unknown bundle schema")
    demand(manifest.get("story_count") == EXPECTED_TOTAL, "bundle is not exactly 21 stories")
    demand(manifest.get("classification_counts") == {
        "BLOCKED_CAPABILITY": EXPECTED_CAPABILITY,
        "BLOCKED_ENVIRONMENT": EXPECTED_ENVIRONMENT,
    }, "classification counts changed")
    demand(manifest.get("journeys_executed") == 0 and manifest.get("pass_claims") == 0,
           "preflight bundle may not claim execution or PASS")
    demand(bool(SHA40.fullmatch(manifest.get("candidate_sha") or "")), "invalid candidate SHA")
    demand(bool(SHA40.fullmatch(manifest.get("candidate_tree_sha") or "")), "invalid tree SHA")
    demand(bool(SHA64.fullmatch(manifest.get("installed_artifact_sha256") or "")),
           "invalid artifact SHA-256")

    entries = manifest.get("entries")
    demand(isinstance(entries, list) and len(entries) == EXPECTED_TOTAL,
           "bundle entry inventory is incomplete")
    expected_files = {"manifest.json"}
    seen: set[str] = set()
    recomputed = {state: 0 for state in RESULT_STATES}
    for entry in entries:
        demand(isinstance(entry, dict) and set(entry) == {
            "story_id", "result", "result_path", "result_sha256", "record_path", "record_sha256"
        }, "invalid bundle entry")
        story_id = entry.get("story_id")
        demand(isinstance(story_id, str) and STORY_ID.fullmatch(story_id) is not None,
               "invalid story ID in bundle")
        demand(story_id not in seen, f"duplicate bundle entry {story_id}")
        seen.add(story_id)
        demand(entry.get("result") in RESULT_STATES, f"invalid result for {story_id}")
        demand(entry.get("result_path") == f"results/{story_id}.json",
               f"non-canonical result path for {story_id}")
        result_path = directory / entry["result_path"]
        demand(result_path.is_file(), f"missing result for {story_id}")
        result = json.loads(result_path.read_text(encoding="utf-8"))
        demand(digest(result) == entry.get("result_sha256"), f"result digest mismatch for {story_id}")
        demand(result.get("schema") == RESULT_SCHEMA and result.get("story_id") == story_id,
               f"result identity mismatch for {story_id}")
        demand(result.get("result") == entry["result"] and result.get("journey_executed") is False,
               f"result state mismatch for {story_id}")
        demand(result.get("candidate_sha") == manifest["candidate_sha"],
               f"mixed candidate SHA for {story_id}")
        reject_secret_keys(result)
        recomputed[entry["result"]] += 1
        expected_files.add(entry["result_path"])

        blocked = entry["result"] in {"BLOCKED_CAPABILITY", "BLOCKED_ENVIRONMENT"}
        if blocked:
            demand(entry.get("record_path") == f"records/{story_id}.json",
                   f"blocked story {story_id} lacks canonical evidence record path")
            demand(bool(SHA64.fullmatch(entry.get("record_sha256") or "")),
                   f"blocked story {story_id} lacks evidence record digest")
            record_path = directory / entry["record_path"]
            demand(record_path.is_file(), f"missing evidence record for {story_id}")
            record = json.loads(record_path.read_text(encoding="utf-8"))
            demand(digest(record) == entry["record_sha256"],
                   f"record digest mismatch for {story_id}")
            demand(record.get("schema") == "sf-uat-evidence-v1"
                   and record.get("case_id") == story_id
                   and record.get("status") == entry["result"],
                   f"record identity mismatch for {story_id}")
            demand(record.get("product_commit_sha") == manifest["candidate_sha"],
                   f"mixed record candidate SHA for {story_id}")
            demand(bool(REASON.fullmatch(record.get("reason_code") or "")),
                   f"invalid reason code for {story_id}")
            demand(bool(SAFE_REF.fullmatch(record.get("sanitized_trace_ref") or "")),
                   f"invalid trace reference for {story_id}")
            reject_secret_keys(record)
            expected_files.add(entry["record_path"])
        else:
            demand(entry.get("record_path") is None and entry.get("record_sha256") is None,
                   f"non-blocked story {story_id} must not produce a ledger record")

    demand(recomputed == manifest.get("result_counts"), "result counts do not match entries")
    actual_files = {
        path.relative_to(directory).as_posix()
        for path in directory.rglob("*")
        if path.is_file()
    }
    demand(actual_files == expected_files, "bundle contains unexpected or missing files")
    reject_secret_keys(manifest)
    return manifest


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    demand(isinstance(value, dict), f"{path} must contain one JSON object")
    return value


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)
    evaluate_parser = sub.add_parser("evaluate", help="evaluate exact-candidate preflight observations")
    evaluate_parser.add_argument("--selection", required=True, type=Path)
    evaluate_parser.add_argument("--observations", required=True, type=Path)
    evaluate_parser.add_argument("--output", required=True, type=Path)
    evaluate_parser.add_argument("--root", type=Path, default=ROOT)
    check_parser = sub.add_parser("check", help="verify a private preflight bundle")
    check_parser.add_argument("--directory", required=True, type=Path)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "evaluate":
            inventory = load_inventory(args.root)
            selection = load_json(args.selection)
            observations = load_json(args.observations)
            manifest, results, records = evaluate(inventory, selection, observations)
            write_bundle(args.output, manifest, results, records, args.root)
            print(json.dumps({
                "story_count": manifest["story_count"],
                "result_counts": manifest["result_counts"],
                "journeys_executed": manifest["journeys_executed"],
                "pass_claims": manifest["pass_claims"],
            }, sort_keys=True))
        else:
            manifest = check_bundle(args.directory)
            print(json.dumps({
                "story_count": manifest["story_count"],
                "result_counts": manifest["result_counts"],
                "verified": True,
            }, sort_keys=True))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"blocked harness rejected: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
