# A9 / F04–AM | Certidão W1 e modelos de certificados de execução

**CERTIDÃO A9-W1-F04-AM-20261116** · emitida em **2026-11-16** · branch `sfa-f04` · classe **PREPARAÇÃO DOCUMENTAL / NÃO EXECUÇÃO**. Este texto documenta um inventário GitHub e uma exigência futura de prova; **não é certificado de go-live, CI green, F04 live, Entra, AM ou Azure**.

## I. Certidão factual de hoje (sem assinatura fabricada)

| Campo | Valor auditável W1 |
|---|---|
| Escopo delegado | Agente A9 / W0–W1; `sf/proofs/**` (documentação), sem mutação do código A5/A7/A8/A10 |
| Fonte de lease | `sf/ci/GPT-PLAN-10.md`, seção Agente A9; `validation/final-bundle/dispatch-agent.md` e `gpt-plan-001-brief.md` |
| Ref de leitura inicial | `sfa-f04@b889ccd518cc80b57037aa8bde09a56238bf5494`; SHA normativo dos documentos depende do ref |
| Inventário CI | 8 IDs presentes em `sf/ci/suites.json` e `script/sf2h/final-bundle/requests.json`; último marcado `PREPARED_NOT_RUN` e `candidate_C: null` |
| Inventário F04 | `transport-integration.test.ts`: 3 negativos release-only; `u39.spec.ts`: 22 testes; `u40.spec.ts`: 22; fontes lidas, execução não realizada |
| Inventário AM | seis pastas; 19 arquivos de teste .test.ts + 2 helpers; 1 arquivo AM05 exclusivo de A5 |
| Gate Azure conhecido | `sf/release-target.json`: `activation.status=BLOCKED`; cloud foundation não equivale a app deployado |
| Candidate C instalado | **NÃO APRESENTADO**; o SHA inicial deste branch NÃO é candidato homologado |
| VM Linux + app/HTTPS | **SEM WITNESS** (A7/dono) |
| Entra/OIDC e atores autenticados | **SEM WITNESS** (A8/dono) |
| F04 manifest 0600/root 0700, CDP privado e selected bundles | **NÃO APRESENTADOS** |
| Oito receitas em mesmo C | **NÃO EXECUTADAS** |
| Q01 F04 e U39/U40 reais | **NÃO EXECUTADOS** |
| AM01–AM06 nativos no C | **NÃO EXECUTADOS** |
| Backup/restore/rollback Linux | **NÃO EXECUTADO** |
| RUN_ID / ATTEMPT / job IDs de prova Azure | **NÃO EXISTEM NESTA CERTIDÃO** |
| Reviewers independentes / aprovação humana | **NÃO APRESENTADOS** |
| Veredicto W1 | **MATRIZ + PLANO PREPARADOS; AZ-04/05 = BLOCKED_BY_ENV; AZURE_RELEASE_QUALIFIED = BLOCKED** |

Nenhum elemento acima pode ser preenchido com logs de PR, strings auto-geradas, instâncias locais, simulação de sessão, status histórico de outro SHA ou afirmação de que “não falhou”. Dois Q01 portáteis pertencem ao PR, não dão status às três negativas F04. Os testes sintéticos dos correlators AM04/AM06 provam recusa e congruência estrutural, não autorizam atestação.

## II. Cartão de pendências e handoff explícito

| Identificador | Situação atual | DRI que deve entregar | Item mínimo que desbloqueia |
|---|---|---|---|
| AZ-04 / F04 negativas | BLOCKED_BY_ENV | A7+A8, dono da VM/tenant; A9 executa depois | app de C em VM, origin real, actors, manifest privado e CDP host |
| U39/U40 live | BLOCKED_BY_ENV + dependência A5 | A5 código X/Y/Z; A8 auth; A7 host; A9 executa | specs revisadas, duas seleções originais CAP04/05, 44 casos |
| AZ-05 / AM01–AM06 | BLOCKED_BY_ENV | A7+A8+A9; A10 recebe | ambiente, 6 witnesses completos, seleção/dispatcher real, C único |
| 8 recipes B3/CI-04 | BLOCKED_BY_SOURCE para equivalência histórica; execução C NOT_RUN | A6 equivalência e freeze; A2 receipts | fontes normativas rastreadas, 8 receipts CI de C, sf/verify real |
| Linux restore/rollback | BLOCKED_BY_ENV | A7 | snapshot/restore e prova de resiliência efetivos em VM |
| Freeze C / go-live / required checks | BLOCKED_BY_OWNER | A10 + proprietário; A1 cold review | release artifact, review 3×, owner approval e checks protegidos |

**Escalada:** um erro de fixture U39/U40 ou `am05/sequence-integrity216.test.ts` é chamado ao **A5**, jamais corrigido pelo A9. Identidade/host: A8/A7. Gates YAML: A6; manifesto/receipts: A2. Release: A10. Sem transferência de lease registrada por A1, nenhum write cruzado.

## III. Formulário único de certificado FUTURO — um registro por prova

Preencher **somente** após execução real observada e revisão independente. Placeholders `NÃO_DISPONÍVEL` invalidam um certificado PASS. Identidade e dados sensíveis devem ser referenciados por hash/URI privada, nunca reproduzidos em texto público.

