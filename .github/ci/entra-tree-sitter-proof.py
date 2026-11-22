from hashlib import file_digest, sha256
import json
import os
from pathlib import Path
import subprocess
import sys

CASE_NAME = "the archived Linux CLI extracts TypeScript and Python symbols with its shipped tree-sitter"
TYPESCRIPT = (
    'import { readFile } from "node:fs/promises"\n'
    "export interface Shape { area(): number }\n"
    "export class Square implements Shape { area() { return 4 } }\n"
    'export function load(file: string) { return readFile(file, "utf8") }\n'
)
PYTHON = "from os import path\n\ndef join(a, b):\n    return path.join(a, b)\n"


def digest(candidate):
    with candidate.open("rb") as stream:
        return file_digest(stream, "sha256").hexdigest()


def main(archive_dir, package, root):
    receipt = json.loads((archive_dir / "orchestra-sf-entra-package-receipt.json").read_bytes())
    provenance = json.loads((archive_dir / "compile-provenance.json").read_bytes())
    archive = archive_dir / receipt["archiveFile"]
    if digest(archive) != receipt["archiveSha256"] or provenance["archiveSha256"] != receipt["archiveSha256"]:
        raise ValueError("archive digest differs")
    distribution_file = package / "distribution.json"
    if digest(distribution_file) != receipt["manifestSha256"]:
        raise ValueError("installed manifest digest differs")
    distribution = json.loads(distribution_file.read_bytes())
    binary_entry = next(entry for entry in distribution["files"] if entry["path"] == "bin/orchestra")
    binary = package / "bin/orchestra"
    if binary.is_symlink() or not binary.is_file() or binary_entry["executable"] is not True:
        raise ValueError("installation does not contain a regular executable CLI")
    binary_hash = digest(binary)
    if binary_hash != binary_entry["sha256"] or binary_hash != provenance["binary"]["sha256"]:
        raise ValueError("installed executable digest differs")

    expected = {
        entry["path"]: entry["sha256"]
        for entry in distribution["files"]
        if entry["path"].startswith("bin/tree-sitter/")
    }
    actual = {
        item.relative_to(package).as_posix(): digest(item)
        for item in (package / "bin/tree-sitter").rglob("*")
        if item.is_file()
    }
    native = {
        "bin/tree-sitter/tree-sitter/prebuilds/linux-x64/tree-sitter.node",
        "bin/tree-sitter/tree-sitter-python/prebuilds/linux-x64/tree-sitter-python.node",
        "bin/tree-sitter/tree-sitter-typescript/prebuilds/linux-x64/tree-sitter-typescript.node",
    }
    if expected != actual or not native <= actual.keys():
        raise ValueError("Tree-sitter companion inventory differs")

    workspace = root / "workspace"
    workspace.mkdir(parents=True, mode=0o700)
    evidence = root / "evidence"
    evidence.mkdir()
    observations = {
        "sample.ts": symbols(binary, workspace, evidence, "sample.ts", TYPESCRIPT),
        "sample.py": symbols(binary, workspace, evidence, "sample.py", PYTHON),
    }
    result = {
        "schema": "sf-archive-tree-sitter-proof-v1",
        "caseName": CASE_NAME,
        "status": "pass",
        "sourceSha256": {"probe": digest(Path(__file__))},
        "sourceSHA": receipt["sourceSHA"],
        "workflowSHA": os.environ["GITHUB_SHA"],
        "runId": os.environ["GITHUB_RUN_ID"],
        "runAttempt": os.environ["GITHUB_RUN_ATTEMPT"],
        "job": os.environ["GITHUB_JOB"],
        "checkRunId": os.environ["CHECK_RUN_ID"],
        "archiveSha256": receipt["archiveSha256"],
        "binarySha256": binary_hash,
        "companions": actual,
        "observations": observations,
    }
    (archive_dir / "tree-sitter-proof.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
    print(CASE_NAME + ": PASS", flush=True)


def symbols(binary, workspace, evidence, name, source):
    fixture = workspace / name
    fixture.write_text(source, encoding="utf-8")
    completed = subprocess.run(
        [str(binary), "debug", "symbols", str(fixture)],
        cwd=workspace,
        env={
            "PATH": "/usr/bin:/bin",
            "HOME": str(workspace),
            "TMPDIR": str(workspace),
            "XDG_CONFIG_HOME": str(workspace / "config"),
            "XDG_DATA_HOME": str(workspace / "data"),
            "XDG_CACHE_HOME": str(workspace / "cache"),
            "XDG_STATE_HOME": str(workspace / "state"),
            "ORCHESTRA_DISABLE_MODELS_FETCH": "1",
            "ORCHESTRA_INHERIT_CREDENTIALS": "0",
            "ORCHESTRA_EXPERIMENTAL_OMNI_SPAWNER": "0",
        },
        capture_output=True,
        timeout=90,
    )
    if completed.returncode != 0:
        raise ValueError(f"{name}: archived CLI exited with {completed.returncode}: {completed.stderr.decode('utf-8', 'replace')[:2000]}")
    observed = json.loads(completed.stdout)
    if observed.get("coverage", {}).get("complete") is not True:
        raise ValueError(f"{name}: extraction coverage is incomplete")
    if name == "sample.ts":
        expected = ["interface Shape", "class Square", "function load"]
        actual = [f"{item['kind']} {item['name']}" for item in observed["symbols"]]
        if actual != expected or observed["imports"] != [{"from": "node:fs/promises", "names": ["readFile"]}]:
            raise ValueError("TypeScript symbols or imports differ")
    elif [item["name"] for item in observed["symbols"]] != ["join"]:
        raise ValueError("Python symbols differ")
    output = evidence / (name + ".result.json")
    output.write_bytes(completed.stdout)
    return {"fixtureSha256": digest(fixture), "stdoutSha256": sha256(completed.stdout).hexdigest()}


if __name__ == "__main__":
    main(Path(sys.argv[1]).resolve(), Path(sys.argv[2]).resolve(strict=True), Path(sys.argv[3]).resolve())
