import type { Period } from "./context.ts"
import type { BusinessEvidenceRef } from "./business-context.ts"

export type ScenarioOperation = { kind: "replace" | "defer" | "include" | "exclude"; targetRef: string; replacementRef?: string; amount?: number; currency?: string; period?: Period }
export type JsonValue = null | boolean | number | string | readonly JsonValue[] | { readonly [key: string]: JsonValue }

export type DashboardReadRequest = {
  selectionRef: string
  period: Period
  fields: readonly string[]
}

export type KpiExplainRequest = {
  metricRef: string
  period: Period
  comparisonRef?: string
}

export type BiViewRequest = {
  viewId: string
  selectionRef: string
  period: Period
}

export type SourceGetRequest = {
  evidenceRef: BusinessEvidenceRef
}

export type ForecastCompareRequest = {
  baseRef: string
  candidateRef: string
  period: Period
  currency: string
}

export type ScenarioRequest = {
  baseRef: string
  operations: readonly ScenarioOperation[]
  assumptions: readonly { id: string; value: string | number | boolean | null; evidenceRefs: readonly BusinessEvidenceRef[]; state: "confirmed" | "estimated" | "hypothetical" | "absent" }[]
}

export type ScenarioCompareRequest = {
  scenarioRefs: readonly string[]
  criteria: readonly string[]
}

export type SensitivityRequest = {
  scenarioRef: string
  parameterBounds: { parameterRef: string; minimum: number; maximum: number; steps: number }
  criterion: { id: string; operator: "lte" | "gte" | "eq"; value: number }
}

export type PortfolioRequest = {
  scope: { horizon: Period; currency: string }
  candidateRefs: readonly string[]
  operations: readonly ScenarioOperation[]
  constraints: readonly string[]
  priorities: readonly string[]
  explorationLimit: number
}

export type RequestReadRequest = {
  requestRef: string
}

export type SupplierReadRequest = {
  supplierRef: string
  fields: readonly string[]
}

export type ContractReadRequest = {
  contractRef: string
  fields: readonly string[]
}

export type SourcingCompareRequest = {
  requestRef: string
  proposalRefs: readonly string[]
  criteria: readonly string[]
}

export type CaseReadRequest = {
  caseRef: string
}

export type CaseDraftRequest = {
  objective: string
  horizon: Period
  currency: string
  criteria: readonly string[]
  sourceRefs: readonly BusinessEvidenceRef[]
}

export type AlternativeDraftRequest = {
  caseRef: string
  proposal: { title: string; description: string; sourceRefs: readonly BusinessEvidenceRef[] }
  sourceRefs: readonly BusinessEvidenceRef[]
}

export type ChangePrepareRequest = {
  caseRef: string
  choiceRef: string
  operations: readonly ScenarioOperation[]
}

export type ReceiptGetRequest = {
  receiptRef: string
}

export type WorkListRequest = {
  selectionRef: string
  period: Period
}

export type QuestionPrepareRequest = {
  caseRef: string
  question: { text: string; criterionRef?: string }
  sourceRefs: readonly BusinessEvidenceRef[]
  recipientRef?: string
}

export type AnswerReadRequest = {
  questionRef: string
}

export type RelationReadRequest = {
  recordRefs: readonly string[]
}

export type HandoffPrepareRequest = {
  caseRef: string
  actionRef: string
  recipientRef?: string
  sourceRefs: readonly BusinessEvidenceRef[]
}

export type DocumentExtractRequest = {
  documentRef: string
  fieldSchemaRef: string
}

export type ImportPreviewRequest = {
  admittedFileRef: string
  format: string
  options: { sheet?: string; replace?: boolean; headerRow?: number }
}

export type ReviewPrepareRequest = {
  selectionRef: string
  period: Period
  sectionRefs: readonly string[]
}

export type ReportPrepareRequest = {
  reviewRef: string
  format: string
  sectionRefs: readonly string[]
}

