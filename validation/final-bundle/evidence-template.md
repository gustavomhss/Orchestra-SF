# Orchestra-SF — modelo de evidência de candidato/CI/Azure
**Origem:** A10, W1, 2026-11-16 (America/Sao_Paulo). **Estado: TEMPLATE_ONLY / NOT_RUN / NÃO É ATESTADO.**
Este arquivo é um formulário de coleta, não uma evidência executada. Deixar campos ausentes como `NOT_OBSERVED`; nunca completar por dedução. Exemplos de runs anteriores ficam em `ci-round-10-13-digest.md` e não qualificam C.

## 1. Escopo e identidade de release (preencher apenas após W3)
| Campo obrigatório | Valor verificado | Fonte observável |
|---|---|---|
| Produto | Web no navegador + runtime/host Linux x86_64 na VM Azure | Contrato de produto |
| C congelado, SHA de commit 40 hex | `NOT_FROZEN` | `git rev-parse HEAD`, URL do commit |
| Tree SHA de C | `NOT_OBSERVED` | `git rev-parse 'HEAD^{tree}'` |
| Base/parents do C e PRs integrados | `NOT_OBSERVED` | Git refs, compare + commits |
| Manifest de oito suites: SHA256 e git blob | `NOT_OBSERVED` | `sha256sum sf/ci/suites.json`, git blob |
| Workflow CI/guards/Omni/build inputs: SHA256 | `NOT_OBSERVED` | caminhos versionados e checksums |
| `release-target.json` e workflow release: blob/digest | `NOT_OBSERVED` | git/sha256 |
| Artefato deployável IMUTÁVEL: ID, URI restrita e SHA256 | `NOT_OBSERVED` | artifact store, digest do byte promovido |
| Ato de freeze e revisor A1 (URL/data) | `NOT_OBSERVED` | ledger A1, aprovação humana |
| Janela de invalidação pós-freeze, diff e requalificação | `NOT_OBSERVED` | auditoria do commit/tree |

**Invalidação:** qualquer alteração de código, configurações, workflow, seleção, provas ou inputs normativos após o freeze cria um novo C; nunca portar recibos/artifact de SHA anterior. Não se confunde `head_sha` do PR com `github.sha` do workflow `pull_request` (pode ser um merge ref). Conservar ambos, e o checkout/tree realmente usados.

## 2. Run CI obrigatório — valores do MESMO run e attempt
| Campo | Valor |
|---|---|
| GitHub Actions run URL / run ID | `NOT_OBSERVED` |
| Workflow `sf-ci.yml`, event, PR/base/head ref | `NOT_OBSERVED` |
| `head_sha` (commit do PR) | `NOT_OBSERVED` |
| `github.sha` / SHA efetivamente checado no job | `NOT_OBSERVED` |
| `HEAD^{tree}` do checkout | `NOT_OBSERVED` |
| `run_attempt`, `run_started_at`, `updated_at` | `NOT_OBSERVED` |
| Linux/X64 runner + imagens/versionamentos Bun/Node | `NOT_OBSERVED` |
| Status e conclusão GLOBAL (não inferir pelos jobs) | `NOT_OBSERVED` |
| Artifacts IDs, retention, sha256 dos arquivos/recibos | `NOT_OBSERVED` |

Todos os nomes abaixo são normativos em `.github/workflows/sf-ci.yml` e `sf/ci/suites.json`. Para cada job registrar **job ID, URL, started/completed, conclusão exata** (`success/failure/cancelled/skipped/timed_out/...`), comando/exit, total de arquivos/casos coletados e executados, skips/failures, receipt filename+SHA256 e artifact ID. Estado inicial de **todas as linhas é NOT_RUN**:

