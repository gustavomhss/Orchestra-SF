#!/usr/bin/env python3
"""Supported fail-closed controller for the 13+8 blocked-story preflight.

The controller binds every selected actor role to the canonical source story,
validates generated blocked records against the append-only ledger contract, and
rebuilds the complete bundle from the external reviewed inputs during checking.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
import sys
from typing import Any

SCRIPTS_ROOT = Path(__file__).resolve().parents[1]
if str(SCRIPTS_ROOT) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_ROOT))

import reconcile_execution
from blocked_harness.evaluate import (
    ROOT,
    check_bundle,
    demand,
    digest,
    evaluate,
    load_inventory,
    load_json,
    write_bundle,
)


def source_actor_roles(source: dict[str, Any]) -> set[str]:
    """Return the actor roles explicitly declared by the canonical story."""
    roles: list[str] = []
    actor = source.get("actor")
    if isinstance(actor, str) and actor.strip():
        roles.append(actor)
    actors = source.get("actors")
    if isinstance(actors, list):
        for value in actors:
            demand(isinstance(value, str) and value.strip(),
                   f"{source.get('id')} contains an invalid source actor")
            if value not in roles:
                roles.append(value)
    demand(bool(roles), f"{source.get('id')} has no canonical actor role")
    return set(roles)


def validate_actor_bindings(
    inventory: dict[str, dict[str, Any]],
    selection: dict[str, Any],
) -> None:
    stories = selection.get("stories")
    demand(isinstance(stories, list), "selection stories must be a list")
    for selected in stories:
        demand(isinstance(selected, dict), "selection story must be an object")
        story_id = selected.get("id")
        demand(isinstance(story_id, str) and story_id in inventory,
               f"selection contains unknown story {story_id}")
        actor_role = selected.get("actor_role")
        demand(actor_role in source_actor_roles(inventory[story_id]),
               f"{story_id} actor_role is not declared by the canonical story")


def validate_ledger_records(
    inventory: dict[str, dict[str, Any]],
    records: dict[str, dict[str, Any]],
) -> None:
    inventories = {
        "stories": set(inventory),
        "route_probes": set(),
        "operations": set(),
    }
    for story_id, record in sorted(records.items()):
        demand(reconcile_execution.validate_record(record, inventories) == "stories",
               f"{story_id} record is incompatible with the append-only ledger")


def evaluate_exact_preflight(
    inventory: dict[str, dict[str, Any]],
    selection: dict[str, Any],
    observations: dict[str, Any],
) -> tuple[dict[str, Any], dict[str, dict[str, Any]], dict[str, dict[str, Any]]]:
    """Evaluate reviewed inputs with canonical actor and ledger checks."""
    validate_actor_bindings(inventory, selection)
    manifest, results, records = evaluate(inventory, selection, observations)
    validate_ledger_records(inventory, records)
    return manifest, results, records


def verify_exact_bundle(
    directory: Path,
    inventory: dict[str, dict[str, Any]],
    selection: dict[str, Any],
    observations: dict[str, Any],
) -> dict[str, Any]:
    """Verify structure and exact equality with a canonical re-evaluation."""
    actual_manifest = check_bundle(directory)
    expected_manifest, expected_results, expected_records = evaluate_exact_preflight(
        inventory,
        selection,
        observations,
    )
    demand(actual_manifest == expected_manifest,
           "manifest differs from canonical selection and observations")
    for story_id, expected_result in sorted(expected_results.items()):
        actual_result = load_json(directory / "results" / f"{story_id}.json")
        demand(actual_result == expected_result,
               f"result differs from canonical preflight evaluation: {story_id}")
    for story_id, expected_record in sorted(expected_records.items()):
        actual_record = load_json(directory / "records" / f"{story_id}.json")
        demand(actual_record == expected_record,
               f"record differs from canonical preflight evaluation: {story_id}")
    return actual_manifest


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)

    evaluate_parser = sub.add_parser("evaluate", help="evaluate exact-candidate preflight inputs")
    evaluate_parser.add_argument("--selection", required=True, type=Path)
    evaluate_parser.add_argument("--observations", required=True, type=Path)
    evaluate_parser.add_argument("--output", required=True, type=Path)
    evaluate_parser.add_argument("--root", type=Path, default=ROOT)

    check_parser = sub.add_parser("check", help="re-evaluate and verify a private bundle")
    check_parser.add_argument("--selection", required=True, type=Path)
    check_parser.add_argument("--observations", required=True, type=Path)
    check_parser.add_argument("--directory", required=True, type=Path)
    check_parser.add_argument("--root", type=Path, default=ROOT)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        inventory = load_inventory(args.root)
        selection = load_json(args.selection)
        observations = load_json(args.observations)
        if args.command == "evaluate":
            manifest, results, records = evaluate_exact_preflight(
                inventory,
                selection,
                observations,
            )
            write_bundle(args.output, manifest, results, records, root=args.root)
            print(json.dumps({
                "story_count": manifest["story_count"],
                "result_counts": manifest["result_counts"],
                "journeys_executed": manifest["journeys_executed"],
                "pass_claims": manifest["pass_claims"],
                "manifest_sha256": digest(manifest),
            }, sort_keys=True))
        else:
            manifest = verify_exact_bundle(
                args.directory,
                inventory,
                selection,
                observations,
            )
            print(json.dumps({
                "story_count": manifest["story_count"],
                "result_counts": manifest["result_counts"],
                "manifest_sha256": digest(manifest),
                "verified": True,
            }, sort_keys=True))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"blocked harness rejected: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