export type ArtifactGetRequest = {
  artifactRef: string
}

export type BusinessContextRequest = {
  selectionRefs: readonly string[]
  purpose: string
  period: Period
}

export type KnowledgeSearchRequest = {
  query: string
  documentRefs?: readonly string[]
  limit: number
}

export type EvidenceGetRequest = {
  evidenceRef: BusinessEvidenceRef
}

export type BusinessRecallRequest = {
  selectionRefs: readonly string[]
  similarityCriteria: readonly string[]
  period: Period
  limit: number
}

export type FreshnessCheckRequest = {
  evidenceRefs: readonly BusinessEvidenceRef[]
}

export type RoutineCatalogRequest = {
  purpose: string
}

export type RoutinePrepareRequest = {
  publishedRecipeRef: string
  inputRefs: readonly string[]
  parameters: { period?: Period; selectionRefs?: readonly string[]; reviewRef?: string }
}

export type RoutineRunRequest = {
  admittedRunRef: string
  expectedAdmissionVersion: number
}

export type RoutineStatusRequest = {
  runRef: string
}

export type RoutineResultRequest = {
  runRef: string
}

export type WatchPrepareRequest = {
  caseRef: string
  conditionRef: string
  recurrence: { recipeRef: string; schedule: string; timezone: string }
  recipientRef?: string
}

export type SfOperationInputMap = {
  sf_dashboard_read: DashboardReadRequest
  sf_kpi_explain: KpiExplainRequest
  sf_bi_view: BiViewRequest
  sf_source_get: SourceGetRequest
  sf_forecast_compare: ForecastCompareRequest
  sf_scenario_simulate: ScenarioRequest
  sf_scenario_compare: ScenarioCompareRequest
  sf_sensitivity_evaluate: SensitivityRequest
  sf_portfolio_evaluate: PortfolioRequest
  sf_request_read: RequestReadRequest
  sf_supplier_read: SupplierReadRequest
  sf_contract_read: ContractReadRequest
  sf_sourcing_compare: SourcingCompareRequest
  sf_case_read: CaseReadRequest
  sf_case_draft: CaseDraftRequest
  sf_alternative_draft: AlternativeDraftRequest
  sf_change_prepare: ChangePrepareRequest
  sf_receipt_get: ReceiptGetRequest
  sf_work_list: WorkListRequest
  sf_question_prepare: QuestionPrepareRequest
  sf_answer_read: AnswerReadRequest
  sf_relation_read: RelationReadRequest
  sf_handoff_prepare: HandoffPrepareRequest
  sf_document_extract: DocumentExtractRequest
  sf_import_preview: ImportPreviewRequest
  sf_review_prepare: ReviewPrepareRequest
  sf_report_prepare: ReportPrepareRequest
  sf_artifact_get: ArtifactGetRequest
  sf_context_get: BusinessContextRequest
  sf_knowledge_search: KnowledgeSearchRequest
  sf_evidence_get: EvidenceGetRequest
  sf_decision_recall: BusinessRecallRequest
  sf_freshness_check: FreshnessCheckRequest
  sf_routine_catalog: RoutineCatalogRequest
  sf_routine_prepare: RoutinePrepareRequest
  sf_routine_run: RoutineRunRequest
  sf_routine_status: RoutineStatusRequest
  sf_routine_result: RoutineResultRequest
  sf_watch_prepare: WatchPrepareRequest
}

