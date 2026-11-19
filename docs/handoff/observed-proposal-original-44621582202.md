# Proposal gate6 original observations

Read-only source run44621582202, artifact14578835200, snapshot7098d64ae0df041d5780b54e7ed047db1ff544d5. No rerun.

Embedded payloads: 1

## Original journey observation 1

```json
[
  {
    "traffic": [
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:d90eef8a-5fbe-4911-88b1-ee5cf34cfe70:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:f996d1b3-ad15-4ce1-8740-bdaa79774414:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:f996d1b3-ad15-4ce1-8740-bdaa79774414:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:436783e5-ad87-4dbb-9659-a0cf741317de:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                    "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                    "projectId": "global",
                    "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-hot-topic-draft",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "draftRef": "hot-topic-draft:ecd90b1525055cd3cd5c3e54fd5acf65e42066713b30db3c0cf7485a8398de2a",
            "version": 1
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:d90eef8a-5fbe-4911-88b1-ee5cf34cfe70:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:f996d1b3-ad15-4ce1-8740-bdaa79774414:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:f996d1b3-ad15-4ce1-8740-bdaa79774414:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:436783e5-ad87-4dbb-9659-a0cf741317de:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                    "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                    "projectId": "global",
                    "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [
                {
                  "id": "e2cd4d94-a559-464e-bd67-7de2194aefba",
                  "incarnation": "57228319-212a-4e37-959a-6cf845162203",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:ecd90b1525055cd3cd5c3e54fd5acf65e42066713b30db3c0cf7485a8398de2a",
                  "version": 1,
                  "label": "Initially saved proposal",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                    "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                    "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Initially saved proposal",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "priority": "normal",
                    "notes": "Initially saved private context"
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                      "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                      "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                        "version": 1,
                        "fields": [
                          "action",
                          "due",
                          "notes",
                          "owner",
                          "priority"
                        ],
                        "period": {
                          "start": "2026-11-13",
                          "end": "2026-11-13"
                        },
                        "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                      }
                    }
                  ]
                }
              ],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:d90eef8a-5fbe-4911-88b1-ee5cf34cfe70:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:f996d1b3-ad15-4ce1-8740-bdaa79774414:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:f996d1b3-ad15-4ce1-8740-bdaa79774414:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:436783e5-ad87-4dbb-9659-a0cf741317de:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                    "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                    "projectId": "global",
                    "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [
                {
                  "id": "e2cd4d94-a559-464e-bd67-7de2194aefba",
                  "incarnation": "57228319-212a-4e37-959a-6cf845162203",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:ecd90b1525055cd3cd5c3e54fd5acf65e42066713b30db3c0cf7485a8398de2a",
                  "version": 1,
                  "label": "Initially saved proposal",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                    "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                    "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Initially saved proposal",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "priority": "normal",
                    "notes": "Initially saved private context"
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                      "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                      "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                        "version": 1,
                        "fields": [
                          "action",
                          "due",
                          "notes",
                          "owner",
                          "priority"
                        ],
                        "period": {
                          "start": "2026-11-13",
                          "end": "2026-11-13"
                        },
                        "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                      }
                    }
                  ]
                }
              ],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      }
    ],
    "preferences": {
      "status": "ok",
      "storageVersion": 1,
      "aggregateRevision": 2,
      "incarnation": "6279de65-7bea-4bde-8162-962a02e6dfcc",
      "value": {
        "keys": [
          "sf:proposal-coverage:hot-topic:history:bf91d4c6a160afb4460b8e076f5264d3fe6c5409eac589f5c2f165d179e4a5b4",
          "sf:proposal-coverage:hot-topic:active:e53f6287a6951f6b272dc36642f85d638108643e676f247ddfe105890e2100b1"
        ],
        "drafts": [
          {
            "schema": "sf-hot-topic-draft-v1",
            "id": "e2cd4d94-a559-464e-bd67-7de2194aefba",
            "incarnation": "57228319-212a-4e37-959a-6cf845162203",
            "version": 1,
            "draftRef": "hot-topic-draft:ecd90b1525055cd3cd5c3e54fd5acf65e42066713b30db3c0cf7485a8398de2a",
            "caseRef": {
              "id": "private-case-identity",
              "incarnation": "case-incarnation",
              "version": 1
            },
            "caseScopeDigest": "99a6f33da8e6bf09b77dffcac1aae93f6c7679938d9ff025ab281434c39dd473",
            "target": {
              "surface": "dashboard",
              "type": "hotTopics",
              "id": "topic",
              "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
              "version": 1,
              "fields": [
                "action",
                "due",
                "notes",
                "owner",
                "priority"
              ],
              "period": {
                "start": "2026-11-13",
                "end": "2026-11-13"
              },
              "observedAt": "2026-11-13T08:00:00.000Z"
            },
            "targetEvidence": {
              "schema": "sf-evidence-v1",
              "kind": "record",
              "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
              "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
              "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
              "projectId": "global",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                "version": 1,
                "fields": [
                  "action",
                  "due",
                  "notes",
                  "owner",
                  "priority"
                ],
                "period": {
                  "start": "2026-11-13",
                  "end": "2026-11-13"
                },
                "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
              }
            },
            "fields": {
              "action": "Initially saved proposal",
              "owner": "Operations",
              "due": "2026-12-01",
              "priority": "normal",
              "notes": "Initially saved private context"
            },
            "sourceRefs": [
              {
                "schema": "sf-evidence-v1",
                "kind": "record",
                "refId": "sf-source:5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f:1",
                "refDigest": "c6ae322911458837a5ed11f3595edc36572748733ff71dd1e36aba7ade32252b",
                "installationId": "6c851604-cfcd-43ca-8a49-db5e70c2cd45",
                "projectId": "global",
                "evidenceLevel": "observed",
                "target": {
                  "surface": "dashboard",
                  "recordType": "hotTopics",
                  "recordId": "topic",
                  "incarnation": "5e6f8f2b-0c39-4cf6-8dee-ec19dd2cbd9f",
                  "version": 1,
                  "fields": [
                    "action",
                    "due",
                    "notes",
                    "owner",
                    "priority"
                  ],
                  "period": {
                    "start": "2026-11-13",
                    "end": "2026-11-13"
                  },
                  "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                }
              }
            ],
            "principalRef": "macos:6c851604-cfcd-43ca-8a49-db5e70c2cd45:1000",
            "accessRevision": "8faaabf8f8a6f76ceba9f7c0ab7f81e128eec99ac1ce1080d5189628b7c68db1",
            "policyVersion": "sf-product-v1",
            "createdAt": "2026-11-19T21:48:12.425Z",
            "recordDigest": "c6a21b022e6dc04d58ca4104e07deb73e271c58164417aeb32b194f9a3373f8d"
          }
        ]
      }
    },
    "decision": {
      "status": "ok",
      "storageVersion": 2,
      "aggregateRevision": 2,
      "incarnation": "6279de65-7bea-4bde-8162-962a02e6dfcc",
      "value": {
        "id": "private-case-identity",
        "incarnation": "case-incarnation",
        "version": 1,
        "objective": "Review the action",
        "state": "investigating",
        "horizon": {
          "start": "2026-01-01",
          "end": "2026-12-31"
        },
        "currency": "USD",
        "participants": [
          "macos:6c851604-cfcd-43ca-8a49-db5e70c2cd45:1000"
        ],
        "criteria": [
          {
            "id": "operational",
            "description": "Operational action",
            "required": true
          }
        ],
        "sourceRefs": [],
        "alternatives": [],
        "costCoverageBases": [],
        "assumptions": [],
        "questions": [],
        "choices": [],
        "preparedChanges": [],
        "receipts": [],
        "ledger": []
      }
    },
    "receipts": {
      "status": "ok",
      "storageVersion": 0,
      "aggregateRevision": 2,
      "incarnation": "6279de65-7bea-4bde-8162-962a02e6dfcc",
      "value": []
    },
    "record": {
      "id": "topic",
      "action": "Original action",
      "owner": "Operations",
      "due": "2026-12-01",
      "priority": "normal",
      "status": "open",
      "notes": ""
    }
  },
  {
    "path": "/orchestra/sf-dashboard/hot-topics/proposals/r_aG90LXRvcGljLWRyYWZ0OmVjZDkwYjE1MjUwNTVjZDNjZDVjM2U1NGZkNWFjZjY1ZTQyMDY2NzEzYjMwZGIzYzBjZjc0ODVhODM5OGRlMmE",
    "text": "Orchestra\n/\nFollow-up proposal\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nFollow-up proposal\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-xnFsgC\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-XNFSGC⁩ · FOLLOW-UP PROPOSAL\nFollow-up proposal\nPrivate proposal\nActionOwnerDue datePriority\nNormal\nHigh\nCritical\nNotes\nSave proposal\nLoad current version and keep my edits\nProposal\nProposal reference\nhot-topic-draft:ecd90b1525055cd3cd5c3e54fd5acf65e42066713b30db3c0cf7485a8398de2a\nAction\nInitially saved proposal\nResponsible party\nOperations\nDue date\nDec 1, 2026\nPriority\nnormal\nNotes\nInitially saved private context\nCurrent case identity\nprivate-case-identity\nSource evidence\n\nCurrent producer source\n\nReview before applying\n\nNo current producer review has been admitted. Applying is unavailable.\n\nOriginal receipt\n\nNo current producer review has been admitted. Applying is unavailable."
  }
]
```

