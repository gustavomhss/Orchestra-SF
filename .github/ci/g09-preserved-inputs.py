#!/usr/bin/env python3
"""Acquire and bind the existing G09 artifact; never rebuild or qualify it."""
import argparse
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import zipfile

SOURCE = "3ef84da65d6b8ad7cd3250412bbcabdf90924172"
TREE = "48d57887656fd2e325dee97a7c066bcb8e84bbc8"
WORKFLOW = "b1e3c29c1b7462872aa3d23b2777a5b619dfb6cb"
ZIP = "84e5f993f0d32e91c3fcb7e815e40c3155c1c1c17b80c4d394d3eb57b2b151ec"
EXPECTED = {
    "orchestra-sf-entra-linux-x64-baseline.tar.gz": "dc11455bbcce4565b24cdca53ce3e5ab05f883757f6c0765910a0e4c98147d83",
    "compile-evidence.json": "3921b2dd5d7df9ac9aa979264cff827901b5da162dd2976f00105bc92775cde9",
    "cli-source-map-index.json": "1b0f15f4d6017878743453356d4a3933d0f2b2e2682514717ea2d52df22d5bb4",
    "cli-source-maps.tar.gz": "6b80a904c0e253b308f80dfa028e636c6898d0ecc15c09c97fa3d8c658f6ef52",
    "compile-provenance.json": "aac471725c52584caef45edbc15b64efe0e037ca72ef0ca758471065c926f22a",
}
def require(condition, label):
    if not condition:
        raise RuntimeError("G09_PRESERVED_INPUT_REJECTED:" + label)

def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("directory", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    root = args.directory
    archive = root / "original.zip"
    meta = json.loads((root / "artifact.json").read_bytes())
    producer = json.loads((root / "producer-run.json").read_bytes())
    require(meta["id"] == 14722264806 and meta["digest"] == "sha256:" + ZIP, "artifact metadata")
    require(meta["size_in_bytes"] == archive.stat().st_size == 124863454, "ZIP length")
    require(meta["workflow_run"]["id"] == producer["id"] == 44944208924, "producer run")
    require(meta["workflow_run"]["head_sha"] == producer["head_sha"] == WORKFLOW, "producer workflow")
    require(producer["run_attempt"] == 1 and producer["conclusion"] == "success", "producer attempt")
    require(digest(archive) == ZIP, "ZIP digest")
    seen = set()
    with zipfile.ZipFile(archive) as package:
        for item in package.infolist():
            path = PurePosixPath(item.filename)
            require(len(path.parts) == 1 and not path.is_absolute() and not item.is_dir() and path.name not in ("", ".", ".."), "ZIP member")
            require(item.filename not in seen and item.file_size <= 200_000_000, "ZIP duplicate or size")
            seen.add(item.filename)
            with package.open(item) as source, (root / item.filename).open("xb") as target:
                while chunk := source.read(1024 * 1024):
                    target.write(chunk)
    require(set(EXPECTED).issubset(seen), "missing required input")
    files = []
    for name, expected in EXPECTED.items():
        observed = digest(root / name)
        require(observed == expected, name)
        files.append({"path": name, "sha256": observed})
    receipt = json.loads((root / "compile-provenance.json").read_bytes())
    require(receipt["sourceSHA"] == SOURCE and receipt["sourceTreeSHA"] == TREE, "source binding")
    require(receipt["workflowSHA"] == WORKFLOW and receipt["checkRunId"] == "136967815702", "producer job")
    current_sha, run, attempt, job = (os.environ.get(key, "") for key in ("GITHUB_SHA", "GITHUB_RUN_ID", "GITHUB_RUN_ATTEMPT", "G09_CHECK_RUN_ID"))
    require(len(current_sha) == 40 and all(ch in "0123456789abcdef" for ch in current_sha), "current workflow")
    require(all(value.isdecimal() and int(value) > 0 for value in (run, attempt, job)), "current job")
    result = {"schema": "g09-preserved-inputs-v1", "status": "INPUTS_VERIFIED",
              "artifactId": "14722264806", "zipSha256": ZIP, "sourceSHA": SOURCE, "sourceTreeSHA": TREE,
              "originalProducer": {"workflowSHA": WORKFLOW, "runId": "44944208924", "runAttempt": "1", "jobId": "136967815702"},
              "execution": {"workflowSHA": current_sha, "runId": run, "runAttempt": attempt, "jobId": job},
              "files": files, "formalG09Pass": False, "rebuild": False}
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"status": result["status"], "artifactId": result["artifactId"], "formalG09Pass": False}))

if __name__ == "__main__":
    main()