export const sfOperationDefinitions = {
  "SourceRef": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "surface": {
        "enum": [
          "dashboard",
          "planner",
          "procurement"
        ]
      },
      "type": {
        "type": "string",
        "minLength": 1
      },
      "id": {
        "type": "string",
        "minLength": 1
      },
      "incarnation": {
        "type": "string",
        "minLength": 1
      },
      "version": {
        "type": "integer",
        "minimum": 0
      },
      "fields": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      },
      "observedAt": {
        "type": "string",
        "minLength": 1
      }
    },
    "required": [
      "surface",
      "type",
      "id",
      "incarnation",
      "version",
      "fields",
      "period",
      "observedAt"
    ]
  },
  "BusinessEvidenceRef": {
    "oneOf": [
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "schema": {
            "const": "sf-evidence-v1"
          },
          "refId": {
            "type": "string",
            "minLength": 1
          },
          "installationId": {
            "type": "string",
            "minLength": 1
          },
          "projectId": {
            "type": "string",
            "minLength": 1
          },
          "refDigest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "evidenceLevel": {
            "enum": [
              "observed",
              "claim",
              "assumption",
              "proposal",
              "decision"
            ]
          },
          "kind": {
            "const": "record"
          },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "surface": {
                "enum": [
                  "dashboard",
                  "planner",
                  "procurement"
                ]
              },
              "recordType": {
                "type": "string",
                "minLength": 1
              },
              "recordId": {
                "type": "string",
                "minLength": 1
              },
              "incarnation": {
                "type": "string",
                "minLength": 1
              },
              "version": {
                "type": "integer",
                "minimum": 0
              },
              "fields": {
                "type": "array",
                "items": {
                  "type": "string",
                  "minLength": 1
                }
              },
              "period": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "start": {
                    "type": "string",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                  },
                  "end": {
                    "type": "string",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                  }
                },
                "required": [
                  "start",
                  "end"
                ]
              },
              "projectionDigest": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "surface",
              "recordType",
              "recordId",
              "incarnation",
              "version",
              "fields",
              "projectionDigest"
            ]
          }
        },
        "required": [
          "schema",
          "refId",
          "installationId",
          "projectId",
          "refDigest",
          "evidenceLevel",
          "kind",
          "target"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "schema": {
            "const": "sf-evidence-v1"
          },
          "refId": {
            "type": "string",
            "minLength": 1
          },
          "installationId": {
            "type": "string",
            "minLength": 1
          },
          "projectId": {
            "type": "string",
            "minLength": 1
          },
          "refDigest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "evidenceLevel": {
            "enum": [
              "observed",
              "claim",
              "assumption",
              "proposal",
              "decision"
            ]
          },
          "kind": {
            "const": "document"
          },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "documentId": {
                "type": "string",
                "minLength": 1
              },
              "incarnation": {
                "type": "string",
                "minLength": 1
              },
              "revision": {
                "type": "integer",
                "minimum": 0
              },
              "blobDigest": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "algorithm": {
                    "const": "sha256"
                  },
                  "value": {
                    "type": "string",
                    "pattern": "^[a-f0-9]{64}$"
                  }
                },
                "required": [
                  "algorithm",
                  "value"
                ]
              },
              "segment": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "start": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "end": {
                    "type": "integer",
                    "minimum": 0
                  },
                  "unit": {
                    "const": "utf16"
                  },
                  "textDigest": {
                    "type": "object",
                    "additionalProperties": false,
                    "properties": {
                      "algorithm": {
                        "const": "sha256"
                      },
                      "value": {
                        "type": "string",
                        "pattern": "^[a-f0-9]{64}$"
                      }
                    },
                    "required": [
                      "algorithm",
                      "value"
                    ]
                  }
                },
                "required": [
                  "start",
                  "end",
                  "unit",
                  "textDigest"
                ]
              },
              "ragSourceId": {
                "type": "string",
                "minLength": 1
              },
              "ragRevisionId": {
                "type": "string",
                "minLength": 1
              },
              "ragSourceHash": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "algorithm": {
                    "const": "blake3"
                  },
                  "value": {
                    "type": "string",
                    "minLength": 1
                  }
                },
                "required": [
                  "algorithm",
                  "value"
                ]
              },
              "fieldCandidateId": {
                "type": "string",
                "minLength": 1
              },
              "confirmationVersion": {
                "type": "integer",
                "minimum": 0
              }
            },
            "required": [
              "documentId",
              "incarnation",
              "revision",
              "blobDigest",
              "segment"
            ]
          }
        },
        "required": [
          "schema",
          "refId",
          "installationId",
          "projectId",
          "refDigest",
          "evidenceLevel",
          "kind",
          "target"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "schema": {
            "const": "sf-evidence-v1"
          },
          "refId": {
            "type": "string",
            "minLength": 1
          },
          "installationId": {
            "type": "string",
            "minLength": 1
          },
          "projectId": {
            "type": "string",
            "minLength": 1
          },
          "refDigest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "evidenceLevel": {
            "enum": [
              "observed",
              "claim",
              "assumption",
              "proposal",
              "decision"
            ]
          },
          "kind": {
            "const": "calculation"
          },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "calculationId": {
                "type": "string",
                "minLength": 1
              },
              "runId": {
                "type": "string",
                "minLength": 1
              },
              "engineVersion": {
                "type": "string",
                "minLength": 1
              },
              "inputDigest": {
                "type": "string",
                "minLength": 1
              },
              "resultDigest": {
                "type": "string",
                "minLength": 1
              },
              "sourceRefs": {
                "type": "array",
                "items": {
                  "$ref": "#/definitions/BusinessEvidenceRef"
                }
              },
              "period": {
                "type": "object",
                "additionalProperties": false,
                "properties": {
                  "start": {
                    "type": "string",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                  },
                  "end": {
                    "type": "string",
                    "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
                  }
                },
                "required": [
                  "start",
                  "end"
                ]
              },
              "currency": {
                "type": "string",
                "pattern": "^[A-Z]{3}$"
              }
            },
            "required": [
              "calculationId",
              "runId",
              "engineVersion",
              "inputDigest",
              "resultDigest",
              "sourceRefs",
              "period",
              "currency"
            ]
          }
        },
        "required": [
          "schema",
          "refId",
          "installationId",
          "projectId",
          "refDigest",
          "evidenceLevel",
          "kind",
          "target"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "schema": {
            "const": "sf-evidence-v1"
          },
          "refId": {
            "type": "string",
            "minLength": 1
          },
          "installationId": {
            "type": "string",
            "minLength": 1
          },
          "projectId": {
            "type": "string",
            "minLength": 1
          },
          "refDigest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "evidenceLevel": {
            "enum": [
              "observed",
              "claim",
              "assumption",
              "proposal",
              "decision"
            ]
          },
          "kind": {
            "const": "receipt"
          },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "surface": {
                "enum": [
                  "dashboard",
                  "planner",
                  "procurement"
                ]
              },
              "receiptId": {
                "type": "string",
                "minLength": 1
              },
              "idempotencyKey": {
                "type": "string",
                "minLength": 1
              },
              "targetIncarnation": {
                "type": "string",
                "minLength": 1
              },
              "commandDigest": {
                "type": "string",
                "minLength": 1
              },
              "version": {
                "type": "integer",
                "minimum": 0
              }
            },
            "required": [
              "surface",
              "receiptId",
              "idempotencyKey",
              "targetIncarnation",
              "commandDigest",
              "version"
            ]
          }
        },
        "required": [
          "schema",
          "refId",
          "installationId",
          "projectId",
          "refDigest",
          "evidenceLevel",
          "kind",
          "target"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "schema": {
            "const": "sf-evidence-v1"
          },
          "refId": {
            "type": "string",
            "minLength": 1
          },
          "installationId": {
            "type": "string",
            "minLength": 1
          },
          "projectId": {
            "type": "string",
            "minLength": 1
          },
          "refDigest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "evidenceLevel": {
            "enum": [
              "observed",
              "claim",
              "assumption",
              "proposal",
              "decision"
            ]
          },
          "kind": {
            "const": "case-event"
          },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "caseId": {
                "type": "string",
                "minLength": 1
              },
              "caseIncarnation": {
                "type": "string",
                "minLength": 1
              },
              "caseVersion": {
                "type": "integer",
                "minimum": 0
              },
              "eventId": {
                "type": "string",
                "minLength": 1
              },
              "outputDigest": {
                "type": "string",
                "minLength": 1
              },
              "evidenceRefs": {
                "type": "array",
                "items": {
                  "$ref": "#/definitions/BusinessEvidenceRef"
                }
              }
            },
            "required": [
              "caseId",
              "caseIncarnation",
              "caseVersion",
              "eventId",
              "outputDigest",
              "evidenceRefs"
            ]
          }
        },
        "required": [
          "schema",
          "refId",
          "installationId",
          "projectId",
          "refDigest",
          "evidenceLevel",
          "kind",
          "target"
        ]
      },
      {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "schema": {
            "const": "sf-evidence-v1"
          },
          "refId": {
            "type": "string",
            "minLength": 1
          },
          "installationId": {
            "type": "string",
            "minLength": 1
          },
          "projectId": {
            "type": "string",
            "minLength": 1
          },
          "refDigest": {
            "type": "string",
            "pattern": "^[a-f0-9]{64}$"
          },
          "evidenceLevel": {
            "enum": [
              "observed",
              "claim",
              "assumption",
              "proposal",
              "decision"
            ]
          },
          "kind": {
            "const": "policy"
          },
          "target": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "packageId": {
                "type": "string",
                "minLength": 1
              },
              "version": {
                "type": "string",
                "minLength": 1
              },
              "sourceDigest": {
                "type": "string",
                "minLength": 1
              },
              "ruleId": {
                "type": "string",
                "minLength": 1
              },
              "reviewRef": {
                "type": "string",
                "minLength": 1
              },
              "scope": {
                "type": "string",
                "minLength": 1
              }
            },
            "required": [
              "packageId",
              "version",
              "sourceDigest",
              "ruleId",
              "reviewRef",
              "scope"
            ]
          }
        },
        "required": [
          "schema",
          "refId",
          "installationId",
          "projectId",
          "refDigest",
          "evidenceLevel",
          "kind",
          "target"
        ]
      }
    ]
  },
  "ScenarioOperation": {
    "type": "object",
    "additionalProperties": false,
    "properties": {
      "kind": {
        "enum": [
          "replace",
          "defer",
          "include",
          "exclude"
        ]
      },
      "targetRef": {
        "type": "string",
        "minLength": 1
      },
      "replacementRef": {
        "type": "string",
        "minLength": 1
      },
      "amount": {
        "type": "number"
      },
      "currency": {
        "type": "string",
        "pattern": "^[A-Z]{3}$"
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      }
    },
    "required": [
      "kind",
      "targetRef"
    ]
  }
} as const

