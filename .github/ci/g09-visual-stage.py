#!/usr/bin/env python3
"""Stage preserved G09 evidence for a separate, read-only visual inspection."""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import subprocess
import sys
import zipfile

EXPECTED_BLOBS = {
    "g09-review-pages.py": "e08a0c2e51b6d3e4eaadf0aa739a42e186ebce79",
    "g09-review-input.json": "402b6e7648df9d1538602f6fb7f7b5733515ff5c",
    "g09-v2-visual-navigation.json": "84b599cc9098adf5772700a5498a0fb7cf450b09",
    "g09-visual-source-proposals.json": "207722cc2f211d2106e643bf45306fef15ad8a1e",
}
REPORT_SHA256 = "211422a64e4c713e4e3f96b5a88489fba76e099d26ea6d8001794ce019e7ff34"
ARCHIVE = "orchestra-sf-entra-linux-x64-baseline.tar.gz"


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def unique(pairs):
    result = {}
    for key, value in pairs:
        require(key not in result, "duplicate JSON key: " + key)
        result[key] = value
    return result


def parse(data):
    return json.loads(data, object_pairs_hook=unique,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


def sha(data):
    return hashlib.sha256(data).hexdigest()


def write(root, name, data):
    target = root / name
    with target.open("xb") as stream:
        stream.write(data)
    target.chmod(0o600)
    return {"path": name, "bytes": len(data), "sha256": sha(data)}


def json_bytes(value):
    return (json.dumps(value, ensure_ascii=False, indent=2, allow_nan=False) + "\n").encode()


def verified_zip(file, metadata, expected_digest):
    require(file.stat().st_size == metadata["size_in_bytes"], "ZIP size differs")
    with file.open("rb") as stream:
        require("sha256:" + hashlib.file_digest(stream, "sha256").hexdigest() == expected_digest == metadata["digest"],
                "ZIP digest differs")
    archive = zipfile.ZipFile(file)
    names = archive.namelist()
    require(len(names) == len(set(names)), "duplicate ZIP name")
    for info in archive.infolist():
        name = info.filename
        relative = PurePosixPath(name)
        require(name and not relative.is_absolute() and ".." not in relative.parts and "\\" not in name
                and "\x00" not in name, "unsafe ZIP member")
        require((info.external_attr >> 16) & 0o170000 != 0o120000, "ZIP symlink forbidden")
        require(info.file_size <= 1024 * 1024 * 1024, "oversized ZIP member")
    return archive


def read_member(archive, name, maximum):
    info = archive.getinfo(name)
    require(not info.is_dir() and info.file_size <= maximum, "invalid bounded ZIP member: " + name)
    data = archive.read(name)
    require(len(data) == info.file_size, "ZIP member length differs")
    return data


def main():
    require(len(sys.argv) == 4, "usage: g09-visual-stage.py prepare|stage inspection-checkout evidence-directory")
    mode, checkout_arg, evidence_arg = sys.argv[1:]
    require(mode in ("prepare", "stage"), "invalid mode")
    checkout = Path(checkout_arg).resolve(strict=True)
    ci = checkout / ".github" / "ci"
    temporary = Path(os.environ["RUNNER_TEMP"]).resolve(strict=True)
    evidence = Path(evidence_arg).resolve()
    workspace = Path(os.environ["GITHUB_WORKSPACE"]).resolve(strict=True)
    require(evidence.is_relative_to(temporary) and not evidence.is_relative_to(workspace),
            "evidence must be inside RUNNER_TEMP and outside checkout")
    inputs = {}
    for name, expected in EXPECTED_BLOBS.items():
        data = (ci / name).read_bytes()
        oid = hashlib.sha1(b"blob " + str(len(data)).encode() + b"\0" + data).hexdigest()
        require(oid == expected, "inspection input Git blob differs: " + name)
        inputs[name] = data
    expected = parse(inputs["g09-review-input.json"])
    navigation = parse(inputs["g09-v2-visual-navigation.json"])
    proposal = parse(inputs["g09-visual-source-proposals.json"])
    require(navigation["identities"] == expected and navigation["reportSha256"] == REPORT_SHA256,
            "visual selection identity differs")
    require(len(navigation["files"]) == 17 and sum(item["occurrences"] for item in navigation["files"]) == 1425,
            "visual target set differs")
    require(len(proposal["sourceFiles"]) == 26 and len(proposal["sourceOccurrences"]) == 1424,
            "source reference set differs")
    if mode == "prepare":
        evidence.mkdir(mode=0o700, parents=False, exist_ok=False)
        write(evidence, "expected.json", inputs["g09-review-input.json"])
        with open(os.environ["GITHUB_ENV"], "a") as output:
            for env, key, pattern in [
                ("NAV_RUN_ID", "runId", r"[1-9][0-9]*"),
                ("NAV_RUN_ATTEMPT", "runAttempt", r"[1-9][0-9]*"),
                ("NAV_REPORT_ARTIFACT_ID", "reportArtifactId", r"[1-9][0-9]*"),
                ("NAV_PRODUCER_ARTIFACT_ID", "producerArtifactId", r"[1-9][0-9]*"),
                ("NAV_SOURCE_SHA", "sourceSHA", r"[a-f0-9]{40}"),
            ]:
                require(isinstance(expected[key], str) and re.fullmatch(pattern, expected[key]), "invalid identity field")
                output.write(env + "=" + expected[key] + "\n")
        return

    require((evidence / "expected.json").read_bytes() == inputs["g09-review-input.json"], "staged input differs")
    catalog = parse((evidence / "catalog-metadata.json").read_bytes())
    require(catalog["type"] == "file" and catalog["encoding"] == "base64"
            and catalog["path"] == "script/sf-ci/g09-581-catalog.json", "wrong catalog metadata")
    import base64
    write(evidence, "catalog.json", base64.b64decode("".join(catalog["content"].split()), validate=True))
    selected = ["archive:" + item["path"] for item in navigation["files"]]
    selected += ["source:" + item["path"] for item in proposal["sourceFiles"]]
    selected += ["source:" + item["path"] for item in proposal["sourceConsumerBindings"]["observedChain"]]
    selected = list(dict.fromkeys(selected))
    context = evidence / "canonical-context"
    command = [sys.executable, str(ci / "g09-review-pages.py"), "--input", str(evidence), "--output", str(context)]
    for item in selected:
        command += ["--select", item]
    subprocess.run(command, check=True)
    manifest = parse((context / "manifest.json").read_bytes())
    require(manifest["sourceReportSha256"] == REPORT_SHA256 and manifest["binding"] == navigation["binding"],
            "verified canonical context differs")
    require(manifest["selection"] == selected, "canonical selector set differs")

    report_meta = parse((evidence / "report-artifact.json").read_bytes())
    product_meta = parse((evidence / "producer-artifact.json").read_bytes())
    report_dir, package_dir = evidence / "report", evidence / "package"
    report_dir.mkdir(mode=0o700)
    package_dir.mkdir(mode=0o700)
    copied = {"report": [], "package": []}
    # Read exact named members; never unzip paths or extract executable tar members.
    with verified_zip(evidence / "report.zip", report_meta, expected["reportArtifactDigest"]) as archive:
        for name, limit in [
            ("diagnostic.json", 512 * 1024 * 1024),
            ("artifact-provenance.json", 1024 * 1024),
            ("candidate-binding.json", 1024 * 1024),
            ("artifact.json", 1024 * 1024),
            ("commit.raw", 4 * 1024 * 1024),
            ("tracked.z", 16 * 1024 * 1024),
        ]:
            data = read_member(archive, name, limit)
            if name == "diagnostic.json":
                require(sha(data) == REPORT_SHA256, "original report changed")
            copied["report"].append(write(report_dir, name, data))
    with verified_zip(evidence / "producer.zip", product_meta, expected["producerArtifactDigest"]) as archive:
        for name, limit in [
            (ARCHIVE, 512 * 1024 * 1024),
            (ARCHIVE + ".inventory.json", 32 * 1024 * 1024),
            ("g09-artifact-receipt.json", 1024 * 1024),
            ("orchestra-sf-entra-package-receipt.json", 1024 * 1024),
            ("compile-provenance.json", 4 * 1024 * 1024),
        ]:
            copied["package"].append(write(package_dir, name, read_member(archive, name, limit)))
    receipt = {
        "schema": "sf-g09-visual-stage-v1",
        "readOnly": True,
        "productExecuted": False,
        "originalIdentities": expected,
        "inspection": {
            "workflowSHA": os.environ["GITHUB_SHA"], "runId": os.environ["GITHUB_RUN_ID"],
            "runAttempt": os.environ["GITHUB_RUN_ATTEMPT"], "job": os.environ["GITHUB_JOB"],
        },
        "inputGitBlobs": EXPECTED_BLOBS,
        "reportSha256": REPORT_SHA256,
        "canonicalContextManifestSha256": sha((context / "manifest.json").read_bytes()),
        "producerZipSha256": product_meta["digest"].removeprefix("sha256:"),
        "copiedMembers": copied,
        "scope": "Preserved evidence only; no new same-run artifact qualification or canonical disposition.",
    }
    write(evidence, "visual-stage-receipt.json", json_bytes(receipt))
    print("G09_VISUAL_STAGE " + json.dumps(receipt, separators=(",", ":")))


if __name__ == "__main__":
    main()
