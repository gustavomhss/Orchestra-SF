# A9 / F04–AM | Matriz de cobertura e dependências (W0/W1)

**Emissão:** 2026-11-16; **branch:** sfa-f04; **fonte examinada:** sfa-f04@b889ccd518cc80b57037aa8bde09a56238bf5494. **Natureza:** inventário de fonte e desenho de prova, NÃO certificado de execução. **AZ-04: BLOCKED_BY_ENV; AZ-05: BLOCKED_BY_ENV; U39/U40 LIVE: NOT_RUN; AM01–AM06: NOT_RUN.** C congelado, artifact deployado, RUN_ID, witness e assinatura: **NÃO APRESENTADOS**. Atualizar contra um novo C por leitura e revalidação; nunca preencher PASS retrospectivamente.

## 1. Fronteiras, pré-condições e donos

| Porta | Dependência real / quem destrava | Situação W1 | Rejeitar como prova |
|---|---|---|---|
| C único e imóvel, HEAD/tree/digest | A10 (freeze), A6 (integração); dono do merge | BLOCKED_BY_OWNER | HEAD de branch móvel, PR merge SHA ≠ C, resultado de outro SHA |
| CI de oito receitas (mesmo C) | A2 manifesto/recibo, A6 workflow/equivalência, A1 revisão | NOT_RUN para C | Verde de uma seleção vazia, `sf/verify` isolado, logs herdados |
| VM Linux x86_64 + app Web real em HTTPS | A7 AZ-01/03 e dono da infra Azure | BLOCKED_BY_ENV | Caddy 503/foundation, devserver ou container local |
| Microsoft Entra/OIDC + sessão real, binding e 4 atores | A8 AZ-02; dono libera tenant/usuários/permissões | BLOCKED_BY_OWNER | role flag, storageState inventado, bearer/token em fixture ou screenshot |
| Manifest F04 `sf2h.native-installed-manifest.v1` | Instalador autorizado na VM, A7/A8; A9 apenas verifica | BLOCKED_BY_ENV | arquivo produzido à mão, `GITHUB_ACTIONS=true` forjado, symlink ou 0644 |
| U39/U40 source livre de X/Y/Z e selecionadores | A5 único editor das specs/selected-installation | BLOCKED_BY_OWNER (handoff A5 pendente) | alterar specs A5, silenciar typecheck, executar contra contexto falso |
| Backup/restore e rollback persistente Linux | A7 AZ-03; A9 consome witness | BLOCKED_BY_ENV | `parity-pitr.test.ts` local macOS como evidência Azure |
| Artefatos privados + reviews independentes | A10 evidência/release, A1 3 revisores, dono aprova | NOT_RUN | recibo autoassinado pelo autor ou screenshot que expõe sessão |

**Leases A9 (exclusivos):** `sf/proofs/**`; `script/sf-release-proofs/**`; `validation/azure-proofs/**`; `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts`; `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/**` até `am06/**`, **exceto** `am05/sequence-integrity216.test.ts` (A5). Nesta W1 somente documentação de preparação sob `sf/proofs/**`. **Read-only:** `u39.spec.ts`/`u40.spec.ts`/`selected-installation.ts` (A5), `readiness.ts` (A8), `parity-pitr.test.ts` (A7), manifesto CI (A2), workflow CI (A6), release (A10), todos os paths protegidos.

## 2. Matriz de oito receitas CI — identificadores normativos, não resultados

O catálogo de IDs, pacotes e seleções tem origem em `script/sf2h/final-bundle/requests.json` (status literal `PREPARED_NOT_RUN`, `candidate_C: null`) e `sf/ci/suites.json`. O segundo limita CLI/Atlas e exclui F04 da seleção PR; A6 é dono da revisão de equivalência entre as representações. É proibido declarar que o snapshot histórico foi executado no novo C.

| ID | Classe | Fonte/seleção no CI Linux atual | Witness exigido no C | Resultado W1 |
|---|---|---|---|---|
| CI-SF | Bun | `modules/sucafina`, suíte produto completa exceto release-only `parity-pitr.test.ts` | job `sf/test-CI-SF`; seleção, report e receipt; contagem >0 | NOT_RUN |
| CI-CLI | Bun | `apps/cli`, 12 arquivos explicitamente manifestados | `sf/test-CI-CLI`, negativos de host/política, receipt | NOT_RUN |
| CI-APP-SRC | Bun | `packages/app-shell`, `src` | `sf/test-CI-APP-SRC`, receipt e execuções reais | NOT_RUN |
| CI-APP-BROWSER | Bun | `test-browser/sucafina-native`, exclui release-only `transport-integration.test.ts` | `sf/test-CI-APP-BROWSER`, 2 Q01 portáteis mantidos, receipt | NOT_RUN |
| CI-ATLAS-BUSINESS | Bun | `modules/atlas/boundary`, 4 arquivos explícitos | `sf/test-CI-ATLAS-BUSINESS`, receipt + generated static gate | NOT_RUN |
| CI-UI-OPERATIONS | Playwright | `e2e/sucafina/operations.spec.ts`, config produção | `sf/test-CI-UI-OPERATIONS`, seleção/lista e report | NOT_RUN |
| CI-UI-DECISIONS | Playwright | `e2e/sucafina/decisions.spec.ts`, config produção | `sf/test-CI-UI-DECISIONS`, seleção/lista e report | NOT_RUN |
| CI-UI-REPORTS | Playwright | `e2e/sucafina/reports.spec.ts`, config produção | `sf/test-CI-UI-REPORTS`, seleção/lista e report | NOT_RUN |

