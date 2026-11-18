#!/usr/bin/env python3
"""A7 static negative controls. Synthetic files prove verifier behavior ONLY, never Azure success."""
import hashlib
import json
from pathlib import Path
import sys
import tempfile
import unittest

sys.path.insert(0, str(Path(__file__).resolve().parent))
from bundle import manifest, verify_release


FAKE_ELF_HEADER = b"\x7fELF\x02\x01" + b"\x00" * 12 + b"\x3e\x00"
C = "a" * 40
TREE = "b" * 40
ARCHIVE_HASH = "c" * 64


class ArtifactContractTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix="a7-contract-")
        self.addCleanup(self.temp.cleanup)
        self.root = Path(self.temp.name)
        self.payload = {
            "bin/orchestra": FAKE_ELF_HEADER + b"test-cli-not-executable",
            "bin/hugr_omni.node": FAKE_ELF_HEADER + b"addon-not-executable",
            "bin/hugr-omni-supervisor": FAKE_ELF_HEADER + b"supervisor-not-executable",
            "web/index.html": b"<html>contract test only</html>",
            "factory/installation.mjs": b"export default undefined // NOT A REAL FACTORY",
        }
        self.manifest = {
            "schema": "orchestra-sf.azure-bundle.v1", "candidateSha": C,
            "treeSha": TREE, "target": "linux-x64",
            "files": [{
                "path": name, "sha256": hashlib.sha256(data).hexdigest(),
                "mode": "0555" if name in ("bin/orchestra", "bin/hugr-omni-supervisor") else "0444"
            } for name, data in sorted(self.payload.items())],
        }

    def build_directory(self):
        for name, data in self.payload.items():
            f = self.root / name
            f.parent.mkdir(parents=True, exist_ok=True)
            f.write_bytes(data)
            f.chmod(0o555 if name in ("bin/orchestra", "bin/hugr-omni-supervisor") else 0o444)
        (self.root / "manifest.json").write_text(json.dumps(self.manifest))
        (self.root / ".archive-sha256").write_text(ARCHIVE_HASH + "\n")

    def test_directory_contract_accepts_structurally_complete_synthetic_sample_only(self):
        self.build_directory()
        self.assertEqual(len(verify_release(self.root, C, TREE, ARCHIVE_HASH)), 5)

    def test_missing_omni_refused(self):
        self.manifest["files"] = [v for v in self.manifest["files"] if v["path"] != "bin/hugr_omni.node"]
        with self.assertRaisesRegex(RuntimeError, "Omni"):
            manifest(json.dumps(self.manifest), C, TREE)

    def test_cross_candidate_revision_refused(self):
        with self.assertRaisesRegex(RuntimeError, "revision"):
            manifest(json.dumps(self.manifest), "d" * 40, TREE)

    def test_unlisted_file_refused(self):
        self.build_directory()
        (self.root / "web/unlisted.js").write_text("untrusted")
        with self.assertRaisesRegex(RuntimeError, "not admitted"):
            verify_release(self.root, C, TREE, ARCHIVE_HASH)

    def test_modified_payload_refused(self):
        self.build_directory()
        (self.root / "web/index.html").chmod(0o644)
        (self.root / "web/index.html").write_bytes(b"tampered")
        with self.assertRaisesRegex(RuntimeError, "hash changed"):
            verify_release(self.root, C, TREE, ARCHIVE_HASH)

    def test_file_permission_widening_refused(self):
        self.build_directory()
        (self.root / "web/index.html").chmod(0o666)
        with self.assertRaisesRegex(RuntimeError, "owner/mode"):
            verify_release(self.root, C, TREE, ARCHIVE_HASH)

    def test_symlink_in_release_refused(self):
        self.build_directory()
        (self.root / "web/new").symlink_to("/etc/passwd")
        with self.assertRaisesRegex(RuntimeError, "symlink"):
            verify_release(self.root, C, TREE, ARCHIVE_HASH)

    def test_missing_file_refused(self):
        self.build_directory()
        (self.root / "web/index.html").unlink()
        with self.assertRaisesRegex(RuntimeError, "missing"):
            verify_release(self.root, C, TREE, ARCHIVE_HASH)

    def test_revision_receipt_mismatch_refused(self):
        self.build_directory()
        with self.assertRaisesRegex(RuntimeError, "archive"):
            verify_release(self.root, C, TREE, "d" * 64)


if __name__ == "__main__":
    unittest.main()
