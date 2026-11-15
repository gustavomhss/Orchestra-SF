#!/usr/bin/env python3
"""Read Operations75 artifact documents only. Never runs tests, browsers or source code."""
from __future__ import annotations

import argparse
import base64
import hashlib
import json
import posixpath
import re
import sys
import zipfile
from pathlib import Path


class DocumentError(ValueError):
    pass


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def canonical(value) -> bytes:
    # This request contains only ASCII keys/strings and integers: matches request.mjs.
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode()


def strict_json(data: bytes):
    def unique(pairs):
        result = {}
        for key, value in pairs:
            if key in result:
                raise DocumentError(f"Duplicate JSON key: {key}")
            result[key] = value
        return result
    if len(data) > 32 * 1024 * 1024:
        raise DocumentError("JSON document exceeds 32 MiB")
    return json.loads(data.decode("utf-8-sig"), object_pairs_hook=unique)


class Artifact:
    def __init__(self, location: Path):
        self.location = location
        self.zip = zipfile.ZipFile(location) if location.is_file() else None
        if self.zip:
            entries = [entry for entry in self.zip.infolist() if not entry.is_dir()]
            self.names = [entry.filename.replace("\\", "/") for entry in entries]
            if len(set(self.names)) != len(self.names):
                raise DocumentError("Repeated ZIP file names")
            self.sizes = {entry.filename.replace("\\", "/"): entry.file_size for entry in entries}
        elif location.is_dir():
            paths = [path for path in location.rglob("*") if path.is_file()]
            if any(path.is_symlink() for path in paths):
                raise DocumentError("Symlink in artifact directory")
            self.names = [path.relative_to(location).as_posix() for path in paths]
            self.sizes = {name: (location / name).stat().st_size for name in self.names}
        else:
            raise DocumentError("Artifact must be an existing ZIP or unpacked directory")
        if any(name.startswith("/") or ".." in name.split("/") for name in self.names):
            raise DocumentError("Non-relative artifact path")

    def find(self, suffix: str) -> str:
        found = [name for name in self.names if name == suffix or name.endswith("/" + suffix)]
        if len(found) != 1:
            raise DocumentError(f"Expected one {suffix}; found {len(found)}")
        return found[0]

    def read(self, name: str) -> bytes:
        if self.sizes.get(name, 0) > 32 * 1024 * 1024:
            raise DocumentError(f"Document exceeds 32 MiB: {name}")
        return self.zip.read(name) if self.zip else (self.location / name).read_bytes()


