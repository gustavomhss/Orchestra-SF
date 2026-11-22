# Fifth wave: review and proposal presentation

Base: `d3ccea42b5f8409c8d6c68e4909f7b868b50322c`. Isolated branch: `sf-next-reviews`.

Owned areas: UI47 meeting agenda; UI48 preserved review list, detail and presentation; UI49 comparison; UI50 report list and source selection; UI54 Hot Topic proposals.

The page roots opt into the established 1160px frame with `data-sf-wave="five"`. The review workbench separates source discovery from agenda order. Preservation uses its existing explicit review stage. Review reading and presentation are distinct stages and the discussion remains mounted. Comparison pairs the two references before reading either source. Reports expose one Office format selector and the original section selection; the former unused title and duplicate format form are removed. A known review reference can be opened through an owner-bound route, without fabricating list data. Proposals retain source-bound preparation, current producer review and original receipt behavior.

Source limits observed in code: no native authorized preserved-review list; no native report list. These are presented as unavailable, never as a fabricated empty or populated list. The original agenda discovery also assigns one shared dashboard section identity across source pages. The native agenda preserves that identity; multiple-section reordering remains unavailable in this fixture. Runtime availability of preservation, review reads, comparison and proposals is still to be qualified through the existing test-ci workflow.

Catalog ownership: sf-u25.ts, sf-u32.ts, sf-u33.ts, sf-u38.ts. Existing English key/value pairs are preserved. New copy is English and Brazilian Portuguese. Native fonts, quiet raised fills and role tokens remain authoritative. Controls are 44px, panels 20px/16px, and focused work stages cap at 760px.

No producer, source schema, guard, authorization, workflow or delivery behavior is changed. No external messages or report publication is requested. Implementation is not visual verification or user approval.

## Validation status

Attempt 1 built the production app and read original dashboard projections, then exposed the shared section-identity boundary. Two diagnostic screenshots were manually inspected; the complete corrected journey, multilingual capture matrix and integration checks remain pending. Evidence and failed attempts will be recorded beside this file.