## Original journey observation 2

```json
[
  {
    "traffic": [
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0bbfc93a-b275-4832-ba79-7a2c0e675bd5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:66588b6f-df8f-4b8c-8cbc-66e9f87fcd84:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
                    "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
                    "projectId": "global",
                    "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0bbfc93a-b275-4832-ba79-7a2c0e675bd5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:66588b6f-df8f-4b8c-8cbc-66e9f87fcd84:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
                    "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
                    "projectId": "global",
                    "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-draft-read",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "caseRef": {
              "id": "private-case-identity",
              "incarnation": "case-incarnation",
              "version": 1
            },
            "label": "Review the action",
            "originalSource": {
              "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
              "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5"
            },
            "currentSource": {
              "schema": "sf-evidence-v1",
              "kind": "record",
              "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
              "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
              "projectId": "global",
              "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                "version": 1,
                "fields": [
                  "action",
                  "due",
                  "notes",
                  "owner",
                  "priority"
                ],
                "period": {
                  "start": "2026-11-13",
                  "end": "2026-11-13"
                },
                "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
              }
            },
            "permissions": {
              "draft": true,
              "prepare": true,
              "apply": true,
              "capture": true,
              "preserve": true
            },
            "source": {
              "label": "Original action",
              "sourceRef": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
              "draft": {
                "target": {
                  "surface": "dashboard",
                  "type": "hotTopics",
                  "id": "topic",
                  "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                  "version": 1,
                  "fields": [
                    "action",
                    "due",
                    "notes",
                    "owner",
                    "priority"
                  ],
                  "period": {
                    "start": "2026-11-13",
                    "end": "2026-11-13"
                  },
                  "observedAt": "2026-11-13T08:00:00.000Z"
                },
                "targetEvidence": {
                  "schema": "sf-evidence-v1",
                  "kind": "record",
                  "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
                  "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
                  "projectId": "global",
                  "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
                  "evidenceLevel": "observed",
                  "target": {
                    "surface": "dashboard",
                    "recordType": "hotTopics",
                    "recordId": "topic",
                    "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                  }
                },
                "fields": {
                  "action": "Original action",
                  "owner": "Operations",
                  "due": "2026-12-01",
                  "priority": "normal",
                  "notes": ""
                }
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0bbfc93a-b275-4832-ba79-7a2c0e675bd5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:66588b6f-df8f-4b8c-8cbc-66e9f87fcd84:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
                    "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
                    "projectId": "global",
                    "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-draft-read",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "caseRef": {
              "id": "private-case-identity",
              "incarnation": "case-incarnation",
              "version": 1
            },
            "label": "Review the action",
            "originalSource": {
              "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
              "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5"
            },
            "currentSource": {
              "schema": "sf-evidence-v1",
              "kind": "record",
              "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
              "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
              "projectId": "global",
              "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                "version": 1,
                "fields": [
                  "action",
                  "due",
                  "notes",
                  "owner",
                  "priority"
                ],
                "period": {
                  "start": "2026-11-13",
                  "end": "2026-11-13"
                },
                "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
              }
            },
            "permissions": {
              "draft": true,
              "prepare": true,
              "apply": true,
              "capture": true,
              "preserve": true
            },
            "source": {
              "label": "Original action",
              "sourceRef": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
              "draft": {
                "target": {
                  "surface": "dashboard",
                  "type": "hotTopics",
                  "id": "topic",
                  "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                  "version": 1,
                  "fields": [
                    "action",
                    "due",
                    "notes",
                    "owner",
                    "priority"
                  ],
                  "period": {
                    "start": "2026-11-13",
                    "end": "2026-11-13"
                  },
                  "observedAt": "2026-11-13T08:00:00.000Z"
                },
                "targetEvidence": {
                  "schema": "sf-evidence-v1",
                  "kind": "record",
                  "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
                  "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
                  "projectId": "global",
                  "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
                  "evidenceLevel": "observed",
                  "target": {
                    "surface": "dashboard",
                    "recordType": "hotTopics",
                    "recordId": "topic",
                    "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                  }
                },
                "fields": {
                  "action": "Original action",
                  "owner": "Operations",
                  "due": "2026-12-01",
                  "priority": "normal",
                  "notes": ""
                }
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0bbfc93a-b275-4832-ba79-7a2c0e675bd5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:c2f4373a-ff1c-42de-9401-d8656b2c2def:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:66588b6f-df8f-4b8c-8cbc-66e9f87fcd84:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
                    "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
                    "projectId": "global",
                    "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "5867b245-e6aa-4a88-8738-5394b232de5f",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-draft-read",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "caseRef": {
              "id": "private-case-identity",
              "incarnation": "case-incarnation",
              "version": 1
            },
            "label": "Review the action",
            "originalSource": {
              "refId": "sf-source:5867b245-e6aa-4a88-8738-5394b232de5f:1",
              "refDigest": "474eebd62409454215fea33903ba11f2c8d5dd417400e27eeae42aa40ee054c5"
            },
            "currentSource": {
              "schema": "sf-evidence-v1",
              "kind": "record",
              "refId": "sf-source:64433c2d-dc95-49fc-b905-a98d9ab53373:1",
              "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
              "projectId": "global",
              "refDigest": "077b3b50f4096eb275786152ee12249a8abdeb014a9a95bca1c38a92abc250f7",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "64433c2d-dc95-49fc-b905-a98d9ab53373",
                "version": 1,
                "fields": [
                  "action",
                  "due",
                  "notes",
                  "owner",
                  "priority"
                ],
                "period": {
                  "start": "2026-11-13",
                  "end": "2026-11-13"
                },
                "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
              }
            },
            "permissions": {
              "draft": false,
              "prepare": false,
              "apply": false,
              "capture": false,
              "preserve": false
            },
            "source": {
              "label": "Original action",
              "sourceRef": "sf-source:64433c2d-dc95-49fc-b905-a98d9ab53373:1",
              "draft": {
                "target": {
                  "surface": "dashboard",
                  "type": "hotTopics",
                  "id": "topic",
                  "incarnation": "64433c2d-dc95-49fc-b905-a98d9ab53373",
                  "version": 1,
                  "fields": [
                    "action",
                    "due",
                    "notes",
                    "owner",
                    "priority"
                  ],
                  "period": {
                    "start": "2026-11-13",
                    "end": "2026-11-13"
                  },
                  "observedAt": "2026-11-13T08:00:00.000Z"
                },
                "targetEvidence": {
                  "schema": "sf-evidence-v1",
                  "kind": "record",
                  "refId": "sf-source:64433c2d-dc95-49fc-b905-a98d9ab53373:1",
                  "installationId": "b877ffc7-b400-4279-8cdd-f15fa91150cb",
                  "projectId": "global",
                  "refDigest": "077b3b50f4096eb275786152ee12249a8abdeb014a9a95bca1c38a92abc250f7",
                  "evidenceLevel": "observed",
                  "target": {
                    "surface": "dashboard",
                    "recordType": "hotTopics",
                    "recordId": "topic",
                    "incarnation": "64433c2d-dc95-49fc-b905-a98d9ab53373",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                  }
                },
                "fields": {
                  "action": "Original action",
                  "owner": "Operations",
                  "due": "2026-12-01",
                  "priority": "normal",
                  "notes": ""
                }
              }
            }
          }
        }
      }
    ],
    "preferences": {
      "status": "ok",
      "storageVersion": 0,
      "aggregateRevision": 1,
      "incarnation": "3c826b43-128d-4a26-9358-bd28f1e50d79",
      "value": {
        "keys": [],
        "drafts": []
      }
    },
    "decision": {
      "status": "ok",
      "storageVersion": 1,
      "aggregateRevision": 1,
      "incarnation": "3c826b43-128d-4a26-9358-bd28f1e50d79",
      "value": {
        "id": "private-case-identity",
        "incarnation": "case-incarnation",
        "version": 1,
        "objective": "Review the action",
        "state": "investigating",
        "horizon": {
          "start": "2026-01-01",
          "end": "2026-12-31"
        },
        "currency": "USD",
        "participants": [
          "macos:b877ffc7-b400-4279-8cdd-f15fa91150cb:1000"
        ],
        "criteria": [
          {
            "id": "operational",
            "description": "Operational action",
            "required": true
          }
        ],
        "sourceRefs": [],
        "alternatives": [],
        "costCoverageBases": [],
        "assumptions": [],
        "questions": [],
        "choices": [],
        "preparedChanges": [],
        "receipts": [],
        "ledger": []
      }
    },
    "receipts": {
      "status": "ok",
      "storageVersion": 0,
      "aggregateRevision": 1,
      "incarnation": "3c826b43-128d-4a26-9358-bd28f1e50d79",
      "value": []
    },
    "record": {
      "id": "topic",
      "action": "Original action",
      "owner": "Operations",
      "due": "2026-12-01",
      "priority": "normal",
      "status": "open",
      "notes": ""
    }
  },
  {
    "path": "/orchestra/sf-dashboard/hot-topics/proposals/r_bmV3",
    "text": "Orchestra\n/\nFollow-up proposal\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nFollow-up proposal\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-ibwZIP\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-IBWZIP⁩ · FOLLOW-UP PROPOSAL\nFollow-up proposal\nPrivate proposal\nActionOwnerDue datePriority\nNormal\nHigh\nCritical\nNotes\nSave proposal\nLoad current version and keep my edits\nField\tOriginal fields\tCurrent proposal\tMy retained values\nAction\tOriginal action\tOriginal action\tPrivate retained operator action\nOwner\tOperations\tOperations\tOperations\nDue date\t2026-12-01\t2026-12-01\t2026-12-01\nPriority\tnormal\tnormal\tnormal\nNotes\t\t\tPrivate retained operator context\nField\tCurrent authorized source\nAction\tOriginal action\nOwner\tOperations\nDue date\t2026-12-01\nPriority\tnormal\nNotes\t\nI reviewed the current proposal and source; keep my values against this base.\n\nCurrent proposal and source loaded. Review both before saving.\n\nReading is available. The current authority does not permit saving this proposal.\n\nProposal\nProposal reference\nnew\nSource evidence\n\nCurrent producer source\n\nReview before applying\n\nNo current producer review has been admitted. Applying is unavailable.\n\nOriginal receipt\n\nNo current producer review has been admitted. Applying is unavailable."
  }
]
```

