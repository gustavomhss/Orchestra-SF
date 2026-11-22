#!/usr/bin/env python3
"""Read the frozen diagnostic into a review index; never classify or sign IDs."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile

ZIP_SHA = "2297358a5612c5755bfd5d7b5341981689090da688631cb66e8abceb05c7bd29"
SOURCE = "3ef84da65d6b8ad7cd3250412bbcabdf90924172"
TREE = "48d57887656fd2e325dee97a7c066bcb8e84bbc8"
WORKFLOW = "65c6cfa0084cc0dc0b190c6d0bda103c1c189ec2"

def require(condition, message):
    if not condition:
        raise RuntimeError(message)

def digest(data):
    return hashlib.sha256(data).hexdigest()

def compact(value):
    return json.dumps(value, separators=(",", ":"), ensure_ascii=False)

def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--zip", type=Path, required=True)
    parser.add_argument("--metadata", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    args = parser.parse_args()
    with args.zip.open("rb") as stream:
        require(hashlib.file_digest(stream, "sha256").hexdigest() == ZIP_SHA, "recovery ZIP changed")
    meta = json.loads(args.metadata.read_bytes())
    require(meta["id"] == 14732642812 and meta["digest"] == "sha256:" + ZIP_SHA, "wrong recovery artifact")
    require(meta["size_in_bytes"] == args.zip.stat().st_size == 62118846, "wrong recovery size")
    require(meta["workflow_run"]["id"] == 44968592532 and
            meta["workflow_run"]["head_sha"] == WORKFLOW, "wrong recovery execution")
    with zipfile.ZipFile(args.zip) as archive:
        names = archive.namelist()
        require(len(set(names)) == len(names), "duplicate ZIP member")
        for name in names:
            path = PurePosixPath(name)
            require(not path.is_absolute() and ".." not in path.parts and "\\" not in name, "unsafe ZIP name")
        manifest = json.loads(archive.read("execution-manifest.json"))
        require(manifest["sourceSHA"] == SOURCE and manifest["sourceTreeSHA"] == TREE and
                manifest["artifactId"] == "14722264806" and manifest["workflowSHA"] == WORKFLOW and
                manifest["runId"] == "44968592532" and manifest["runAttempt"] == "1" and
                manifest["jobId"] == "137043117261", "manifest identity changed")
        require(manifest["formalG09Pass"] is False and manifest["candidateRebuilt"] is False and
                manifest["inheritedSignatures"] == 0, "unexpected recovery qualification")
        for step in ("inputs", "scanner_controls", "inventory", "guards"):
            require(manifest["steps"][step]["outcome"] == "success", "required recovery step did not pass: " + step)
        declared = {item["path"]: item for item in manifest["files"]}
        require(len(declared) == len(manifest["files"]), "duplicate manifest entry")
        def read(name):
            expected = declared[name]
            info = archive.getinfo(name)
            require(0 <= info.file_size <= 512 * 1024 * 1024 and info.file_size == expected["bytes"], "unbounded declared file")
            data = archive.read(name)
            require(digest(data) == expected["sha256"], "declared file hash changed: " + name)
            return data
        metadata = json.loads(read("independent-diagnostic-metadata.json"))
        raw = read("independent-diagnostic-report.json")
        require(digest(raw) == metadata["reportSha256"], "diagnostic metadata mismatch")
        report = json.loads(raw)
    require(metadata["sourceSHA"] == SOURCE and metadata["sourceTreeSHA"] == TREE and
            report["source"]["sha"] == SOURCE and report["source"]["tree"] == TREE, "diagnostic source mismatch")
    require(report["binding"] == metadata["binding"] and report["status"] == "DIAGNOSTIC_UNQUALIFIED", "diagnostic binding mismatch")
    occurrences, findings = report["occurrences"], report["reachability"]["findings"]
    require(len(occurrences) == 19718 and len(findings) == 3146, "diagnostic inventory size changed")
    require(len({x["id"] for x in occurrences + findings}) == 22864, "duplicate cross-inventory ID")
    require(all(x["disposition"] is None for x in occurrences + findings), "unexpected inherited disposition")
    inventory = {(x["domain"], x["path"]): x for x in report["inventory"]}
    require(len(inventory) == len(report["inventory"]), "duplicate inventory path")
    occurrence_groups = defaultdict(list)
    finding_groups = defaultdict(list)
    for item in occurrences:
        identity = {key: item[key] for key in ("domain", "path", "fileSha256", "byteOffset", "byteLength", "seed", "encoding")}
        require(digest(compact(identity).encode()) == item["id"], "occurrence ID is not exact")
        file = inventory[(item["domain"], item["path"])]
        require(file["sha256"] == item["fileSha256"] and 0 <= item["byteOffset"] and
                item["byteOffset"] + item["byteLength"] <= file["byteLength"], "occurrence exceeds inventoried file")
        occurrence_groups[(item["domain"], item["path"])].append(item)
    for item in findings:
        require(re.fullmatch("[0-9a-f]{64}", item["id"]), "invalid finding ID")
        identity = {key: value for key, value in item.items() if key not in ("id", "disposition")}
        require(digest(compact(identity).encode()) == item["id"], "finding ID is not exact")
        finding_groups[(item["domain"], item["path"])].append(item)
    overview = {
        "schema": "g09-unsigned-review-index-v1", "sourceSHA": SOURCE, "sourceTreeSHA": TREE,
        "sourceReportSha256": metadata["reportSha256"], "binding": report["binding"],
        "occurrences": len(occurrences), "findings": len(findings), "inventoryFiles": len(inventory),
        "occurrenceFiles": len(occurrence_groups), "findingFiles": len(finding_groups),
        "formalG09Pass": False, "inheritedClassifications": 0, "assignedDispositions": 0,
        "scope": "Exact unsigned inventory for a new review; grouping does not establish semantics",
        "files": [],
    }
    for domain, path in sorted(set(occurrence_groups) | set(finding_groups)):
        rows = occurrence_groups[(domain, path)]
        gaps = finding_groups[(domain, path)]
        file = inventory.get((domain, path))
        overview["files"].append({
            "domain": domain, "path": path, "fileSha256": file["sha256"] if file else None,
            "encoding": file["encoding"] if file else None,
            "occurrences": len(rows), "findings": len(gaps),
            "seeds": dict(Counter(x["seed"] for x in rows)),
            "findingKinds": dict(Counter(x["kind"] for x in gaps)),
            "entrypoints": sorted({entry for x in rows for entry in x.get("reachableEntrypoints", [])}),
        })
    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    for name, value in (("review-index.json", overview), ("occurrences.json", occurrences), ("findings.json", findings)):
        (args.output / name).write_text(compact(value) + "\n")
    print("G09_REVIEW_OVERVIEW " + compact({key: value for key, value in overview.items() if key != "files"}))
    for start in range(0, len(overview["files"]), 25):
        print("G09_REVIEW_FILES " + compact(overview["files"][start:start + 25]))
    for start in range(0, len(occurrences), 50):
        print("G09_REVIEW_OCCURRENCES " + compact(occurrences[start:start + 50]))
    for start in range(0, len(findings), 25):
        print("G09_REVIEW_FINDINGS " + compact(findings[start:start + 25]))
    print("G09_REVIEW_INDEX_FILES " + compact([
        {"path": file.name, "bytes": file.stat().st_size, "sha256": digest(file.read_bytes())}
        for file in sorted(args.output.iterdir())]))

if __name__ == "__main__":
    main()
