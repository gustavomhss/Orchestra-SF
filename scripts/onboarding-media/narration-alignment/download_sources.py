#!/usr/bin/env python3
"""Materialize only declared narration WAVs from exact existing Actions artifacts."""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import shutil
import subprocess
import tempfile


def sha256(path: Path) -> str:
    return hashlib.sha256(path.read_bytes()).hexdigest()


def gh(arguments: list[str], timeout: int = 90) -> str:
    try:
        result = subprocess.run(["gh", *arguments], capture_output=True, text=True, timeout=timeout, check=False)
    except subprocess.TimeoutExpired:
        raise RuntimeError("GitHub artifact operation exceeded its bounded timeout") from None
    if result.returncode:
        # CLI stderr can contain a private signed transfer URL. Never persist it.
        raise RuntimeError(f"GitHub artifact operation failed (exit {result.returncode}); no private response logged")
    return result.stdout


def api(path: str) -> object:
    return json.loads(gh(["api", "--method", "GET", "-H", "X-GitHub-Api-Version: 2022-11-28", path]))


def unique_file(root: Path, basename: str) -> Path:
    matches = [path for path in root.rglob(basename) if path.is_file() and not path.is_symlink()]
    if len(matches) != 1 or not matches[0].resolve().is_relative_to(root.resolve()):
        raise ValueError(f"Artifact must contain exactly one ordinary {basename}")
    return matches[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--input", type=Path, required=True)
    parser.add_argument("--audio-root", type=Path, required=True)
    parser.add_argument("--receipt", type=Path, required=True)
    parser.add_argument("--repository", default="gustavomhss/Orchestra-SF")
    args = parser.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repository):
        raise ValueError("Invalid repository identity")
    manifest = json.loads(args.input.read_text(encoding="utf-8"))
    if manifest.get("schema") != "sf-narration-alignment-input-v1":
        raise ValueError("Unsupported source manifest")
    if not os.environ.get("GH_TOKEN"):
        raise ValueError("Require the scoped Actions read token in GH_TOKEN")
    if args.audio_root.exists() and any(args.audio_root.iterdir()):
        raise ValueError("Audio destination must be fresh to avoid reusing stale source bytes")
    args.audio_root.mkdir(parents=True, exist_ok=True)
    receipt = {"schema": "sf-narration-artifact-download-v1", "repository": args.repository, "input_sha256": sha256(args.input), "cli_version": gh(["--version"]).splitlines()[0], "artifacts": [], "signed_urls_recorded": False, "credentials_recorded": False}
    folders = [source["folder"] for source in manifest["sources"]]
    if len(set(folders)) != len(folders):
        raise ValueError("Duplicate source folders")
    for source in manifest["sources"]:
        folder, name, run_id = source["folder"], source["artifact_name"], source["run_id"]
        if not re.fullmatch(r"[A-Za-z0-9_-]+", folder) or not isinstance(run_id, int) or run_id <= 0:
            raise ValueError("Invalid source folder/run")
        suffix = re.search(r"-([a-f0-9]{40})$", name)
        expected_head = source.get("head_sha") or (suffix.group(1) if suffix else None)
        if not expected_head or not re.fullmatch(r"[a-f0-9]{40}", expected_head):
            raise ValueError("Source needs an exact head SHA, explicitly or in its artifact name")
        run = api(f"repos/{args.repository}/actions/runs/{run_id}")
        if run.get("head_sha") != expected_head or run.get("status") != "completed" or run.get("conclusion") != "success":
            raise ValueError(f"Source run {run_id} is not the exact successful narrated revision")
        candidates = []
        for page in range(1, 11):
            listing = api(f"repos/{args.repository}/actions/runs/{run_id}/artifacts?per_page=100&page={page}")
            artifacts = listing.get("artifacts", [])
            candidates.extend(artifact for artifact in artifacts if artifact.get("name") == name)
            if len(artifacts) < 100:
                break
        else:
            raise ValueError("Artifact listing exceeded bounded pagination")
        if len(candidates) != 1 or candidates[0].get("expired"):
            raise ValueError(f"Run {run_id} must have exactly one unexpired named artifact")
        artifact = candidates[0]
        if artifact.get("size_in_bytes", 0) > 256 * 1024 * 1024:
            raise ValueError("Narration artifact exceeds the reviewed download size bound")
        clips = [clip for clip in manifest["clips"] if clip["batch"] == folder]
        if not clips:
            raise ValueError(f"No declared clips for source {folder}")
        with tempfile.TemporaryDirectory(prefix="sf-narration-source-") as temporary:
            temporary_root = Path(temporary)
            gh(["run", "download", str(run_id), "--repo", args.repository, "--name", name, "--dir", temporary], timeout=240)
            original_manifest_path = unique_file(temporary_root, "manifest.json")
            original_manifest = json.loads(original_manifest_path.read_text(encoding="utf-8"))
            original_clips = original_manifest.get("clips", [])
            extracted = []
            for clip in clips:
                if Path(clip["file"]).name != clip["file"]:
                    raise ValueError("Declared WAV filename must be a basename")
                declared = [entry for entry in original_clips if entry.get("id") == clip["id"] and entry.get("file") == clip["file"]]
                if len(declared) != 1:
                    raise ValueError(f"Original batch manifest does not identify {clip['id']} uniquely")
                for field in ("text", "text_sha256", "audio_sha256"):
                    if declared[0].get(field) != clip[field]:
                        raise ValueError(f"Original batch {field} differs for {clip['id']}")
                wav = unique_file(temporary_root, clip["file"])
                if sha256(wav) != clip["audio_sha256"]:
                    raise ValueError(f"Original WAV hash differs for {clip['id']}")
                target = args.audio_root / folder / clip["file"]
                target.parent.mkdir(parents=True, exist_ok=True)
                shutil.copyfile(wav, target)
                if sha256(target) != clip["audio_sha256"]:
                    raise ValueError(f"Materialized WAV hash differs for {clip['id']}")
                extracted.append({"id": clip["id"], "file": f"{folder}/{clip['file']}", "audio_sha256": clip["audio_sha256"], "text_sha256": clip["text_sha256"]})
            receipt["artifacts"].append({"folder": folder, "run_id": run_id, "run_head_sha": expected_head, "run_conclusion": run["conclusion"], "artifact_id": artifact["id"], "artifact_name": name, "artifact_size_in_bytes": artifact.get("size_in_bytes"), "github_reported_artifact_digest": artifact.get("digest"), "digest_scope": "GitHub metadata only; every extracted WAV separately verified against its predeclared SHA256", "original_manifest_sha256": sha256(original_manifest_path), "clips": extracted})
        args.receipt.parent.mkdir(parents=True, exist_ok=True)
        args.receipt.write_text(json.dumps(receipt, indent=2) + "\n", encoding="utf-8")
        print(json.dumps({"event": "verified_narration_artifact", "run_id": run_id, "artifact_id": artifact["id"], "clips": len(clips)}), flush=True)


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(json.dumps({"status": "source_download_failed", "error_type": type(error).__name__, "message": str(error)[:300]}), flush=True)
        raise SystemExit(2)
