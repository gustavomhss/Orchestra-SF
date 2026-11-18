# Orchestra SF campaign mode

Apply only to explicitly authorized Orchestra SF execution or a request adopting this mode. The pinned plan and applicable AGENTS remain authoritative; record operational changes separately.

- One primary worktree and branch per WP.
- Four implementers: two Grok, one Terra and one Luna, subject to observed capacity. A role allocation does not prove four live sessions or permit oversubscription.
- Divide the WP's existing tasks among the four, each with all its criteria. Preserve previous outputs; validate complete, nonduplicate task coverage.
- Terra implements, leads the team, manages write leases, stages/commits and consolidates one complete WP PR.
- The supervisor receives complete WP PRs, stacks them and runs the epic bundle. Do not turn the supervisor into a microtask allocator or continuous publisher of partial source heads. Return any error to the author WP team for correction.
- Grok and Luna execute no product tests. Terra executes surgical hosted checks only at the end of the complete WP. No heavy local tests or intermediate CI.
- If Grok's adapter supports only read-only tools, require complete textual implementation patches, reviewed/materialized by Terra. Preserve host approval requirements.
- Verify permission configuration before concluding the adapter is read-only. Grok CLI 1.0.77 actually wrote both an exact authorized file and a new file under a scoped directory with `--no-plan --permission-mode acceptEdits --allow 'Write(/ABS/owned-subtree/**)'`. Reuse existing sessions and authorize only their assigned paths. Do not substitute `--always-approve` or permission bypass. Remove supervisor-imposed plan/read-only flags and tiny turn limits when assigning full implementation tasks.
- When all WP PRs are ready, the supervisor integrates the stacked bundle and runs epic/full E2E, preserving every additional selection and gate in the pinned plan.
- Full release additionally requires eight final CI selections on accepted C, AM01–AM06, three independent reviews, valid D provenance, separate real C/G7 and D/G8 guards, remote delivery verification and released writer authority. Epic green alone cannot replace them.
- Remote repository operations use GitHub MCP exclusively. Preserve user changes, immutable planning artifacts and the control branch boundary. No unrelated deployments, engines, corporate identity or infrastructure changes.
- Reuse existing worker sessions and stable prompt context, sending only necessary task/checkpoint deltas. Verify cache usage where exposed; do not promise a cache hit or sacrifice complete criteria to reduce context.

The originating campaign contains 15 WPs, 74 tasks, 17 contracts and 1,610 criteria. These counts do not establish delivery or prescribe other campaigns' size.
