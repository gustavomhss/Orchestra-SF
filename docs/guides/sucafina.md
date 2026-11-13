# Sucafina

Orchestra-SF is the Sucafina derivation of Orchestra, with preserved Git history and an upstream reference to the original project. GitHub does not show it as a formal fork because both repositories belong to the same account.

The Sucafina chapter brings three business areas into Orchestra's existing navigation and visual system:

- Dashboard: IT budget, team, portfolio, operations, security, risks, contracts and reporting.
- Planner: budget versions, OPEX, CAPEX, headcount, entities, allocations and exchange rates.
- Procurement: purchase requests, sourcing, approvals, purchase orders and suppliers.

The native Sucafina chapter is integrated into Orchestra navigation at `/orchestra/sucafina/dashboard`, `/orchestra/sucafina/planner` and `/orchestra/sucafina/procurement`, with page routes within each area. It is server-wide and opens without a project selected. Hosted checks cover the production entry and router using an HTTP fixture; they do not complete installation UAT or establish that every native card is complete.

Before rendering the server-backed app, the native entry requires both an authenticated Orchestra host session at the current origin and the authenticated, explicitly enrolled local operator for that installation. A missing installation configuration shows a setup state; an unauthenticated session shows sign-in guidance. Signing out clears the verified identity and current business view immediately while the server logout request runs. Microsoft authentication remains deferred because no Microsoft application has been supplied; no substitute administrator is used.

The serve CLI supports an isolated native installation at `http://localhost:4111`. Admission checks the private installation configuration and the native web build before loading the host. After binding, the CLI prints the path of a private, single-use enrollment artifact; enrollment establishes the installation and host sessions. Hosted checks cover the actual CLI HTTP lifecycle and private database placement. The private-cookie Chrome 28-page workflow still needs UAT. Native write editors and file I/O, along with some authoritative summaries, remain incomplete.

Budgets, attachments, roles, approval authority and audit history remain private. A public source repository does not include installation keys or business databases. Local backups do not protect against loss of the Mac; no external backup destination has been configured.

Creating an HR domain in Planner requires an administrator editing an unlocked version that is not official. Updating an existing domain still follows the field permissions for that version and the user's scope. These checks also apply to workbook imports; a forbidden new domain rejects the entire import.


Planner saves update the fields you edit. An empty save cannot advance a record revision, and editing actuals or forecasts leaves untouched budget fields as stored. On locked versions, an authorized roster import leaves the roster unchanged and reports a warning while applying other permitted rows.

Before PO approval, the request amount uses the selected quote converted to base currency, then the requisition estimate if no selected quote is available. Approved and issued orders use their frozen PO exchange rate. A PO above its approved sourcing amount shows a warning and still follows the normal submission and approval rules. Quote evaluation displays technical, price, commercial and overall scores plus rank using the same calculation as validation.

Workbook imports normalize supported calendar dates to `YYYY-MM-DD`: ISO dates, unpadded ISO dates, day-first slash or dot dates, and numeric Excel serials. Blank start or end cells preserve the existing date when updating a matched team member or Planner roster record. An invalid date rejects an eligible team-member or Planner roster import before it changes stored records. Project previews mark invalid rows as errors; applying a preview skips those rows and can import the valid rows. Direct project import rejects unmarked rows containing invalid dates before applying changes.

The native budget and Headcount screens display authorized summaries supplied by the server. Headcount includes leader totals, unassigned staff and departures; restricted talent classifications are omitted when they are not authorized. Security displays eight server-supplied KPI values and statuses for the selected year and month, including latest valid readings through that month. Zero and missing data remain distinct. Missing or malformed summaries show an unavailable state; the client does not reconstruct them from raw rows. Other operations, campaign and incident summaries remain incomplete.

The native Headcount leader-to-domain mapping follows the existing administrator, HR and Finance display permission. Budget owners and viewers retain their permitted aggregate HR totals. Supplier bank details remain visible only to administrators and supplier administrators; other authorized supplier views receive masked account identifiers and no remaining bank metadata.

The native client transport pins the installation origin and expected principal supplied by its caller, forwards cancellation, and rejects mismatched or unauthorized page responses. A newer stored record returns a conflict for the editor to resolve. Hosted entry/router checks used HTTP fixtures; private-cookie Chrome UAT remains outstanding.
