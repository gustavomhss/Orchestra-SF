#!/usr/bin/env python3
"""Verify and paginate an existing G09 diagnostic; never scan, classify or sign."""
import argparse
from collections import Counter, defaultdict
import hashlib
import json
from pathlib import Path, PurePosixPath
import re
import zipfile

LIMIT = 850_000
PAGE_LIMIT = 840_000
REPOSITORY = "gustavomhss/Orchestra-SF"
REPOSITORY_ID = "1455724710"
OCCURRENCE_KEYS = ("domain", "path", "fileSha256", "byteOffset", "byteLength", "seed", "encoding")


def require(condition, message):
    if not condition:
        raise RuntimeError(message)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def compact(value):
    text = json.dumps(value, separators=(",", ":"), ensure_ascii=False, allow_nan=False)
    # JSON.stringify escapes lone UTF-16 surrogates; preserve that identity rule.
    return re.sub("[\ud800-\udfff]", lambda match: "\\u%04x" % ord(match[0]), text)


def encoded(value):
    return compact(value).encode("utf-8")


def unique_object(pairs):
    value = {}
    for key, item in pairs:
        require(key not in value, "duplicate JSON key: " + key)
        value[key] = item
    return value


def parse(data):
    return json.loads(data, object_pairs_hook=unique_object,
                      parse_constant=lambda value: (_ for _ in ()).throw(ValueError(value)))


def read_json(file):
    return parse(file.read_bytes())