const inputSchemas = {
  "sf_dashboard_read": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "selectionRef",
      "period",
      "fields"
    ],
    "properties": {
      "selectionRef": {
        "type": "string",
        "minLength": 1
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      },
      "fields": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_kpi_explain": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "metricRef",
      "period"
    ],
    "properties": {
      "metricRef": {
        "type": "string",
        "minLength": 1
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      },
      "comparisonRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_bi_view": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "viewId",
      "selectionRef",
      "period"
    ],
    "properties": {
      "viewId": {
        "type": "string",
        "minLength": 1
      },
      "selectionRef": {
        "type": "string",
        "minLength": 1
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      }
    }
  },
  "sf_source_get": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "evidenceRef"
    ],
    "properties": {
      "evidenceRef": {
        "$ref": "#/definitions/BusinessEvidenceRef"
      }
    }
  },
  "sf_forecast_compare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "baseRef",
      "candidateRef",
      "period",
      "currency"
    ],
    "properties": {
      "baseRef": {
        "type": "string",
        "minLength": 1
      },
      "candidateRef": {
        "type": "string",
        "minLength": 1
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      },
      "currency": {
        "type": "string",
        "pattern": "^[A-Z]{3}$"
      }
    }
  },
  "sf_scenario_simulate": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "baseRef",
      "operations",
      "assumptions"
    ],
    "properties": {
      "baseRef": {
        "type": "string",
        "minLength": 1
      },
      "operations": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/ScenarioOperation"
        }
      },
      "assumptions": {
        "type": "array",
        "items": {
          "type": "object",
          "additionalProperties": false,
          "properties": {
            "id": {
              "type": "string",
              "minLength": 1
            },
            "value": {
              "type": [
                "string",
                "number",
                "boolean",
                "null"
              ]
            },
            "evidenceRefs": {
              "type": "array",
              "items": {
                "$ref": "#/definitions/BusinessEvidenceRef"
              }
            },
            "state": {
              "enum": [
                "confirmed",
                "estimated",
                "hypothetical",
                "absent"
              ]
            }
          },
          "required": [
            "id",
            "value",
            "evidenceRefs",
            "state"
          ]
        }
      }
    }
  },
  "sf_scenario_compare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "scenarioRefs",
      "criteria"
    ],
    "properties": {
      "scenarioRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "criteria": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_sensitivity_evaluate": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "scenarioRef",
      "parameterBounds",
      "criterion"
    ],
    "properties": {
      "scenarioRef": {
        "type": "string",
        "minLength": 1
      },
      "parameterBounds": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "parameterRef": {
            "type": "string",
            "minLength": 1
          },
          "minimum": {
            "type": "number"
          },
          "maximum": {
            "type": "number"
          },
          "steps": {
            "type": "integer",
            "minimum": 1
          }
        },
        "required": [
          "parameterRef",
          "minimum",
          "maximum",
          "steps"
        ]
      },
      "criterion": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "id": {
            "type": "string",
            "minLength": 1
          },
          "operator": {
            "enum": [
              "lte",
              "gte",
              "eq"
            ]
          },
          "value": {
            "type": "number"
          }
        },
        "required": [
          "id",
          "operator",
          "value"
        ]
      }
    }
  },
  "sf_portfolio_evaluate": {
  "type": "object",
  "additionalProperties": false,
  "required": [
    "candidateRefs",
    "constraints",
    "priorities",
    "explorationLimit",
    "scope",
    "operations"
  ],
  "properties": {
    "candidateRefs": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "constraints": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "priorities": {
      "type": "array",
      "items": {
        "type": "string",
        "minLength": 1
      }
    },
    "explorationLimit": {
      "type": "integer",
      "minimum": 1
    },
    "scope": {
      "type": "object",
      "additionalProperties": false,
      "properties": {
        "horizon": {
          "type": "object",
          "additionalProperties": false,
          "x-sf-period": true,
          "properties": {
            "start": {
              "type": "string",
              "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
            },
            "end": {
              "type": "string",
              "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
            }
          },
          "required": [
            "start",
            "end"
          ]
        },
        "currency": {
          "type": "string",
          "pattern": "^[A-Z]{3}$"
        }
      },
      "required": [
        "horizon",
        "currency"
      ]
    },
    "operations": {
      "type": "array",
      "items": {
        "$ref": "#/definitions/ScenarioOperation"
      }
    }
  }
},
  "sf_request_read": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "requestRef"
    ],
    "properties": {
      "requestRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_supplier_read": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "supplierRef",
      "fields"
    ],
    "properties": {
      "supplierRef": {
        "type": "string",
        "minLength": 1
      },
      "fields": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_contract_read": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "contractRef",
      "fields"
    ],
    "properties": {
      "contractRef": {
        "type": "string",
        "minLength": 1
      },
      "fields": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_sourcing_compare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "requestRef",
      "proposalRefs",
      "criteria"
    ],
    "properties": {
      "requestRef": {
        "type": "string",
        "minLength": 1
      },
      "proposalRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "criteria": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_case_read": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "caseRef"
    ],
    "properties": {
      "caseRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_case_draft": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "objective",
      "horizon",
      "currency",
      "criteria",
      "sourceRefs"
    ],
    "properties": {
      "objective": {
        "type": "string",
        "minLength": 1
      },
      "horizon": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      },
      "currency": {
        "type": "string",
        "pattern": "^[A-Z]{3}$"
      },
      "criteria": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "sourceRefs": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/BusinessEvidenceRef"
        }
      }
    }
  },
  "sf_alternative_draft": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "caseRef",
      "proposal",
      "sourceRefs"
    ],
    "properties": {
      "caseRef": {
        "type": "string",
        "minLength": 1
      },
      "proposal": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "title": {
            "type": "string",
            "minLength": 1
          },
          "description": {
            "type": "string",
            "minLength": 1
          },
          "sourceRefs": {
            "type": "array",
            "items": {
              "$ref": "#/definitions/BusinessEvidenceRef"
            }
          }
        },
        "required": [
          "title",
          "description",
          "sourceRefs"
        ]
      },
      "sourceRefs": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/BusinessEvidenceRef"
        }
      }
    }
  },
  "sf_change_prepare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "caseRef",
      "choiceRef",
      "operations"
    ],
    "properties": {
      "caseRef": {
        "type": "string",
        "minLength": 1
      },
      "choiceRef": {
        "type": "string",
        "minLength": 1
      },
      "operations": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/ScenarioOperation"
        }
      }
    }
  },
  "sf_receipt_get": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "receiptRef"
    ],
    "properties": {
      "receiptRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_work_list": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "selectionRef",
      "period"
    ],
    "properties": {
      "selectionRef": {
        "type": "string",
        "minLength": 1
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      }
    }
  },
  "sf_question_prepare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "caseRef",
      "question",
      "sourceRefs"
    ],
    "properties": {
      "caseRef": {
        "type": "string",
        "minLength": 1
      },
      "question": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "text": {
            "type": "string",
            "minLength": 1
          },
          "criterionRef": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "text"
        ]
      },
      "sourceRefs": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/BusinessEvidenceRef"
        }
      },
      "recipientRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_answer_read": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "questionRef"
    ],
    "properties": {
      "questionRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_relation_read": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "recordRefs"
    ],
    "properties": {
      "recordRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_handoff_prepare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "caseRef",
      "actionRef",
      "sourceRefs"
    ],
    "properties": {
      "caseRef": {
        "type": "string",
        "minLength": 1
      },
      "actionRef": {
        "type": "string",
        "minLength": 1
      },
      "recipientRef": {
        "type": "string",
        "minLength": 1
      },
      "sourceRefs": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/BusinessEvidenceRef"
        }
      }
    }
  },
  "sf_document_extract": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "documentRef",
      "fieldSchemaRef"
    ],
    "properties": {
      "documentRef": {
        "type": "string",
        "minLength": 1
      },
      "fieldSchemaRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_import_preview": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "admittedFileRef",
      "format",
      "options"
    ],
    "properties": {
      "admittedFileRef": {
        "type": "string",
        "minLength": 1
      },
      "format": {
        "type": "string",
        "minLength": 1
      },
      "options": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "sheet": {
            "type": "string",
            "minLength": 1
          },
          "replace": {
            "type": "boolean"
          },
          "headerRow": {
            "type": "integer",
            "minimum": 1
          }
        },
        "required": []
      }
    }
  },
  "sf_review_prepare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "selectionRef",
      "period",
      "sectionRefs"
    ],
    "properties": {
      "selectionRef": {
        "type": "string",
        "minLength": 1
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      },
      "sectionRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_report_prepare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "reviewRef",
      "format",
      "sectionRefs"
    ],
    "properties": {
      "reviewRef": {
        "type": "string",
        "minLength": 1
      },
      "format": {
        "type": "string",
        "minLength": 1
      },
      "sectionRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      }
    }
  },
  "sf_artifact_get": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "artifactRef"
    ],
    "properties": {
      "artifactRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_context_get": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "selectionRefs",
      "purpose",
      "period"
    ],
    "properties": {
      "selectionRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "purpose": {
        "type": "string",
        "minLength": 1
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      }
    }
  },
  "sf_knowledge_search": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "query",
      "limit"
    ],
    "properties": {
      "query": {
        "type": "string",
        "minLength": 1
      },
      "documentRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "limit": {
        "type": "integer",
        "minimum": 1
      }
    }
  },
  "sf_evidence_get": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "evidenceRef"
    ],
    "properties": {
      "evidenceRef": {
        "$ref": "#/definitions/BusinessEvidenceRef"
      }
    }
  },
  "sf_decision_recall": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "selectionRefs",
      "similarityCriteria",
      "period",
      "limit"
    ],
    "properties": {
      "selectionRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "similarityCriteria": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "period": {
        "type": "object",
        "additionalProperties": false,
        "x-sf-period": true,
        "properties": {
          "start": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          },
          "end": {
            "type": "string",
            "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
          }
        },
        "required": [
          "start",
          "end"
        ]
      },
      "limit": {
        "type": "integer",
        "minimum": 1
      }
    }
  },
  "sf_freshness_check": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "evidenceRefs"
    ],
    "properties": {
      "evidenceRefs": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/BusinessEvidenceRef"
        }
      }
    }
  },
  "sf_routine_catalog": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "purpose"
    ],
    "properties": {
      "purpose": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_routine_prepare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "publishedRecipeRef",
      "inputRefs",
      "parameters"
    ],
    "properties": {
      "publishedRecipeRef": {
        "type": "string",
        "minLength": 1
      },
      "inputRefs": {
        "type": "array",
        "items": {
          "type": "string",
          "minLength": 1
        }
      },
      "parameters": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "period": {
            "type": "object",
            "additionalProperties": false,
            "properties": {
              "start": {
                "type": "string",
                "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
              },
              "end": {
                "type": "string",
                "pattern": "^\\d{4}-\\d{2}-\\d{2}$"
              }
            },
            "required": [
              "start",
              "end"
            ]
          },
          "selectionRefs": {
            "type": "array",
            "items": {
              "type": "string",
              "minLength": 1
            }
          },
          "reviewRef": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": []
      }
    }
  },
  "sf_routine_run": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "admittedRunRef",
      "expectedAdmissionVersion"
    ],
    "properties": {
      "admittedRunRef": {
        "type": "string",
        "minLength": 1
      },
      "expectedAdmissionVersion": {
        "type": "integer",
        "minimum": 0
      }
    }
  },
  "sf_routine_status": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "runRef"
    ],
    "properties": {
      "runRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_routine_result": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "runRef"
    ],
    "properties": {
      "runRef": {
        "type": "string",
        "minLength": 1
      }
    }
  },
  "sf_watch_prepare": {
    "type": "object",
    "additionalProperties": false,
    "required": [
      "caseRef",
      "conditionRef",
      "recurrence"
    ],
    "properties": {
      "caseRef": {
        "type": "string",
        "minLength": 1
      },
      "conditionRef": {
        "type": "string",
        "minLength": 1
      },
      "recurrence": {
        "type": "object",
        "additionalProperties": false,
        "properties": {
          "recipeRef": {
            "type": "string",
            "minLength": 1
          },
          "schedule": {
            "type": "string",
            "minLength": 1
          },
          "timezone": {
            "type": "string",
            "minLength": 1
          }
        },
        "required": [
          "recipeRef",
          "schedule",
          "timezone"
        ]
      },
      "recipientRef": {
        "type": "string",
        "minLength": 1
      }
    }
  }
} as const

export const sfOperationInputSchemas = Object.fromEntries(Object.entries(inputSchemas).map(([id, schema]) => [id, { ...schema, definitions: sfOperationDefinitions }])) as { [K in keyof typeof inputSchemas]: typeof inputSchemas[K] & { definitions: typeof sfOperationDefinitions } }
