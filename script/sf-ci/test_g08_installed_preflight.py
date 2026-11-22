#!/usr/bin/env python3
"""Hosted controls for the private reader, not an installed-host qualification."""
import hashlib
import copy
import json
from datetime import datetime, timedelta, timezone
from types import SimpleNamespace
from unittest.mock import patch
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



class Az02RestartControls(unittest.TestCase):
    """Controlled inputs and observed-port doubles; never a service restart or installed qualification."""
    def setUp(self):
        self.directory = tempfile.TemporaryDirectory(prefix="g08-az02-control-")
        self.root = Path(self.directory.name)
        self.root.chmod(0o700)
        self.target = {"serverKey": "https://qa.example.invalid", "discoveryOrigin": "https://qa.example.invalid",
                       "shellOrigin": "https://qa.example.invalid", "publicOrigin": "https://qa.example.invalid",
                       "installationId": "controlled-installation", "tenantId": "00000000-0000-4000-8000-000000000001",
                       "teamObjectId": "00000000-0000-4000-8000-000000000002", "projectId": "controlled-project",
                       "hostId": "controlled-host-before", "mount": "/sucafina", "chapterHref": "/orchestra"}
        now = datetime.now(timezone.utc)
        self.plan = {"schema": "sf-g08-private-plan-v1", "candidate": {"sha": "a" * 40, "tree": "b" * 40},
                     "scratchRoot": str(self.root), "target": self.target,
                     "invocation": {"id": "c" * 32, "runId": "1", "runAttempt": "1", "workflowSha": "a" * 40},
                     "reservation": {"vmId": "00000000-0000-4000-8000-000000000003", "environment": "qa-isolated",
                                     "exclusive": True, "startsAt": (now - timedelta(minutes=10)).isoformat(),
                                     "endsAt": (now + timedelta(minutes=10)).isoformat()},
                     "approvals": {"scope": "qualification-only"}}
        self.package = {"schema": "sf-g07-package-v1", "status": "PACKAGE_VERIFIED",
                        "candidate": self.plan["candidate"], "factory": {"path": "bin/local/entry.mjs", "sha256": "d" * 64},
                        "archive": {"file": observer.ARCHIVE, "sha256": "e" * 64, "bytes": 1},
                        "manifest": {"sha256": "f" * 64},
                        "verification": {"installerSha256": "1" * 64}}
        self.before = {"pid": 101, "startTicks": "200", "bootId": "00000000-0000-4000-8000-000000000004",
                       "executable": "/opt/orchestra-sf/releases/" + "a" * 40 + "/bin/orchestra",
                       "factorySha256": "d" * 64}
        self.after = {**self.before, "pid": 102, "startTicks": "300"}
        self.host = {"schema": "sf-g08-installed-host-v1", "status": "INSTALLATION_BYTES_AND_PROCESS_VERIFIED",
                     "phase": "before", "observedAt": now.isoformat(), "candidate": self.plan["candidate"],
                     "currentSource": "a" * 40, "invocationId": "c" * 32, "vmId": self.plan["reservation"]["vmId"],
                     "archiveSha256": "e" * 64, "manifestSha256": "f" * 64, "installerSha256": "1" * 64,
                     "releaseReceiptSha256": "3" * 64,
                     "process": self.host_process(self.before), "binding": self.binding(self.target)}
        fresh = {**self.descriptor(self.target), "hostId": "controlled-host-after"}
        self.private = {"schema": "sf.az02.private-observations.v2", "phase": "after-restart",
                        "candidate": self.plan["candidate"], "archiveSha256": "e" * 64, "invocation": self.plan["invocation"],
                        "details": [{"role": "requester", "cookieSha256": "2" * 64,
                                     "before": self.before, "after": self.after, "freshHost": fresh}]}
        self.phase = {"schema": "sf.az02.teams-proof.v2", "phase": "after-restart", "status": "PASS",
                      "proofClass": "OWNER_OPERATED_HTTPS_OBSERVATIONS", "liveQualified": False,
                      "installedTeamsProof": False, "g08Closed": False, "finalCandidate": False,
                      "candidate": self.plan["candidate"], "archiveSha256": "e" * 64, "invocation": self.plan["invocation"],
                      "source": {"legacySha": "687759276c2c9121c2cfd20a5994b277ceb7ee4d", "contractRevision": "sf-team-profile/1",
                                 "legacyCaseCount": 32, "currentCaseCount": 37},
                      "counts": {"total": 1, "passed": 1, "failed": 0, "skipped": 0},
                      "cases": [{"id": "REPLAY_AFTER_RESTART",
                                 "expected": "native process change and same revoked cookie denied on fresh host",
                                 "observed": "401", "status": "PASS"}], "scope": "CONTROLLED PARSER INPUT, NOT LIVE",
                      "hostPlanSha256": "", "privateEvidenceSha256": ""}
        self.publish()

    def tearDown(self):
        self.directory.cleanup()

    def write(self, name, value):
        raw = json.dumps(value, separators=(",", ":")).encode() + b"\n"
        file = self.root / name
        file.write_bytes(raw)
        file.chmod(0o600)
        return raw

    def publish(self):
        self.package_raw = self.write("package-receipt.json", self.package)
        self.plan["packageReceiptSha256"] = observer.sha256(self.package_raw)
        self.plan_raw = self.write("plan.json", self.plan)
        self.private_raw = self.write("az02-private.json", self.private)
        self.phase["hostPlanSha256"] = observer.sha256(self.plan_raw)
        self.phase["privateEvidenceSha256"] = observer.sha256(self.private_raw)
        self.write("az02-phase.json", self.phase)
        self.write("host-before.json", self.host)

    def descriptor(self, target):
        return {"contractRevision": "sf-team-profile/1", "authMode": "microsoft",
                **{key: target[key] for key in ("installationId", "tenantId", "projectId", "hostId", "publicOrigin", "mount")}}

    def binding(self, target):
        return {"status": "LOOPBACK_PID_AND_HTTPS_BOUND", "factorySha256": "d" * 64,
                "descriptor": self.descriptor(target)}

    def host_process(self, value):
        return {"unit": observer.UNIT, "pid": value["pid"], "startTicks": value["startTicks"],
                "bootId": value["bootId"], "exe": value["executable"], "activeState": "active", "subState": "running"}

    def derive(self):
        return observer.az02_restart_binding(self.root, self.plan, self.plan_raw, self.package)

    def test_bound_input_changes_only_host_id_and_does_not_qualify_live(self):
        plan_before = self.plan_raw
        target, restart = self.derive()
        self.assertEqual(target, {**self.target, "hostId": "controlled-host-after"})
        self.assertEqual((self.root / "plan.json").read_bytes(), plan_before)
        self.assertEqual(restart["before"], self.before)
        self.assertEqual(restart["after"], self.after)
        self.assertEqual(restart["status"], "AZ02_TRANSITION_INPUTS_BOUND_NOT_LIVE")
        self.assertTrue(restart["requiresOriginalWorkflowChain"])
        self.assertFalse(restart["liveQualified"])

    def test_controlled_manual_or_live_phase_claim_refused(self):
        for key, value in (("proofClass", "CONTROLLED_TRANSPORT"), ("restartReceipt", {}),
                           ("liveQualified", True), ("installedTeamsProof", True), ("g08Closed", True),
                           ("finalCandidate", True)):
            with self.subTest(key=key):
                saved = copy.deepcopy(self.phase)
                self.phase[key] = value
                self.publish()
                with self.assertRaises(RuntimeError):
                    self.derive()
                self.phase = saved

    def test_exact_case_and_zero_skip_required(self):
        changes = [("phase", "logout"), ("status", "FAIL"), ("counts", {"total": 1, "passed": 0, "failed": 0, "skipped": 1}),
                   ("counts", {"total": True, "passed": True, "failed": 0, "skipped": 0}), ("cases", []),
                   ("cases", [dict(self.phase["cases"][0], observed="200")]),
                   ("cases", [dict(self.phase["cases"][0], observed="BOOLEAN_CHECK")]),
                   ("cases", [dict(self.phase["cases"][0], id="MANUAL_RESTART")]),
                   ("cases", [dict(self.phase["cases"][0], status="FAIL")])]
        for key, value in changes:
            with self.subTest(key=key, value=value):
                saved = copy.deepcopy(self.phase)
                self.phase[key] = value
                self.publish()
                with self.assertRaises(RuntimeError):
                    self.derive()
                self.phase = saved

    def test_phase_and_private_c_t_tar_run_are_bound(self):
        for side in ("phase", "private"):
            for key, value in (("candidate", {"sha": "9" * 40, "tree": "b" * 40}),
                               ("candidate", {"sha": "a" * 40, "tree": "9" * 40}),
                               ("archiveSha256", "9" * 64),
                               ("invocation", {**self.plan["invocation"], "runId": "2"}),
                               ("invocation", {**self.plan["invocation"], "runAttempt": "2"}),
                               ("invocation", {**self.plan["invocation"], "id": "9" * 32}),
                               ("invocation", {**self.plan["invocation"], "workflowSha": "9" * 40})):
                with self.subTest(side=side, key=key):
                    saved = copy.deepcopy(getattr(self, side))
                    getattr(self, side)[key] = value
                    self.publish()
                    with self.assertRaises(RuntimeError):
                        self.derive()
                    setattr(self, side, saved)

    def test_original_phase_and_plan_bytes_are_bound(self):
        for key in ("hostPlanSha256", "privateEvidenceSha256"):
            with self.subTest(key=key):
                saved = self.phase[key]
                self.phase[key] = "9" * 64
                self.write("az02-phase.json", self.phase)
                with self.assertRaisesRegex(RuntimeError, "G08_AZ02_ORIGINAL_BYTES_MISMATCH"):
                    self.derive()
                self.phase[key] = saved

    def test_before_host_must_be_original_matching_invocation(self):
        changes = [("schema", "manual"), ("phase", "after"), ("status", "PASS"), ("currentSource", "9" * 40),
                   ("candidate", {"sha": "a" * 40, "tree": "9" * 40}), ("invocationId", "9" * 32),
                   ("vmId", "other"), ("archiveSha256", "9" * 64), ("manifestSha256", "9" * 64),
                   ("installerSha256", "9" * 64), ("observedAt", "2000-01-01T00:00:00Z")]
        for key, value in changes:
            with self.subTest(key=key):
                saved = copy.deepcopy(self.host)
                self.host[key] = value
                self.publish()
                with self.assertRaises(RuntimeError):
                    self.derive()
                self.host = saved

    def test_before_process_cannot_be_replaced_by_an_operator_claim(self):
        for key, value in (("pid", 999), ("startTicks", "999"),
                           ("bootId", "00000000-0000-4000-8000-000000000099")):
            with self.subTest(key=key):
                saved = self.host["process"][key]
                self.host["process"][key] = value
                self.publish()
                with self.assertRaisesRegex(RuntimeError, "G08_AZ02_BEFORE_PROCESS_MISMATCH"):
                    self.derive()
                self.host["process"][key] = saved

    def test_fresh_host_without_observed_process_change_is_refused(self):
        self.private["details"][0]["after"] = copy.deepcopy(self.before)
        self.publish()
        with self.assertRaisesRegex(RuntimeError, "G08_AZ02_PROCESS_DID_NOT_RESTART"):
            self.derive()

    def test_original_pid_start_boot_executable_and_factory_required(self):
        changes = [("pid", 0), ("pid", True), ("startTicks", "0"), ("startTicks", 300),
                   ("bootId", "not-a-boot-id"), ("factorySha256", "9" * 64), ("executable", "/tmp/other")]
        for key, value in changes:
            with self.subTest(key=key):
                saved = copy.deepcopy(self.private)
                self.private["details"][0]["after"][key] = value
                self.publish()
                with self.assertRaises(RuntimeError):
                    self.derive()
                self.private = saved

    def test_fresh_descriptor_cannot_change_any_other_selector(self):
        fresh = self.private["details"][0]["freshHost"]
        for key in ("contractRevision", "authMode", "installationId", "tenantId", "projectId", "publicOrigin", "mount"):
            with self.subTest(key=key):
                saved = fresh[key]
                fresh[key] = "different"
                self.publish()
                with self.assertRaises(RuntimeError):
                    self.derive()
                fresh[key] = saved
        fresh["teamObjectId"] = self.target["teamObjectId"]
        self.publish()
        with self.assertRaises(RuntimeError):
            self.derive()

    def test_same_or_invalid_fresh_host_is_refused(self):
        for value in (self.target["hostId"], "", "x", "../other-host", None):
            with self.subTest(value=value):
                self.private["details"][0]["freshHost"]["hostId"] = value
                self.publish()
                with self.assertRaises(RuntimeError):
                    self.derive()

    def test_original_private_detail_and_cookie_hash_are_required(self):
        for value in ([], [{**self.private["details"][0], "role": "holder"}],
                      [{**self.private["details"][0], "cookieSha256": "raw-cookie"}],
                      [{**self.private["details"][0], "manualRestart": True}]):
            with self.subTest(value=value):
                saved = self.private["details"]
                self.private["details"] = value
                self.publish()
                with self.assertRaises(RuntimeError):
                    self.derive()
                self.private["details"] = saved

    def test_completion_requires_current_process_and_binding_not_sidecar_alone(self):
        target, restart = self.derive()
        current = self.host_process(self.after)
        result = observer.complete_az02_restart_observation(self.root, restart, current, self.binding(target), self.package)
        self.assertEqual(result["status"], "AZ02_PROCESS_AND_HOST_TRANSITION_REOBSERVED")
        self.assertFalse(result["liveQualified"])
        for key, value in (("pid", 103), ("startTicks", "400"),
                           ("bootId", "00000000-0000-4000-8000-000000000099"), ("subState", "exited")):
            with self.subTest(key=key):
                with self.assertRaises(RuntimeError):
                    observer.complete_az02_restart_observation(self.root, restart, {**current, key: value},
                                                              self.binding(target), self.package)
        with self.assertRaises(RuntimeError):
            observer.complete_az02_restart_observation(self.root, restart, current, self.binding(self.target), self.package)

    def test_completion_rejects_changed_original_private_inputs(self):
        target, restart = self.derive()
        for name in ("plan.json", "host-before.json", "az02-phase.json", "az02-private.json"):
            with self.subTest(name=name):
                saved = (self.root / name).read_bytes()
                (self.root / name).write_bytes(saved.rstrip() + b" \n")
                with self.assertRaisesRegex(RuntimeError, "G08_AZ02_INPUT_CHANGED_DURING_OBSERVATION"):
                    observer.complete_az02_restart_observation(self.root, restart, self.host_process(self.after),
                                                              self.binding(target), self.package)
                (self.root / name).write_bytes(saved)

    def test_completion_rejects_changed_original_producer_source(self):
        target, restart = self.derive()
        producer = self.root / "sf/azure/identity/az02-proof.cjs"
        producer.parent.mkdir(parents=True)
        producer.write_bytes(b"CONTROLLED_DIFFERENT_SOURCE")
        with patch.object(observer, "REPOSITORY", self.root):
            with self.assertRaisesRegex(RuntimeError, "G08_AZ02_PRODUCER_CHANGED_DURING_OBSERVATION"):
                observer.complete_az02_restart_observation(self.root, restart, self.host_process(self.after),
                                                          self.binding(target), self.package)

    def test_sidecar_must_remain_private_regular_single_link(self):
        file = self.root / "az02-private.json"
        file.chmod(0o644)
        with self.assertRaises(RuntimeError):
            self.derive()
        file.chmod(0o600)
        os.link(file, self.root / "aliased.json")
        with self.assertRaises(RuntimeError):
            self.derive()

    def installed_ports(self):
        """Actual local control files; every OS/cloud/process port is explicitly replaced for orchestration testing."""
        archive = b"CONTROLLED_ARCHIVE_NOT_AN_INSTALLED_TAR"
        file = self.root / observer.ARCHIVE
        file.write_bytes(archive)
        file.chmod(0o600)
        release = self.root / "releases" / self.plan["candidate"]["sha"]
        (release / "bin").mkdir(parents=True)
        (release / "bin/orchestra").write_bytes(b"CONTROLLED_NOT_EXECUTABLE")
        files = [{"path": "bin/orchestra", "sha256": observer.sha256(b"CONTROLLED_NOT_EXECUTABLE"), "executable": True}]
        manifest_raw = json.dumps({"files": files}, separators=(",", ":")).encode()
        (release / "distribution.json").write_bytes(manifest_raw)
        manifest_sha = observer.sha256(manifest_raw)
        archive_sha = observer.sha256(archive)
        source = {"sourceSHA": self.plan["candidate"]["sha"], "archiveSha256": archive_sha, "manifestSha256": manifest_sha}
        (release / ".a7-source.json").write_text(json.dumps(source))
        self.package["archive"] = {"file": observer.ARCHIVE, "sha256": archive_sha, "bytes": len(archive)}
        self.package["manifest"] = {"sha256": manifest_sha,
                                    "files": [{**files[0], "bytes": len(b"CONTROLLED_NOT_EXECUTABLE")}]}
        self.package["verification"]["installerSha256"] = observer.sha256(observer.INSTALLER.read_bytes())
        self.host.update(archiveSha256=archive_sha, manifestSha256=manifest_sha,
                         installerSha256=self.package["verification"]["installerSha256"],
                         releaseReceiptSha256=observer.sha256((release / ".a7-source.json").read_bytes()))
        self.phase["archiveSha256"] = archive_sha
        self.private["archiveSha256"] = archive_sha
        self.publish()
        calls = []
        installer = SimpleNamespace(RELEASES=release.parent,
                                    current_source=lambda: self.plan["candidate"]["sha"],
                                    check_rollback_release=lambda candidate: calls.append(("installed", candidate)),
                                    protected_input=lambda file, maximum: file.open("rb"))
        loader = SimpleNamespace(exec_module=lambda module: None)
        env = {"GITHUB_ACTIONS": "true", "CI": "true", "RUNNER_ENVIRONMENT": "self-hosted",
               "GITHUB_REPOSITORY": "gustavomhss/Orchestra-SF", "SF_G08_CANDIDATE_SHA": self.plan["candidate"]["sha"],
               "SF_G08_CANDIDATE_TREE": self.plan["candidate"]["tree"], "SF_G08_INVOCATION_ID": self.plan["invocation"]["id"],
               "GITHUB_RUN_ID": "1", "GITHUB_RUN_ATTEMPT": "1", "GITHUB_WORKFLOW_SHA": self.plan["invocation"]["workflowSha"]}
        return installer, loader, env, calls

    def execute_controlled_observer(self, phase, change_last_process=False):
        installer, loader, env, calls = self.installed_ports()
        if phase != "after-restart":
            (self.root / "az02-phase.json").unlink()
            (self.root / "az02-private.json").unlink()
        if phase == "before":
            (self.root / "host-before.json").unlink()
        process = self.host_process(self.after if phase == "after-restart" else self.before)
        observed = [copy.deepcopy(process), copy.deepcopy(process), copy.deepcopy(process)]
        if change_last_process:
            observed[-1]["pid"] += 1
        def binding(process_value, package_value, target):
            calls.append(("runtime", copy.deepcopy(target)))
            return self.binding(target)
        with patch.dict(os.environ, env), patch.object(observer, "actual_vm_id", return_value=self.plan["reservation"]["vmId"]), \
             patch.object(observer.importlib.util, "spec_from_file_location", return_value=SimpleNamespace(loader=loader)), \
             patch.object(observer.importlib.util, "module_from_spec", return_value=installer), \
             patch.object(observer, "running_process", side_effect=observed), \
             patch.object(observer, "runtime_binding", side_effect=binding):
            observer.observe(self.root, phase)
        return calls

    def test_after_restart_orchestration_rechecks_original_ports_and_writes_host_after(self):
        calls = self.execute_controlled_observer("after-restart")
        value = observer.parse_json((self.root / "host-after.json").read_bytes())
        self.assertEqual(value["phase"], "after-restart")
        self.assertEqual(value["target"], {**self.target, "hostId": "controlled-host-after"})
        self.assertEqual(value["restart"]["after"], self.after)
        self.assertEqual(calls, [("installed", "a" * 40), ("runtime", value["target"])])
        self.assertFalse(value["restart"]["liveQualified"])
        self.assertFalse((self.root / "host-after-restart.json").exists())
        self.assertEqual(observer.parse_json((self.root / "plan.json").read_bytes())["target"], self.target)

    def test_ordinary_after_preserves_original_target_and_requires_no_restart_sidecars(self):
        calls = self.execute_controlled_observer("after")
        value = observer.parse_json((self.root / "host-after.json").read_bytes())
        self.assertEqual(value["phase"], "after")
        self.assertNotIn("restart", value)
        self.assertNotIn("target", value)
        self.assertEqual(calls[-1], ("runtime", self.target))


    def test_ordinary_before_preserves_original_output_and_ignores_restart_inputs(self):
        calls = self.execute_controlled_observer("before")
        value = observer.parse_json((self.root / "host-before.json").read_bytes())
        self.assertEqual(value["phase"], "before")
        self.assertNotIn("restart", value)
        self.assertNotIn("target", value)
        self.assertEqual(calls[-1], ("runtime", self.target))
        self.assertFalse((self.root / "az02-phase.json").exists())
        self.assertFalse((self.root / "az02-private.json").exists())

    def test_process_race_before_publication_cannot_emit_host_after(self):
        with self.assertRaisesRegex(RuntimeError, "G08_AZ02_FINAL_PROCESS_OR_RELEASE_CHANGED"):
            self.execute_controlled_observer("after-restart", change_last_process=True)
        self.assertFalse((self.root / "host-after.json").exists())

    def test_existing_host_after_cannot_be_overwritten(self):
        self.write("host-after.json", {"controlled": "preserve"})
        before = (self.root / "host-after.json").read_bytes()
        with self.assertRaises(FileExistsError):
            self.execute_controlled_observer("after-restart")
        self.assertEqual((self.root / "host-after.json").read_bytes(), before)


if __name__ == "__main__":
    unittest.main()