**Regra única de vínculo:** para toda linha, exigir mesmo `sourceSha = checkoutSha = C`, SHA de árvore, workflow efetivo, `GITHUB_RUN_ID/GITHUB_RUN_ATTEMPT`, job ID, Linux/X64, report SHA256, test-file IDs, número de casos realmente executados e exit 0. Gate final: `sf/preflight` + `sf/static-and-contracts` + `sf/linux-native-omni` + 5 Bun + 3 UI + `sf/verify`, **12 jobs** reais. Para PR o `github.sha` pode ser o merge ref; não equiparar ao head C sem verificação. Se um item não é success, CI do C não é PASS. GitHub PR CI pode verificar código, mas não qualifica a VM.

## 3. F04 — três negativas Q01 e jornadas instaladas

Manifesto: valores reais de `target`, `wrongServer`, `wrongProject`, `wrongInstallation`, atores requester/holder/denied/(dashboardAdmin) distintos, `candidateSha=C` de 40 hex; `scratchRoot` absoluto 0700 sob usuário efetivo, manifesto regular 0600 no root, sem symlink, origin HTTPS, owner/installation/project/host e capítulo originais. O instalador — não A9 — deve criar os arquivos; `readNativeManifest` valida schema, propriedade e candidate contra `SF_NATIVE_CANDIDATE_SHA`.

| Caso em `transport-integration.test.ts` | Fronteira observada | Negativa obrigatória | Status |
|---|---|---|---|
| Q01-TRANSPORT-GUEST | GET real a `{mount}/api/ui/context`, sem cookie | 401/403, sem redirecionamento de autorização | BLOCKED_BY_ENV |
| Q01-TRANSPORT-INVALID-OWNER | GET real com `projectId` duplicado e sem actor | NÃO 200; somente 400/401/403/404/409 | BLOCKED_BY_ENV |
| Q01-TRANSPORT-STALE-FENCE | Cliente real com geração obsoleta, fetch que lança se invocado | `transport-error/contract-mismatch`; networkCalls = 0; **prova de preflight local**, não terceira chamada remota | BLOCKED_BY_ENV |

As duas verificações Q01 portáteis em `transport-contract.test.ts` são de A4 e permanecem no PR. As três acima são release-only e não são qualificadas por sucesso do PR.

| Jornada | Selector e contratos de fonte | Cobertura em source (inventário, NÃO execução) | Pré-condições adicionais | Estado |
|---|---|---|---|---|
| U39 | `e2e/sucafina/native/journeys/u39.spec.ts`; CAP04/OPEX Detail | 22 testes nomeados: leitura, draft/review, source CAS CRUD/mensal, 12 parcelas, desvios, estado empty/not-found, readonly/denied, revogação, 409, held/lost response, cross-installation, acessibilidade | Binding CAP04 e selected suite privados no mesmo browser context; A5 remove cast artificial | NOT_RUN / BLOCKED_BY_ENV |
| U40 | `e2e/sucafina/native/journeys/u40.spec.ts`; CAP05/CAPEX Projects | 22 testes nomeados com mesmas famílias de garantia adaptadas a CAP05 | Binding CAP05 independente e selected suite privados; A5 corrige fonte; não reaproveitar `chapterHref` de CAP04 | NOT_RUN / BLOCKED_BY_ENV |

Prova observável: `requireNativeJourney`/`observeNativeBinding` retornando principal corrente e política/acesso do produtor; source original e operações prontas; respostas reais de autorização/CSRF/CAS/revogação; nenhuma autorização pelo botão, nenhuma requisição de mutação antes de confirmação humana; não exportar cookie/token/storage state. Falha de X/Y/Z vai ao A5. Falha de identidade vai ao A8. Falha de deploy vai ao A7.

## 4. AM01–AM06 — arquivo/caso/revisor por contrato

Inventário da pasta `modules/sucafina/Sucafinav1/test/product/integrated-proofs/` em `sfa-f04`: **19 arquivos `*.test.ts` (18 em lease A9, um de A5) e 2 helpers `*.ts`**. Os arquivos de teste podem exercer contratos locais, simulações NEGATIVAS ou correlação sem atestação; sua aprovação unitária **não** autoriza AM LIVE. A suite AM completa exige witness externo e avaliação independente no mesmo C.