| Job obrigatório | Job ID / URL | Conclusão | Testes/recibo/artifact e hashes |
|---|---|---|---|
| `sf/preflight` | NOT_RUN | NOT_RUN | manifest/negative controls + seletor |
| `sf/static-and-contracts` | NOT_RUN | NOT_RUN | geração+diff, typechecks/inclusão E2E, build e guards |
| `sf/linux-native-omni` | NOT_RUN | NOT_RUN | Linux/X64 + binários e artifact |
| `sf/test-CI-SF` | NOT_RUN | NOT_RUN | JUnit+receipt+seleção |
| `sf/test-CI-CLI` | NOT_RUN | NOT_RUN | JUnit+receipt+seleção |
| `sf/test-CI-APP-SRC` | NOT_RUN | NOT_RUN | JUnit+receipt+seleção |
| `sf/test-CI-APP-BROWSER` | NOT_RUN | NOT_RUN | JUnit+receipt+seleção |
| `sf/test-CI-ATLAS-BUSINESS` | NOT_RUN | NOT_RUN | JUnit+receipt+seleção |
| `sf/test-CI-UI-OPERATIONS` | NOT_RUN | NOT_RUN | Playwright JSON minimizado+receipt |
| `sf/test-CI-UI-DECISIONS` | NOT_RUN | NOT_RUN | Playwright JSON minimizado+receipt |
| `sf/test-CI-UI-REPORTS` | NOT_RUN | NOT_RUN | Playwright JSON minimizado+receipt |
| `sf/verify` | NOT_RUN | NOT_RUN | upstream precheck e verificação dos oito recibos |

**Regras do aceite:** 12/12 jobs existentes, não cancelados, não pulados, conclusões `success`; oito suites com lista de casos realmente coletados/executados, sem `skipped/flaky/failure`; SHA/run/attempt/runner/artifacts coincidentes e SHA256 íntegro. `sf/verify` só vale como sucesso comprovado após testes negativos B1/B2/M4, cobertura/equivalência B3/CI-04, M2/M3, guards e revisão independente. Falta de um job = RED/NOT_RUN, não `N/A`. Histórico separado não substitui rodada nova sobre C.

## 3. Controles negativos e proveniência (preencher com comandos, logs e IDs)
| Obrigação | Prova positiva e contraprova requeridas | Estado |
|---|---|---|
| B1: inclusão de TODOS os E2E no typecheck | `--showConfig`, `--listFiles`, `verify-e2e-typecheck.mjs` + exclusão deliberada detectada | NOT_RUN |
| B2: manifest governa seleção real | arquivos/casos declarados=coletados=executados; mutação detectada | NOT_RUN |
| B3/CI-04: equivalência CLI+Atlas | matriz requisitos→testes, exclusões justificadas, revisão fria | BLOCKED_BY_SOURCE |
| M2: generated+diff real ou equivalência | execução com drift intencional barrado | NOT_RUN |
| M3: base de guards comparada | ambas bases/mesma árvore, sem bypass | NOT_RUN |
| M4: suíte quase vazia rejeitada | remover um caso/arquivo obrigatório deve falhar | NOT_RUN |
| CI-06: SHA256 + run/attempt + runner | adulteração de receipt/artefato rejeitada | NOT_RUN |
| CI-03: upstream RED | `sf/verify` falha pelo erro real antes do artifact download | NOT_RUN |

## 4. Trilhas independentes de aceite (NÃO inferir uma da outra)
| Marco | Status inicial | Exigência |
|---|---|---|
| `CI_HARNESS_VALIDATED` | PARTIAL (histórico; requer C novo) | controles reais, equivalência, integridade e revisor |
| `PRODUCT_CI_GREEN` | NO | mesma seleção completa, 12 conclusões success e `sf/verify` success no SHA correto |
| `AZURE_RELEASE_QUALIFIED` | BLOCKED | C servido, Azure+Entra+F04+AM01–06+restore/rollback, **ADM-01..06** e 3 cold reviews |

