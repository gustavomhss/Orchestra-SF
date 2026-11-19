# Proposal gate7 original observations

Read-only source run44623930895, artifact14578598211, snapshotfc566a0a339b674f71166119eac4563551315287. No rerun.

Embedded payloads: 1

## Original journey observation 1

```json
[
  {
    "traffic": [
      {
        "mode": "dashboard-hot-topic-draft",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "draftRef": "hot-topic-draft:f0ceeaadd9309024e3f479033306af787bf2a7dba1e3d3dd2a0b6401e955e185",
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
                "selectionRef": "sf-source:9ceb5af6-5f26-477f-89c6-d21e023907c5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:3a09fa0c-ecf3-4359-877e-44784097e263:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                  "id": "e1170c9a-65d1-426c-8361-f6c5a0565910",
                  "incarnation": "566f1b04-d539-4c0d-a0d3-e3ae05d67530",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:f0ceeaadd9309024e3f479033306af787bf2a7dba1e3d3dd2a0b6401e955e185",
                  "version": 1,
                  "label": "Initially saved proposal",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                      "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                      "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                      "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                "selectionRef": "sf-source:9ceb5af6-5f26-477f-89c6-d21e023907c5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:3a09fa0c-ecf3-4359-877e-44784097e263:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                  "id": "e1170c9a-65d1-426c-8361-f6c5a0565910",
                  "incarnation": "566f1b04-d539-4c0d-a0d3-e3ae05d67530",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:f0ceeaadd9309024e3f479033306af787bf2a7dba1e3d3dd2a0b6401e955e185",
                  "version": 1,
                  "label": "Initially saved proposal",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                      "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                      "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                      "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                "selectionRef": "sf-source:9ceb5af6-5f26-477f-89c6-d21e023907c5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:3a09fa0c-ecf3-4359-877e-44784097e263:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                  "id": "e1170c9a-65d1-426c-8361-f6c5a0565910",
                  "incarnation": "566f1b04-d539-4c0d-a0d3-e3ae05d67530",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:f0ceeaadd9309024e3f479033306af787bf2a7dba1e3d3dd2a0b6401e955e185",
                  "version": 1,
                  "label": "Initially saved proposal",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                      "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                      "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                      "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
        "mode": "dashboard-hot-topic-draft",
        "status": 200,
        "result": {
          "status": "ok",
          "value": {
            "draftRef": "hot-topic-draft:715dfa7b7e303078f27ba3fc96d3d0ddd555e9c028a4b5414048c3b7ef9abcd8",
            "version": 2
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
                "selectionRef": "sf-source:9ceb5af6-5f26-477f-89c6-d21e023907c5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:3a09fa0c-ecf3-4359-877e-44784097e263:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                  "id": "e1170c9a-65d1-426c-8361-f6c5a0565910",
                  "incarnation": "566f1b04-d539-4c0d-a0d3-e3ae05d67530",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:715dfa7b7e303078f27ba3fc96d3d0ddd555e9c028a4b5414048c3b7ef9abcd8",
                  "version": 2,
                  "label": "Active proposal from another page",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "action": "Active proposal from another page",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "priority": "normal",
                    "notes": "Current private proposal context"
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                      "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                      "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                "selectionRef": "sf-source:9ceb5af6-5f26-477f-89c6-d21e023907c5:1",
                "topic": "hot-topics",
                "period": {
                  "start": "2026-01-01",
                  "end": "2026-12-31"
                },
                "recordRefs": [
                  "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1"
                ]
              },
              "recordOptions": [
                {
                  "recordRef": "sf-source:86d2b111-767c-4b71-ac18-3930b2a520ab:1",
                  "recordId": "topic",
                  "label": "Original action"
                }
              ],
              "recordCount": 1
            },
            "records": [
              {
                "label": "Original action",
                "sourceRef": "sf-source:3a09fa0c-ecf3-4359-877e-44784097e263:1",
                "draft": {
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                  "id": "e1170c9a-65d1-426c-8361-f6c5a0565910",
                  "incarnation": "566f1b04-d539-4c0d-a0d3-e3ae05d67530",
                  "caseRef": {
                    "id": "private-case-identity",
                    "incarnation": "case-incarnation",
                    "version": 1
                  },
                  "draftRef": "hot-topic-draft:715dfa7b7e303078f27ba3fc96d3d0ddd555e9c028a4b5414048c3b7ef9abcd8",
                  "version": 2,
                  "label": "Active proposal from another page",
                  "target": {
                    "surface": "dashboard",
                    "type": "hotTopics",
                    "id": "topic",
                    "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                    "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                    "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                    "projectId": "global",
                    "evidenceLevel": "observed",
                    "target": {
                      "surface": "dashboard",
                      "recordType": "hotTopics",
                      "recordId": "topic",
                      "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
                    "action": "Active proposal from another page",
                    "owner": "Operations",
                    "due": "2026-12-01",
                    "priority": "normal",
                    "notes": "Current private proposal context"
                  },
                  "sourceRefs": [
                    {
                      "schema": "sf-evidence-v1",
                      "kind": "record",
                      "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                      "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                      "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                      "projectId": "global",
                      "evidenceLevel": "observed",
                      "target": {
                        "surface": "dashboard",
                        "recordType": "hotTopics",
                        "recordId": "topic",
                        "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
        "mode": "dashboard-hot-topic-draft",
        "status": 409,
        "result": {
          "status": "stale",
          "reason": "hot-topic-draft-changed"
        }
      }
    ],
    "preferences": {
      "status": "ok",
      "storageVersion": 2,
      "aggregateRevision": 3,
      "incarnation": "17f0a39a-df24-4eb3-8b3a-d33aa75920b8",
      "value": {
        "keys": [
          "sf:proposal-coverage:hot-topic:history:dabaa2ef2349b05974517987c3060e2ce0b820017b2602357438c24434cd0cc7",
          "sf:proposal-coverage:hot-topic:active:d9098b512824dc1eef232f2814dbffcc5aa327393786d6f690af2b126aaa60d2",
          "sf:proposal-coverage:hot-topic:history:84b242b5a226bae3dc93fdc8ea2bde5db880ba20ab815bcb1cbe7dc5aacfede1"
        ],
        "drafts": [
          {
            "schema": "sf-hot-topic-draft-v1",
            "id": "e1170c9a-65d1-426c-8361-f6c5a0565910",
            "incarnation": "566f1b04-d539-4c0d-a0d3-e3ae05d67530",
            "version": 2,
            "draftRef": "hot-topic-draft:715dfa7b7e303078f27ba3fc96d3d0ddd555e9c028a4b5414048c3b7ef9abcd8",
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
              "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
              "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
              "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
              "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
              "projectId": "global",
              "evidenceLevel": "observed",
              "target": {
                "surface": "dashboard",
                "recordType": "hotTopics",
                "recordId": "topic",
                "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
              "action": "Active proposal from another page",
              "owner": "Operations",
              "due": "2026-12-01",
              "priority": "normal",
              "notes": "Current private proposal context"
            },
            "sourceRefs": [
              {
                "schema": "sf-evidence-v1",
                "kind": "record",
                "refId": "sf-source:00c4660a-4c3d-4954-80c9-f6b41df5c1da:1",
                "refDigest": "944f630f87068a0ee2a40d72134b3f11c6d075327464f81226d27ed0a0182206",
                "installationId": "86fa05a3-e899-4c6c-a065-5a10db7bee4b",
                "projectId": "global",
                "evidenceLevel": "observed",
                "target": {
                  "surface": "dashboard",
                  "recordType": "hotTopics",
                  "recordId": "topic",
                  "incarnation": "00c4660a-4c3d-4954-80c9-f6b41df5c1da",
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
            "principalRef": "macos:86fa05a3-e899-4c6c-a065-5a10db7bee4b:1000",
            "accessRevision": "6c6d7c091a07ac21b45448d0ea8e7c1aa02325c9aafe5733bc9a5fcff3fe39d6",
            "policyVersion": "sf-product-v1",
            "createdAt": "2026-11-19T22:02:07.425Z",
            "recordDigest": "f1eac9a6525aeb29541d8fd4aed2f1504bb315166353341091e378d53faf0584"
          }
        ]
      }
    },
    "decision": {
      "status": "ok",
      "storageVersion": 3,
      "aggregateRevision": 3,
      "incarnation": "17f0a39a-df24-4eb3-8b3a-d33aa75920b8",
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
          "macos:86fa05a3-e899-4c6c-a065-5a10db7bee4b:1000"
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
      "aggregateRevision": 3,
      "incarnation": "17f0a39a-df24-4eb3-8b3a-d33aa75920b8",
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
    "path": "/orchestra/sf-dashboard/hot-topics/proposals/r_aG90LXRvcGljLWRyYWZ0OmYwY2VlYWFkZDkzMDkwMjRlM2Y0NzkwMzMzMDZhZjc4N2JmMmE3ZGJhMWUzZDNkZDJhMGI2NDAxZTk1NWUxODU",
    "text": "Orchestra\n/\nFollow-up proposal\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nFollow-up proposal\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-4HqE4o\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-4HQE4O⁩ · FOLLOW-UP PROPOSAL\nFollow-up proposal\nPrivate proposal\nActionOwnerDue datePriority\nNormal\nHigh\nCritical\nNotes\nSave proposal\nLoad current version and keep my edits\n\nThis topic changed. Review the current version before saving.\n\nProposal\nProposal reference\nhot-topic-draft:f0ceeaadd9309024e3f479033306af787bf2a7dba1e3d3dd2a0b6401e955e185\nAction\nInitially saved proposal\nResponsible party\nOperations\nDue date\nDec 1, 2026\nPriority\nnormal\nNotes\nInitially saved private context\nCurrent case identity\nprivate-case-identity\nSource evidence\n\nCurrent producer source\n\nReview before applying\n\nNo current producer review has been admitted. Applying is unavailable.\n\nOriginal receipt\n\nNo current producer review has been admitted. Applying is unavailable."
  },
  {
    "path": "/orchestra/sf-dashboard/hot-topics/proposals/r_aG90LXRvcGljLWRyYWZ0OjcxNWRmYTdiN2UzMDMwNzhmMjdiYTNmYzk2ZDNkMGRkZDU1NWU5YzAyOGE0YjU0MTQwNDhjM2I3ZWY5YWJjZDg",
    "text": "Orchestra\n/\nFollow-up proposal\nORCHESTRA\nHome\nChat\nInbox\nProject Board\nAgents\nActions\nEXTENSIONS\nToday\nDecisions\nFollow-up proposal\nHeadcount Overview\nIT Operations\nPortfolio Dashboard\nRequests\nOverview\nMy work\nAnalytics\nMeeting agenda\nImport file\nDocuments\nSignals\nRoutines\nMaestro\nFlight Engineer\nWorkflows\nAtlas\nRag Studio\nMCP\nIntegrations\nSkills\nPlugins\nHooks\nContext savings\nSchedule\n.env\nMCP Dock\nWorkspaces\nSearch\nCtrl+K\nSettings\nS\nsf-proposal-native-4HqE4o\n8 agents\n⌄\n\nBuild what matters.\nWith agents.\n\nRefresh access\nSign out\n⁨SF-PROPOSAL-NATIVE-4HQE4O⁩ · FOLLOW-UP PROPOSAL\nFollow-up proposal\nPrivate proposal\nActionOwnerDue datePriority\nNormal\nHigh\nCritical\nNotes\nSave proposal\nLoad current version and keep my edits\n\nThe original producer saved this private proposal.\n\nProposal\nProposal reference\nhot-topic-draft:715dfa7b7e303078f27ba3fc96d3d0ddd555e9c028a4b5414048c3b7ef9abcd8\nAction\nActive proposal from another page\nResponsible party\nOperations\nDue date\nDec 1, 2026\nPriority\nnormal\nNotes\nCurrent private proposal context\nCurrent case identity\nprivate-case-identity\nSource evidence\n\nCurrent producer source\n\nReview before applying\n\nNo current producer review has been admitted. Applying is unavailable.\n\nOriginal receipt\n\nNo current producer review has been admitted. Applying is unavailable."
  }
]
```

