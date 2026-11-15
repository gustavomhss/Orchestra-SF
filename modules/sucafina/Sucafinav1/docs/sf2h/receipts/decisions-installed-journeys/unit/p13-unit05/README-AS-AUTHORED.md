# P13 — supplemental access-projection contract tests

This is a new, inert test-file proposal for hosted surgical execution only. No test, product module, compiler or build has been executed locally. The five installed Decisions journeys remain unchanged and mandatory.

The 23 statically enumerated cases use actual LocalStore SQLite, ProductAuthority, C08 state and private UI leases. The fixture authenticator is an explicit membership boundary backed by the canonical `identity.resolve` function; it records every invocation and is not a Microsoft/local-login qualification. Direct setup mutations exist only inside this isolated unit fixture.

The test distinguishes an absent optional capability from a present function returning undefined. Canonical transaction entry is permitted when initially outside a root; fallback to full `currentSnapshots` is never permitted merely because the optional projection returned undefined.

The peer-writer test honors the real lock: it starts outside the reader ALS, cannot enter its callback or COMMIT while BEGIN IMMEDIATE is held, and is awaited only after root release. A fresh subsequent root must see its committed ACL. No test claims another writer can COMMIT inside the held root.

The projection boundary intentionally excludes unrelated business data. The test checks that the unchanged full reader still refuses an unrelated accessor while the access-only projection does not traverse it. Selected object accessors, malformed metadata, scope guards and canonical role/access validation remain negative controls.

`material.json` carries complete new-file contents and a null preimage; `complete.patch` is the matching creation patch. `matrix.json` lists the meaningful oracles. This proposal changes no shared source file or workflow, adds no timeout/skip/retry, and grants no runtime PASS or release.