## Original journey observation 3

```json
[
  {
    "traffic": [
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0e32bfa9-cec7-4948-bcfe-15d58d94f05c:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:6167e781-8685-42dd-9fad-bd5f84a6cd6a:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:6167e781-8685-42dd-9fad-bd5f84a6cd6a:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:60793c97-ee27-4ac9-b464-72a9cd636bd3:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "012ff724-437a-4d64-b2c8-03404aa427af",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:012ff724-437a-4d64-b2c8-03404aa427af:1",
                    "installationId": "4b2255ff-debe-4a1b-b75d-ba74117b54f0",
                    "projectId": "global",
                    "refDigest": "37a838576926414cb3bc9e075b6f998fa3b04428d001ff8d97be559d8f9d4199",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "012ff724-437a-4d64-b2c8-03404aa427af",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-hot-topic-draft",
        "status": 403,
        "result": {
          "status": "denied"
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:6382802f-46c9-49d3-a1d2-2bb0d2921c91:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:a9a3fc03-eac1-49de-af22-6acb0fb8b14d:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:a9a3fc03-eac1-49de-af22-6acb0fb8b14d:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:fb15e198-d95f-41a4-a36e-c5c8761b4d32:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "94c5a314-5c4e-483f-a7f1-b5c689988416",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:94c5a314-5c4e-483f-a7f1-b5c689988416:1",
                    "installationId": "4b2255ff-debe-4a1b-b75d-ba74117b54f0",
                    "projectId": "global",
                    "refDigest": "c7f0953962af49d5a51a4bf1013342152b3eb3c072f3615921bde3e4f806f73d",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "94c5a314-5c4e-483f-a7f1-b5c689988416",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": false,
              "capture": false
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": false,
                "prepare": false,
                "apply": false
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-draft-read",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "caseRef": {
              "id": "private-case-identity",
              "incarnation": "case-incarnation",
              "version": 1
            },
            "label": "Review the action",
            "originalSource": {
              "refId": "sf-source:012ff724-437a-4d64-b2c8-03404aa427af:1",
              "refDigest": "37a838576926414cb3bc9e075b6f998fa3b04428d001ff8d97be559d8f9d4199"
            },
            "currentSource": {
              "schema": "sf-evidence-v1",
              "kind": "record",
              "refId": "sf-source:94c5a314-5c4e-483f-a7f1-b5c689988416:1",
              "installationId": "4b2255ff-debe-4a1b-b75d-ba74117b54f0",
              "projectId": "global",
              "refDigest": "c7f0953962af49d5a51a4bf1013342152b3eb3c072f3615921bde3e4f806f73d",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "94c5a314-5c4e-483f-a7f1-b5c689988416",
                "version": 1,
                "fields": [
                  "action",
                  "due",
                  "notes",
                  "owner",
                  "priority"
                ],
                "period": {
                  "start": "2026-11-13",
                  "end": "2026-11-13"
                },
                "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
              }
            },
            "permissions": {
              "draft": false,
              "prepare": false,
              "apply": false,
              "capture": false,
              "preserve": false
            },
            "source": {
              "label": "Original action",
              "sourceRef": "sf-source:94c5a314-5c4e-483f-a7f1-b5c689988416:1",
              "draft": {
                "target": {
                  "surface": "dashboard",
                  "type": "hotTopics",
                  "id": "topic",
                  "incarnation": "94c5a314-5c4e-483f-a7f1-b5c689988416",
                  "version": 1,
                  "fields": [
                    "action",
                    "due",
                    "notes",
                    "owner",
                    "priority"
                  ],
                  "period": {
                    "start": "2026-11-13",
                    "end": "2026-11-13"
                  },
                  "observedAt": "2026-11-13T08:00:00.000Z"
                },
                "targetEvidence": {
                  "schema": "sf-evidence-v1",
                  "kind": "record",
                  "refId": "sf-source:94c5a314-5c4e-483f-a7f1-b5c689988416:1",
                  "installationId": "4b2255ff-debe-4a1b-b75d-ba74117b54f0",
                  "projectId": "global",
                  "refDigest": "c7f0953962af49d5a51a4bf1013342152b3eb3c072f3615921bde3e4f806f73d",
                  "evidenceLevel": "observed",
                  "target": {
                    "surface": "dashboard",
                    "recordType": "hotTopics",
                    "recordId": "topic",
                    "incarnation": "94c5a314-5c4e-483f-a7f1-b5c689988416",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                  }
                },
                "fields": {
                  "action": "Original action",
                  "owner": "Operations",
                  "due": "2026-12-01",
                  "priority": "normal",
                  "notes": ""
                }
              }
            }
          }
        }
      }
    ],
    "preferences": {
      "status": "ok",
      "storageVersion": 0,
      "aggregateRevision": 1,
      "incarnation": "2007fca0-fc03-4efc-b204-db8a5619e871",
      "value": {
        "keys": [],
        "drafts": []
      }
    },
    "decision": {
      "status": "ok",
      "storageVersion": 1,
      "aggregateRevision": 1,
      "incarnation": "2007fca0-fc03-4efc-b204-db8a5619e871",
      "value": {
        "id": "private-case-identity",
        "incarnation": "case-incarnation",
        "version": 1,
        "objective": "Review the action",
        "state": "investigating",
        "horizon": {
          "start": "2026-01-01",
          "end": "2026-12-31"
        },
        "currency": "USD",
        "participants": [
          "macos:4b2255ff-debe-4a1b-b75d-ba74117b54f0:1000"
        ],
        "criteria": [
          {
            "id": "operational",
            "description": "Operational action",
            "required": true
          }
        ],
        "sourceRefs": [],
        "alternatives": [],
        "costCoverageBases": [],
        "assumptions": [],
        "questions": [],
        "choices": [],
        "preparedChanges": [],
        "receipts": [],
        "ledger": []
      }
    },
    "receipts": {
      "status": "ok",
      "storageVersion": 0,
      "aggregateRevision": 1,
      "incarnation": "2007fca0-fc03-4efc-b204-db8a5619e871",
      "value": []
    },
    "record": {
      "id": "topic",
      "action": "Original action",
      "owner": "Operations",
      "due": "2026-12-01",
      "priority": "normal",
      "status": "open",
      "notes": ""
    }
  },
  {
    "path": "/orchestra/sf-dashboard/hot-topics/proposals/r_bmV3",
    "text": "Orchestra\n/\nFollow-up proposal\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nFollow-up proposal\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-1lvMty\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-1LVMTY⁩ · FOLLOW-UP PROPOSAL\nFollow-up proposal\nPrivate proposal\nActionOwnerDue datePriority\nNormal\nHigh\nCritical\nNotes\nSave proposal\nLoad current version and keep my edits\nField\tOriginal fields\tCurrent proposal\tMy retained values\nAction\tOriginal action\tOriginal action\tUnsaved operator wording\nOwner\tOperations\tOperations\tOperations\nDue date\t2026-12-01\t2026-12-01\t2026-12-01\nPriority\tnormal\tnormal\tnormal\nNotes\t\t\t\nField\tCurrent authorized source\nAction\tOriginal action\nOwner\tOperations\nDue date\t2026-12-01\nPriority\tnormal\nNotes\t\nI reviewed the current proposal and source; keep my values against this base.\n\nCurrent proposal and source loaded. Review both before saving.\n\nReading is available. The current authority does not permit saving this proposal.\n\nProposal\nProposal reference\nnew\nSource evidence\n\nCurrent producer source\n\nReview before applying\n\nNo current producer review has been admitted. Applying is unavailable.\n\nOriginal receipt\n\nNo current producer review has been admitted. Applying is unavailable."
  }
]
```

