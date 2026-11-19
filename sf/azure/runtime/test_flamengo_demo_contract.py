#!/usr/bin/env python3
"""Static A7 proof of *example shape* only; never proof of Azure/Entra success."""
import json
from pathlib import Path
import re
import unittest

FILE = Path(__file__).resolve().parent / "flamengo-microsoft.example.json"
UUID = re.compile(r"^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$")
EXPECTED_GROUPS = {
    "dashboard": {
        "admin": "group:d9a91aba-a2fc-4efa-ad9a-4a515208b5d2",
        "contributor": "group:05823772-b8dc-408a-94a8-3f341f72dfd9",
        "viewer": "group:d0910680-aae4-4ebb-9834-be836150ab1a",
    },
    "planner": {
        "admin": "group:457af676-7ac9-4f1c-b70c-dff1dfa61066",
        "finance": "group:fb9fdbd9-f9d8-428d-ad57-04090a52390c",
        "viewer": "group:6b9f6816-89f8-44e8-92e3-c5b16e35d6a2",
    },
    "procurement": {
        "admin": "group:400ea7f4-cf9b-4a20-a7b0-bd094c7b7c55",
        "requester": "group:54aa32bd-6f5d-4713-9903-90b3df524b47",
        "buyer": "group:3f89c5a8-63cb-43f8-9235-b83f99a0c659",
        "approver": "group:b52163db-66d7-430a-8585-80efbfef84f3",
        "viewer": "group:aa325a71-671e-4b2b-87bd-8b5ee5e681a1",
    },
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
        self.assertEqual(self.doc["groups"], EXPECTED_GROUPS)
        for surface, groups in EXPECTED_GROUPS.items():
            for role, group in groups.items():
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
