#!/usr/bin/env python3
"""Static A7 proof of *example shape* only; never proof of Azure/Entra success."""
import json
from pathlib import Path
import re
import unittest

FILE = Path(__file__).resolve().parent / "flamengo-microsoft.example.json"
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
ROLES = {
    "dashboard": {"admin", "contributor", "viewer"},
    "planner": {"admin", "finance", "viewer"},
    "procurement": {"admin", "requester", "buyer", "approver", "viewer"},
}


class FlamDemoExampleContract(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.doc = json.loads(FILE.read_text(encoding="utf-8"))

    def test_exact_public_app_and_origins(self):
        doc = self.doc
        self.assertEqual(doc["version"], 1)
        self.assertEqual(doc["deployment"], "azure-https")
        self.assertEqual(doc["authentication"], "microsoft")
        self.assertEqual(doc["tenantId"], "449dfd17-d627-45da-b22c-1be49d8df99f")
        self.assertEqual(doc["clientId"], "9006dcb8-1a75-4886-9475-1e7f1dc5d7cd")
        self.assertEqual(doc["origin"], "https://orchsf-spug5rxxyqkdw.swedencentral.cloudapp.azure.com")
        self.assertEqual(doc["listenerOrigin"], "http://127.0.0.1:4096")
        self.assertEqual(doc["mount"], "/sucafina")

    def test_exact_eleven_role_groups_no_extra_authority(self):
        self.assertEqual(set(self.doc["groups"]), set(ROLES))
        for surface, roles in ROLES.items():
            self.assertEqual(set(self.doc["groups"][surface]), roles)
            for role in roles:
                group = self.doc["groups"][surface][role]
                self.assertTrue(group.startswith("group:") and UUID.fullmatch(group[6:]), (surface, role))
        self.assertEqual(sum(map(len, self.doc["groups"].values())), 11)
        self.assertEqual(self.doc["grants"], [])
        self.assertIsNone(self.doc["scanner"])

    def test_ingress_deliberately_unresolved_not_guessed(self):
        self.assertEqual(self.doc["ingressOrigin"], "REQUIRES_OBSERVED_CADDY_HTTP_INGRESS_ORIGIN")
        self.assertFalse(self.doc["ingressOrigin"].startswith("http://"))

    def test_no_secret_or_unsupported_schema_keys(self):
        self.assertEqual(set(self.doc), {
            "version", "deployment", "authentication", "origin", "listenerOrigin",
            "ingressOrigin", "mount", "tenantId", "clientId", "groups", "grants",
            "workspaceDirectory", "scanner", "sessionSeconds", "loginSeconds",
        })
        content = FILE.read_text(encoding="utf-8").lower()
        self.assertNotIn("clientsecret", content)
        self.assertNotIn("client-secret.txt", content)
        self.assertNotIn("access_token", content)


if __name__ == "__main__":
    unittest.main()
