#!/usr/bin/env python3
"""Build and verify an exact, fail-closed 94-story runtime campaign.

This module prepares private agent job packets. It never opens a browser, changes
product state, updates the UAT matrix, or imports evidence into the append-only
ledger. The 94 story IDs must come from a separately reviewed classification
receipt; aggregate counts from the audit are not enough to invent membership.
"""
from __future__ import annotations

import argparse
import hashlib
import json
from pathlib import Path
import re
import sys
from typing import Any

SELECTION_SCHEMA = "sf-runtime-ready-selection-v1"
CAMPAIGN_SCHEMA = "sf-runtime-agent-campaign-v1"
JOB_SCHEMA = "sf-runtime-agent-job-v1"
EXPECTED_STORIES = 94
ALLOWED_OUTCOMES = (
    "PASSED_WITH_EVIDENCE",
    "FAILED_PRODUCT",
    "BLOCKED_CAPABILITY",
    "BLOCKED_ENVIRONMENT",
)
SHA40 = re.compile(r"^[0-9a-f]{40}$")
SHA64 = re.compile(r"^[0-9a-f]{64}$")
STORY_ID = re.compile(r"^SF-[A-Z0-9-]+$")
SAFE_REF = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_.:/@#-]{1,190}$")
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


def read_jsonl(path: Path) -> list[dict[str, Any]]:
    rows: list[dict[str, Any]] = []
    for line_number, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        if not line.strip():
            continue
        try:
            row = json.loads(line)
        except json.JSONDecodeError as exc:
            raise ValueError(f"{path.name}:{line_number} is invalid JSON") from exc
        demand(isinstance(row, dict), f"{path.name}:{line_number} is not an object")
        rows.append(row)
    return rows


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
) -> list[dict[str, Any]]:
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
    demand(bool(SHA40.fullmatch(selection.get("candidate_sha") or "")), "candidate_sha must be full Git SHA")
    demand(bool(SHA40.fullmatch(selection.get("candidate_tree_sha") or "")), "candidate_tree_sha must be full Git tree SHA")
    demand(bool(SHA64.fullmatch(selection.get("installed_artifact_sha256") or "")),
           "installed_artifact_sha256 must be SHA-256")
    demand(bool(SAFE_REF.fullmatch(selection.get("classification_source_ref") or "")),
           "classification_source_ref must be a safe immutable reference")
    demand(bool(SHA64.fullmatch(selection.get("classification_source_sha256") or "")),
           "classification_source_sha256 must be SHA-256")

    selected = selection.get("stories")
    demand(isinstance(selected, list), "stories must be a list")
    demand(len(selected) == EXPECTED_STORIES,
           f"selection must contain exactly {EXPECTED_STORIES} stories, found {len(selected)}")
    seen: set[str] = set()
    normalized: list[dict[str, Any]] = []
    for item in selected:
        demand(isinstance(item, dict), "selection story must be an object")
        demand(set(item) == {"id", "classification", "classification_evidence_ref"},
               "selection story fields must match the closed v1 contract")
        story_id = item.get("id")
        demand(isinstance(story_id, str) and STORY_ID.fullmatch(story_id) is not None,
               "selection contains an invalid story ID")
        demand(story_id in inventory, f"selection contains unknown story {story_id}")
        demand(story_id not in seen, f"selection duplicates {story_id}")
        seen.add(story_id)
        demand(item.get("classification") == "PATH_PRESENT_RUNTIME_REQUIRED",
               f"{story_id} is not classified PATH_PRESENT_RUNTIME_REQUIRED")
        demand(bool(SAFE_REF.fullmatch(item.get("classification_evidence_ref") or "")),
               f"{story_id} lacks a safe classification evidence reference")
        source = inventory[story_id]
        demand(source.get("status") == "DESIGNED_NOT_EXECUTED",
               f"{story_id} source status is not DESIGNED_NOT_EXECUTED")
        demand(not source.get("conditional_release_feature"),
               f"{story_id} declares a conditional release feature and cannot enter runtime-ready queue")
        normalized.append(item)
    reject_secret_keys(selection)
    return normalized