## Original journey observation 4

```json
[
  {
    "traffic": [
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0b0ac7b9-0077-4266-ad14-021c5f37a75c:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:2f867696-e8cb-4a0a-881e-7eebf8a1c020:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:2f867696-e8cb-4a0a-881e-7eebf8a1c020:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:dca4ca78-4324-48e1-bedb-50297af04b5f:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                    "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                    "projectId": "global",
                    "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-hot-topic-draft",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "draftRef": "hot-topic-draft:d665864a9766fa1d29150fc41caaf15d2479d086aed3f33935b2e96df8ce6035",
            "version": 1
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0b0ac7b9-0077-4266-ad14-021c5f37a75c:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:2f867696-e8cb-4a0a-881e-7eebf8a1c020:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:2f867696-e8cb-4a0a-881e-7eebf8a1c020:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:dca4ca78-4324-48e1-bedb-50297af04b5f:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                    "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                    "projectId": "global",
                    "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [
                {
                  "id": "1194cf10-6160-430d-aa4d-5acc6856dd6d",
                  "incarnation": "f2f13c7a-43f8-422a-a940-ee6588cd7ddb",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:d665864a9766fa1d29150fc41caaf15d2479d086aed3f33935b2e96df8ce6035",
                  "version": 1,
                  "label": "Initial shared draft",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                    "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                    "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Initial shared draft",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "priority": "normal",
                    "notes": ""
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                      "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                      "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                        "version": 1,
                        "fields": [
                          "action",
                          "due",
                          "notes",
                          "owner",
                          "priority"
                        ],
                        "period": {
                          "start": "2026-11-13",
                          "end": "2026-11-13"
                        },
                        "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                      }
                    }
                  ]
                }
              ],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:0b0ac7b9-0077-4266-ad14-021c5f37a75c:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:2f867696-e8cb-4a0a-881e-7eebf8a1c020:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:2f867696-e8cb-4a0a-881e-7eebf8a1c020:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:dca4ca78-4324-48e1-bedb-50297af04b5f:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                    "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                    "projectId": "global",
                    "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [
                {
                  "id": "1194cf10-6160-430d-aa4d-5acc6856dd6d",
                  "incarnation": "f2f13c7a-43f8-422a-a940-ee6588cd7ddb",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:d665864a9766fa1d29150fc41caaf15d2479d086aed3f33935b2e96df8ce6035",
                  "version": 1,
                  "label": "Initial shared draft",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                    "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                    "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Initial shared draft",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "priority": "normal",
                    "notes": ""
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                      "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                      "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                        "version": 1,
                        "fields": [
                          "action",
                          "due",
                          "notes",
                          "owner",
                          "priority"
                        ],
                        "period": {
                          "start": "2026-11-13",
                          "end": "2026-11-13"
                        },
                        "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                      }
                    }
                  ]
                }
              ],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      }
    ],
    "preferences": {
      "status": "ok",
      "storageVersion": 1,
      "aggregateRevision": 2,
      "incarnation": "19e36c44-1b27-4e34-b510-13a3ffa33c82",
      "value": {
        "keys": [
          "sf:proposal-coverage:hot-topic:history:658819686765ae0e97026bda4b8016a8d00d9501db7c366d8ac10d9e61d20c04",
          "sf:proposal-coverage:hot-topic:active:9162179f275a74b57781f4e160bbe8d5efa950eb3d0392e2922de3e3ec9c1c57"
        ],
        "drafts": [
          {
            "schema": "sf-hot-topic-draft-v1",
            "id": "1194cf10-6160-430d-aa4d-5acc6856dd6d",
            "incarnation": "f2f13c7a-43f8-422a-a940-ee6588cd7ddb",
            "version": 1,
            "draftRef": "hot-topic-draft:d665864a9766fa1d29150fc41caaf15d2479d086aed3f33935b2e96df8ce6035",
            "caseRef": {
              "id": "private-case-identity",
              "incarnation": "case-incarnation",
              "version": 1
            },
            "caseScopeDigest": "99a6f33da8e6bf09b77dffcac1aae93f6c7679938d9ff025ab281434c39dd473",
            "target": {
              "surface": "dashboard",
              "type": "hotTopics",
              "id": "topic",
              "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
              "version": 1,
              "fields": [
                "action",
                "due",
                "notes",
                "owner",
                "priority"
              ],
              "period": {
                "start": "2026-11-13",
                "end": "2026-11-13"
              },
              "observedAt": "2026-11-13T08:00:00.000Z"
            },
            "targetEvidence": {
              "schema": "sf-evidence-v1",
              "kind": "record",
              "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
              "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
              "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
              "projectId": "global",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                "version": 1,
                "fields": [
                  "action",
                  "due",
                  "notes",
                  "owner",
                  "priority"
                ],
                "period": {
                  "start": "2026-11-13",
                  "end": "2026-11-13"
                },
                "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
              }
            },
            "fields": {
              "action": "Initial shared draft",
              "owner": "Operations",
              "due": "2026-12-01",
              "priority": "normal",
              "notes": ""
            },
            "sourceRefs": [
              {
                "schema": "sf-evidence-v1",
                "kind": "record",
                "refId": "sf-source:e5e1e6b2-6a08-40a4-9dbd-a8539d124808:1",
                "refDigest": "d8ca211c24af63cbe3d9512a9f515641280480972474808ed9ed06e7090885fd",
                "installationId": "7accb2eb-f047-4a4d-a754-4b5eaa560caa",
                "projectId": "global",
                "evidenceLevel": "observed",
                "target": {
                  "surface": "dashboard",
                  "recordType": "hotTopics",
                  "recordId": "topic",
                  "incarnation": "e5e1e6b2-6a08-40a4-9dbd-a8539d124808",
                  "version": 1,
                  "fields": [
                    "action",
                    "due",
                    "notes",
                    "owner",
                    "priority"
                  ],
                  "period": {
                    "start": "2026-11-13",
                    "end": "2026-11-13"
                  },
                  "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                }
              }
            ],
            "principalRef": "macos:7accb2eb-f047-4a4d-a754-4b5eaa560caa:1000",
            "accessRevision": "926209c037fbbec0c039ced3b57f8241a38d40641514467a1960fc8cf54ca783",
            "policyVersion": "sf-product-v1",
            "createdAt": "2026-11-19T21:49:24.519Z",
            "recordDigest": "97e4d7d84814056caf4d90ba54d83e952531f4bce0172ec9e3d259c316e59fbe"
          }
        ]
      }
    },
    "decision": {
      "status": "ok",
      "storageVersion": 2,
      "aggregateRevision": 2,
      "incarnation": "19e36c44-1b27-4e34-b510-13a3ffa33c82",
      "value": {
        "id": "private-case-identity",
        "incarnation": "case-incarnation",
        "version": 1,
        "objective": "Review the action",
        "state": "investigating",
        "horizon": {
          "start": "2026-01-01",
          "end": "2026-12-31"
        },
        "currency": "USD",
        "participants": [
          "macos:7accb2eb-f047-4a4d-a754-4b5eaa560caa:1000"
        ],
        "criteria": [
          {
            "id": "operational",
            "description": "Operational action",
            "required": true
          }
        ],
        "sourceRefs": [],
        "alternatives": [],
        "costCoverageBases": [],
        "assumptions": [],
        "questions": [],
        "choices": [],
        "preparedChanges": [],
        "receipts": [],
        "ledger": []
      }
    },
    "receipts": {
      "status": "ok",
      "storageVersion": 0,
      "aggregateRevision": 2,
      "incarnation": "19e36c44-1b27-4e34-b510-13a3ffa33c82",
      "value": []
    },
    "record": {
      "id": "topic",
      "action": "Original action",
      "owner": "Operations",
      "due": "2026-12-01",
      "priority": "normal",
      "status": "open",
      "notes": ""
    }
  },
  {
    "path": "/orchestra/sf-dashboard/hot-topics/proposals/r_aG90LXRvcGljLWRyYWZ0OmQ2NjU4NjRhOTc2NmZhMWQyOTE1MGZjNDFjYWFmMTVkMjQ3OWQwODZhZWQzZjMzOTM1YjJlOTZkZjhjZTYwMzU",
    "text": "Orchestra\n/\nFollow-up proposal\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nFollow-up proposal\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-3Yij2P\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-3YIJ2P⁩ · FOLLOW-UP PROPOSAL\nFollow-up proposal\nPrivate proposal\nActionOwnerDue datePriority\nNormal\nHigh\nCritical\nNotes\nSave proposal\nLoad current version and keep my edits\nProposal\nProposal reference\nhot-topic-draft:d665864a9766fa1d29150fc41caaf15d2479d086aed3f33935b2e96df8ce6035\nAction\nInitial shared draft\nResponsible party\nOperations\nDue date\nDec 1, 2026\nPriority\nnormal\nNotes\nCurrent case identity\nprivate-case-identity\nSource evidence\n\nCurrent producer source\n\nReview before applying\n\nNo current producer review has been admitted. Applying is unavailable.\n\nOriginal receipt\n\nNo current producer review has been admitted. Applying is unavailable."
  }
]
```