class Audit:
    def __init__(self, artifact: Artifact, policy: dict, args):
        self.artifact, self.policy, self.args = artifact, policy, args
        self.checks, self.inputs, self.journeys, self.inventory = [], [], [], {}

    def check(self, name, condition, actual=None, expected=None):
        self.checks.append({"check": name, "passed": bool(condition), "actual": actual, "expected": expected})

    def eq(self, name, actual, expected):
        self.check(name, actual == expected, actual, expected)

    def json(self, suffix):
        name = self.artifact.find(suffix)
        data = self.artifact.read(name)
        self.inputs.append({"path": name, "bytes": len(data), "sha256": digest(data)})
        return strict_json(data)

    def text(self, suffix):
        name = self.artifact.find(suffix)
        data = self.artifact.read(name)
        self.inputs.append({"path": name, "bytes": len(data), "sha256": digest(data)})
        return data.decode("utf-8")

    def stage(self, name, fn):
        try:
            fn()
        except (DocumentError, KeyError, IndexError, AttributeError, TypeError, ValueError, OSError, UnicodeError) as error:
            self.check(name + ".document_error", False, str(error), "Complete, unambiguous document")

    def request(self):
        receipt = self.json("test-ci-evidence/request.json")
        self.eq("request.body", receipt["request"], self.policy["request"])
        self.eq("request.canonical_sha256", digest(canonical(receipt["request"])), self.policy["request_sha256"])
        expected = {"campaign": "sf2h-integral-20261112", "mission": 75, "sourceBranch": "sf2-stack",
                    "productSha": self.args.work, "requestSha256": self.policy["request_sha256"], "selection": "journeys"}
        self.eq("request.envelope", receipt["envelope"], expected)
        self.eq("request.snapshot", receipt["snapshotSha"], self.args.snapshot)
        self.eq("request.run", receipt["run"], self.args.run)
        self.eq("request.attempt", receipt["attempt"], self.args.attempt)
        args = ["--config", "e2e/playwright.production.config.ts", "--workers", "1", "--retries", "0",
                "--repeat-each", "1", r"(^|[\\/])e2e[\\/]sucafina[\\/]operations\.spec\.ts$"]
        self.eq("request.exact_playwright_args", receipt["playwrightArgs"], args)
        fixed = {row["path"]: row["sha256"] for row in self.policy["source_files"]}
        required = [".ci-run.json", ".github/workflows/sf-operations-scanner.yml", "script/test-ci-request.ts",
                    "script/test-ci-location.ts", "script/sf2h/operations-scanner/request.mjs",
                    "script/sf2h/operations-scanner/setup.sh", "script/sf2h/operations-scanner/service.mjs",
                    "script/sf2h/operations-scanner/cleanup.sh", "script/sf2h/operations-scanner/tools.lock.json",
                    "packages/app-shell/e2e/playwright.production.config.ts", "packages/app-shell/e2e/sucafina/operations.spec.ts"]
        records = receipt["integrity"]
        self.eq("request.integrity_path_order", [row["path"] for row in records], required)
        for row in records:
            path, sha = row["path"], row["sha256"]
            self.check("integrity.sha_shape:" + path, bool(re.fullmatch(r"[0-9a-f]{64}", sha)), sha)
            if path in fixed:
                self.eq("integrity.source_hash:" + path, sha, fixed[path])
        if self.args.snapshot_request:
            raw = self.args.snapshot_request.read_bytes()
            body = strict_json(raw)
            self.eq("request.snapshot_file", body, {**receipt["request"], "operationsScanner": expected})
            self.eq("request.snapshot_file_sha256", digest(raw), records[0]["sha256"])
            self.inputs.append({"path": str(self.args.snapshot_request), "bytes": len(raw), "sha256": digest(raw)})
        selection = self.json("test-ci-evidence/selection.json")
        self.eq("selection.receipt", selection, {"ids": self.policy["ids"], "tests": 5, "workers": 1, "retries": 0, "repeat": 1})

    @staticmethod
    def specs(suites):
        found = []
        for suite in suites:
            found.extend(suite.get("specs", []))
            found.extend(Audit.specs(suite.get("suites", [])))
        return found

    def config(self, report, label):
        cfg = report["config"]
        self.check(label + ".config_file", cfg["configFile"].endswith("/packages/app-shell/e2e/playwright.production.config.ts"), cfg["configFile"])
        self.check(label + ".root_dir", cfg["rootDir"].endswith("/packages/app-shell/e2e"), cfg["rootDir"])
        for key, expected in {"workers": 1, "fullyParallel": False, "forbidOnly": True, "maxFailures": 0, "globalTimeout": 0, "shard": None}.items():
            self.eq(label + ".config." + key, cfg[key], expected)
        self.eq(label + ".version", cfg["version"], self.policy["playwright_version"])
        self.eq(label + ".bundle", cfg.get("metadata", {}).get("bundle"), "production")
        self.eq(label + ".project_count", len(cfg["projects"]), 1)
        project = cfg["projects"][0]
        for key, expected in {"name": "chromium", "id": "chromium", "retries": 0, "repeatEach": 1, "timeout": 60000}.items():
            self.eq(label + ".project." + key, project[key], expected)
        self.check(label + ".project.output", project["outputDir"].endswith("/packages/app-shell/e2e/test-results"), project["outputDir"])
        self.eq(label + ".project.test_dir", project["testDir"], cfg["rootDir"])
        reporters = [row[0] for row in cfg["reporter"]]
        if label == "list":
            self.eq(label + ".reporters", reporters, ["json"])
        else:
            self.check(label + ".reporters", len(reporters) == 4 and reporters[:3] == ["html", "line", "json"]
                       and reporters[3].replace("\\", "/").endswith("e2e/utils/flaky-reporter.ts"), reporters)
        # JSONReporter omits project.expect/use. These policies need source intake, not inference from a pass.
        return cfg

    def playwright(self):
        listed = self.json("test-ci-evidence/playwright-selection.json")
        runtime = self.json("test-ci-evidence/playwright-runtime.json")
        lists = {}
        for label, report in [("list", listed), ("runtime", runtime)]:
            cfg = self.config(report, label)
            self.eq(label + ".global_errors", report["errors"], [])
            specs = self.specs(report["suites"])
            self.eq(label + ".spec_count", len(specs), 5)
            ids = [spec["title"].split(" ", 1)[0] for spec in specs]
            self.eq(label + ".ordered_ids", ids, self.policy["ids"])
            lists[label] = [(s["id"], s["title"], s["file"], s["line"], s["column"]) for s in specs]
            for spec in specs:
                test_id = spec["title"].split(" ", 1)[0]
                prefix = label + "." + test_id
                resolved = posixpath.normpath(posixpath.join(cfg["rootDir"], spec["file"]))
                self.eq(prefix + ".file", resolved, cfg["rootDir"] + "/sucafina/operations.spec.ts")
                self.eq(prefix + ".test_count", len(spec["tests"]), 1)
                test = spec["tests"][0]
                for key, expected in {"projectName": "chromium", "projectId": "chromium", "timeout": 60000, "expectedStatus": "passed"}.items():
                    self.eq(prefix + "." + key, test[key], expected)
                forbidden = [a for a in test.get("annotations", []) if a.get("type") in {"skip", "fixme", "fail", "slow"}]
                self.eq(prefix + ".non_skipping_annotations", forbidden, [])
                if label == "list":
                    self.eq(prefix + ".not_executed_by_list", test["results"], [])
                    continue
                self.eq(prefix + ".ok", spec["ok"], True)
                self.eq(prefix + ".outcome", test["status"], "expected")
                self.eq(prefix + ".attempt_count", len(test["results"]), 1)
                results = test["results"]
                attachments, errors = [], []
                for result in results:
                    self.eq(prefix + ".result_status", result["status"], "passed")
                    self.eq(prefix + ".retry", result["retry"], 0)
                    self.eq(prefix + ".errors", result.get("errors", []), [])
                    self.check(prefix + ".error", not result.get("error"), result.get("error"))
                    self.eq(prefix + ".parallel_index", result["parallelIndex"], 0)
                    errors.extend(result.get("errors", []))
                    for attachment in result.get("attachments", []):
                        attachments.append(self.attachment(attachment, prefix))
                    self.steps(result.get("steps", []), prefix)
                self.journeys.append({"id": test_id, "title": spec["title"], "file": spec["file"], "line": spec["line"],
                                      "project": test["projectName"], "expected_status": test["expectedStatus"],
                                      "outcome": test["status"], "attempts": len(results),
                                      "statuses": [r["status"] for r in results], "retries": [r["retry"] for r in results],
                                      "duration_ms": sum(r["duration"] for r in results), "attachments": attachments, "errors": errors})
        self.eq("runtime.same_tests_as_list", lists.get("runtime"), lists.get("list"))
        for key, expected in {"expected": 5, "skipped": 0, "unexpected": 0, "flaky": 0}.items():
            self.eq("runtime.stats." + key, runtime["stats"][key], expected)
        html = self.artifact.find("packages/app-shell/e2e/playwright-report/index.html")
        self.check("html.nonempty", self.artifact.sizes[html] > 0, self.artifact.sizes[html])
        outputs = [n for n in self.artifact.names if "/e2e/test-results/" in "/" + n]
        traces = [n for n in outputs if n.endswith("trace.zip")]
        self.inventory = {"html": html, "test_results": outputs, "traces": traces,
                          "trace_policy": "retain-on-failure: no trace is required for a passing attempt"}
        last = [n for n in outputs if n.endswith("/.last-run.json")]
        if len(last) == 1:
            record = strict_json(self.artifact.read(last[0]))
            self.eq("last_run.status", record.get("status"), "passed")
            self.eq("last_run.failed_tests", record.get("failedTests"), [])
        # upload-artifact does not include hidden files by default; missing .last-run.json is not failure.

    def steps(self, steps, prefix):
        for index, step in enumerate(steps):
            self.check(prefix + f".step[{index}].error", not step.get("error"), step.get("error"))
            self.steps(step.get("steps", []), prefix + f".step[{index}]")

    def attachment(self, attachment, prefix):
        item = {"name": attachment.get("name"), "content_type": attachment.get("contentType")}
        if attachment.get("path"):
            path = attachment["path"].replace("\\", "/")
            marker = "/packages/app-shell/e2e/test-results/"
            if marker in path:
                suffix = "packages/app-shell/e2e/test-results/" + path.split(marker, 1)[1]
                found = [n for n in self.artifact.names if n == suffix or n.endswith("/" + suffix)]
            else:
                found = [n for n in self.artifact.names if n == path or n.endswith("/" + path)]
            self.check(prefix + ".attachment_present:" + str(item["name"]), len(found) == 1, path)
            item.update({"reported_path": path, "artifact_path": found[0] if len(found) == 1 else None})
        if attachment.get("body") is not None:
            data = base64.b64decode(attachment["body"], validate=True)
            item.update({"inline_bytes": len(data), "inline_sha256": digest(data)})
        return item

    def scanner(self):
        found = [n for n in self.artifact.names if n.endswith("/evidence/setup.json")
                 and any(part.startswith("sf-operations75-") for part in n.split("/"))]
        if len(found) != 1:
            raise DocumentError(f"Expected one scanner evidence root, found {len(found)}")
        prefix = found[0][:-len("setup.json")]
        doc = lambda name: self.json(prefix + name)
        setup = doc("setup.json")
        lock = doc("tools.lock.json")
        self.eq("scanner.lock", lock, self.policy["scanner_lock"])
        root = setup["root"]
        self.check("scanner.ephemeral_path", bool(re.fullmatch(r"/home/runner/work/_temp/sf-operations75-" + re.escape(self.args.run) + "-" + re.escape(self.args.attempt) + r"\.[A-Za-z0-9]+", root)), root)
        for key, expected in {"status": "READY", "productSnapshot": self.args.snapshot, "runId": self.args.run,
                              "runAttempt": self.args.attempt, "syntheticDatabase": False, "controls": "PASS_DAEMON_ONLY",
                              "productQualification": "NOT_RUN"}.items():
            self.eq("scanner.setup." + key, setup[key], expected)
        branch = r"sf-ops75-" + self.args.work[:12] + "j" + self.policy["request_sha256"][:12] + r"[1-9][0-9]?"
        self.check("scanner.branch", bool(re.fullmatch(branch, setup["branch"])), setup["branch"])
        package = doc("package.json")
        self.eq("scanner.package.expected", package["expected"], lock["asset"])
        self.eq("scanner.package.actual", package["actual"], {"bytes": lock["asset"]["size"], "sha256": lock["asset"]["sha256"]})
        self.eq("scanner.package.source", package["source"], lock["asset"]["url"])
        databases = doc("databases.json")
        for key, expected in {"origin": "database.clamav.net", "freshclamCompleted": True, "testDatabasesEnabled": True,
                              "officialDatabaseOnly": True, "syntheticDatabase": False}.items():
            self.eq("scanner.databases." + key, databases[key], expected)
        self.eq("scanner.database_names", sorted(row["name"].split(".")[0] for row in databases["files"]), ["bytecode", "daily", "main"])
        for row in databases["files"]:
            self.check("scanner.database_entry:" + row["name"], bool(re.fullmatch(r"(main|daily|bytecode)\.(cvd|cld)", row["name"]))
                       and row["bytes"] > 0 and bool(re.fullmatch(r"[a-f0-9]{64}", row["sha256"])), row)
        freshclam_log = self.text(prefix + "freshclam-output.log")
        self.eq("scanner.freshclam.database_tests_passed", freshclam_log.count("Database test passed."), 3)
        self.check("scanner.freshclam.no_failed_database_test", "Database test FAILED" not in freshclam_log)
        tested = re.findall(r"Testing database: '([^']+)'", freshclam_log)
        self.eq("scanner.freshclam.tested_names", sorted(posixpath.basename(name).split(".")[0] for name in tested), ["bytecode", "daily", "main"])
        self.check("scanner.freshclam.private_database_paths", all(name.startswith(root + "/database/") for name in tested), tested)
        service, config = doc("service.json"), doc("configuration.json")
        for key, expected in {"run_id": self.args.run, "run_attempt": self.args.attempt, "github_sha": self.args.snapshot, "work_directory": root}.items():
            self.eq("scanner.service." + key, service[key], expected)
        self.eq("scanner.configuration.services", config["services"], lock["services"])
        self.eq("scanner.configuration.credentials", config["credentialsUsed"], False)
        self.eq("scanner.configuration.global_install", config["globalInstallation"], False)
        self.eq("scanner.configuration.library_path", config["processScopedLibraryPath"], ["root/usr/local/lib", "root/usr/local/lib64"])
        self.eq("scanner.configuration.files", sorted(row["path"] for row in config["files"]), ["clamd-error.conf", "clamd-main.conf", "freshclam.conf"])
        for row in config["files"]:
            data = self.text(prefix + row["path"] + ".txt").encode()
            self.eq("scanner.configuration.hash:" + row["path"], digest(data), row["sha256"])
            options = self.options(data.decode())
            self.eq("scanner.config.database:" + row["path"], options.get("DatabaseDirectory"), root + "/database")
            self.eq("scanner.config.certs:" + row["path"], options.get("CVDCertsDirectory"), root + "/root/usr/local/etc/certs")
            self.eq("scanner.config.foreground:" + row["path"], options.get("Foreground"), "yes")
            if row["path"] == "freshclam.conf":
                self.eq("scanner.config.signature_test", options.get("TestDatabases"), "yes")
                self.eq("scanner.config.mirror", options.get("DatabaseMirror"), "database.clamav.net")
            else:
                kind = "main" if "main" in row["path"] else "error"
                for key, expected in {"OfficialDatabaseOnly": "yes", "TCPAddr": "127.0.0.1", "TCPSocket": str(lock["services"][kind]["port"]),
                                      "StreamMaxLength": str(lock["services"][kind]["stream_max_length"]), "SelfCheck": "0"}.items():
                    self.eq("scanner.config." + kind + "." + key, options.get(key), expected)
        for tool in ["clamd", "freshclam"]:
            version = self.text(prefix + tool + "-version.txt").strip()
            self.check("scanner.version:" + tool, version == "ClamAV 1.5.4" or version.startswith("ClamAV 1.5.4/"), version)
        for kind in ["main", "error"]:
            ready, owned = setup["services"][kind], service[kind]
            self.eq("scanner.ready.ping:" + kind, ready["ping"], "PONG")
            self.eq("scanner.ready.port:" + kind, ready["port"], lock["services"][kind]["port"])
            self.check("scanner.ready.version:" + kind, ready["version"].startswith("ClamAV 1.5.4/"), ready["version"])
            self.eq("scanner.owned.host:" + kind, owned["host"], "127.0.0.1")
            self.eq("scanner.owned.port:" + kind, owned["port"], ready["port"])
            self.eq("scanner.owned.inode:" + kind, owned["listen_inode"], ready["listen_inode"])
            self.eq("scanner.owned.executable:" + kind, owned["executable"], root + "/root/usr/local/sbin/clamd")
            self.eq("scanner.owned.config:" + kind, owned["config"], root + "/clamd-" + kind + ".conf")
            process = doc("process-" + kind + ".json")
            self.eq("scanner.process.pid:" + kind, process["pid"], owned["pid"])
            self.eq("scanner.process.start_time:" + kind, process["startTime"], owned["start_time"])
            self.eq("scanner.process.executable:" + kind, process["executable"], owned["executable"])
            self.check("scanner.process.config_arg:" + kind, "--config-file=" + owned["config"] in process["arguments"], process["arguments"])
        controls = doc("daemon-controls.json")
        self.eq("scanner.control_kinds", [row["kind"] for row in controls["controls"]], ["main", "error"])
        for row in controls["controls"]:
            self.eq("scanner.control.clean:" + row["kind"], row["clean"], "stream: OK")
            self.eq("scanner.control.clean_after:" + row["kind"], row["cleanAfter"], "stream: OK")
            self.check("scanner.control.eicar:" + row["kind"], bool(re.search(r"EICAR.*FOUND$", row["eicar"], re.I)), row["eicar"])
        self.check("scanner.control.size_error", bool(re.search(r"INSTREAM size limit exceeded.*ERROR", controls["sizeError"], re.I)), controls["sizeError"])
        cleanup = doc("cleanup.json")
        self.eq("scanner.cleanup.state", cleanup["state"], "STOPPED")
        self.eq("scanner.cleanup.evidence", cleanup["evidencePreserved"], True)
        self.eq("scanner.cleanup.kinds", [row["kind"] for row in cleanup["results"]], ["main", "error"])
        for row in cleanup["results"]:
            kind = row["kind"]
            # Journeys do not stop error daemon. ABSENT needs separate diagnosis, unlike R3 controls.
            self.eq("scanner.cleanup.status:" + kind, row["status"], "STOPPED")
            self.eq("scanner.cleanup.pid:" + kind, row.get("pid"), service[kind]["pid"])
            self.eq("scanner.cleanup.start_time:" + kind, row.get("startTime"), service[kind]["start_time"])
        self.inventory["scanner"] = {"evidence_prefix": prefix, "work_directory": root, "services": setup["services"], "databases": databases["files"], "cleanup": cleanup}

    @staticmethod
    def options(content):
        result = {}
        for line in content.splitlines():
            if not line.strip() or line.lstrip().startswith("#"):
                continue
            key, value = line.split(None, 1)
            if key in result:
                raise DocumentError("Repeated config option: " + key)
            result[key] = value
        return result

    def result(self):
        self.stage("request", self.request)
        self.stage("playwright", self.playwright)
        self.stage("scanner", self.scanner)
        failures = [check for check in self.checks if not check["passed"]]
        return {"schema": "operations75.journeys-artifact-read.v1", "scope": "Documentary extraction; no product code or tests executed by this tool",
                "status": "ARTIFACT_DOCUMENTS_PASS" if not failures else "ARTIFACT_DOCUMENTS_HOLD",
                "binding": {"work": self.args.work, "snapshot": self.args.snapshot, "run": self.args.run, "attempt": self.args.attempt,
                            "request_sha256": self.policy["request_sha256"]},
                "checks": self.checks, "failure_count": len(failures), "failures": failures,
                "journeys": self.journeys, "inventory": self.inventory, "document_hashes": self.inputs,
                "requires_external_intake": [
                    "GitHub MCP: final released73+75 candidate W and its tree; snapshot S has single parent W and only .ci-run.json delta.",
                    "GitHub MCP: Actions run/job terminal success bound to S, correct repository/push/branch, setup/run/cleanup/upload steps successful.",
                    "GitHub MCP: base Playwright config, package scripts, flaky reporter and lockfile hashes at W match the reviewed source policy; JSON omits expect/use.",
                    "Review uploaded HTML and failure traces if present; raw pass counts alone do not close all campaign criteria.",
                    "Checks45, native/provider parity, C06 and global release are separate gates."],
                "GLOBAL_RELEASE": False, "checks45": "NOT_ESTABLISHED_BY_THIS_PARSER", "native_parity": "NOT_ESTABLISHED_BY_THIS_PARSER"}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("artifact", type=Path, help="Downloaded ZIP or unpacked artifact directory")
    parser.add_argument("--work", required=True, help="Expected integrated product W, full SHA")
    parser.add_argument("--snapshot", required=True, help="Expected request-only S, full SHA")
    parser.add_argument("--run", required=True, help="Expected Actions run ID")
    parser.add_argument("--attempt", default="1", help="Expected GitHub run attempt")
    parser.add_argument("--snapshot-request", type=Path, help="Optional exact .ci-run.json bytes obtained from S by MCP")
    parser.add_argument("--policy", type=Path, default=Path(__file__).with_name("POLICY.json"))
    parser.add_argument("--output", type=Path, help="Write extracted JSON report; input artifacts stay unchanged")
    args = parser.parse_args(argv)
    if not re.fullmatch(r"[a-f0-9]{40}", args.work) or not re.fullmatch(r"[a-f0-9]{40}", args.snapshot):
        parser.error("--work and --snapshot must be full lowercase Git SHAs")
    if not re.fullmatch(r"[1-9][0-9]*", args.run) or not re.fullmatch(r"[1-9][0-9]*", args.attempt):
        parser.error("--run and --attempt must be positive integers")
    try:
        result = Audit(Artifact(args.artifact), strict_json(args.policy.read_bytes()), args).result()
    except (DocumentError, OSError, ValueError, zipfile.BadZipFile) as error:
        result = {"status": "ARTIFACT_DOCUMENTS_HOLD", "failure_count": 1, "error": str(error), "GLOBAL_RELEASE": False}
    encoded = json.dumps(result, ensure_ascii=False, indent=2) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(encoded, encoding="utf-8")
        print(json.dumps({"status": result["status"], "failure_count": result["failure_count"], "output": str(args.output)}))
    else:
        print(encoded, end="")
    return 0 if result["status"] == "ARTIFACT_DOCUMENTS_PASS" else 1


if __name__ == "__main__":
    raise SystemExit(main())
