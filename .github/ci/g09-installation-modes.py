#!/usr/bin/env python3
"""Apply the pinned installer's file-mode policy to a verified temporary fixture.

This is not an Azure install, root-ownership proof, or product rebuild. The tar's
0644 headers are not the installed modes; distribution.json supplies that policy.
"""
import argparse
import hashlib
import json
import os
from pathlib import Path


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(path):
    with path.open("rb") as stream:
        return hashlib.file_digest(stream, "sha256").hexdigest()


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("release", type=Path)
    parser.add_argument("receipt", type=Path)
    parser.add_argument("installer", type=Path)
    parser.add_argument("output", type=Path)
    args = parser.parse_args()
    require(os.environ.get("GITHUB_ACTIONS") == "true", "GitHub Actions fixture only")
    root = args.release.resolve(strict=True)
    require(root.is_relative_to(Path(os.environ["RUNNER_TEMP"]).resolve()), "Fixture must be in RUNNER_TEMP")
    source = args.installer.read_bytes()
    blob = hashlib.sha1(b"blob " + str(len(source)).encode() + b"\0" + source).hexdigest()
    require(blob == "17345366812c79944928731d4fe188b3bced7342", "Frozen installer changed")
    receipt = json.loads(args.receipt.read_bytes())
    manifest = root / "distribution.json"
    require(digest(manifest) == receipt["manifestSha256"], "Manifest identity differs")
    entries = json.loads(manifest.read_bytes())["files"]
    observed = []
    for entry in entries:
        file = root / entry["path"]
        require(not file.is_symlink() and file.resolve(strict=True).is_relative_to(root), "Unsafe fixture member")
        require(type(entry["executable"]) is bool, "Missing executable policy")
        require(digest(file) == entry["sha256"], "Fixture payload differs: " + entry["path"])
        mode = 0o555 if entry["executable"] else 0o444
        file.chmod(mode)
        require(digest(file) == entry["sha256"], "Mode application changed bytes")
        observed.append({"path": entry["path"], "sha256": entry["sha256"], "mode": oct(mode)})
    for name in ("distribution.json", "checksums.sha256"):
        (root / name).chmod(0o444)
    directories = [path for path in root.rglob("*") if path.is_dir()]
    for path in sorted(directories, key=lambda value: len(value.parts), reverse=True):
        require(not path.is_symlink(), "Unexpected fixture directory symlink")
        path.chmod(0o555)
    root.chmod(0o555)
    require(os.access(root / "bin/orchestra", os.X_OK), "Candidate is not executable after installation modes")
    result = {"schema": "g09-temporary-installation-modes-v1", "status": "APPLIED_AND_BYTES_VERIFIED",
              "installerGitBlob": blob, "manifestSha256": receipt["manifestSha256"],
              "harnessSha256": digest(Path(__file__)), "files": observed,
              "scope": "Pinned installer mode policy in a temporary runner-owned fixture",
              "azureDeployment": False, "rootOwnershipProven": False, "formalG09Pass": False}
    args.output.write_text(json.dumps(result, indent=2) + "\n")
    print(json.dumps({"status": result["status"], "files": len(observed), "formalG09Pass": False}))


if __name__ == "__main__":
    main()