## Original journey observation 5

```json
[
  {
    "traffic": [
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:872b4489-786f-4dcb-ab67-dd7d6208f93c:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:948d60d8-e3af-4b56-a7e3-6a48196b804c:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:1",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "refDigest": "5422e3c3e70ed8da0e7179c2d9a473d3ec4a5767ddffef092b47ff4d27262964",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:872b4489-786f-4dcb-ab67-dd7d6208f93c:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:948d60d8-e3af-4b56-a7e3-6a48196b804c:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:1",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "refDigest": "5422e3c3e70ed8da0e7179c2d9a473d3ec4a5767ddffef092b47ff4d27262964",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [
              {
                "kind": "review",
                "ref": "dashboard-review:f24871bcf91322a2fa0cf676f9bc9aa5493c9e45fb45e065c581404ed182cc28",
                "label": "Hot Topics · 2026-11-19"
              }
            ],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:872b4489-786f-4dcb-ab67-dd7d6208f93c:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:948d60d8-e3af-4b56-a7e3-6a48196b804c:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 1,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:1",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "refDigest": "5422e3c3e70ed8da0e7179c2d9a473d3ec4a5767ddffef092b47ff4d27262964",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 1,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "31964fa098e3ef1709f0f8cc3fa982f03365914d16966fb82cc88decacba2a1f"
                    }
                  },
                  "fields": {
                    "action": "Original action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [
              {
                "kind": "capture",
                "ref": "dashboard-capture:1f4e9df8ff7e6923dab089c6f3cd835e596e713caf06ce133f057e1ddfbab958",
                "label": "Original action · 2026-11-13"
              },
              {
                "kind": "review",
                "ref": "dashboard-review:f24871bcf91322a2fa0cf676f9bc9aa5493c9e45fb45e065c581404ed182cc28",
                "label": "Hot Topics · 2026-11-19"
              }
            ],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:872b4489-786f-4dcb-ab67-dd7d6208f93c:2",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1",
                  "recordId": "topic",
                  "label": "Current revised action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Current revised action",
                "sourceRef": "sf-source:948d60d8-e3af-4b56-a7e3-6a48196b804c:2",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 2,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 2,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                    }
                  },
                  "fields": {
                    "action": "Current revised action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [
              {
                "kind": "capture",
                "ref": "dashboard-capture:1f4e9df8ff7e6923dab089c6f3cd835e596e713caf06ce133f057e1ddfbab958",
                "label": "Original action · 2026-11-13"
              },
              {
                "kind": "review",
                "ref": "dashboard-review:f24871bcf91322a2fa0cf676f9bc9aa5493c9e45fb45e065c581404ed182cc28",
                "label": "Hot Topics · 2026-11-19"
              }
            ],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-hot-topic-draft",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "draftRef": "hot-topic-draft:fd5dc6494ec081b58671d0f80d81e50589c0c362abeee902519ba5d364ed6d78",
            "version": 1
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:872b4489-786f-4dcb-ab67-dd7d6208f93c:2",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1",
                  "recordId": "topic",
                  "label": "Current revised action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Current revised action",
                "sourceRef": "sf-source:948d60d8-e3af-4b56-a7e3-6a48196b804c:2",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 2,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 2,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                    }
                  },
                  "fields": {
                    "action": "Current revised action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [
              {
                "kind": "capture",
                "ref": "dashboard-capture:1f4e9df8ff7e6923dab089c6f3cd835e596e713caf06ce133f057e1ddfbab958",
                "label": "Original action · 2026-11-13"
              },
              {
                "kind": "review",
                "ref": "dashboard-review:f24871bcf91322a2fa0cf676f9bc9aa5493c9e45fb45e065c581404ed182cc28",
                "label": "Hot Topics · 2026-11-19"
              }
            ],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [
                {
                  "id": "457042b8-9648-4ff5-89e7-cfece8de1ba7",
                  "incarnation": "5a84d8ca-2cf1-4c03-9110-dd2d8999ef88",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:fd5dc6494ec081b58671d0f80d81e50589c0c362abeee902519ba5d364ed6d78",
                  "version": 1,
                  "label": "Approved new action",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 2,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                    "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 2,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                    }
                  },
                  "fields": {
                    "action": "Approved new action",
                    "owner": "Operations",
                    "due": "2026-12-20",
                    "priority": "high",
                    "notes": "Reviewed with Operations"
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                      "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                      "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                        "version": 2,
                        "fields": [
                          "action",
                          "due",
                          "notes",
                          "owner",
                          "priority"
                        ],
                        "period": {
                          "start": "2026-11-13",
                          "end": "2026-11-13"
                        },
                        "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                      }
                    }
                  ]
                }
              ],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      },
      {
        "mode": "dashboard-workbench",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "period": {
              "start": "2026-01-01",
              "end": "2026-12-31"
            },
            "agenda": {
              "section": {
                "id": "dashboard",
                "title": "Hot Topics & Actions",
                "selectionRef": "sf-source:872b4489-786f-4dcb-ab67-dd7d6208f93c:2",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:adfeb80b-3960-46cc-a21e-88e72e34d1e8:1",
                  "recordId": "topic",
                  "label": "Current revised action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Current revised action",
                "sourceRef": "sf-source:948d60d8-e3af-4b56-a7e3-6a48196b804c:2",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 2,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 2,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                    }
                  },
                  "fields": {
                    "action": "Current revised action",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "notes": "",
                    "priority": "normal"
                  }
                }
              }
            ],
            "recordLimit": 100,
            "history": [
              {
                "kind": "capture",
                "ref": "dashboard-capture:1f4e9df8ff7e6923dab089c6f3cd835e596e713caf06ce133f057e1ddfbab958",
                "label": "Original action · 2026-11-13"
              },
              {
                "kind": "review",
                "ref": "dashboard-review:f24871bcf91322a2fa0cf676f9bc9aa5493c9e45fb45e065c581404ed182cc28",
                "label": "Hot Topics · 2026-11-19"
              }
            ],
            "permissions": {
              "preserve": true,
              "capture": true
            },
            "decisions": {
              "cases": [
                {
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "label": "Review the action"
                }
              ],
              "drafts": [
                {
                  "id": "457042b8-9648-4ff5-89e7-cfece8de1ba7",
                  "incarnation": "5a84d8ca-2cf1-4c03-9110-dd2d8999ef88",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:fd5dc6494ec081b58671d0f80d81e50589c0c362abeee902519ba5d364ed6d78",
                  "version": 1,
                  "label": "Approved new action",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                    "version": 2,
                    "fields": [
                      "action",
                      "due",
                      "notes",
                      "owner",
                      "priority"
                    ],
                    "period": {
                      "start": "2026-11-13",
                      "end": "2026-11-13"
                    },
                    "observedAt": "2026-11-13T08:00:00.000Z"
                  },
                  "targetEvidence": {
                    "schema": "sf-evidence-v1",
                    "kind": "record",
                    "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                    "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                    "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                      "version": 2,
                      "fields": [
                        "action",
                        "due",
                        "notes",
                        "owner",
                        "priority"
                      ],
                      "period": {
                        "start": "2026-11-13",
                        "end": "2026-11-13"
                      },
                      "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                    }
                  },
                  "fields": {
                    "action": "Approved new action",
                    "owner": "Operations",
                    "due": "2026-12-20",
                    "priority": "high",
                    "notes": "Reviewed with Operations"
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                      "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                      "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                        "version": 2,
                        "fields": [
                          "action",
                          "due",
                          "notes",
                          "owner",
                          "priority"
                        ],
                        "period": {
                          "start": "2026-11-13",
                          "end": "2026-11-13"
                        },
                        "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                      }
                    }
                  ]
                }
              ],
              "preparations": [],
              "changes": [],
              "caseLimit": 50,
              "permissions": {
                "draft": true,
                "prepare": true,
                "apply": true
              }
            }
          }
        }
      }
    ],
    "preferences": {
      "status": "ok",
      "storageVersion": 2,
      "aggregateRevision": 4,
      "incarnation": "947ff0d0-e251-4c5c-a442-0857d15c6a85",
      "value": {
        "keys": [
          "sf:proposal-coverage:hot-topic:history:32bf790b25afefae9525b39c52b1f1441098b21d66e7ea87e82af6040ea81532",
          "sf:proposal-coverage:hot-topic:active:5d3569f75af1db9566d19ace57d40544f5cd3bb30eba0cdfa9eafbf44cb26fe2"
        ],
        "drafts": [
          {
            "schema": "sf-hot-topic-draft-v1",
            "id": "457042b8-9648-4ff5-89e7-cfece8de1ba7",
            "incarnation": "5a84d8ca-2cf1-4c03-9110-dd2d8999ef88",
            "version": 1,
            "draftRef": "hot-topic-draft:fd5dc6494ec081b58671d0f80d81e50589c0c362abeee902519ba5d364ed6d78",
            "caseRef": {
              "id": "private-case-identity",
              "incarnation": "case-incarnation",
              "version": 1
            },
            "caseScopeDigest": "99a6f33da8e6bf09b77dffcac1aae93f6c7679938d9ff025ab281434c39dd473",
            "target": {
              "surface": "dashboard",
              "type": "hotTopics",
              "id": "topic",
              "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
              "version": 2,
              "fields": [
                "action",
                "due",
                "notes",
                "owner",
                "priority"
              ],
              "period": {
                "start": "2026-11-13",
                "end": "2026-11-13"
              },
              "observedAt": "2026-11-13T08:00:00.000Z"
            },
            "targetEvidence": {
              "schema": "sf-evidence-v1",
              "kind": "record",
              "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
              "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
              "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
              "projectId": "global",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                "version": 2,
                "fields": [
                  "action",
                  "due",
                  "notes",
                  "owner",
                  "priority"
                ],
                "period": {
                  "start": "2026-11-13",
                  "end": "2026-11-13"
                },
                "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
              }
            },
            "fields": {
              "action": "Approved new action",
              "owner": "Operations",
              "due": "2026-12-20",
              "priority": "high",
              "notes": "Reviewed with Operations"
            },
            "sourceRefs": [
              {
                "schema": "sf-evidence-v1",
                "kind": "record",
                "refId": "sf-source:73fb880b-bcf7-499c-81c8-0733d5de5849:2",
                "refDigest": "8c994dca68f8c6a366f2836b44b6c94604a5c4e22a898ddf1351fcbea6c303e5",
                "installationId": "5e337fd2-4cde-41fe-8e5c-8f682b9c2d41",
                "projectId": "global",
                "evidenceLevel": "observed",
                "target": {
                  "surface": "dashboard",
                  "recordType": "hotTopics",
                  "recordId": "topic",
                  "incarnation": "73fb880b-bcf7-499c-81c8-0733d5de5849",
                  "version": 2,
                  "fields": [
                    "action",
                    "due",
                    "notes",
                    "owner",
                    "priority"
                  ],
                  "period": {
                    "start": "2026-11-13",
                    "end": "2026-11-13"
                  },
                  "projectionDigest": "36d7144fd5cbf77e7a1b10bbe8a70978cf7b218dd97ab6c572444846525daf24"
                }
              }
            ],
            "principalRef": "macos:5e337fd2-4cde-41fe-8e5c-8f682b9c2d41:1000",
            "accessRevision": "0626e5bc575f403be539079fb31c8480f853bfb2829c63fc580040657c94f082",
            "policyVersion": "sf-product-v1",
            "createdAt": "2026-11-19T21:50:12.094Z",
            "recordDigest": "0bfa8bc4dfca7c2673ec92152870d5ad2cbe52bfda19d9d474cf9fdf02f268d5"
          }
        ]
      }
    },
    "decision": {
      "status": "ok",
      "storageVersion": 2,
      "aggregateRevision": 4,
      "incarnation": "947ff0d0-e251-4c5c-a442-0857d15c6a85",
      "value": {
        "id": "private-case-identity",
        "incarnation": "case-incarnation",
        "version": 1,
        "objective": "Review the action",
        "state": "investigating",
        "horizon": {
          "start": "2026-01-01",
          "end": "2026-12-31"
        },
        "currency": "USD",
        "participants": [
          "macos:5e337fd2-4cde-41fe-8e5c-8f682b9c2d41:1000"
        ],
        "criteria": [
          {
            "id": "operational",
            "description": "Operational action",
            "required": true
          }
        ],
        "sourceRefs": [],
        "alternatives": [],
        "costCoverageBases": [],
        "assumptions": [],
        "questions": [],
        "choices": [],
        "preparedChanges": [],
        "receipts": [],
        "ledger": []
      }
    },
    "receipts": {
      "status": "ok",
      "storageVersion": 0,
      "aggregateRevision": 4,
      "incarnation": "947ff0d0-e251-4c5c-a442-0857d15c6a85",
      "value": []
    },
    "record": {
      "status": "open",
      "priority": "normal",
      "id": "topic",
      "action": "Current revised action",
      "owner": "Operations",
      "due": "2026-12-01",
      "notes": ""
    }
  },
  {
    "path": "/orchestra/sf-dashboard/hot-topics/proposals/r_aG90LXRvcGljLWRyYWZ0OmZkNWRjNjQ5NGVjMDgxYjU4NjcxZDBmODBkODFlNTA1ODljMGMzNjJhYmVlZTkwMjUxOWJhNWQzNjRlZDZkNzg",
    "text": "Orchestra\n/\nFollow-up proposal\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nFollow-up proposal\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-D3s6La\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-D3S6LA⁩ · FOLLOW-UP PROPOSAL\nFollow-up proposal\nPrivate proposal\nActionOwnerDue datePriority\nNormal\nHigh\nCritical\nNotes\nSave proposal\nLoad current version and keep my edits\nProposal\nProposal reference\nhot-topic-draft:fd5dc6494ec081b58671d0f80d81e50589c0c362abeee902519ba5d364ed6d78\nAction\nApproved new action\nResponsible party\nOperations\nDue date\nDec 20, 2026\nPriority\nhigh\nNotes\nReviewed with Operations\nCurrent case identity\nprivate-case-identity\nSource evidence\n\nCurrent producer source\n\nReview before applying\n\nNo current producer review has been admitted. Applying is unavailable.\n\nOriginal receipt\n\nNo current producer review has been admitted. Applying is unavailable."
  },
  {
    "path": "/orchestra/sf-dashboard/hot-topics/r_dG9waWM",
    "text": "Orchestra\n/\nHot Topics & Actions\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nHot Topics & Actions\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-D3s6La\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-D3S6LA⁩ · HOT TOPICS & ACTIONS\nHot Topics & Actions\nNew topic\nOriginal action\nBack to topics\nOwner\nOperations\nDue date\nDec 1, 2026\nStatus\nOpen\nPriority\nNormal\nNotes\nNot specified\nRecord version\nNot specified\nRelate action by reference\nExecutive references\nOpen canonical record\nSelect a record\n\nNo authorized or available destinations\n\nPreserved record\n\nOriginal action\n\nPreserve this record\nRefresh record sources\nPreserved record to open\nPreserved record to open\nOriginal action · 2026-11-13\nOpen preserved record\nHistorical record\nCapture reference\ndashboard-capture:1f4e9df8ff7e6923dab089c6f3cd835e596e713caf06ce133f057e1ddfbab958\nCaptured at\n2026-11-13T08:00:00.000Z\nCaptured by\nmacos:5e337fd2-4cde-41fe-8e5c-8f682b9c2d41:1000\n\nSource: dashboard · hotTopics · topic · version 1 · incarnation 948d60d8-e3af-4b56-a7e3-6a48196b804c\n\nField\tValue\tAuthorized period\tEvidence\nhotTopics:topic:action\tOriginal action\t2026-11-13 – 2026-11-13\tConfirmed\nhotTopics:topic:due\t2026-12-01\t2026-11-13 – 2026-11-13\tConfirmed\nhotTopics:topic:notes\t\t2026-11-13 – 2026-11-13\tConfirmed\nhotTopics:topic:owner\tOperations\t2026-11-13 – 2026-11-13\tConfirmed\nhotTopics:topic:priority\tnormal\t2026-11-13 – 2026-11-13\tConfirmed\nhotTopics:topic:status\topen\t2026-11-13 – 2026-11-13\tConfirmed\nEdit topic\nDelete topic\nHistory\n\nThe current producer has not supplied record history."
  }
]
```

Original attachment without inline body: {"name": "proposal-original-observation.json", "contentType": "application/json"}

Original attachment without inline body: {"name": "proposal-original-observation.json", "contentType": "application/json"}

Original attachment without inline body: {"name": "proposal-original-observation.json", "contentType": "application/json"}

Original attachment without inline body: {"name": "proposal-original-observation.json", "contentType": "application/json"}

Original attachment without inline body: {"name": "proposal-original-observation.json", "contentType": "application/json"}