## 5. Azure instalado — provas release-only do MESMO C
| Prova | Run/host control ID, digest, resultado observável | Estado inicial |
|---|---|---|
| AZ-01: app Web + host realmente instalado em VM Linux x64, HTTPS/URL e processo | NOT_OBSERVED | BLOCKED_BY_ENV |
| AZ-02: login Microsoft Entra/OIDC, origem, CSRF, cookies/sessão e revogação, CAS, Task/Permission/Relay; delegated Graph requested/consented/used | NOT_OBSERVED | BLOCKED_BY_ENV/OWNER |
| **ADM-01..06 (novo): admin supremo, Graph, papéis por tela, zero writes Entra/Teams, demo sintética** | **NOT_OBSERVED** | **BLOCKED_BY_SOURCE/OWNER/ENV / NOT_RUN** |
| AZ-03: migração/dados privados + restart, backup/restore Linux e rollback | NOT_OBSERVED | BLOCKED_BY_ENV |
| AZ-04: F04 real, manifesto `sf2h.native-installed-manifest.v1`, diretório privado 0700, testemunhas + 3 negativos Q01 | NOT_OBSERVED | BLOCKED_BY_ENV |
| AZ-05: oito recipes integradas e AM01/02/03/04/05/06, U39/U40 com atores reais | NOT_OBSERVED | BLOCKED_BY_ENV |
| AZ-06: 3 revisões frias independentes, nomes, URLs, achados fechados, exato C | NOT_OBSERVED | NOT_RUN |
| AZ-07: ambiente GitHub protegido + approvals; artifact por digest, smoke TRANSACIONAL e rollback comprovado | NOT_OBSERVED | BLOCKED_BY_OWNER |
| AZ-08: autorização humana + policies/required checks reversíveis; Epic aposentado separadamente | NOT_OBSERVED | BLOCKED_BY_OWNER |

**Prova release não é Job PR:** não substituir login Entra por mock ou resposta HTTP 200; não forjar issuer/core, aprovação, instalação, manifesto F04 ou witness. Manifest/identidade/cookies/tokens, storageState, arquivos de empresa, secrets e logs privados não entram neste pacote: registrar apenas referência a armazenamento restrito, ID e hash sem valores secretos. Evidência privada deve ser validada por agente humano habilitado.

## 6. Auditoria/parecer e decisão (assinaturas reais; nenhum autocarimbo)
| Papel | Revisor/autoridade | Parecer, timestamp, evidência | Estado |
|---|---|---|---|
| Cold review independente 1 | NOT_ASSIGNED | NOT_OBSERVED | NOT_RUN |
| Cold review independente 2 | NOT_ASSIGNED | NOT_OBSERVED | NOT_RUN |
| Cold review independente 3 | NOT_ASSIGNED | NOT_OBSERVED | NOT_RUN |
| A1: ledgers, achados e colisões | NOT_OBSERVED | NOT_OBSERVED | NOT_RUN |
| Repo owner: rulesets/status contexts | NOT_OBSERVED | NOT_OBSERVED | BLOCKED_BY_OWNER |
| Repo owner: autorização de produção/rollback | NOT_OBSERVED | NOT_OBSERVED | BLOCKED_BY_OWNER |

**Decisão final:** `NOT_AUTHORIZED` enquanto uma obrigação prerequisito não tiver evidência própria; alterações de required checks, merge e deploy são `DECISÃO DO DONO`. Registrar URL da aprovação/PR separados, ausência de janela desprotegida e artefatos de rollback **antes** de mudar qualquer gate.

---

## 7. Atestação operacional assinável — modelo para o C final, NÃO preenchido

