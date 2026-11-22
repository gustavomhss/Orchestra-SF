"""Component controls: real ZIP/tar bytes and the existing candidate verifier, no host installation."""
import hashlib
import importlib.util
import io
import json
from pathlib import Path
import stat
import tarfile
import tempfile
import unittest
from unittest.mock import patch
import warnings
import zipfile

SPEC = importlib.util.spec_from_file_location("g07_archive", Path(__file__).with_name("go-live-package-archive.py"))
package = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(package)
INSTALLER = Path(__file__).resolve().parents[2] / "sf/azure/vm/install-factory-distribution.py"
ELF = b"\x7fELF\x02\x01" + bytes(12) + b"\x3e\x00"
CANDIDATE = "a" * 40
TREE = "b" * 40
WORKFLOW = "c" * 40


def digest(value):
    return hashlib.sha256(value).hexdigest()


def encoded(value):
    return json.dumps(value, sort_keys=True).encode()


class PackageTest(unittest.TestCase):
    def setUp(self):
        self.root = Path(self.enterContext(tempfile.TemporaryDirectory(prefix="sf-g07-control-")))
        self.output = self.root / "verified"
        self.zip = self.root / "artifact.zip"
        self.admission_file = self.root / "admission.json"
        self.admission = {
            "schema": "sf-g07-admission-v1", "status": "VERIFIED_SOURCE",
            "candidate": {"sha": CANDIDATE, "tree": TREE},
            "acknowledgements": {"migration": {"testFixtureOnly": True}, "release": {"testFixtureOnly": True}},
            "producer": {"workflowSha": WORKFLOW, "workflowPath": ".github/workflows/g09-candidate.yml",
                         "runId": "33", "runAttempt": "2", "jobId": "44", "checkRunId": "55",
                         "jobName": "teams-profile-artifact", "artifactId": "66", "artifactName": "test-fixture-only",
                         "sourceProofFile": "compile-provenance.json", "buildInputsFile": "build-inputs.json"},
            "productionCutover": False, "installation": None,
        }

    def fixture(self, *, extra=None, corrupt=False, no_web=False, javascript=b"console.log('fixture');",
                proof_change=None, input_change=None, native_change=None, additional=None):
        bundle = b"export default {};\n"
        entry = "modules/sucafina/Sucafinav1/local/microsoft-entry.ts"
        files = {
            "bin/orchestra": ELF, "bin/hugr_omni.node": ELF, "bin/hugr-omni-supervisor": ELF,
            "package.json": b'{"version":"1.0.0"}',
            "bin/local/entry.mjs": bundle,
            "bin/local/closure.json": encoded({
                "schema": "sf-factory-closure-v1", "entry": entry,
                "bundle": {"path": "bin/local/entry.mjs", "sha256": digest(bundle)},
                "inputs": [{"path": entry, "sha256": digest(b"synthetic fixture source")}], "assets": []}),
        }
        if not no_web:
            files.update({"bin/web/index.html": b"<html><script src='/assets/entry.js'></script></html>",
                          "bin/web/assets/entry.js": javascript})
        files.update(extra or {})
        executable = {"bin/orchestra", "bin/hugr-omni-supervisor"}
        hashes = {name: digest(data) for name, data in files.items()}
        manifest = encoded({"schema": "orchestra-distribution-v1", "version": "1.0.0",
                            "target": "linux-x64-baseline", "files": [
                                {"path": name, "sha256": value, "executable": name in executable}
                                for name, value in sorted(hashes.items())]})
        files["distribution.json"] = manifest
        hashes["distribution.json"] = digest(manifest)
        files["checksums.sha256"] = "".join(value + "  " + name + "\n"
                                                   for name, value in sorted(hashes.items())).encode()
        if corrupt:
            files["bin/local/entry.mjs"] = b"unexpected modified payload"
        tar = io.BytesIO()
        with tarfile.open(fileobj=tar, mode="w:gz") as output:
            for name, data in sorted(files.items()):
                info = tarfile.TarInfo(name)
                info.size = len(data)
                output.addfile(info, io.BytesIO(data))
        archive = tar.getvalue()
        native = {
            "schema": "sf-entra-factory-package-v1", "proof": "packaged",
            "sourceSHA": CANDIDATE, "checkoutSHA": CANDIDATE, "expectedSourceSHA": CANDIDATE,
            "archiveFile": package.TAR_NAME, "archiveSha256": digest(archive),
            "manifestSha256": digest(manifest), "bundleSha256": digest(bundle),
            "target": "linux-x64-baseline", "runID": "33", "runAttempt": "2",
        }
        ledger = encoded({"schema": "orchestra-compile-evidence-v2", "target": "linux-x64-baseline",
                          "bun": "synthetic-compiler", "binary": {"sha256": digest(ELF)},
                          "inputs": [{"path": "fixture.ts"}], "metafile": {"outputs": {"fixture": {}}}})
        web = encoded({"index.html": {"file": "assets/entry.js", "isEntry": True}})
        proof = {
            "schema": "sf-linux-compile-provenance-v1", "sourceSHA": CANDIDATE, "sourceTreeSHA": TREE,
            "workflowSHA": WORKFLOW, "runId": "33", "runAttempt": "2", "checkRunId": "55",
            "job": "teams-profile-artifact", "target": "linux-x64-baseline",
            "bun": "synthetic-compiler", "bunRevision": "synthetic-revision", "bunArchiveSha256": "d" * 64,
            "archiveSha256": digest(archive), "manifestSha256": digest(manifest),
            "binary": {"path": "bin/orchestra", "sha256": digest(ELF)},
            "ledger": {"file": "compile-evidence.json", "sha256": digest(ledger)},
            "webManifest": {"file": "web-build-manifest.json", "sha256": digest(web)},
        }
        inputs = {"sourceSHA": CANDIDATE, "channel": "prod", "brand": "sucafina", "viteEnvironmentInputs": 0}
        proof.update(proof_change or {})
        inputs.update(input_change or {})
        native.update(native_change or {})
        members = {
            package.TAR_NAME: archive, package.RECEIPT_NAME: encoded(native),
            "compile-provenance.json": encoded(proof), "build-inputs.json": encoded(inputs),
            "compile-evidence.json": ledger, "web-build-manifest.json": web,
            "diagnostic.txt": b"UNSELECTED_CRC_CONTROL",
        }
        members.update(additional or {})
        self.write_zip(members)
        return members

    def write_zip(self, members):
        with zipfile.ZipFile(self.zip, "w", compression=zipfile.ZIP_STORED) as output:
            for name, data in members.items():
                output.writestr(name, data)
        self.sync_admission()

    def sync_admission(self):
        self.admission["producer"].update(zipSha256=package.sha256_file(self.zip), zipBytes=self.zip.stat().st_size)
        self.admission_file.write_bytes(encoded(self.admission))
        self.admission_file.chmod(0o600)

    def verify(self):
        return package.verify_package(self.zip, self.admission_file, INSTALLER, self.output)

    def inspect(self, selected=()):
        destination = self.root / "extracted"
        destination.mkdir()
        return package.inspect_zip(self.zip, destination, set(selected),
                                   package.sha256_file(self.zip), self.zip.stat().st_size)

    def test_actual_archive_verifier_records_components_without_claiming_installation(self):
        self.fixture()
        result = self.verify()
        self.assertEqual(result["status"], "PACKAGE_VERIFIED")
        self.assertEqual(result["candidate"], {"sha": CANDIDATE, "tree": TREE})
        self.assertEqual(result["archive"]["file"], package.TAR_NAME)
        self.assertTrue(result["verification"]["candidateInstallerInvoked"])
        self.assertEqual(result["verification"]["installerSha256"], package.sha256_file(INSTALLER))
        self.assertIsNone(result["installation"])
        self.assertFalse(result["g07Closed"])
        self.assertFalse(result["productionCutover"])
        self.assertEqual({p.name for p in self.output.iterdir()}, {"g07-package-receipt.json", "g07-zip-inventory.json"})
        self.assertEqual(stat.S_IMODE((self.output / "g07-package-receipt.json").stat().st_mode), 0o600)
        self.assertGreaterEqual(len(result["manifest"]["files"]), 8)

    def test_original_installer_rejects_corrupt_payload_before_receipt_output(self):
        self.fixture(corrupt=True)
        with self.assertRaisesRegex(RuntimeError, "payload differs from manifest"):
            self.verify()
        self.assertFalse(self.output.exists())

    def test_final_package_requires_built_web(self):
        self.fixture(no_web=True)
        with self.assertRaisesRegex(ValueError, "lacks built Web"):
            self.verify()

    def test_candidate_run_tree_and_toolchain_proofs_are_not_self_authorizing(self):
        mutations = [
            ({"sourceSHA": "e" * 40}, "source/tree/workflow"),
            ({"sourceTreeSHA": "e" * 40}, "source/tree/workflow"),
            ({"workflowSHA": "e" * 40}, "source/tree/workflow"),
            ({"runAttempt": "1"}, "run/attempt/check-run"),
            ({"checkRunId": "56"}, "run/attempt/check-run"),
            ({"job": "another-job"}, "producer job"),
            ({"bunRevision": ""}, "toolchain"),
            ({"bunArchiveSha256": "bad"}, "distribution digest"),
            ({"binary": {"path": "bin/orchestra", "sha256": "e" * 64}}, "ELF not bound"),
            ({"manifestSha256": "e" * 64}, "artifact identity"),
            ({"ledger": {"file": "compile-evidence.json", "sha256": "e" * 64}}, "supporting evidence"),
        ]
        for change, message in mutations:
            with self.subTest(change=change):
                self.fixture(proof_change=change)
                with self.assertRaisesRegex(ValueError, message):
                    self.verify()
                self.assertFalse(self.output.exists())

    def test_prod_brand_and_vite_environment_require_real_values(self):
        for change in ({"channel": "dev"}, {"brand": "orchestra"}, {"sourceSHA": "e" * 40},
                       {"viteEnvironmentInputs": 1}, {"viteEnvironmentInputs": False}):
            with self.subTest(change=change):
                self.fixture(input_change=change)
                with self.assertRaisesRegex(ValueError, "build inputs not proved"):
                    self.verify()

    def test_native_run_attempt_must_match_independent_admission(self):
        self.fixture(native_change={"runAttempt": "1"})
        with self.assertRaisesRegex(ValueError, "native package run/attempt"):
            self.verify()

    def test_parse_status_and_production_authorization_are_refused(self):
        self.fixture()
        for key, value in (("status", "PARSED"), ("productionCutover", True)):
            original = self.admission[key]
            self.admission[key] = value
            self.sync_admission()
            with self.assertRaisesRegex(ValueError, "live source admission"):
                self.verify()
            self.admission[key] = original

    def test_source_maps_inside_tar_are_rejected_even_with_valid_native_hashes(self):
        for suffix in (".map", ".map.gz", ".map.br"):
            with self.subTest(suffix=suffix):
                self.fixture(extra={"bin/web/assets/entry.js" + suffix: b"map"})
                with self.assertRaisesRegex(ValueError, "public payload contains source maps"):
                    self.verify()

    def test_inline_map_is_found_across_streaming_boundary_and_long_whitespace(self):
        self.fixture(javascript=b"x" * (1024 * 1024 - 8) +
                     b"sourceMappingURL" + b" " * (1024 * 1024) + b"=data:application/json;base64,e30=")
        with self.assertRaisesRegex(ValueError, "inline source map"):
            self.verify()

    def test_v2_external_map_evidence_is_hashed_without_entering_payload(self):
        maps = b"external compiler map fixture"
        index = b'{"maps":[]}'
        self.fixture(proof_change={
            "schema": "sf-linux-compile-provenance-v2",
            "cliSourceMaps": {"file": "cli-source-maps.tar.gz", "sha256": digest(maps),
                              "index": "cli-source-map-index.json", "indexSha256": digest(index)}},
            additional={"cli-source-maps.tar.gz": maps, "cli-source-map-index.json": index})
        result = self.verify()
        self.assertFalse(any("source-map" in row["path"] for row in result["manifest"]["files"]))

    def test_wrong_v2_external_map_digest_is_refused(self):
        self.fixture(proof_change={"schema": "sf-linux-compile-provenance-v2", "cliSourceMaps": {
            "file": "cli-source-maps.tar.gz", "sha256": "f" * 64,
            "index": "cli-source-map-index.json", "indexSha256": "f" * 64}},
            additional={"cli-source-maps.tar.gz": b"x", "cli-source-map-index.json": b"x"})
        with self.assertRaisesRegex(ValueError, "map evidence hash"):
            self.verify()

    def test_zip_traversal_backslash_and_unsafe_names_are_refused(self):
        for name in ("../escape", "/absolute", "a\\b", "a//b", "a/./b", "a/b."):
            with self.subTest(name=name):
                self.write_zip({name: b"control"})
                destination = self.root / ("case" + str(len(list(self.root.iterdir()))))
                destination.mkdir()
                with self.assertRaisesRegex(ValueError, "archive member"):
                    package.inspect_zip(self.zip, destination, set(), package.sha256_file(self.zip), self.zip.stat().st_size)

    def test_nul_in_original_zip_name_is_refused(self):
        self.write_zip({"aXb": b"control"})
        self.zip.write_bytes(self.zip.read_bytes().replace(b"aXb", b"a\0b"))
        with self.assertRaisesRegex(ValueError, "original name"):
            self.inspect()

    def test_duplicate_and_special_members_are_refused(self):
        with warnings.catch_warnings():
            warnings.simplefilter("ignore", UserWarning)
            with zipfile.ZipFile(self.zip, "w") as output:
                output.writestr("duplicate", b"x")
                output.writestr("duplicate", b"y")
        with self.assertRaisesRegex(ValueError, "duplicate ZIP"):
            self.inspect()
        link = zipfile.ZipInfo("link")
        link.create_system = 3
        link.external_attr = (stat.S_IFLNK | 0o777) << 16
        with zipfile.ZipFile(self.zip, "w") as output:
            output.writestr(link, b"/outside")
        with self.assertRaisesRegex(ValueError, "special ZIP"):
            package.inspect_zip(self.zip, self.root, set(), package.sha256_file(self.zip), self.zip.stat().st_size)

    def test_unselected_diagnostic_crc_is_checked(self):
        self.fixture()
        raw = self.zip.read_bytes()
        self.zip.write_bytes(raw.replace(b"UNSELECTED_CRC_CONTROL", b"UNSELECTED_CRC_CONTROX", 1))
        self.sync_admission()
        with self.assertRaises(zipfile.BadZipFile):
            self.verify()
        self.assertFalse(self.output.exists())

    def test_decompressed_and_member_count_limits_refuse_before_extraction(self):
        self.write_zip({"payload": b"x" * 512})
        for name, limit, message in (("EXPANDED_LIMIT", 511, "decompressed byte"),
                                     ("MAX_MEMBERS", 0, "member count")):
            with self.subTest(limit=name), patch.object(package, name, limit):
                with self.assertRaisesRegex(ValueError, message):
                    package.inspect_zip(self.zip, self.root, set(), package.sha256_file(self.zip), self.zip.stat().st_size)

    def test_missing_evidence_and_wrong_zip_identity_refuse(self):
        self.fixture()
        with self.assertRaisesRegex(ValueError, "required package evidence"):
            self.inspect({"not-present.json"})
        with self.assertRaisesRegex(ValueError, "ZIP identity"):
            package.inspect_zip(self.zip, self.root, set(), "f" * 64, self.zip.stat().st_size)

    def test_json_duplicate_fields_do_not_become_proofs(self):
        self.fixture(additional={"build-inputs.json": b'{"channel":"dev","channel":"prod"}'})
        with self.assertRaisesRegex(ValueError, "duplicate JSON"):
            self.verify()


if __name__ == "__main__":
    unittest.main()
