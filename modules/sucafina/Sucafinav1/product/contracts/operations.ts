import type { Period, SourceRef } from "./context.ts"
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
  assumptions: Readonly<Record<string, JsonValue>>
}

export type ScenarioCompareRequest = {
  scenarioRefs: readonly string[]
  criteria: readonly string[]
}

export type SensitivityRequest = {
  scenarioRef: string
  parameterBounds: Readonly<Record<string, JsonValue>>
  criterion: Readonly<Record<string, JsonValue>>
}

export type PortfolioRequest = {
  candidateRefs: readonly string[]
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
  sourceRefs: readonly SourceRef[]
}

export type AlternativeDraftRequest = {
  caseRef: string
  proposal: Readonly<Record<string, JsonValue>>
  sourceRefs: readonly SourceRef[]
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
  question: Readonly<Record<string, JsonValue>>
  sourceRefs: readonly SourceRef[]
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
  sourceRefs: readonly SourceRef[]
}

export type DocumentExtractRequest = {
  documentRef: string
  fieldSchemaRef: string
}

export type ImportPreviewRequest = {
  admittedFileRef: string
  format: string
  options: Readonly<Record<string, JsonValue>>
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
  parameters: Readonly<Record<string, JsonValue>>
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
  recurrence: Readonly<Record<string, JsonValue>>
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

export const sfOperationInputSchemas = {
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
      },
      "currency": {
        "type": "string",
        "minLength": 1
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
        "type": "object"
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
        "type": "object"
      },
      "criterion": {
        "type": "object"
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
      "explorationLimit"
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
      },
      "currency": {
        "type": "string",
        "minLength": 1
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
          "$ref": "#/definitions/SourceRef"
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
        "type": "object"
      },
      "sourceRefs": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/SourceRef"
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
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
        "type": "object"
      },
      "sourceRefs": {
        "type": "array",
        "items": {
          "$ref": "#/definitions/SourceRef"
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
          "$ref": "#/definitions/SourceRef"
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
        "type": "object"
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
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
        "required": [
          "start",
          "end"
        ],
        "properties": {
          "start": {
            "type": "string",
            "minLength": 1
          },
          "end": {
            "type": "string",
            "minLength": 1
          }
        }
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
        "type": "object"
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
        "type": "object"
      },
      "recipientRef": {
        "type": "string",
        "minLength": 1
      }
    }
  }
} as const
