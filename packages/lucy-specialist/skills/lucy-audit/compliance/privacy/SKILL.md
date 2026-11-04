---
name: lucy-audit-compliance-privacy
description: "Find risks in a personal-data processing change; legal applicability and certification remain human decisions."
when: "The privacy lens is routed for a change affecting personal-data processing."
not-when: "The change does not affect personal-data processing or the task seeks a legal certification."
---

# Privacy processing changes

Trace changed categories of personal data from collection through purpose, defaults, access, logs, storage, retention, deletion, transfers and third-party sinks. Compare actual flows with the base-revision requirements and documented purpose. Look for unnecessary exposure, a new destination, a changed automated decision or a broken rights-handling path. Cite the changed line, affected data, concrete trigger and written expectation for `class:privacy.processing`; do not treat the author's transcript, a PR description or a policy assertion as evidence of implementation. Unknown facts become questions, not findings or passes.

Check whether the change affects incident detection and audit records, assessment of changed risk, children or older people, international transfer, automated decisions, access, correction or deletion. Ask for the relevant legal basis, scope, transfer mechanism and risk assessment; do not decide their adequacy. A change touching a possible DPIA trigger or data-subject right does not by itself establish that a particular duty applies.

## Sources and open questions

The Brazilian official text of LGPD Arts 14, 18, 20, 37 and 38 is at https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm . Its Art 20 describes a right to request review of solely automated decisions; do not assert that it always requires review by a human. Ask which rights, exceptions, records and assessments apply to this processing. The California Attorney General's overview at https://oag.ca.gov/privacy/ccpa identifies rights and describes CPRA as amendments to CCPA; ask whether CCPA applies and which rights and exceptions affect the changed flow.

The applicability and precise requirements of ePrivacy Art 5(3), UK GDPR and EDPB DPIA criteria are open questions: obtain current authoritative primary sources and human legal interpretation before stating duties. Likewise resolve the LGPD provisions and applicable ANPD measures against current primary text and the actual facts. Do not generalize consent, retention, transfer or breach-notification obligations from this checklist. This is a processing-change review, not a legal opinion, comprehensive compliance audit or certification.