## Original host log

```text
[22:01:55.079] WARN (#817): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[22:01:55.313] INFO (#592): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[22:01:55.314] INFO (#828): project copy refresh started {
  projectID: "[redacted-hex]",
}
[22:01:55.316] INFO (#828): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[22:01:55.803] INFO (#1250): all LSPs are disabled
[22:01:56.233] INFO (#899): watcher backend {
  directory: "/tmp/sf-proposal-native-4HqE4o",
  platform: "linux",
  backend: "inotify",
}
[22:01:56.254] INFO (#2228): all LSPs are disabled
[22:01:56.274] INFO (#2027): project copy refresh started {
  projectID: "global",
}
[22:01:56.276] INFO (#2027): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[22:01:56.343] INFO (#899): booting location services {
  directory: "/tmp/sf-proposal-native-4HqE4o",
  workspaceID: undefined,
}
[22:01:56.561] INFO (#592): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[22:01:57.589] WARN (#3013): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
[Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.
```

## Original host log

```text
[22:02:15.647] WARN (#817): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[22:02:15.849] INFO (#592): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[22:02:15.850] INFO (#828): project copy refresh started {
  projectID: "[redacted-hex]",
}
[22:02:15.852] INFO (#828): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[22:02:16.048] INFO (#1053): all LSPs are disabled
[22:02:16.231] INFO (#592): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[22:02:17.198] INFO (#1813): watcher backend {
  directory: "/tmp/sf-proposal-native-k37zO1",
  platform: "linux",
  backend: "inotify",
}
[22:02:17.199] INFO (#2024): project copy refresh started {
  projectID: "global",
}
[22:02:17.199] INFO (#2024): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[22:02:17.244] INFO (#2226): all LSPs are disabled
[22:02:17.760] INFO (#1813): booting location services {
  directory: "/tmp/sf-proposal-native-k37zO1",
  workspaceID: undefined,
}
[22:02:18.148] WARN (#2997): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
[Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.
```

