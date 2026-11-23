/** Capture plan, not execution or visual-approval evidence. Each PNG has its own observed source-state attachment. */
export const workflowPolishCoverage = {
  "status": "scope-only; execution and visual review required",
  "surfaces": [
    {
      "surface": "UI30",
      "spec": "design-wave-four-work.spec.ts",
      "states": [
        "period prerequisite",
        "original assigned handoff",
        "work details and current destination",
        "filtered empty"
      ],
      "limits": "Original read and source navigation; no inferred assignment."
    },
    {
      "surface": "UI31",
      "spec": "design-wave-four-work.spec.ts",
      "states": [
        "initial query",
        "invalid empty query",
        "original empty result"
      ],
      "limits": "Private POST body verified; no fabricated positive search hit."
    },
    {
      "surface": "UI32",
      "spec": "design-wave-four-work.spec.ts",
      "states": [
        "original V1 view",
        "edit and review",
        "cancel/revise retains draft",
        "saved revision readback",
        "removal review",
        "native V2 unavailable"
      ],
      "limits": "Removal is reviewed then cancelled; no V2 producer invented."
    },
    {
      "surface": "UI33",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "original authorized case list",
        "filtered empty",
        "new-case prerequisites"
      ],
      "limits": "No creation command in the new visual checkpoints."
    },
    {
      "surface": "UI34",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "case summary",
        "editor",
        "source review",
        "CAS-confirmed original edit"
      ],
      "limits": "Existing source attachments and exact version preserved."
    },
    {
      "surface": "UI35",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "two original alternatives",
        "empty alternatives",
        "conditioned comparison",
        "320px qualification"
      ],
      "limits": "Null totals and partial comparison retained."
    },
    {
      "surface": "UI36",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "original assumptions",
        "assumption detail"
      ],
      "limits": "Original open assumptions, no invented confirmation."
    },
    {
      "surface": "UI37",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "original questions",
        "question review",
        "prepared proposal"
      ],
      "limits": "One original question preparation and readback."
    },
    {
      "surface": "UI38",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "original current choice",
        "source-qualified action prerequisites"
      ],
      "limits": "No promotion bypass."
    },
    {
      "surface": "UI39",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "empty prepared changes"
      ],
      "limits": "Fixture has no prepared application changes."
    },
    {
      "surface": "UI40",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "empty application history"
      ],
      "limits": "No application receipt synthesized."
    },
    {
      "surface": "UI41",
      "spec": "design-wave-four-decisions.spec.ts",
      "states": [
        "original case/analysis/model catalogs",
        "empty analysis history",
        "missing prerequisite state",
        "prepared input only if the original model and operation exist"
      ],
      "limits": "No invented model or run; absent selectors are asserted against the original catalog."
    },
    {
      "surface": "UI42",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original case inputs and candidates"
      ],
      "limits": "Portfolio preview/evaluation not qualified by this visual test."
    },
    {
      "surface": "UI43",
      "spec": "design-workflows.spec.ts",
      "states": [
        "missing-result negative control"
      ],
      "limits": "No completed result; deliberate missing reference under a real case."
    },
    {
      "surface": "UI44",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original case/scenario/baseline/parameter inputs"
      ],
      "limits": "Sensitivity evaluation/result not qualified."
    },
    {
      "surface": "UI45",
      "spec": "design-workflows.spec.ts",
      "states": [
        "initial authorized analysis context"
      ],
      "limits": "View and period remain explicit prerequisites."
    },
    {
      "surface": "UI46",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original BI01 selection",
        "original contextual financial values"
      ],
      "limits": "Exact source selection, period and nonempty producer values verified."
    },
    {
      "surface": "UI47",
      "spec": "design-workflows.spec.ts",
      "states": [
        "initial agenda",
        "original section selection",
        "preservation review",
        "producer-confirmed preservation"
      ],
      "limits": "Two independent original preserved reviews feed UI48/49/50."
    },
    {
      "surface": "UI48",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original preserved review",
        "presentation mode"
      ],
      "limits": "Same original authorized review; no substituted snapshot."
    },
    {
      "surface": "UI49",
      "spec": "design-workflows.spec.ts",
      "states": [
        "compatible original revisions"
      ],
      "limits": "Same material retained twice; no numeric delta fabricated."
    },
    {
      "surface": "UI50",
      "spec": "design-workflows.spec.ts",
      "states": [
        "authorized report sections",
        "empty report selection"
      ],
      "limits": "No downloadable DOCX/PPTX artifact claimed."
    },
    {
      "surface": "UI51",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original relationship",
        "removal review"
      ],
      "limits": "Review cancelled without removing the relationship."
    },
    {
      "surface": "UI52",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original internal comment",
        "origin context",
        "unsent composer draft"
      ],
      "limits": "Local test seed has no recipient; no reply is posted."
    },
    {
      "surface": "UI53",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original material and fingerprint"
      ],
      "limits": "No no-change confirmation submitted."
    },
    {
      "surface": "UI54",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original follow-up draft"
      ],
      "limits": "No preparation, application or receipt invented."
    },
    {
      "surface": "UI55",
      "spec": "operations.spec.ts",
      "states": [
        "selected source and actual XLSX",
        "original scanned preview",
        "one Apply with lost delivery",
        "unavailable reconciliation"
      ],
      "limits": "SF_WORKFLOW_VISUAL_CAPTURE=1; real ClamD and original Apply, never synthetic approval."
    },
    {
      "surface": "UI56",
      "spec": "operations.spec.ts",
      "states": [
        "independent original manifest preview route"
      ],
      "limits": "Same exact source-backed manifest before Apply; no preview-only fixture."
    },
    {
      "surface": "UI57",
      "spec": "design-workflows.spec.ts + operations.spec.ts",
      "states": [
        "history reference prerequisite",
        "independent confirmed receipt",
        "real foreign-owner denial"
      ],
      "limits": "Actual separately enrolled viewer receives producer HTTP 403 for owner's manifest."
    },
    {
      "surface": "UI58",
      "spec": "operations.spec.ts",
      "states": [
        "admitted document with empty candidates",
        "authorized extraction fields before any extraction command",
        "original extracted candidate"
      ],
      "limits": "Actual private bytes, schema, digest and extraction."
    },
    {
      "surface": "UI59",
      "spec": "operations.spec.ts",
      "states": [
        "source confirmation review",
        "original confirmed evidence"
      ],
      "limits": "Original text range and confirmationVersion 1 verified."
    },
    {
      "surface": "UI60",
      "spec": "operations.spec.ts",
      "states": [
        "confirmed source with scenario prerequisite",
        "original source revoked"
      ],
      "limits": "No Planner scenario preview claimed; revocation clears evidence and source text."
    },
    {
      "surface": "UI61",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original authorized case conditions/signals or explicit absence"
      ],
      "limits": "Exact identity/version and original memory responses; no materiality signal invented."
    },
    {
      "surface": "UI62",
      "spec": "design-workflows.spec.ts",
      "states": [
        "authorized source and candidate choices"
      ],
      "limits": "No similar-case search result inferred."
    },
    {
      "surface": "UI63",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original authorized case conditions or explicit absence"
      ],
      "limits": "No expected/observed outcome manufactured."
    },
    {
      "surface": "UI64",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original routine admission prerequisites"
      ],
      "limits": "No prepare/run and no fabricated recipe."
    },
    {
      "surface": "UI65",
      "spec": "design-workflows.spec.ts",
      "states": [
        "no selected run"
      ],
      "limits": "No verified output or execution claimed."
    },
    {
      "surface": "UI66",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original schedule list or explicit source restriction",
        "new recurrence prerequisites"
      ],
      "limits": "No recurrence created; missing condition/recipe/timezone keeps review disabled."
    },
    {
      "surface": "UI67",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original local-operator context"
      ],
      "limits": "Exact project, installation and principal; not live Microsoft/Teams identity."
    },
    {
      "surface": "UI68",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original export controls and prerequisites"
      ],
      "limits": "No download/file claimed."
    },
    {
      "surface": "UI69",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original authorized local administration"
      ],
      "limits": "Read-only capture; no maintenance, restore or permission changes."
    },
    {
      "surface": "UI70",
      "spec": "design-workflows.spec.ts",
      "states": [
        "original resident inventory",
        "selected original profile when emitted"
      ],
      "limits": "Inventory is not execution, contribution or skill-pack proof."
    }
  ],
  "fixture": "Original isolated local-operator native installations; operations uses its existing real scanner host.",
  "newMatrixVariants": [
    "dark 1440x1100",
    "light 1440x1100",
    "dark 320x800"
  ],
  "limits": [
    "This inventory enumerates UI30–70, not every input permutation or all 165 registered route aliases.",
    "Portfolio/sensitivity results, new analyses, routine executions, Office downloads and live Microsoft identity are not inferred from prerequisites."
  ]
} as const