**Instrução de custódia:** criar uma instância datada deste modelo em armazenamento de evidência controlado **somente após** fatos observados. Não substituir NOT_OBSERVED por PASS a partir de texto de plano, anotações históricas, screenshot sem URI ou sucesso de PR não executado em C. Referência do fluxo de owner/rollback: [RELEASE-ATTESTATION.md](../../sf/ci/RELEASE-ATTESTATION.md#pacote-de-promoção--owner-only--execução-condicional-2026-11-16). A assinatura é uma aprovação humana, não um campo default.

~~~yaml
schema: orchestra-sf.release-attestation.v1
status: NOT_SIGNED
release_decision: NOT_AUTHORIZED
collection_timestamp_utc: NOT_OBSERVED
collector_identity: NOT_OBSERVED
owner_approval:
  principal: NOT_OBSERVED
  evidence_url_private_or_sanitized: NOT_OBSERVED
  timestamp_utc: NOT_OBSERVED
  scope: NOT_OBSERVED
candidate:
  commit_C_40hex: NOT_FROZEN
  tree_sha_40hex: NOT_OBSERVED
  base_and_accepted_prs_with_shas: NOT_OBSERVED
  freeze_approval_url: NOT_OBSERVED
  protected_tag_name_and_resolved_commit: NOT_OBSERVED
  manifest_sha256: NOT_OBSERVED
  ci_workflow_sha256: NOT_OBSERVED
  release_workflow_sha256: NOT_OBSERVED
  release_target_sha256: NOT_OBSERVED
  release_inputs_revision_and_change_log: NOT_OBSERVED
ci:
  run_id: NOT_OBSERVED
  run_attempt: NOT_OBSERVED
  event: NOT_OBSERVED
  head_sha: NOT_OBSERVED
  github_sha_checkout: NOT_OBSERVED
  checkout_tree_sha: NOT_OBSERVED
  runner_os_and_arch: NOT_OBSERVED
  runner_image_bun_node_versions: NOT_OBSERVED
  run_status_conclusion_and_url: NOT_OBSERVED
  twelve_job_ids_names_urls_exact_conclusions: NOT_OBSERVED
  eight_suite_case_counts_skips_exit_codes: NOT_OBSERVED
  eight_receipt_artifact_ids_and_sha256: NOT_OBSERVED
  sf_verify_provenance_and_positive_negative_controls: NOT_OBSERVED
  coverage_equivalence_B1_B2_B3_M2_M3_M4_review: NOT_OBSERVED
  admin_surface_cases_included_in_CI_and_negative_controls: NOT_OBSERVED
  demo_flamengo_scenario_receipts_and_isolation: NOT_OBSERVED
artifact:
  source_C: NOT_OBSERVED
  immutable_id_and_restricted_uri: NOT_OBSERVED
  build_run_attempt_and_builder_identity: NOT_OBSERVED
  linux_binary_web_omni_factory_manifest_hashes: NOT_OBSERVED
  signed_digest_sha256: NOT_OBSERVED
  installed_bytes_sha256: NOT_OBSERVED
  previous_release_id_and_sha256: NOT_OBSERVED
azure:
  subscription_rg_vm_opaque_record_id: NOT_OBSERVED
  ubuntu_x86_64_and_volume_identity_receipt: NOT_OBSERVED
  public_https_origin_and_service: NOT_OBSERVED
  deploy_job_run_id_and_environment_approval: NOT_OBSERVED
  app_start_restart_transacting_smoke_evidence: NOT_OBSERVED
  entra_tenant_issuer_callback_login_and_revocation_evidence: NOT_OBSERVED
  delegated_graph_four_scopes_requested_vs_consented_AllPrincipals: NOT_OBSERVED
  delegated_scopes_issued_in_scp_vs_actually_used_per_endpoint: NOT_OBSERVED
  origin_CSRF_owner_project_installation_CAS_negatives: NOT_OBSERVED
  backup_job_and_consistency_receipt: NOT_OBSERVED
  recovery_point_and_restore_job_receipt: NOT_OBSERVED
  isolated_restore_integrity_and_RPO_RTO: NOT_OBSERVED
  rollback_drill_approval_exits_and_smoke: NOT_OBSERVED
  F04_manifest_mode_binding_three_Q01_negatives: NOT_OBSERVED
  U39_U40_case_counts_and_results: NOT_OBSERVED
  AM01_AM02_AM03_AM04_AM05_AM06_receipts: NOT_OBSERVED
  eight_native_recipes_cases_witness_and_digests: NOT_OBSERVED
admin_surface:
  requirement_source: OWNER_DECISION_2026_11_16_NOT_PROOF
  implementation_candidate_commit_and_PR_review: NOT_OBSERVED
  demo_flamengo_fixture_commit_and_execution: NOT_OBSERVED
  microsoft_graph_delegated_permission_grants_AllPrincipals_export_digest: NOT_OBSERVED
  consented_vs_token_issued_vs_used_scopes_and_read_endpoints: NOT_OBSERVED
  graph_organogram_teams_profiles_read_only_projection_receipts: NOT_OBSERVED
  required_supreme_group_name: fla-supreme-admin
  required_supreme_group_id: a739232b-d5cb-4f41-873b-4c9d2340831e
  supreme_member_backend_UI_and_API_allowed_witness: NOT_OBSERVED
  nonmembers_anonymous_expired_revoked_cross_tenant_denial_witnesses: NOT_OBSERVED
  dashboard_planner_procurement_roles_cas_audit_and_per_screen_enforcement: NOT_OBSERVED
  graph_and_teams_zero_write_allowlist_network_and_audit_witness: NOT_OBSERVED
  synthetic_demo_positive_negative_and_denied_Zico_receipts: NOT_OBSERVED
  ADM_01_02_03_04_05_06_results_with_link_digest_and_review: NOT_OBSERVED
reviews:
  security_reviewer_identity_timestamp_finding_closeout: NOT_OBSERVED
  linux_data_reviewer_identity_timestamp_finding_closeout: NOT_OBSERVED
  producer_business_CI_reviewer_identity_timestamp_finding_closeout: NOT_OBSERVED
policy:
  branch_protection_403_MCP_provenance: REPRODUCED_READ_403_ONLY
  owner_full_protection_export_digest_and_timestamp: NOT_OBSERVED
  repository_and_org_rulesets_effective_exports: NOT_OBSERVED
  baseline_required_contexts_and_app_ids: NOT_OBSERVED
  add_sf_verify_owner_approval_and_mutation_audit: NOT_AUTHORIZED
  negative_enforcement_PR_url_after_add: NOT_OBSERVED
  retire_legacy_contexts_owner_approval_and_audit: NOT_AUTHORIZED
  epic_retirement_separate_PR_and_rollback_evidence: NOT_AUTHORIZED
verdicts:
  CI_HARNESS_VALIDATED: PARTIAL
  PRODUCT_CI_GREEN: NO
  AZURE_RELEASE_QUALIFIED: BLOCKED
  ADMIN_SURFACE_REQUIRED_GATE: BLOCKED_NOT_PROVEN
  GO_LIVE: BLOCKED
signatures:
  reviewer_1: NOT_SIGNED
  reviewer_2: NOT_SIGNED
  reviewer_3: NOT_SIGNED
  release_owner: NOT_SIGNED
~~~

**Nota de semântica:** somente a observação MCP de GET branch protection 403 foi reproduzida em 2026-11-16; não houve leitura bem-sucedida das regras efetivas nem autorização de mudança. O campo de verdict inicial acima é **fotografia de bloqueio**, não uma atestação assinada do estado futuro. Quando iniciar uma instância real, os três vereditos são preenchidos da **nova prova C**, jamais copiados como PASS deste documento.

## 8. Registro de mudança/rollback (uma linha POR ato, sem inferência)

| Evento | Ator/autoridade | C e run/attempt | Antes → depois (ID/hash) | Aprovação/URL/UTC | Contraprova e efeito observado | Estado |
|---|---|---|---|---|---|---|
| Freeze de C | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_RUN |
| Adição de sf/verify | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_AUTHORIZED |
| Remoção exclusiva de contexts Epic | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_AUTHORIZED |
| Deploy environment protegido | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_RUN |
| Rollback app/host | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_RUN |
| Restore isolado de dados | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_RUN |
| Reversão de policy | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_RUN |
| PR separado de aposentadoria Epic | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_OBSERVED | NOT_AUTHORIZED |

Cada linha precisa de **observação e link** antes de abandonar NOT_OBSERVED. Guardar IDs de VM/usuários, logs completos, tokens/cookies e manifesto F04 bruto apenas em storage de acesso restrito; a referência pública contém URL opaca/hash e verificação de um revisor autorizado. Nenhum script gera assinatura humana.

---

## 9. ADMIN-SURFACE — nova matriz de evidência, decisão do dono 2026-11-16

**Esta é a linha de release obrigatória adicionada pela decisão do owner, não é prova e não altera retroativamente o significado de runs antigos.** `AZ-02` passa a cobrir o Microsoft Graph e o gate novo `ADM-01..ADM-06` entra em `AZURE_RELEASE_QUALIFIED`. Código implementado por ADMIN-SURFACE; dados sintéticos por DEMO-FLAMENGO; evidência em tenant real por A8 + security reviewer. **Não existem aqui evidências positivas.**

| ID | Identidade e recibos exigidos no C/tenant real | Valor observado | Gate inicial |
|---|---|---|---|
| ADM-01 — consentimento Graph | Export sanitizado Entra app reg / service principal / `oauth2PermissionGrant.consentType=AllPrincipals`; quatro scopes delegados `User.Read`, `User.Read.All`, `GroupMember.Read.All`, `Directory.Read.All`: **requested / consented / issued `scp` / actually used** por endpoint e principal; não inferir uso dos quatro só por pedido | NOT_OBSERVED | NOT_RUN/BLOCKED_BY_OWNER |
| ADM-02 — Graph leitura | Lista real sanitizada de endpoints read-only e paginação para organograma/times/perfis; prova de falha sem consentimento, escopo ou Graph; nenhuma fixture sintética aceita como tenant real | NOT_OBSERVED | NOT_RUN/BLOCKED_BY_ENV |
| ADM-03 — supreme-only | Membro de `fla-supreme-admin` (`a739232b-d5cb-4f41-873b-4c9d2340831e`) permite UI+API; não membros/guest/tenant errado/revogado recebem 401/403 também por API direta, sem efeitos; ID e binding server-side | NOT_OBSERVED | NOT_RUN/BLOCKED_BY_ENV |
| ADM-04 — roles por tela | Admin autorizado altera papéis **Dashboard, Planner e Procurement** só na policy do Orchestra-SF, CAS/audit/restart; prova ações permitidas e negadas por tela/ação para destinatários reais | NOT_OBSERVED | NOT_RUN/BLOCKED_BY_ENV |
| ADM-05 — nenhuma escrita Entra/Teams | Política Graph read-only/allowlist, request trace sanitizado, logs do tenant/revisão e contraprova de operação mutável bloqueada; nenhuma chamada alterou usuários, grupos ou Teams, e mudança de papel é apenas local | NOT_OBSERVED | NOT_RUN/BLOCKED_BY_ENV |
| ADM-06 — org demo | Fixtures `sf/demo/flamengo/{org.json,catalog.json,scenarios.json,seed.mjs}` integradas, cenário positivo e negado incluindo Zico sem grupo, receipt/digest e isolamento de produção; **não substitui** os recibos ADM-01..05 no Entra real | NOT_OBSERVED | NOT_RUN/BLOCKED_BY_SOURCE |

**Critérios de custódia:** por prova anexar ID/URL restrita e hash SHA256, C/tree/artifact SHA, run/attempt/caso/ator opaco e timestamp, status HTTP sem valores sensíveis, revisor independente e contraste esperado/observado. Guardar tokens `scp` íntegros, segredos, cookies, membros reais, perfis e logs brutos em storage protegido, nunca no Git/Actions público. **Scope consentido não significa scope usado; ausência de Graph write precisa de contraprovas e inspeção server-side, não só ausência de linha de log.**

**Entrada na linha de chegada:** `ADM-01..06=PASS` exige resultado real observável no C final. A ausência de qualquer campo ou dono da prova mantém `ADMIN_SURFACE_REQUIRED_GATE=BLOCKED_NOT_PROVEN` e `GO_LIVE=BLOCKED`, mesmo com 12 jobs verdes.
