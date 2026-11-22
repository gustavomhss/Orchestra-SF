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



class RuntimeBindingControls(unittest.TestCase):
    def package(self):
        return {"candidate": {"sha": "a" * 40}, "factory": {"path": "bin/local/entry.mjs", "sha256": "b" * 64}}

    def target(self):
        return {"installationId": "synthetic-installation", "tenantId": "00000000-0000-4000-8000-000000000001",
                "projectId": "synthetic-project", "hostId": "synthetic-factory-instance",
                "publicOrigin": "https://qa.example.invalid", "mount": "/sucafina"}

    def configuration(self):
        return {"version": 1, "deployment": "azure-https", "authentication": "microsoft", "teams": "direct",
                "origin": self.target()["publicOrigin"], "tenantId": self.target()["tenantId"],
                "mount": "/sucafina", "listenerOrigin": "http://127.0.0.1:4096", "ingressOrigin": "http://sf-ingress.internal"}

    def discovery(self):
        return {"installations": [{"contractRevision": "sf-team-profile/1", "authMode": "microsoft", **self.target()}]}

    def argv(self):
        return ["/opt/orchestra-sf/current/bin/orchestra", "serve", "--hostname", "127.0.0.1", "--port", "4096",
                "--installation", "/opt/orchestra-sf/current/bin/local/entry.mjs"]

    def test_observed_launch_acceptance_contract(self):
        release = "/opt/orchestra-sf/releases/" + "a" * 40
        self.assertEqual(observer.validate_launch(self.argv(), release + "/bin/orchestra",
                         release + "/bin/local/entry.mjs", "b" * 64, self.package()), release + "/bin/local/entry.mjs")

    def test_other_factory_release_refused(self):
        with self.assertRaises(RuntimeError):
            observer.validate_launch(self.argv(), "/opt/orchestra-sf/releases/" + "a" * 40 + "/bin/orchestra",
                                     "/opt/orchestra-sf/releases/" + "c" * 40 + "/bin/local/entry.mjs", "b" * 64, self.package())

    def test_factory_hash_mismatch_refused(self):
        release = "/opt/orchestra-sf/releases/" + "a" * 40
        with self.assertRaises(RuntimeError):
            observer.validate_launch(self.argv(), release + "/bin/orchestra", release + "/bin/local/entry.mjs",
                                     "c" * 64, self.package())

    def test_different_launch_arguments_refused(self):
        for index, value in [(1, "run"), (3, "0.0.0.0"), (5, "8080"), (6, "--other")]:
            with self.subTest(index=index):
                argv = self.argv()
                argv[index] = value
                with self.assertRaises(RuntimeError):
                    observer.validate_launch(argv, "/opt/orchestra-sf/releases/" + "a" * 40 + "/bin/orchestra",
                                             "/opt/orchestra-sf/releases/" + "a" * 40 + "/bin/local/entry.mjs", "b" * 64, self.package())

    def test_original_config_descriptor_contract(self):
        self.assertEqual(observer.validate_configuration(self.configuration(), self.target()), "sf-ingress.internal")

    def test_configuration_target_and_listener_divergence_refused(self):
        for key, value in [("origin", "https://other.invalid"), ("tenantId", "another-tenant"),
                           ("mount", "/other"), ("listenerOrigin", "http://127.0.0.1:8080"),
                           ("authentication", "local-operator"), ("teams", "synthetic")]:
            with self.subTest(key=key):
                config = self.configuration()
                config[key] = value
                with self.assertRaises(RuntimeError):
                    observer.validate_configuration(config, self.target())

    def test_original_discovery_contract(self):
        self.assertEqual(observer.validate_discovery(self.discovery(), self.target()), self.discovery()["installations"][0])

    def test_foreign_factory_or_https_descriptor_refused(self):
        for key, value in [("hostId", "other-factory-instance"), ("publicOrigin", "https://other.invalid"),
                           ("installationId", "other-installation"), ("authMode", "local-operator"),
                           ("contractRevision", "sf-native-ui/1")]:
            with self.subTest(key=key):
                observed = self.discovery()
                observed["installations"][0][key] = value
                with self.assertRaises(RuntimeError):
                    observer.validate_discovery(observed, self.target())

    def test_duplicate_discovery_refused(self):
        value = self.discovery()
        value["installations"].append(value["installations"][0])
        with self.assertRaises(RuntimeError):
            observer.validate_discovery(value, self.target())

    def test_unique_actual_pid_listener_contract(self):
        header = "sl local_address rem_address st tx_queue tr retr uid timeout inode\n"
        row = "0: 0100007F:1000 00000000:0000 0A 00000000:00000000 00:00000000 00000000 1000 0 123\n"
        self.assertEqual(observer.listener_from_tables(header + row, header, {"123"}), "123")
        for tcp, tcp6, owned in [(header + row, header, {"999"}), (header + row + row, header, {"123"}),
                                (header + row.replace("0100007F", "00000000"), header, {"123"}),
                                (header + row.replace(" 0A ", " 01 "), header, {"123"}),
                                (header + row, header + row, {"123"})]:
            with self.subTest(tcp=tcp, tcp6=tcp6, owned=owned):
                with self.assertRaises(RuntimeError):
                    observer.listener_from_tables(tcp, tcp6, owned)

    def test_ingress_proof_cannot_leave_loopback(self):
        # HTTPConnection constructors do not connect. Both refusals occur before request().
        import http.client
        for connection in [http.client.HTTPSConnection("qa.example.invalid"), http.client.HTTPConnection("other.invalid", 4096)]:
            with self.assertRaises(RuntimeError):
                observer.discovery_request(connection, "qa.example.invalid", "a" * 64)



