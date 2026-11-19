#!/usr/bin/env python3
"""Supported fail-closed entrypoint for the exact 94-story runtime campaign.

The lower-level prepare module builds and performs structural checks. This
controller additionally rebuilds the complete bundle from the independently
reviewed selection and the canonical story inventory, so coordinated changes to
both a job and its manifest digest cannot pass verification.
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

from runtime_campaign.prepare import (
    ROOT,
    build_campaign,
    check_campaign,
    demand,
    digest,
    load_inventory,
    load_json,
    write_campaign,
)


def build_exact_campaign(
    inventory: dict[str, dict[str, Any]],
    selection: dict[str, Any],
    max_parallel: int = 8,
) -> tuple[dict[str, Any], dict[str, dict[str, Any]]]:
    """Build the canonical campaign from reviewed inputs."""
    return build_campaign(inventory, selection, max_parallel)


def verify_exact_campaign(
    directory: Path,
    inventory: dict[str, dict[str, Any]],
    selection: dict[str, Any],
) -> dict[str, Any]:
    """Verify structure and exact equality with a canonical rebuild."""
    actual_manifest = check_campaign(directory)
    max_parallel = actual_manifest.get("max_parallel_per_wave")
    demand(type(max_parallel) is int and 1 <= max_parallel <= 32,
           "manifest max_parallel_per_wave must be an integer from 1 to 32")
    expected_manifest, expected_jobs = build_exact_campaign(
        inventory,
        selection,
        max_parallel=max_parallel,
    )
    demand(actual_manifest == expected_manifest,
           "manifest differs from canonical selection and source inventory")
    for story_id, expected_job in sorted(expected_jobs.items()):
        actual_job = load_json(directory / "jobs" / f"{story_id}.json")
        demand(actual_job == expected_job,
               f"job differs from canonical selection and source story: {story_id}")
    return actual_manifest


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    sub = result.add_subparsers(dest="command", required=True)

    build = sub.add_parser("build", help="build private exact 94-story job packets")
    build.add_argument("--selection", required=True, type=Path)
    build.add_argument("--output", required=True, type=Path)
    build.add_argument("--max-parallel", type=int, default=8)
    build.add_argument("--root", type=Path, default=ROOT)

    check = sub.add_parser("check", help="rebuild and verify a prepared campaign")
    check.add_argument("--selection", required=True, type=Path)
    check.add_argument("--directory", required=True, type=Path)
    check.add_argument("--root", type=Path, default=ROOT)
    return result


def main(argv: list[str] | None = None) -> int:
    args = parser().parse_args(argv)
    try:
        inventory = load_inventory(args.root)
        selection = load_json(args.selection)
        if args.command == "build":
            manifest, jobs = build_exact_campaign(
                inventory,
                selection,
                max_parallel=args.max_parallel,
            )
            write_campaign(args.output, manifest, jobs, root=args.root)
            print(json.dumps({
                "campaign_id": manifest["campaign_id"],
                "story_count": manifest["story_count"],
                "wave_count": manifest["wave_count"],
                "execution_status": manifest["execution_status"],
                "manifest_sha256": digest(manifest),
            }, sort_keys=True))
        else:
            manifest = verify_exact_campaign(args.directory, inventory, selection)
            print(json.dumps({
                "campaign_id": manifest["campaign_id"],
                "story_count": manifest["story_count"],
                "wave_count": manifest["wave_count"],
                "manifest_sha256": digest(manifest),
                "verified": True,
            }, sort_keys=True))
        return 0
    except (OSError, ValueError, json.JSONDecodeError) as exc:
        print(f"runtime campaign rejected: {exc}", file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