def verify_artifact(meta, expected, identifier, digest_key, name):
    require([str(meta["id"]), meta["digest"], meta["name"], meta["expired"],
             str(meta["workflow_run"]["id"]), meta["workflow_run"]["head_sha"],
             str(meta["workflow_run"]["repository_id"]), str(meta["workflow_run"]["head_repository_id"])] ==
            [expected[identifier], expected[digest_key], name, False, expected["runId"],
             expected["sourceSHA"], REPOSITORY_ID, REPOSITORY_ID], "artifact identity mismatch: " + identifier)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--input", type=Path, required=True,
                        help="expected.json, report-artifact.json, producer-artifact.json, run.json, jobs.json, report.zip, catalog.json")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--select", action="append", default=[], help="exact occurrence/finding ID or source:path / archive:path")
    parser.add_argument("--emit-page", type=int, help="emit one measured page instead of just the manifest")
    args = parser.parse_args()
    require(args.output.resolve() != args.input.resolve(), "input and output must differ")
    expected = read_json(args.input / "expected.json")
    required = {"schema", "sourceSHA", "sourceTreeSHA", "workflowSHA", "runId", "runAttempt",
                "diagnosticJobId", "producerJobId", "producerCheckRunId", "reportArtifactId",
                "reportArtifactDigest", "producerArtifactId", "producerArtifactDigest"}
    require(set(expected) == required and expected["schema"] == "sf-g09-review-navigation-input-v1", "explicit navigation identities required")
    for key in ("sourceSHA", "sourceTreeSHA", "workflowSHA"):
        require(re.fullmatch("[a-f0-9]{40}", expected[key]), "invalid expected " + key)
    require(expected["workflowSHA"] == expected["sourceSHA"], "this reader accepts the new same-HEAD protocol only")
    for key in required - {"schema", "sourceSHA", "sourceTreeSHA", "workflowSHA", "reportArtifactDigest", "producerArtifactDigest"}:
        require(re.fullmatch("[1-9][0-9]*", expected[key]), "invalid expected " + key)
    for key in ("reportArtifactDigest", "producerArtifactDigest"):
        require(re.fullmatch("sha256:[a-f0-9]{64}", expected[key]), "invalid expected " + key)
    report_meta, product_meta = [read_json(args.input / name) for name in ("report-artifact.json", "producer-artifact.json")]
    run, jobs = [read_json(args.input / name) for name in ("run.json", "jobs.json")]
    verify_artifact(report_meta, expected, "reportArtifactId", "reportArtifactDigest",
                    "g09-diagnostic-" + expected["sourceSHA"] + "-" + expected["runAttempt"])
    verify_artifact(product_meta, expected, "producerArtifactId", "producerArtifactDigest",
                    "orchestra-sf-entra-linux-" + expected["sourceSHA"])
    require([str(run["id"]), str(run["run_attempt"]), run["head_sha"], run["head_branch"], run["path"], run["event"],
             str(run["repository"]["id"]), run["repository"]["full_name"]] ==
            [expected["runId"], expected["runAttempt"], expected["sourceSHA"], "g09-next-candidate",
             ".github/workflows/g09-candidate.yml", "push", REPOSITORY_ID, REPOSITORY], "original workflow identity mismatch")
    require(jobs["total_count"] == len(jobs["jobs"]), "complete original-attempt job inventory required")
    for key, name in (("producerJobId", "teams-profile-artifact"), ("diagnosticJobId", "g09-diagnostic")):
        found = [job for job in jobs["jobs"] if str(job["id"]) == expected[key]]
        require(len(found) == 1, "original job missing: " + name)
        job = found[0]
        require([job["name"], str(job["run_id"]), job["head_sha"], job["status"], job["conclusion"]] ==
                [name, expected["runId"], expected["sourceSHA"], "completed", "success"], "original job did not complete: " + name)
        if key == "producerJobId":
            require(job["check_run_url"] == "https://api.github.com/repos/" + REPOSITORY + "/check-runs/" + expected["producerCheckRunId"],
                    "producer check run mismatch")
    zipped = args.input / "report.zip"
    require(zipped.stat().st_size == report_meta["size_in_bytes"], "report ZIP size mismatch")
    with zipped.open("rb") as stream:
        require("sha256:" + hashlib.file_digest(stream, "sha256").hexdigest() == expected["reportArtifactDigest"], "report ZIP digest mismatch")
    with zipfile.ZipFile(zipped) as archive:
        names = archive.namelist()
        require(len(set(names)) == len(names), "duplicate ZIP member")
        for name in names:
            item = PurePosixPath(name)
            require(not item.is_absolute() and ".." not in item.parts and "\\" not in name, "unsafe ZIP member")
        def read(name, maximum=512 * 1024 * 1024):
            require(archive.getinfo(name).file_size <= maximum, "oversized evidence: " + name)
            return archive.read(name)
        raw = read("diagnostic.json")
        report = parse(raw)
        provenance, binding = [parse(read(name)) for name in ("artifact-provenance.json", "candidate-binding.json")]
        embedded_meta = parse(read("artifact.json"))
        commit, tracked = read("commit.raw", 4 * 1024 * 1024), read("tracked.z", 16 * 1024 * 1024)
    verify_artifact(embedded_meta, expected, "producerArtifactId", "producerArtifactDigest", product_meta["name"])
    source, execution = report["source"], report["execution"]
    require([report["schema"], report["status"], source["sha"], source["tree"], source["recheckedAfter"],
             execution["workflowSHA"], execution["runId"], execution["runAttempt"]] ==
            ["teams-profile-residue-report-v1", "DIAGNOSTIC_UNQUALIFIED", expected["sourceSHA"], expected["sourceTreeSHA"],
             True, expected["workflowSHA"], expected["runId"], expected["runAttempt"]], "canonical diagnostic identity mismatch")
    require(report["artifact"]["status"] == "BOUND" and report["controls"]["status"] == "VERIFIED", "original artifact/controls not verified")
    require(report["review"]["status"] == report["proofs"]["status"] == "MISSING", "unexpected authenticated sidecars")
    require(hashlib.sha1(b"commit " + str(len(commit)).encode() + b"\0" + commit).hexdigest() == expected["sourceSHA"], "raw source commit differs")
    require(commit.splitlines()[0] == ("tree " + expected["sourceTreeSHA"]).encode(), "source tree differs")
    require(digest(commit) == source["commitSha256"] and digest(tracked) == source["trackedInventorySha256"], "source evidence differs")
    require(tracked.endswith(b"\0"), "truncated tracked inventory")
    catalog = (args.input / "catalog.json").read_bytes()
    catalog_oid = hashlib.sha1(b"blob " + str(len(catalog)).encode() + b"\0" + catalog).hexdigest().encode()
    require(b"100644 blob " + catalog_oid + b"\tscript/sf-ci/g09-581-catalog.json" in tracked[:-1].split(b"\0"),
            "catalog is not the original tracked blob")
    for value in (report["artifact"], provenance, binding):
        for key in ("workflowSHA", "runId", "runAttempt"):
            require(value[key] == expected[key], "original execution binding differs: " + key)
    require(binding["schema"] == "sf-g09-candidate-binding-v1" and
            [binding["sourceSHA"], binding["sourceTreeSHA"], binding["producerJobId"], binding["producerCheckRunId"],
             binding["artifactId"], binding["artifactDigest"]] ==
            [expected["sourceSHA"], expected["sourceTreeSHA"], expected["producerJobId"], expected["producerCheckRunId"],
             expected["producerArtifactId"], expected["producerArtifactDigest"]], "candidate binding differs")
    require([provenance["sourceSHA"], provenance["sourceTreeSHA"], report["artifact"]["source"]["sha"],
             report["artifact"]["source"]["tree"], binding["artifactZipSha256"]] ==
            [expected["sourceSHA"], expected["sourceTreeSHA"], expected["sourceSHA"], expected["sourceTreeSHA"],
             expected["producerArtifactDigest"].removeprefix("sha256:")], "source/archive provenance identity differs")
    require(provenance["schema"] == "teams-profile-residue-provenance-v1" and
            provenance["producerJob"] == "teams-profile-artifact" and
            provenance["artifact"] == report["artifact"]["artifact"], "canonical provenance differs")
    require(provenance["archiveSha256"] == binding["archiveSha256"] == report["artifact"]["archiveSha256"], "archive binding differs")
    require(provenance["artifact"]["id"] == expected["producerArtifactId"] and
            provenance["artifact"]["digest"] == expected["producerArtifactDigest"], "producer artifact binding differs")
    inventory = {(item["domain"], item["path"]): item for item in report["inventory"]}
    require(len(inventory) == len(report["inventory"]), "duplicate inventory file")
    occurrences, findings = report["occurrences"], report["reachability"]["findings"]
    require(len({item["id"] for item in occurrences + findings}) == len(occurrences) + len(findings), "duplicate exact ID")
    require(all(item["disposition"] is None for item in occurrences + findings), "unexpected assigned disposition")
    groups = defaultdict(lambda: {"occurrences": [], "findings": []})
    originals = []
    for item in occurrences:
        identity = {key: item[key] for key in OCCURRENCE_KEYS}
        require(digest(encoded(identity)) == item["id"], "occurrence ID mismatch")
        file = inventory[(item["domain"], item["path"])]
        require(file["sha256"] == item["fileSha256"] and 0 <= item["byteOffset"] and
                item["byteOffset"] + item["byteLength"] <= file["byteLength"], "occurrence exceeds inventoried file")
        originals.append({"id": item["id"], **identity})
        groups[(item["domain"], item["path"])]["occurrences"].append(item)
    original_findings = []
    for item in findings:
        identity = {key: value for key, value in item.items() if key not in ("id", "disposition")}
        require(digest(encoded(identity)) == item["id"], "finding ID mismatch")
        original_findings.append({key: value for key, value in item.items() if key != "disposition"})
        groups[(item["domain"], item["path"])]["findings"].append(item)
    graph = {key: report["reachability"][key] for key in ("source", "archive")}
    recomputed = {"sourceSHA": expected["sourceSHA"], "sourceTreeSHA": expected["sourceTreeSHA"],
                  "catalogSha256": digest(catalog), "inventorySha256": digest(encoded(report["inventory"])),
                  "occurrencesSha256": digest(encoded(originals)), "graphSha256": digest(encoded(graph)),
                  "gapsSha256": digest(encoded(original_findings))}
    require(report["binding"] == recomputed, "complete canonical report binding differs")
    require(report["counts"] == {"occurrences": len(occurrences), "classified": 0, "unknownOccurrences": len(occurrences),
                                "unknownReachability": len(findings), "unclassified": len(occurrences) + len(findings),
                                "activeLegacy": 0, "orphan": 0}, "unsigned inventory counts differ")

    args.output.mkdir(mode=0o700, parents=True, exist_ok=False)
    pages, file_rows, streams = [], [], defaultdict(list)
    for number, key in enumerate(sorted(groups)):
        domain, name = key
        rows, gaps = groups[key]["occurrences"], groups[key]["findings"]
        file = inventory.get(key)
        file_rows.append({"fileId": number, "domain": domain, "path": name,
                          "fileSha256": file["sha256"] if file else None, "encoding": file["encoding"] if file else None,
                          "occurrences": len(rows), "findings": len(gaps), "seeds": dict(Counter(item["seed"] for item in rows)),
                          "findingKinds": dict(Counter(item["kind"] for item in gaps)),
                          "entrypoints": sorted({entry["entrypoint"] for entry in graph[domain]["reachable"].get(name, [])})})
        streams["files"].append(file_rows[-1])
        streams[domain].extend(["occurrence", number, item["id"], item["byteOffset"], item["byteLength"], item["seed"], item["encoding"]] for item in rows)
        streams["findings"].extend(["finding", number, item["id"], {field: value for field, value in item.items()
                                    if field not in ("id", "disposition", "domain", "path", "fileSha256")}] for item in gaps)
    if args.select:
        all_ids = {item["id"] for item in occurrences + findings}
        selected_files, selected_ids = set(), set()
        for selection in args.select:
            if selection in all_ids:
                selected_ids.add(selection)
            else:
                domain, separator, name = selection.partition(":")
                require(separator and ((domain, name) in groups or (domain, name) in inventory), "unknown context selector: " + selection)
                selected_files.add((domain, name))
        selected = [item for item in occurrences + findings if item["id"] in selected_ids or (item["domain"], item["path"]) in selected_files]
        selected_files.update((item["domain"], item["path"]) for item in selected)
        calls = {identifier for item in selected for identifier in item.get("callsites", [])}
        streams = {"context": [{"type": "record", "record": item} for item in selected]}
        for domain, name in sorted(selected_files):
            streams["context"].append({"type": "file", "inventory": inventory.get((domain, name)),
                                       "domain": domain, "path": name, "reachable": graph[domain]["reachable"].get(name, [])})
        for domain in ("source", "archive"):
            paths = {name for selected_domain, name in selected_files if selected_domain == domain}
            streams["context"].extend({"type": "edge", "edge": edge} for edge in graph[domain]["edges"]
                                      if edge["from"] in paths or any(target in paths for target in edge["targets"]))
        streams["context"].extend({"type": "callsite", "callsite": call} for domain in ("source", "archive")
                                  for call in graph[domain]["calls"] if call["id"] in calls)
    for stream in (("context",) if args.select else ("files", "source", "archive", "findings")):
        records = streams[stream]
        pending, count = bytearray(), 0
        def flush():
            nonlocal pending, count
            if not pending:
                return
            filename = "%04d-%s.jsonl" % (len(pages), stream)
            data = bytes(pending)
            (args.output / filename).write_bytes(data)
            pages.append({"page": len(pages), "stream": stream, "file": filename, "bytes": len(data), "sha256": digest(data), "records": count})
            pending, count = bytearray(), 0
        def append(batch):
            nonlocal pending, count
            line = encoded(batch) + b"\n"
            if len(line) > PAGE_LIMIT:
                require(len(batch) > 1, "one context record exceeds the page budget")
                middle = len(batch) // 2
                append(batch[:middle])
                append(batch[middle:])
                return
            if len(pending) + len(line) > PAGE_LIMIT:
                flush()
            pending.extend(line)
            count += len(batch)
        for start in range(0, len(records), 25):
            append(records[start:start + 25])
        flush()
    manifest = {"schema": "sf-g09-review-pages-v1", "navigationOnly": True, "scannerReexecuted": False,
                "formalG09Pass": False, "assignedDispositions": 0, "identities": expected,
                "sourceReportSha256": digest(raw), "binding": recomputed,
                "occurrences": len(occurrences), "findings": len(findings), "inventoryFiles": len(inventory),
                "reviewFiles": len(groups), "domainCounts": {domain: {"files": sum(row["domain"] == domain for row in file_rows),
                    "occurrences": sum(row["occurrences"] for row in file_rows if row["domain"] == domain),
                    "findings": sum(row["findings"] for row in file_rows if row["domain"] == domain)} for domain in ("source", "archive")},
                "pageLimitBytes": PAGE_LIMIT, "stdoutLimitBytes": LIMIT, "selection": args.select, "pages": pages,
                "pageRecordFormat": "Each JSONL line is an array of at most 25 records.",
                "occurrenceColumns": ["type", "fileId", "id", "byteOffset", "byteLength", "seed", "encoding"],
                "findingColumns": ["type", "fileId", "id", "details"],
                "contextScope": "Original report callsites, edges and reachability; no source or archive byte snippets are invented."}
    (args.output / "manifest.json").write_bytes(encoded(manifest) + b"\n")
    if args.emit_page is None:
        summary = b"G09_REVIEW_MANIFEST " + encoded(manifest) + b"\n"
        require(len(summary) <= LIMIT, "manifest exceeds stdout budget")
        print(summary.decode("utf-8"), end="")
    else:
        require(0 <= args.emit_page < len(pages), "requested measured page does not exist")
        page = pages[args.emit_page]
        header = "G09_REVIEW_PAGE " + compact({"sourceReportSha256": digest(raw), "binding": recomputed, **page}) + "\n"
        contents = (args.output / page["file"]).read_bytes()
        require(len(header.encode()) + len(contents) <= LIMIT, "selected page exceeds stdout budget")
        print(header, end="")
        print(contents.decode("utf-8"), end="")


if __name__ == "__main__":
    main()