class ActiveProxyControls(unittest.TestCase):
    def servers(self):
        return {"srv0": {"listen": [":443"], "routes": [
            {"match": [{"host": ["qa.example.invalid"]}], "handle": [
                {"handler": "subroute", "routes": [{"handle": [
                    {"handler": "reverse_proxy", "upstreams": [{"dial": "127.0.0.1:4096"}],
                     "headers": {"request": {"set": {"Host": ["sf-ingress.internal"],
                         "X-Sf-Ingress-Proof": ["{env.SF_INGRESS_PROOF}"]}, "delete": ["Forwarded"]}}}
                ]}]}]}]}}

    def proxy(self, servers):
        return servers["srv0"]["routes"][0]["handle"][0]["routes"][0]["handle"][0]

    def test_original_active_proxy_contract(self):
        observer.validate_caddy_servers(self.servers(), "qa.example.invalid", "sf-ingress.internal")

    def test_other_upstream_refused(self):
        value = self.servers()
        self.proxy(value)["upstreams"] = [{"dial": "10.0.0.99:4096"}]
        with self.assertRaises(RuntimeError):
            observer.validate_caddy_servers(value, "qa.example.invalid", "sf-ingress.internal")

    def test_static_or_custom_success_content_refused(self):
        for handler in [{"handler": "file_server"}, {"handler": "static_response", "status_code": 200},
                        {"handler": "templates"}]:
            with self.subTest(handler=handler):
                value = self.servers()
                value["srv0"]["routes"][0]["handle"].append(handler)
                with self.assertRaises(RuntimeError):
                    observer.validate_caddy_servers(value, "qa.example.invalid", "sf-ingress.internal")

    def test_success_body_interception_refused(self):
        value = self.servers()
        self.proxy(value)["handle_response"] = [{"handle": [{"handler": "static_response", "body": "other frontend"}]}]
        with self.assertRaises(RuntimeError):
            observer.validate_caddy_servers(value, "qa.example.invalid", "sf-ingress.internal")

    def test_other_hostname_and_catchall_refused(self):
        for matcher in [[{"host": ["other.invalid"]}], [{"host": ["*.example.invalid"]}], []]:
            with self.subTest(matcher=matcher):
                value = self.servers()
                value["srv0"]["routes"][0]["match"] = matcher
                with self.assertRaises(RuntimeError):
                    observer.validate_caddy_servers(value, "qa.example.invalid", "sf-ingress.internal")

    def test_ingress_header_mismatch_refused(self):
        for header, content in [("Host", ["different-ingress"]), ("X-Sf-Ingress-Proof", ["not-the-runtime-placeholder"])]:
            with self.subTest(header=header):
                value = self.servers()
                self.proxy(value)["headers"]["request"]["set"][header] = content
                with self.assertRaises(RuntimeError):
                    observer.validate_caddy_servers(value, "qa.example.invalid", "sf-ingress.internal")

    def test_static_error_branch_can_coexist_with_original_proxy(self):
        value = self.servers()
        value["srv0"]["routes"][0]["handle"][0]["routes"].append(
            {"handle": [{"handler": "static_response", "status_code": 404}]})
        observer.validate_caddy_servers(value, "qa.example.invalid", "sf-ingress.internal")


if __name__ == "__main__":
    unittest.main()
