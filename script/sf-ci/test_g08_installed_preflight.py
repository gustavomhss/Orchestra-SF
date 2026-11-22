#!/usr/bin/env python3
"""Hosted controls for the private reader, not an installed-host qualification."""
import hashlib
import importlib.util
import io
import os
from pathlib import Path
import tempfile
import unittest

spec = importlib.util.spec_from_file_location("g08_observer", Path(__file__).with_name("g08-installed-preflight.py"))
observer = importlib.util.module_from_spec(spec)
spec.loader.exec_module(observer)


class PrivateReaderControls(unittest.TestCase):
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="g08-host-control-")
        self.root = Path(self.directory.name)
        self.root.chmod(0o700)

    def tearDown(self):
        self.directory.cleanup()

    def write(self, name="control.json", content=b'{"synthetic":true}\n'):
        file = self.root / name
        with os.fdopen(os.open(file, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600), "wb") as writer:
            writer.write(content)
        return file

    def test_actual_private_reader(self):
        self.write()
        self.assertEqual(observer.private_root(str(self.root)), self.root)
        value, raw = observer.private_json(self.root, "control.json")
        self.assertEqual(value, {"synthetic": True})
        self.assertEqual(raw, b'{"synthetic":true}\n')

    def test_public_root_refused(self):
        self.root.chmod(0o755)
        with self.assertRaises(RuntimeError):
            observer.private_root(str(self.root))

    def test_public_file_refused(self):
        self.write().chmod(0o644)
        with self.assertRaises(RuntimeError):
            observer.private_json(self.root, "control.json")

    def test_symbolic_file_refused(self):
        file = self.write()
        (self.root / "link.json").symlink_to(file)
        with self.assertRaises(RuntimeError):
            observer.private_json(self.root, "link.json")

    def test_hard_link_refused(self):
        file = self.write()
        os.link(file, self.root / "link.json")
        with self.assertRaises(RuntimeError):
            observer.private_json(self.root, "link.json")

    def test_bound_and_empty_file_refused(self):
        self.write()
        with self.assertRaises(RuntimeError):
            observer.private_json(self.root, "control.json", 2)
        self.write("empty.json", b"")
        with self.assertRaises(RuntimeError):
            observer.private_json(self.root, "empty.json")

    def test_outside_name_refused(self):
        self.write()
        with self.assertRaises(RuntimeError):
            observer.private_json(self.root, "../control.json")

    def test_duplicate_and_nested_duplicate_json_refused(self):
        for raw in [b'{"a":1,"a":2}', b'{"nested":{"a":1,"a":2}}']:
            with self.assertRaises(RuntimeError):
                observer.parse_json(raw)

    def test_stream_hash_observes_all_bytes(self):
        raw = b"synthetic archive bytes" * 100000
        self.assertEqual(observer.stream_digest(io.BytesIO(raw)), hashlib.sha256(raw).hexdigest())
        self.assertNotEqual(observer.stream_digest(io.BytesIO(raw[:-1])), hashlib.sha256(raw).hexdigest())

    def test_invalid_utf8_refused(self):
        self.write(content=b"\xff")
        with self.assertRaises(UnicodeDecodeError):
            observer.private_json(self.root, "control.json")


if __name__ == "__main__":
    unittest.main()
