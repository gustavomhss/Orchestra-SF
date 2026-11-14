# Hosted thread-actors failure: missing case verifier dependency

Observed hosted gate: run43654508667, job132629975340, source2fbb07c89581d1b30cbb23a1046805c3bcaea4a3, composed W9647675e5a08f86393d478602897657a3b8d478a. Root's complete log at mission48/evidence/boundary-01.log records75 pass and3 fail. This note addresses only the thread-actors failure; the failed run remains part of the evidence history.

The stack is thread-actors.test.ts:20 -> thread-actors-fixture.ts:146 -> available(unavailable/case-state-unavailable). Pinned W source shows line146 is caseSelection.create, after cases.draft at143 has returned successfully. It is not capture or case draft itself.

The fixture constructs createDecisionCasePort without the required verifyScenarioOperations callback. caseSelection.create reads the created case, and case-port.read calls input.verifyScenarioOperations twice. The missing function throws; the port's catch deliberately returns unavailable/case-state-unavailable.

Exact provenance: case-port.ts blob2bbcf63bb0fa56dd3a93190f7711f99aef2efb74 and thread-actors-fixture.ts blob2c9012ae49084c9c89d3d6be7779b5a88b8314e1 are identical in C12 and W. Neither the case port nor the fixture was changed by the original sixteen Mission48 patches. The Mission48 host changes do not modify case selection construction. The missing dependency therefore predates this patch unit; no fresh baseline execution is claimed here.

The complete proposed fixture patch supplies a deliberately restrictive callback: cases must have no alternatives, no choices and no prepared changes, and the actual host must revalidate the authentic context. This collaboration fixture creates only such draft cases and does not compose scenario-operation authority. Any scenario operation remains refused. The product receives no permissive fallback; no assertion, test body or budget changes.

Status: proposal only, to be composed and rerun by root on hosted infrastructure. No local product execution or remote mutation was performed by this auxiliary. This note does not claim a green rerun.