def source_actors(story: dict[str, Any]) -> list[str]:
    actors = story.get("actors")
    if isinstance(actors, list) and actors:
        values = actors
    else:
        values = [story.get("actor")]
    result: list[str] = []
    for actor in values:
        demand(isinstance(actor, str) and actor.strip(), "story has an invalid actor")
        if actor not in result:
            result.append(actor)
    return result


def source_surfaces(story: dict[str, Any]) -> list[str]:
    values = story.get("surface_ids")
    demand(isinstance(values, list) and values, "story has no surface_ids")
    result: list[str] = []
    for surface in values:
        demand(isinstance(surface, str) and re.fullmatch(r"(?:CAP|UI)[0-9]{2}", surface) is not None,
               "story contains an invalid surface ID")
        if surface not in result:
            result.append(surface)
    return result


def build_job(
    story: dict[str, Any],
    classification: dict[str, Any],
    selection: dict[str, Any],
) -> dict[str, Any]:
    actors = source_actors(story)
    surfaces = source_surfaces(story)
    fixture_digest = hashlib.sha256(str(story.get("fixture", "")).encode("utf-8")).hexdigest()[:16]
    lease_keys = sorted(
        [f"surface:{surface}" for surface in surfaces]
        + [f"actor:{actor}" for actor in actors]
        + [f"fixture:{fixture_digest}"]
    )
    job = {
        "schema": JOB_SCHEMA,
        "story_id": story["id"],
        "candidate_sha": selection["candidate_sha"],
        "candidate_tree_sha": selection["candidate_tree_sha"],
        "installed_artifact_sha256": selection["installed_artifact_sha256"],
        "classification": classification["classification"],
        "classification_evidence_ref": classification["classification_evidence_ref"],
        "source_story_sha256": digest(story),
        "lease_keys": lease_keys,
        "source_story": story,
        "execution_contract": {
            "one_story_only": True,
            "allowed_outcomes": list(ALLOWED_OUTCOMES),
            "stop_at_first_unrecoverable_blocker": True,
            "ui_or_original_typed_port_only": True,
            "mocked_authority_forbidden": True,
            "blind_retry_after_unknown_mutation_forbidden": True,
            "source_reread_required": True,
            "contraproof_required": True,
            "evidence_must_remain_outside_git": True,
        },
        "evidence_record_template": {
            "schema": "sf-uat-evidence-v1",
            "case_id": story["id"],
            "status": "REPLACE_WITH_TERMINAL_STATUS",
            "attempt_id": "REPLACE_WITH_SAFE_ATTEMPT_ALIAS",
            "operator_alias": "REPLACE_WITH_SAFE_OPERATOR_ALIAS",
            "actor_role": story.get("actor"),
            "timestamp_utc": "REPLACE_WITH_ISO8601_UTC",
            "product_commit_sha": selection["candidate_sha"],
            "git_tree_sha": selection["candidate_tree_sha"],
            "installed_artifact_sha256": selection["installed_artifact_sha256"],
            "actual_result": "REPLACE_WITH_OBSERVED_RESULT",
            "reason_code": None,
            "sanitized_trace_ref": "STORE_SECURELY_NOT_IN_GIT",
        },
    }
    reject_secret_keys(job)
    return job


def assign_waves(jobs: list[dict[str, Any]], max_parallel: int) -> list[list[str]]:
    demand(type(max_parallel) is int and 1 <= max_parallel <= 32,
           "max_parallel must be an integer from 1 to 32")
    priority_rank = {"P0": 0, "P1": 1}
    ordered = sorted(
        jobs,
        key=lambda job: (
            priority_rank.get(job["source_story"].get("priority"), 9),
            -len(job["lease_keys"]),
            job["story_id"],
        ),
    )
    waves: list[list[str]] = []
    occupied: list[set[str]] = []
    for job in ordered:
        leases = set(job["lease_keys"])
        placed = False
        for index, wave in enumerate(waves):
            if len(wave) < max_parallel and occupied[index].isdisjoint(leases):
                wave.append(job["story_id"])
                occupied[index].update(leases)
                placed = True
                break
        if not placed:
            waves.append([job["story_id"]])
            occupied.append(set(leases))
    return waves


