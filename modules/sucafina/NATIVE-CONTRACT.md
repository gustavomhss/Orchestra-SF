# Native integration contract

This is the implementation contract for the Orchestra-SF fork. It does not establish readiness. The original Orchestra repository and running installation are outside the mutation scope.

## Ownership and layers

`packages/schema/src/sucafina.ts` defines the shared wire types. Protocol exposes the server-wide `server.sucafina` group. Generated Client methods are `orchestra.sucafina.status`, `.state` and `.command`. The Solid app-shell chapter uses those methods; it never imports business or server runtime code.

`modules/sucafina` owns the existing business engine and the native gateway. Server owns private installation configuration, process lifecycle and the Effect adapter. Shared protocol, registration and generation files remain lead-owned during delegation.

## Gateway

`createNativeGateway(mount, services)` takes the same explicitly supplied `ModuleServices` as `createModule`. It starts no listener and chooses no identity, database or key. Outside its exact mount it returns `undefined`.

- `GET {mount}/{surface}/state?page=...` returns `PageState` as JSON after authentication, page authorization and the domain's masked view.
- `POST {mount}/{surface}/commands` accepts the existing business `Command` and preserves its transaction, CAS, permission, locking and audit behavior.
- Unknown surfaces or suffixes are 404. A known route with an unsupported method is 405. `GET commands` and `POST state` are 405.
- POST preserves origin and cross-site checks. Authentication is resolved inside the same transaction as the role map and current data.
- Rejected commands preserve data, versions, sequences, audit and notices. A business error keeps its HTTP status; 409 is not a successful result.
- Native reads include only the authorized view, permitted page list, actor context, selected period, record versions and explicitly supplied directory. Never serialize a raw snapshot, secrets or unfiltered private assets.
- Native read output contains no HTML. Legacy rendering remains a separate parity reference. Frontend tables, forms, charts, dialogs and validation are Solid components in Orchestra's existing visual system.

The server maps validation to `SucafinaValidationError` (422), authorized conflicts to `SucafinaConflictError` (409), and standard authorization/unavailability errors to their declared statuses. It must not expose an unfiltered conflicting record.

Downloads, attachments, workbook previews, backup imports, role administration, notifications and enrollment require explicit native routes and acceptance before feature completion. The three initial endpoints do not replace those requirements.

## Authentication and installation

Microsoft integration remains deferred. Local operator access requires the existing explicit Mac-owner enrollment, opaque expiring sessions and actual OS identity. Configuration absence shows native setup state. Never invent a user, role, group or approval holder, and never treat host API authentication as corporate business identity.

The native API mount has its own cookie audience/path. Reusing the old `/sucafina` cookie at `/api/sucafina` is not valid. Enrollment must preserve one-use redemption, origin binding and private handoff. Browser and desktop transports need separate verification; a Chrome result is not desktop cookie proof.

The fork needs its own app IDs, URL scheme, storage paths, daemon ownership and update destination. No automatic migration or credential copy from the original Orchestra is authorized by this integration. Existing business data stays in private installation storage and must pass migration/reconciliation before cutover.

## Acceptance and completion

Tests run only through change-scoped hosted CI. Typechecks run from package directories. Public API changes require regenerating Client. The final gate includes guards against `origin/dev` and the complete imported fork baseline, independent review, native browser workflows and original-installation preservation checks.

The existing 38 business findings, four confirmed static deep-audit findings, operational gaps and native integration packages remain tracked in the external delivery ledger. A registered workspace, successful generation or fail-closed scaffold is not delivery.