## Original host log

```text
[22:02:35.885] WARN (#1022): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[22:02:36.061] INFO (#823): watcher backend {
  directory: "/tmp/sf-proposal-native-NdBcLP",
  platform: "linux",
  backend: "inotify",
}
[22:02:36.236] INFO (#592): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[22:02:36.238] INFO (#1028): project copy refresh started {
  projectID: "global",
}
[22:02:36.240] INFO (#1028): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[22:02:36.240] INFO (#1079): project copy refresh started {
  projectID: "[redacted-hex]",
}
[22:02:36.240] INFO (#1079): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[22:02:36.342] INFO (#1247): all LSPs are disabled
[22:02:36.482] INFO (#2216): all LSPs are disabled
[22:02:36.525] INFO (#823): booting location services {
  directory: "/tmp/sf-proposal-native-NdBcLP",
  workspaceID: undefined,
}
[22:02:36.843] INFO (#592): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[22:02:37.862] WARN (#2993): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
```

## Original host log

```text
[22:02:54.085] WARN (#816): Project plugins not loaded. Add "/home/runner/work/Orchestra-SF/Orchestra-SF" to trusted_projects in your user config to approve it.
[22:02:54.370] INFO (#592): watcher backend {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  platform: "linux",
  backend: "inotify",
}
[22:02:54.371] INFO (#828): project copy refresh started {
  projectID: "[redacted-hex]",
}
[22:02:54.373] INFO (#828): project copy refresh done {
  projectID: "[redacted-hex]",
  updated: [],
  removed: [],
}
[22:02:54.566] INFO (#1053): all LSPs are disabled
[22:02:54.776] INFO (#592): booting location services {
  directory: "/home/runner/work/Orchestra-SF/Orchestra-SF",
  workspaceID: undefined,
}
[22:02:55.809] INFO (#1813): watcher backend {
  directory: "/tmp/sf-proposal-native-8kqqyB",
  platform: "linux",
  backend: "inotify",
}
[22:02:55.810] INFO (#2021): project copy refresh started {
  projectID: "global",
}
[22:02:55.811] INFO (#2021): project copy refresh done {
  projectID: "global",
  updated: [],
  removed: [],
}
[22:02:56.230] INFO (#2231): all LSPs are disabled
[22:02:56.327] INFO (#1813): booting location services {
  directory: "/tmp/sf-proposal-native-8kqqyB",
  workspaceID: undefined,
}
[22:02:56.716] WARN (#2757): event stream skipped an event the public schema cannot name {
  type: "project.updated",
}
[Bun.serve]: request timed out after 10 seconds. Pass `idleTimeout` to configure.
```

Original attachment without inline body: {"name": "proposal-original-observation.json", "contentType": "application/json"}

Original attachment without inline body: {"name": "proposal-host.log", "contentType": "text/plain"}

Original attachment without inline body: {"name": "proposal-host.log", "contentType": "text/plain"}

Original attachment without inline body: {"name": "proposal-host.log", "contentType": "text/plain"}

Original attachment without inline body: {"name": "proposal-host.log", "contentType": "text/plain"}

