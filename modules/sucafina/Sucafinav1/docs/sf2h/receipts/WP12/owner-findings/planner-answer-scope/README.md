# Planner-backed answer reading — scope reconciliation required

The W20 human question consumer created one real thread, preserved its prepared provenance, retried without duplication, received a reply and reopened/read/retried the stored thread. Its final `sf_answer_read` assertion failed with **unavailable** in run **43604476634**, job **132476041608**. The log does not expose the inner reason or isolate the first failing subgate.

Two exact published source boundaries independently prevent the intended Planner path:

1. The business constructor mounts the Planner confirmation observer but omits `resolveAnswerScope`. C06’s default scope resolver supports only a single Dashboard source. Scope derivation precedes the unconfirmed-baseline branch, and the dispatcher preserves an unavailable result.
2. The real Planner source carries the keys of its actor-visible projection, including the required `year`. C06 requires the scope fields to equal those source fields. The Planner confirmation manifest accepts only `summary`. Merely adding a callback therefore cannot reconcile the source and manifest.

**No code patch is supplied or applied.** A summary-only callback would be misleading: it either fabricates the source field scope or remains refused. WP10, WP08/C06 and the Planner producer must publish a producer-owned scope aligned with the actual EvidenceRef and manifest; WP00 participates if a shared contract changes. Only then should WP10 mount the resolver, with all current identity, period, dependency, authority, observation and fence checks preserved.

`finding.json` contains the log boundary, both findings and immutable source pins. `owner-delta.json` gives the required owner sequence and positive/negative hosted discriminators. These documents are a separate increment after D21; the published full criterion map is preserved.

The distinct native-question scalar-field correction does not fix this answer path. Its later genuine Planner-backed predecessor read reaches the same operation. Retests of these two question paths await the owner reconciliation; green Intent remains excluded. No unavailable result is accepted as unconfirmed, and no fixture, UI receipt or prepared input becomes native inference.