def build_campaign(
    inventory: dict[str, dict[str, Any]],
    selection: dict[str, Any],
    max_parallel: int = 8,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    selected = validate_selection(selection, inventory)
    jobs = {
        item["id"]: build_job(inventory[item["id"]], item, selection)
        for item in selected
    }
    waves = assign_waves(list(jobs.values()), max_parallel)
    wave_for = {story_id: index + 1 for index, wave in enumerate(waves) for story_id in wave}
    selection_sha256 = digest(selection)
    campaign_id = f"runtime94-{selection['candidate_sha'][:12]}-{selection_sha256[:12]}"
    inventory_sha256 = digest([
        {"id": story_id, "sha256": digest(inventory[story_id])}
        for story_id in sorted(inventory)
    ])
    manifest_jobs = []
    for story_id in sorted(jobs):
        manifest_jobs.append({
            "story_id": story_id,
            "wave": wave_for[story_id],
            "path": f"jobs/{story_id}.json",
            "sha256": digest(jobs[story_id]),
        })
    manifest = {
        "schema": CAMPAIGN_SCHEMA,
        "campaign_id": campaign_id,
        "candidate_sha": selection["candidate_sha"],
        "candidate_tree_sha": selection["candidate_tree_sha"],
        "installed_artifact_sha256": selection["installed_artifact_sha256"],
        "classification_source_ref": selection["classification_source_ref"],
        "classification_source_sha256": selection["classification_source_sha256"],
        "selection_sha256": selection_sha256,
        "source_inventory_sha256": inventory_sha256,
        "story_count": len(jobs),
        "wave_count": len(waves),
        "max_parallel_per_wave": max_parallel,
        "allowed_outcomes": list(ALLOWED_OUTCOMES),
        "waves": waves,
        "jobs": manifest_jobs,
        "execution_status": "NOT_RUN",
    }
    reject_secret_keys(manifest)
    return manifest, jobs


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_name(path.name + ".tmp")
    temporary.write_text(json.dumps(value, ensure_ascii=False, sort_keys=True, indent=2) + "\n",
                         encoding="utf-8")
    temporary.replace(path)


def ensure_private_output(output: Path, root: Path) -> None:
    resolved_output = output.resolve()
    resolved_root = root.resolve()
    try:
        resolved_output.relative_to(resolved_root)
    except ValueError:
        return
    raise ValueError("campaign output must remain outside the repository")


def write_campaign(
    output: Path,
    manifest: dict[str, Any],
    jobs: dict[str, dict[str, Any]],
    root: Path = ROOT,
) -> None:
    ensure_private_output(output, root)
    demand(not output.exists() or not any(output.iterdir()),
           "output directory already contains files")
    output.mkdir(parents=True, exist_ok=True)
    for story_id, job in sorted(jobs.items()):
        write_json(output / "jobs" / f"{story_id}.json", job)
    write_json(output / "manifest.json", manifest)


def check_campaign(directory: Path) -> dict[str, Any]:
    manifest_path = directory / "manifest.json"
    demand(manifest_path.is_file(), "manifest.json is missing")
    manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    demand(manifest.get("schema") == CAMPAIGN_SCHEMA, "unknown campaign schema")
    demand(manifest.get("story_count") == EXPECTED_STORIES, "campaign is not exactly 94 stories")
    demand(bool(SHA40.fullmatch(manifest.get("candidate_sha") or "")), "invalid campaign candidate SHA")
    demand(bool(SHA40.fullmatch(manifest.get("candidate_tree_sha") or "")), "invalid campaign tree SHA")
    demand(bool(SHA64.fullmatch(manifest.get("installed_artifact_sha256") or "")),
           "invalid campaign artifact SHA-256")
    demand(manifest.get("execution_status") == "NOT_RUN",
           "prepared campaign may not claim execution")
    demand(manifest.get("allowed_outcomes") == list(ALLOWED_OUTCOMES),
           "allowed outcomes changed")
    entries = manifest.get("jobs")
    waves = manifest.get("waves")
    demand(isinstance(entries, list) and len(entries) == EXPECTED_STORIES,
           "manifest job inventory is incomplete")
    demand(isinstance(waves, list) and len(waves) == manifest.get("wave_count"),
           "manifest wave inventory is inconsistent")

    expected_files = {"manifest.json"}
    seen: set[str] = set()
    jobs_by_id: dict[str, dict[str, Any]] = {}
    for entry in entries:
        demand(isinstance(entry, dict) and set(entry) == {"story_id", "wave", "path", "sha256"},
               "invalid job manifest entry")
        story_id = entry.get("story_id")
        demand(isinstance(story_id, str) and STORY_ID.fullmatch(story_id) is not None,
               "invalid story ID in manifest")
        demand(story_id not in seen, f"duplicate job {story_id}")
        seen.add(story_id)
        demand(entry.get("path") == f"jobs/{story_id}.json", "job path is not canonical")
        demand(type(entry.get("wave")) is int and entry["wave"] >= 1, "invalid wave number")
        demand(bool(SHA64.fullmatch(entry.get("sha256") or "")), "invalid job digest")
        job_path = directory / entry["path"]
        demand(job_path.is_file(), f"missing job file for {story_id}")
        job = json.loads(job_path.read_text(encoding="utf-8"))
        demand(digest(job) == entry["sha256"], f"job digest mismatch for {story_id}")
        demand(job.get("schema") == JOB_SCHEMA and job.get("story_id") == story_id,
               f"job identity mismatch for {story_id}")
        demand(job.get("candidate_sha") == manifest["candidate_sha"],
               f"mixed candidate SHA in {story_id}")
        demand(job.get("candidate_tree_sha") == manifest["candidate_tree_sha"],
               f"mixed tree SHA in {story_id}")
        reject_secret_keys(job)
        jobs_by_id[story_id] = job
        expected_files.add(entry["path"])

    flattened = [story_id for wave in waves for story_id in wave]
    demand(len(flattened) == EXPECTED_STORIES and set(flattened) == seen,
           "waves do not cover every job exactly once")
    wave_for = {story_id: index + 1 for index, wave in enumerate(waves) for story_id in wave}
    for entry in entries:
        demand(entry["wave"] == wave_for[entry["story_id"]], "job/wave mapping mismatch")
    for wave in waves:
        demand(len(wave) <= manifest.get("max_parallel_per_wave"), "wave exceeds parallel limit")
        leases: set[str] = set()
        for story_id in wave:
            current = set(jobs_by_id[story_id]["lease_keys"])
            demand(leases.isdisjoint(current), f"wave has overlapping leases at {story_id}")
            leases.update(current)

    actual_files = {
        path.relative_to(directory).as_posix()
        for path in directory.rglob("*")
        if path.is_file()
    }
    demand(actual_files == expected_files, "campaign directory contains unexpected or missing files")
    reject_secret_keys(manifest)
    return manifest


def load_json(path: Path) -> dict[str, Any]:
    value = json.loads(path.read_text(encoding="utf-8"))
    demand(isinstance(value, dict), f"{path} must contain one JSON object")
    return value


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)
    build = sub.add_parser("build", help="build private 94-story job packets")
    build.add_argument("--selection", required=True, type=Path)
    build.add_argument("--output", required=True, type=Path)
    build.add_argument("--max-parallel", type=int, default=8)
    build.add_argument("--root", type=Path, default=ROOT)
    check = sub.add_parser("check", help="verify an already prepared private campaign")
    check.add_argument("--directory", required=True, type=Path)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        if args.command == "build":
            inventory = load_inventory(args.root)
            selection = load_json(args.selection)
            manifest, jobs = build_campaign(inventory, selection, args.max_parallel)
            write_campaign(args.output, manifest, jobs, args.root)
            print(json.dumps({
                "campaign_id": manifest["campaign_id"],
                "story_count": manifest["story_count"],
                "wave_count": manifest["wave_count"],
                "execution_status": manifest["execution_status"],
            }, sort_keys=True))
        else:
            manifest = check_campaign(args.directory)
            print(json.dumps({
                "campaign_id": manifest["campaign_id"],
                "story_count": manifest["story_count"],
                "wave_count": manifest["wave_count"],
                "verified": True,
            }, sort_keys=True))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"runtime campaign rejected: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
