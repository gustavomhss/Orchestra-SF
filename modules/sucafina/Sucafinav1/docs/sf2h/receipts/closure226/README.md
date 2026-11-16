# Mission 226 — source A06 / shared F02

**Status**: PR #205 draft, code published on `sf-files-transport`; 211 integration
is pending, and 223 real-source validation is NOT_RUN. GitHub currently
reported PR mergeable=false; **do not force merge** or overwrite another author.

Source lineage: original W18 / PR121 and repair218, 25 frozen operations.
Web F02 authenticates original same-origin request, constructs file imports
as bounded multipart, reuses original asset uploads and consumes only bounded
bytes with live context/operation-owner checks. Desktop main owns private
64KiB response chunks, 32MiB total and pre/post authority recheck.
A06 JSON metadata/codecs are distinct from `Uint8Array` payloads.

Receipts:
- `ACK.json`: initial frozen HEAD/S0 and source recovery.
- `INERT-211-PATCHSET.json`: 6 complete **unapplied** preimage-locked
  package/binding/host ingress/filename and frame-bound patches for 211.
- `REQUEST-223.json`: exact operation selectors, real installed inputs and
  seven-case source/authorization matrix.
- `REQUEST-190.json`: generation only if 211 actually changes public API.
- `HANDOFF.json`: authority, consumers, known blockers.
- `RECHECK.json`: live remote sha/PR/source checks and next actions.

Driver `test/product/files-transport226/live-driver.ts` requires actual
original server inputs and independent expected HTTP/source-status and
byte/MIME facts; it makes no identity, bytes, grants, scanner or successful
proof. The source unit tests are authored but **never executed by 226**.
Unit, typecheck, build, validator, local run, CI, E2E all `NOT_RUN`.

No Azure, restart, platform work, SDK-generated edits, own S0 or watchdog.
`GLOBAL_RELEASE=false`; native goal paused.