```text
schema: sf.f04-am.proof-certificate.v1   # formato documental proposto, não schema runtime existente
certificate_id: <unique id>            # NÃO ATRIBUÍDO
proof_id: <CI-ID | Q01-negative-ID | U39 | U40 | AM01..AM06 | AZ03-RESTORE>
status: <NOT_RUN | BLOCKED_BY_ENV | BLOCKED_BY_OWNER | BLOCKED_BY_SOURCE |
         RED_PRODUCT | RED_HARNESS | PASS>   # PASS proibido sem witness
candidate_sha: <C-40hex>               # obrigatório se PASS
checkout_sha: <40hex>                  # deve ser exatamente C
effective_github_sha: <40hex>          # explicitar merge-ref vs HEAD
tree_sha: <40hex>
immutable_artifact_sha256: <64hex>
installed_artifact_sha256: <64hex>
source_ref_and_path: <ref/path>
source_file_blob_sha: <40hex>
run_event: <workflow_dispatch | pull_request | environment protected run ...>
workflow_name: <id>
workflow_run_id: <integer>
workflow_run_attempt: <integer>
workflow_job_id: <integer>
runner_os_arch: <Linux/X64>
tool_versions: <bun/node/host/scanner/Playwright actual>
started_utc: <ISO8601>
finished_utc: <ISO8601>
selection_declared: <files/test IDs>
selection_observed: <files/test IDs, execution counts>
executed_count: <integer > 0>
skip_count: 0
retry_count: 0
exit_code: 0
job_conclusion: success
original_producer_observation: <opaque restricted evidence ref + SHA256>
actor_authorization_observation: <opaque restricted evidence ref + SHA256>
negative_proof: <case, observed denial, source/witness ref>
positive_proof: <source, actual effect/no-effect, witness ref>
task_permission_relay_skill_witness: <source IDs/digests, not credentials>
restart_restore_correlation: <id+digest; mandatory where applicable>
sanitized_evidence_uri: <restricted opaque pointer>
sanitized_evidence_sha256: <64hex>
confidential_raw_evidence_location: <vault pointer, ACL + retention>
author: <identified executor>
independent_reviewer: <different actual person>
review_ref_and_disposition: <signed review id + no BLOCKER>
owner_authorization_ref: <actual approval, if release>
verdict_reason: <explanation; all fields validated>
```

**Invariantes de validação:** (a) prova pertence ao mesmo C/tree/artifact instalado; (b) runner Linux/X64 e identidade de run/attempt/job reais; (c) todos casos obrigatórios selecionados/executados, nenhum retry/skip/todo oculto; (d) digest SHA256 recalculado em material bruto retido; (e) original producer, principal autorizado e fonte CAS/versão/proveniência independentes; (f) negativos provam DENY sem novo efeito e positivos provam efeito realmente autorizado; (g) review independente não é o author; (h) witness de skill/Task/Permission/Relay presente onde exigido. Campo obrigatório ausente => BLOCKED/NOT_RUN/REJECTED, **nunca PASS**. Um resultado CORRELATABLE/CORRELATED_NOT_ATTESTED não eleva status.

## IV. Manifesto final de lotes — todos explicitamente não executados

| Família | Certificados individuais esperados | Quantos apresentados aqui como PASS |
|---|---|---:|
| CI Linux | CI-SF, CI-CLI, CI-APP-SRC, CI-APP-BROWSER, CI-ATLAS-BUSINESS, CI-UI-OPERATIONS, CI-UI-DECISIONS, CI-UI-REPORTS; mais sf/verify vinculado | **0/8** (+verify NÃO PROVADO) |
| F04-Q01 | TRANSPORT-GUEST, TRANSPORT-INVALID-OWNER, TRANSPORT-STALE-FENCE | **0/3** |
| Installed journeys | U39 CAP04 (22 casos), U40 CAP05 (22 casos) | **0/2** |
| Native acceptance | AM01, AM02, AM03, AM04, AM05, AM06 | **0/6** |
| Linux data | AZ03-RESTORE + rollback + restart com confirmação A7 | **0/1** |
| Independent reviewers | 3 pareceres frios de A1/A10 | **0/3** |

**Propriedade de emissão:** A9 redige a prova, A1 controla reviewers, A10 recebe e decide se o pacote está completo para submeter ao dono. O proprietário humano controla go-live e branch protection; nenhum certificado desta W1 autoriza atualização de `sf-release.yml`, `sf/release-target.json` ou required checks.

## V. Fontes de leitura e documentação entregue

- `validation/final-bundle/dispatch-agent.md` no branch A9 — autoriza draft PR A9→`close-final-candidate` e obriga relatório do run.
- `validation/final-bundle/gpt-plan-001-brief.md`; `sf/ci/GPT-PLAN-10.md` contrato A9 e locks.
- `sf/ci/PENDING-WORK.md` §6 AZ-01..08; `sf/ci/README.md`; `sf/ci/suites.json`; `script/sf2h/final-bundle/requests.json`; `.github/workflows/sf-ci.yml`; `sf/release-target.json`.
- `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts`; `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts` e `u40.spec.ts`; `fixture/readiness.ts`, `fixture/selected-installation.ts`, `fixture/installed-browser.ts`.
- `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/**` até `am06/**`; `script/sf2h/proofs/am04/correlate.ts`.

**Fim da certidão W1:** PREPARED_NOT_EXECUTED. O PR draft e seus jobs medem somente o diff desta documentação. Nada aqui conclui AZ-04 ou AZ-05.