| AM | Arquivos de teste da fonte (sem esconder exclusões) | Aceite live adicional e verificável | Status W1 |
|---|---|---|---|
| AM01 | `hypothetical-closure212.test.ts`; `portfolio-recall-proof.test.ts`; `recall-five-profiles.test.ts` | 5 perfis residentes reais, recall por cada perfil; persistência/reopen das cinco saídas; observação vs hipótese não aplicada, sem grant inventado | NOT_RUN |
| AM02 | `forecast-domain-correlation.test.ts`; `performance-public-c16-reopen.test.ts` (helper `observe-native-c16.ts`) | UI + agent/MCP C16 em fonte/digest congruentes; completed provider messages reais e receipts de ToolState; 3 portas/outputs após restart, witness de transporte independente (não inferir de helper) | NOT_RUN |
| AM03 | `correlation.test.ts`; `functional-boundaries.test.ts`; `provider-generation.test.ts` | sessão/revogação por principal; cross-principal e generation/host-restart fail-closed; descoberta pública não concede capacidade; evidence hosted original | NOT_RUN |
| AM04 | `correlation-gate.test.ts`; `domain-recovery-functional.test.ts`; `receipt-key-collision.test.ts` | human choice e grant separados, scanner/model reais, receipt e domain write atômicos, perda de resposta→reopen→reconcile sem segundo efeito; correlator `CORRELATABLE_NOT_ATTESTED` **não é PASS** | NOT_RUN |
| AM05 | `authorized-original-replay.test.ts`; `c08-rollback.test.ts`; `scanner-write-gates.test.ts`; **`sequence-integrity216.test.ts` (A5, read-only)** | scanner real gitleaks clean/hit/timeout/missing; nenhum append na recusa; C08 rollback e replay com mesmo digest/sem duplicação; ordinais do journal/reopen, provenance; pendência A5 | NOT_RUN / BLOCKED_BY_OWNER (A5) |
| AM06 | `correlate.test.ts`; `native-terminal-unavailable.test.ts`; `reentry-fence.test.ts`; `schedule-native-retry.test.ts` (helper `correlate.ts`) | publicação pin C07; prepare/run/status/result nativos reais, skill sf-preparar-revisao-executiva, 5 calls C07 correlatas, Brief persistido e consumido; correlator `CORRELATED_NOT_ATTESTED` **não é PASS** | NOT_RUN |

Para cada AM registrar explicitamente: arquivos e contagem de testes selecionados, 0 ignored/skipped/todo, resultados concretos, artifact SHA256, C/tree, run+attempt, job, origem dos atos/model/Relay/Task/Permission/host, identidade de principal, receipt original (digest), reabertura pós-restart, segregação de testemunhas e parecer nominativo. A10 recebe apenas pacote minimizado revisado; logs privados ficam em storage restrito. A5 preserva posse de `am05/sequence-integrity216.test.ts` — A9 não edita nem "corrige" esse teste.

## 5. Classificação de bloqueio e regra de encerramento

- **BLOCKED_BY_ENV (A7/A8 + dono):** VM app, origens reais, sessão Entra, instalado F04/atores/priv-root, restore Linux, runner protegido e artifacts sob ACL. Nenhum teste live disparado por A9 nesta wave.
- **BLOCKED_BY_OWNER (A5/A10 + dono):** PR240 X/Y/Z, congelamento/integração e autorização de deploy; settings/approvals não são ação A9.
- **BLOCKED_BY_SOURCE (A6):** reconciliação histórica `ci-recipes.json` mencionada no brief mas ausente na foto do plano; não inventar seus bytes ou declarar equivalência até A6 resolver com proveniência. Fonte de 8 IDs atual verificada em `requests.json` e `suites.json`.
- **NOT_RUN:** todas as linhas de aceite live; documentação W1 NÃO produz recibo.
- **PASS somente após W4:** todos os 8 CI jobs de C com `sf/verify`, 3 Q01 F04, U39/U40 (22+22 selecionados, execução real), 6 AM independentes, backup/restore/rollback Linux, evidência revisada e autorização do dono. Novo commit/artefato/config/identidade material invalida qualificação e exige novo C.

**Referências verificadas (read-only):** `sf/ci/GPT-PLAN-10.md` §0–5/A9; `sf/ci/PENDING-WORK.md` §6; `sf/ci/suites.json`; `script/sf2h/final-bundle/requests.json`; `.github/workflows/sf-ci.yml`; `sf/ci/README.md`; `packages/app-shell/e2e/sucafina/native/fixture/readiness.ts`; `transport-integration.test.ts`; `u39.spec.ts`/`u40.spec.ts`; source AM01–AM06 sob `integrated-proofs`.
