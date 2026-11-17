# GPT-PLAN-10 — plano executável de 10 agentes para o go-live Orchestra-SF

**Controle:** plano de execução, NÃO aceite técnico nem autorização de deploy. Elaborado a partir do branch `gpt-plan-001@97944f7733e19860704d81badb67b3cf32976b42`, filho de `sf-ci-lean@2f94d74d50dceee8a3c0562feac27a7335171ae8`, em 2026-11-16. A execução futura NÃO ocorre neste branch de planejamento. **Status factual inicial:** `CI_HARNESS_VALIDATED=PARTIAL`; `PRODUCT_CI_GREEN=NO`; `AZURE_RELEASE_QUALIFIED=BLOCKED`. Não há evidência de go-live. Os SHAs e estados abaixo são snapshots do brief e de documentos do branch, não uma promessa de que refs remotas permanecerão imóveis.

## 0. Constituição operacional, inalterável

1. **Produto e arquitetura:** aplicação **Web** acessível pelo navegador, host/runtime nativo **Linux x86_64** em VM Azure, login real **Microsoft Entra/OIDC**. Navegador no Windows/macOS continua em escopo Web. Desktop/Electron como entrega, instaladores, guests Windows/MUSL, build cross-OS/ARM64 e matrizes canônicas não são condições do go-live SF. **Não apagar código compartilhado só por mencionar outra plataforma.**
2. **Invariantes de segurança/produto:** Task, Permission, Relay, Omni Linux nativo, admissão sf-native, autorização da fonte/origem, owner/projeto/instalação, CAS/drafts, revogação, proveniência de issuer e aprovação humana. Nenhuma substituição por mocks de autenticidade, cookies/tokens no renderer, CORS aberto, assert enfraquecido, retry oportunista, `any`/`ts-ignore`, `continue-on-error`, `--pass-with-no-tests`, skip aprovado, recibo sem execução ou verde por ausência de falha.
3. **Proteção especial:** `script/godfile.ts`, `script/spawn-imports/**`, `script/guards/**` e `godfile-waivers.json` são **NO-TOUCH** por todos os dez agentes. Qualquer mudança excepcional exige PR **separado**, aprovação explícita do mesmo dia por pessoa com write access e label `guardrail-approved`, verificada por proprietário; um label num PR anterior não autoriza mutações futuras. Nunca injetar `GUARDRAIL_APPROVED` para autoaprovar.
4. **Três marcos independentes:** (a) `CI_HARNESS_VALIDATED` = controles negativos, inclusão, cobertura, integridade, equivalência e revisão no SHA real; pode coexistir com produto RED; (b) `PRODUCT_CI_GREEN` = static + Omni + preflight + **oito suites completas** + `sf/verify=success` **no SHA exato**; (c) `AZURE_RELEASE_QUALIFIED` = mesmo candidato C + artefato imutável/digest + Azure real + Entra/origem + persistência/restore/rollback + F04 + AM01–AM06 + revisão independente. Uma flag não infere a seguinte.
5. **Regra de evidência:** para PR, `github.sha` pode ser o **merge ref**, diferente do HEAD do PR. Registrar sempre `head_sha`, `github.sha` efetivamente testado, `HEAD^{tree}`, run ID/attempt, job ID, comandos/exit codes, runner Linux/X64, artifact IDs e SHA256. Um novo commit de código, config, workflow, teste ou input normativo invalida a qualificação anterior; reexecutar a seleção exigida.
6. **Regra de bloqueio:** ambiente Azure, atores reais, 403 de ruleset e aprovação/merge são dependências de pessoas autorizadas, não tarefas a serem fingidas. `BLOCKED_BY_OWNER` / `BLOCKED_BY_ENV` / `RED_PRODUCT` / `RED_HARNESS` / `NOT_RUN` são estados válidos; `PASS` exige observação positiva.

## 1. Fontes, fotografia e lacunas de provenance

**Lidas em `gpt-plan-001`:** `validation/final-bundle/gpt-plan-001-brief.md`; `sf/ci/PENDING-WORK.md`; `validation/final-bundle/gpt-review-pr242.md`; `validation/final-bundle/gpt-review-pr240.md`; `.github/workflows/sf-ci.yml`, `sf-release.yml`, `test-ci.yml`, `sf2-epic.yml`; `script/sf-ci/gate.mjs`, `gate.test.mjs`; `sf/ci/suites.json`, `README.md`, `CI-CLOSURE.md`; `sf/release-target.json`; `script/sf2h/final-bundle/verify-e2e-typecheck.mjs`, `requests.json`, `validate-requests.mjs`, `README.md`; `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts` e `packages/app-shell/e2e/sucafina/native/fixture/readiness.ts`. Foram listadas as árvores reais dos diretórios de testes, host e UI para impedir ownership inventado.

**Não disponíveis no branch consultado (GitHub contents 404; listagem de diretório confirmou ausência):** `modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json` (nem `sf2h-plan/ci-recipes.json`); `validation/final-bundle/ci-round-10-13-digest.md`, `evidence-template.md` e `installed-proof-checklist.md`. O brief menciona estes arquivos, mas **não** são provas lidas. Há `script/sf2h/final-bundle/requests.json` com as oito receitas históricas, marcado `PREPARED_NOT_RUN`; **não é automaticamente substituto equivalente** do `ci-recipes.json`. F deverá recuperar a versão histórica por ref verificável **ou** reconstruir uma matriz derivada de `requests.json` + `sf2-epic.yml` + testes/contratos efetivos, com proveniência e revisão fria, antes de aprovar B3/CI-04. J produzirá os três documentos de evidência **a partir de observações**, não alegará que já estavam publicados.

**Snapshot do brief (revalidar com GET antes de agir):**
- `close-final-candidate@1cb77b8deb` e `sf2-epic-c@1cb77b8deb`; Epic de 47 jobs teve falhas, nunca foi substituído com segurança.
- `sf-ci-lean@2f94d74d50` / PR **#242 DRAFT**, não contém `1cb77b8deb` nem fix `524f6ed87e` do Planner; contém fix E2E `ae7850a7e3`. `sf/verify` não provado verde.
- `close-tests-fixes@a2c49fc8` / PR **#240 DRAFT**, revisão fria **CHANGES REQUIRED** (X, Y, Z).
- `godfile-waivers@2e1cee39a1` / PR **#243 DRAFT**, descrito como mergeable e com `guardrail-approved` em 2026-11-16, **ainda não mergeado**; aprovação/ordem/merge finais exclusivamente do dono, não é dependência de CI/SF.
- Commits mencionados como locais: `6f3dcd7a20` (coverage `GET /api/sucafina/installations`) e `0fca277369` (waivers; #243 contém cherry-pick correspondente). **Não presumir acessibilidade remota ou cherry-pick novo**; inspecionar ancestralidade/diff depois de publicação.
- Run histórico `43956369500`: preflight/Omni/CLI/APP-SRC/ATLAS observados PASS; static TS2322 em Planner, SF/APP-BROWSER/OPERATIONS/DECISIONS RED; Reports `IN_PROGRESS` à coleta; `sf/verify` ainda não provado. Não reutilizar estes resultados para C, nem atribuir conclusão à Reports sem consulta atual.
- `sf/release-target.json`: VM/fundação `azure-hardening@22d8da9948810562deed2b051d4903d80d6f2370` NÃO é aplicação instalada; `activation.status=BLOCKED`. Branch protection consultada pela integração retornou 403; **nenhum required check foi migrado**.

## 2. Regra formal de propriedade e colaboração

**Dez workstreams, exatamente A1–A10.** Exclusividade vale para **edições**, não para leitura ou execução. Cada agente cria commits/PRs de implementação em branches de trabalho próprios **apenas quando o operador futuro os autorizar**; somente o integrador A6 movimenta a integração `close-final-candidate → sf-ci-lean`; o dono do repositório aceita merges finais. Não há dois agentes autorizados a escrever o mesmo path. Paths compartilhados são **READ-ONLY**: para modificar, pedir ao proprietário do lease uma alteração incorporada por ele, nunca um commit concorrente. A1 registra transferência excepcional **antes** da edição, com SHA/paths/owner anterior/novo; nenhum intervalo pode ter dois owners.

**Hierarquia de leases:** lista explícita/exceção vence prefixo amplo. Prefixos de arquivo terminados em `/**` incluem futuros filhos; os caminhos novos são *propostas de local*, nunca afirmação de que já existem. Alterações fora dos leases são bloqueadas até roteamento pelo A1. No congelamento C todos os leases de produto ficam fechados.

| Agente | Escreve EXCLUSIVAMENTE (ou coordena sem alterar código) | Lê, mas NÃO escreve | Dono principal |
|---|---|---|---|
| **A1 — coordenação/revisão** | `sf/ci/coordination/**`; `sf/ci/reviews/**` (ledgers novos) | Todos os PRs, runs, fontes, `PENDING-WORK.md` | CI-01, CI-10, CI-11, CI-12, #242/#240/#243 status, revisores |
| **A2 — manifesto/gate** | `script/sf-ci/**`; `sf/ci/suites.json`; `script/sf2h/final-bundle/verify-bun-report.py`; `.github/workflows/test-ci.yml`; `script/test-ci.ts`; `script/test-ci-request.ts`; `script/test-ci-location.ts`; `packages/core/test/test-ci-request.test.ts` | `sf-ci.yml` (A6), testes de produto (A3–A5/A8/A9) | CI-02/03/05/06/07/08, B2, M4 |
| **A3 — produto SF/Planner** | `modules/sucafina/Sucafinav1/test/**` **exceto** as exclusões de A5/A7/A9 descritas abaixo; `modules/sucafina/Sucafinav1/src/**` se presente; `packages/app-shell/src/orchestra/chapters/sucafina/planner/**` | Host/security (A8), harness (A2/A6), DOM/E2E (A4) | PROD-01, PROD-04 |
| **A4 — browser + jornadas UI** | `packages/app-shell/test-browser/sucafina-native/**` **exceto** `transport-integration.test.ts` (A9); `packages/app-shell/e2e/sucafina/{operations.spec.ts,decisions.spec.ts,reports.spec.ts}` e `{operations-support,decisions-support,reports-support}/**`; `packages/app-shell/src/orchestra/chapters/sucafina/{procurement,operations,decisions,reviews}/**` | Planner A3, host A8, F04 A9 | PROD-02/03/05/06/07 |
| **A5 — conserto PR #240** | **Exatamente os 11 arquivos do PR #240** enumerados no `5; prevalecem sobre prefixos A3/A9. | Suites e host de outros agentes, manifesto F04 (sem credenciais) | X, Y, Z tipagem/consumidores; U39/U40 como código |
| **A6 — integração CI/estático** | `.github/workflows/sf-ci.yml`; `script/sf2h/final-bundle/verify-e2e-typecheck.mjs`; `sf/ci/equivalence/**` (mapas de equivalência); **único operador do merge candidato→CI** | Gate A2; `sf2-epic.yml`, `requests.json`, `dev`, guard engine (somente leitura) | B1, B3, M2, M3, CI-04/09, merge 524f/1cb |
| **A7 — VM/dados Azure** | `sf/azure/{vm,runtime,data,recovery,runbooks}/**` (novos ou sobre fonte autorizada com lease transferido) | CI, host security A8, release workflow A10, fonte `azure-hardening` | AZ-01/03, backup/restore Linux, rollback de dados |
| **A8 — identidade/autorização** | `sf/azure/{identity,security}/**`; `packages/app-shell/src/orchestra/chapters/sucafina/host/**`; `packages/client/src/sucafina/transport*`; `apps/cli/src/sucafina-product/{host-context.ts,native-host.ts,native-identity.ts,native-execution.ts,routine-native-admission.ts,routine-native-origin.ts,routine-native-owner.ts,routine-native-phase-origin.ts,routine-native-phase-fence.ts}`; `apps/cli/test/{sucafina-host-context.test.ts,sucafina-installation.test.ts,sucafina-native-phase-wiring.test.ts}`; `packages/app-shell/e2e/sucafina/native/fixture/readiness.ts` | DOM/jornadas A4, specs U39/U40 A5, release A10 | AZ-02, security gates, guards/approvals como política; nunca editar paths protegidos |
| **A9 — F04/AM/live proofs** | `sf/proofs/**`, `script/sf-release-proofs/**`, `validation/azure-proofs/**`; `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts`; `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am0[1-6]/**` **exceto** `am05/sequence-integrity216.test.ts` (A5) | Specs U39/U40/fixture selected (A5), readiness (A8), Azure (A7), `sf-release.yml` (A10) | AZ-04/05, PROD-08 (F04+equivalência Linux), U39/U40 LIVE, AM01–06 |
| **A10 — release/evidências/owner liaison** | `.github/workflows/sf-release.yml`; `sf/release-target.json`; `sf/ci/{PENDING-WORK.md,README.md,RELEASE-ATTESTATION.md}`; `validation/final-bundle/{evidence-template.md,installed-proof-checklist.md,ci-round-10-13-digest.md}` | Todos os arquivos/fontes e ledgers A1; rulesets são **config externa do dono** | M1, CI-13/14/15, AZ-06/07/08, pacote final, required-check migration **sob aprovação do dono** |

**Exclusões precisas de A3:** `modules/sucafina/Sucafinav1/test/native-ui-contract/{memory.test.ts,operations.test.ts,reviews.test.ts}`, `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/native-fixture.ts` e `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am05/sequence-integrity216.test.ts` são A5; o resto de `.../test/product/integrated-proofs/am01/**` até `am06/**` é A9; `modules/sucafina/Sucafinav1/test/parity-pitr.test.ts` é A7 (read-only original salvo revisão excepcional autorizada; a prova Linux substitutiva pertence ao A7). A4 não edita `transport-integration.test.ts`. A9 executa `u39.spec.ts`/`u40.spec.ts` mas **não os edita**. A6 nunca edita `gate.mjs`/`suites.json`. A2 nunca edita `sf-ci.yml`. A7/A8/A9 nunca editam `sf-release.yml`/`release-target.json`; pedem ligação ao A10.

**Arquivos normativos compartilhados = leitura apenas:** `validation/final-bundle/gpt-plan-001-brief.md`, revisões PR240/242, `sf2-epic.yml`, `script/sf2h/final-bundle/requests.json`, `script/sf2h/final-bundle/validate-requests.mjs`, `AGENTS.md` e os quatro paths protegidos. Se uma falha exigir edição fora dos leases, **não improvisar**: A1 registra change request com owner único e bloqueio explícito. Alteração de guard implica trilha humana independente, não troca de owner automática.

## 3. DAG de integração e ordem de chegada

`S0 Inventário (A1) → F0 merge controlado (A6) → [A2 || A3 || A4 || A5 || A7 || A8] → A6 ligação final YAML + B1/B3/M2/M3 → A1 revisão independente → A10 freeze C e execução limpa das 8 famílias → [A7 aplicação VM + A8 Entra/origem sobre C] → A9 F04/U39/U40/AM01–06/restore sobre C → A10 revisão fria final + release protegido/rollback → DECISÃO DO DONO: gates e go-live.`

Em termos de waves, **paralelo real** só ocorre em leases disjuntos e sem execução sobre um candidato ainda mutável:

| Wave | Quem | Pré-condição e barreira | Sinal que autoriza avançar |
|---|---|---|---|
| **W0 — horas iniciais** | A1, A6(F0), A2(design), A3/A4/A5(triagem), A7/A8(preparo) | A1 obtém heads atuais; A6 é o **único** a integrar `close-final-candidate` em `sf-ci-lean` ANTES de qualificar CI; checa `1cb77b8deb` e `524f6ed87e` ancestrais; não tocar Epic. A1 aloca leases. | HEAD de integração identificado, diff limpo/sem conflito; PRs e blockers anotados |
| **W1 — implementação paralela** | A2 gate+manifest, A3 SF, A4 browser+3 journeys, A5 PR240, A7 infra, A8 auth; A6 B1/M2/M3 sem editar gate | A6 consome a interface de seleção/recibo definida por A2; A4 não edita U39/U40; A9 só prepara plano de prova, **não pode executar live** sem G/H/E. | Testes focalizados reais + negativos + PRs isolados, sem merges concorrentes |
| **W2 — convergência do CI** | A6 aplica integração YAML e equivalência; A1 conduz revisão fria; A2 valida receipt | Todas as mudanças aceitas em head candidato; CI-04/B3 **bloqueado** se receitas históricas não forem rastreáveis; B1/B2/M4 com contraprovas. PR #240 só após X/Y/Z; PR #243 é opcional/dono. | `CI_HARNESS_VALIDATED` só se auditado em SHA atual; produto ainda pode RED |
| **W3 — produto green / freeze** | A3/A4/A5 corrigem reds, A6 integra em ordem, A10 congela C, A1 coleta runs | Requalificar **depois de cada integração**; congelar apenas após fixes de produto e revisão do PR #242. Runner manual ou PR deve testar exatamente C, não merge ref diferente. | 12 jobs esperados completos, 8 recibos íntegros, `sf/verify=success`, head/tree/artifact match |
| **W4 — Azure/live qualificação** | A7 e A8 em paralelo na instalação/identidade; **depois** A9 | VM/app instalado, URL/HTTPS, storage/backup, Entra sessões reais, atores admitidos e origem validada; manifesto F04 0600 sob root 0700; candidato C e digests iguais. | F04 negativo/positivo, U39/U40, AM01–AM06, rollback/restore verificáveis, 3 revisores frios |
| **W5 — release** | A10; proprietário humano; A1 independente | Ambiente protegido e artefato imutável; nenhum outstanding finding; owner confirma rulesets (403 para app), autorização de deploy e plano de reversão. | `AZURE_RELEASE_QUALIFIED` por prova; **depois** required checks → `sf/verify` e aposentadoria do Epic em **PR separado** |

**Dependências delicadas:** A6(F0) → A3(PROD-01 reenquadrado como verificação do fix publicado); A2(B2) → A6(YAML consumer); A5(X/Y) → A9(U39/U40 live) e A10(Z); A7 + A8 + A5 → A9(F04/AM); A9 + A1(revisores) + A10(release workflow) → autorização humana; A10(CI-13) é **pré-condição** de CI-14/AZ-08, mas o dono — não um bot — muda o settings. Nunca confundir revisão CI da arquitetura com promoção do gate.

## 4. Manual comum: evidência, validação e sinalização

**Ambiente de execução autorizado para o time futuro:** checkout Linux x86_64 real com Bun/Node e GitHub Actions. Antes de qualquer teste, registrar:

```bash
git rev-parse HEAD
git rev-parse 'HEAD^{tree}'
git status --short
uname -sm
node --version
bun --version
```

No Actions, correlacionar explicitamente `GITHUB_SHA`, `GITHUB_RUN_ID`, `GITHUB_RUN_ATTEMPT`, `RUNNER_OS` e `RUNNER_ARCH` com checkout, `receipt.json`, `summary.json`/`report.json`, digest, job IDs, versão de ferramenta e seleção. Usar `gh run view RUN_ID -R gustavomhss/Orchestra-SF --json status,conclusion,headSha,event,jobs`, `gh run view RUN_ID -R gustavomhss/Orchestra-SF --log` e listagem de artifacts; guardar log bruto apenas em escopo restrito. Nunca anexar secrets, cookies, storageState, traces de atores ou stdout sensível ao pacote público. Reexecução em outro SHA = nova prova.

**DoD padronizado por tarefa:** (1) commit/diff apenas dos paths lease; (2) teste positivo concreto e negativo de falha relevante no Linux; (3) revisão do produtor original/contratos; (4) CI executado em C com ID/attempt/exit, sem cancelamento; (5) receipt+SHA256+contagem/identidade de testes sem skip; (6) revisor externo ao autor; (7) risco residual classificado e nenhuma falsa declaração `PASS`. Onde o produto não dispõe de ambiente verdadeiro, registrar `BLOCKED_BY_ENV` com o dono e procedimento, **não** trocar teste por simulação.

**Comando final de inspeção de integridade (A1/A10, no Actions real):**

```bash
node script/sf-ci/gate.mjs manifest
node --test script/sf-ci/gate.test.mjs
# A invocação "verify" EXIGE GITHUB_SHA/RUN_ID/RUN_ATTEMPT, SF_NEEDS_JSON
# e sf-ci-collected com os OITO artifacts reais da MESMA tentativa.
node script/sf-ci/gate.mjs verify
```

O `verify` isolado sem dados de Actions deve falhar: **isso é comportamento correto**. O sucesso não substitui Entra/AM/F04.

## 5. Workstreams — contratos individuais

### Agente A1 — orquestração, PRs, triagem, custo, revisão fria

- **Contexto:** guardião do mapa de leases, da fila de integrações e das decisões não delegáveis. Conduz PR #242 para revisão fria; PR #240 exige X/Y/Z; PR #243 tem label relatado, mas merge é discricionário do dono. Não faz merge nem edita produto.
- **Arquivos exclusivos:** `sf/ci/coordination/merge-ledger.md`, `sf/ci/coordination/dependency-ledger.md`, `sf/ci/reviews/ci-red-triage.md`, `sf/ci/reviews/performance.md`, `sf/ci/reviews/final-cold-review.md`.
- **Compartilhados READ-ONLY:** todos os PRs, logs, `sf/ci/PENDING-WORK.md`, YAML, manifest, bundle. Corrigir pela mão do owner A2–A10.
- **Grafo:** inicia W0; precisa de F0 para estado de código; recebe provas de A2–A9; A10 consome seu parecer antes de freeze/release.
- **Tarefas:** CI-01 inventariar **todos os jobs** do último run completo, CI-10 classificar **cada RED** `PRODUCT_BUG / TEST_FIXTURE / MISSING_REAL_ENV / CI_HARNESS` com arquivo/caso, CI-11 medir fila/Bun/build/Omni/unit/UI/wall-clock/runner-min e p50/p95 **após amostra suficiente**, CI-12 revisão fria do PR #242, concorrência/base e subcasos Q01; vigiar PRs #240/#243 sem executá-los. Solicitar 3 pareceres finais de pessoas distintas para A10; nenhum revisor é o autor do próprio patch.
- **Comandos de verificação (somente leitura):**

```bash
gh pr view 242 -R gustavomhss/Orchestra-SF --json number,state,isDraft,headRefOid,baseRefName,mergeStateStatus,statusCheckRollup
gh pr view 240 -R gustavomhss/Orchestra-SF --json number,state,isDraft,headRefOid,baseRefName,mergeStateStatus,statusCheckRollup
gh pr view 243 -R gustavomhss/Orchestra-SF --json number,state,isDraft,headRefOid,baseRefName,mergeStateStatus,labels
gh run view 43956369500 -R gustavomhss/Orchestra-SF --json status,conclusion,headSha,event,jobs
gh pr diff 242 -R gustavomhss/Orchestra-SF --name-only
```

- **DoD:** ledger com refs reais, owners únicos e SHA; tabela de 12 jobs (preflight/static/omni/5 unit/3 UI/verify) por run/attempt **sem `IN_PROGRESS` especulativo**; toda falha com dono/log/ação; equivalência revisada por independentes; consumo medido, p50/p95 `INSUFFICIENT_SAMPLE` se necessário. Se um PR não possui parecer ou autoriza proteção, marca `BLOCKED_BY_OWNER`, nunca aprova automaticamente.
- **Bloqueio/mitigação:** branches e jobs mudam durante a sprint. Reconsultar antes de integrar; A6 sozinho integra; owner sozinho aprova #243 e checks. Duplicação entre classificações eliminada pelo ledger único.

### Agente A2 — gate, seleção governada pelo manifesto, receipts, Linux-only

- **Contexto:** todos os oito IDs de `sf/ci/suites.json` são normativos. Seleção hoje é parcial: CLI/Atlas via manifesto, mas três E2E hardcoded em YAML; `countBunReport≥1` é insuficiente como prova de cobertura. `sf/verify` deve falhar antes de download quando upstream RED.
- **Arquivos exclusivos:** `script/sf-ci/gate.mjs`, `gate.test.mjs`, `sf/ci/suites.json`, `script/sf2h/final-bundle/verify-bun-report.py`, `.github/workflows/test-ci.yml`, `script/test-ci.ts`, `script/test-ci-request.ts`, `script/test-ci-location.ts`, `packages/core/test/test-ci-request.test.ts`. **Não editar `sf-ci.yml` (A6).**
- **Compartilhados READ-ONLY:** `.github/workflows/sf-ci.yml`, suites de produto e Q01; entregar a A6 o contrato do CLI de seleção + metadata.
- **Grafo:** W1 após F0; interface fechada com A6 antes de ligação YAML; seu teste negativo e contrato de evidence precedem `CI_HARNESS_VALIDATED`.
- **Tarefas:** CI-02 preflight independente Linux X64 e regressões do seletor; CI-03 precheck com upstream fracassado; CI-05/ B2 comando gerado de manifesto para **todas** as seleções, incluindo E2E, SF/APP-SRC/APP-BROWSER e exclusões release-only estritas; CI-06 binding recibos SHA256/run/attempt/runner/identidade/sem secrets; CI-07 bail de falha real/verde exaustivo; CI-08 sem OS fora do alvo/sem triggers duplicados; M4 travar suíte quase vazia com conjunto de **casos e arquivos coletados/executados** por família, baseline versionada e negative controls que removem arquivo/caso (contagem não basta). Preservar 6 AM como release-only.
- **Comandos:**

```bash
node script/sf-ci/gate.mjs manifest
node --test script/sf-ci/gate.test.mjs
(cd packages/core && bun test test/test-ci-request.test.ts)
# Dentro dos jobs reais: SF_SUITE_ID identifica o grupo, e "select",
# "release-only", "receipt" e "verify" recebem metadados Actions vinculados.
# Inspecionar os oito receipts de um run de C, não fixtures sintéticas.
```

- **DoD:** B2 negativo muda seleção do YAML ou tira caso obrigatório sem mudar manifest e o gate **falha**; arquivo novo em diretório admitido participa; JUnit/Playwright reconciliados por caso+arquivo com baseline do mesmo C; M4 falha com `product_executed=1` falsamente reduzido; zero/duplicado/skip/retry/cancelled/excesso de artifacts/digest/SHA/attempt/OS incorretos falham; status upstream `failure/skipped/cancelled/missing` produz `sf/verify=failure` com diagnóstico específico. Linux x64 em runner real, sem matriz Windows/macOS e sem “pass by timeout”.
- **Bloqueio/mitigação:** risco de drift YAML x manifest; A6 consome exclusivamente interface publicada e não mantém segunda lista; qualquer mudança de protocolo exige versionamento/teste negativo simultâneo. Prova de run real, não apenas `gate.test.mjs`.

### Agente A3 — SF unit real, Planner/CORES XLSX/OPEX

- **Contexto:** `PROD-01` TS2322 em `planner/overview/index.tsx:331` consta **corrigido** em `524f6ed87e` dentro de `1cb77b8deb`, ainda **sem lane fresca** na cabeça antiga do PR #242. `PROD-04` CI-SF viu Planner/charts/cores/XLSX/OPEX/browser private e bail cinco.
- **Arquivos exclusivos:** Planner UI `packages/app-shell/src/orchestra/chapters/sucafina/planner/**`; `modules/sucafina/Sucafinav1/src/**` se presente; `modules/sucafina/Sucafinav1/test/**` exceto A5/A7/A9 do mapa. **Não reabrir fix já aplicado sem reproduzir a falha em head atual.**
- **Compartilhados READ-ONLY:** gate/manifest A2, UI E2E A4, host/identidade A8, recibos A10.
- **Grafo:** depende de A6(F0); pode analisar em paralelo com A2/A4/A5; integração de correções antes de C; se bug for auth de host, transferir ticket ao A8.
- **Tarefas:** reproduzir por caso/log, separar falha de produto de fixture/happy-dom; consertar no produtor original preservando assertions/contabilidade/guardas. Provar `CI-SF` **inteira**, e `packages/app-shell` typecheck após o fix publicado. Verificar Excel/CORES/OPEX e orçamento com fixture real admissível, sem silencionar.
- **Comandos:**

```bash
(cd packages/app-shell && bun run typecheck)
(cd modules/sucafina && bun run typecheck)
(cd modules/sucafina && bun test --timeout 30000 --bail=5 --reporter=junit --reporter-outfile=/tmp/sf-ci-sf.xml --path-ignore-patterns=Sucafinav1/test/parity-pitr.test.ts)
```

- **DoD:** typecheck App e SF em C efetivo sem supressões; todos os casos de CI-SF selecionados reconciliados por identidade e PASS; regressões XLSX/OPEX/Planner positivas+negativas; não confundir `--bail=5` vermelho com suite verde. `parity-pitr.test.ts` **não** é contado PASS; sua substituição Linux cabe A7/A9.
- **Bloqueio/mitigação:** área ampla e falhas em runtime de A8; A3 não invade host. Red residual anotado A1 com owner, sem alterar CI para mascarar.

### Agente A4 — fixtures navegador Q01/Procurement e Operations/Decisions/Reports

- **Contexto:** `PROD-02` divergência registry/extensões/catálogo Q01; `PROD-03` revisão/source mutation/CAS 409/422/quarantine; `PROD-05` duas respostas Operations não equivalem ao 200 esperado; `PROD-06` timeout/locator Decisions; `PROD-07` Reports `locator.fill` 180s em run anterior, último status deve ser consultado.
- **Arquivos exclusivos:** `packages/app-shell/test-browser/sucafina-native/**` **menos** `transport-integration.test.ts` (A9); `packages/app-shell/e2e/sucafina/{operations.spec.ts,decisions.spec.ts,reports.spec.ts}` e seus três diretórios `*-support/**`; UI `chapters/sucafina/{procurement,operations,decisions,reviews}/**`.
- **Compartilhados READ-ONLY:** `route-registry.ts`, schema/operation-registry, Planner A3, host A8, F04 A9, U39/U40 A5.
- **Grafo:** W1 em paralelo a A3/A5; depende de A8 quando erro tem origem autorizativa, de A2 para cobertura coletiva; entrega antes de C.
- **Tarefas:** comparar catálogo congelado com registry e extensões sem ajustar baseline arbitrariamente; testar producer e autorização originais; corrigir fixtures que esperavam 200 quando produto corretamente devolve 401/403/409/422 sem mudar contrato. Remover flakiness pela causa, não por aumentar timeout/retries. Manter dois Q01 portáteis vivos e os três F04 negativos separados, não aprovar o segundo como CI.
- **Comandos:**

```bash
(cd packages/app-shell && ORCHESTRA_OMNI_CONTROL=declared GITHUB_ACTIONS=false bun test --conditions=browser --preload ../../script/test-omni-control.ts --preload ./happydom.ts ./test-browser/sucafina-native --path-ignore-patterns=test-browser/sucafina-native/transport-integration.test.ts --bail=5)
(cd packages/app-shell && bun run test:e2e:local e2e/sucafina/operations.spec.ts --config e2e/playwright.production.config.ts --workers 1 --retries 0 --max-failures=2)
(cd packages/app-shell && bun run test:e2e:local e2e/sucafina/decisions.spec.ts --config e2e/playwright.production.config.ts --workers 1 --retries 0 --max-failures=2)
(cd packages/app-shell && bun run test:e2e:local e2e/sucafina/reports.spec.ts --config e2e/playwright.production.config.ts --workers 1 --retries 0 --max-failures=2)
```

- **DoD:** `CI-APP-BROWSER` e `CI-UI-OPERATIONS/DECISIONS/REPORTS` têm quatro reports **frescos e completos** no C; Q01 registry/rotas e drafts negative cases mantêm proteção; validação de locator inclui transição de estado e recibo real, não visibilidade isolada; nenhum `timeout/skip/retry` introduzido para passar. Sem inferência do `IN_PROGRESS` de Reports.
- **Bloqueio/mitigação:** defeito de origem ou authorization remete A8, defeito de Planner A3; A4 fornece reprodução e NÃO escreve arquivo do parceiro.

### Agente A5 — revisão e reparo de PR #240 (X/Y/Z)

- **Contexto:** revisão do PR #240 observou 11 arquivos; **CHANGES REQUIRED**, não merge as-is. X = union cast impossível CAP04/CAP05 em U39/U40; Y = `Schema.Schema<A>` lançado como `Schema.Decoder<A>` sem prova de Context-free; Z = compilar e testar consumidores Web/Azure, ainda não feito. E2E F04 live permanece release-only.
- **Arquivos exclusivos (11, sem wildcard):**
  1. `apps/desktop/test/sucafina-bootstrap213/d01-packaged-driver.ts`;
  2. `modules/sucafina/Sucafinav1/test/native-ui-contract/memory.test.ts`;
  3. `modules/sucafina/Sucafinav1/test/native-ui-contract/operations.test.ts`;
  4. `modules/sucafina/Sucafinav1/test/native-ui-contract/reviews.test.ts`;
  5. `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am05/sequence-integrity216.test.ts`;
  6. `modules/sucafina/Sucafinav1/test/product/native-phase-bridge/native-fixture.ts`;
  7. `packages/app-shell/e2e/sucafina/native/fixture/selected-installation.ts`;
  8. `packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/packaged-electron.spec.ts`;
  9. `packages/app-shell/e2e/sucafina/native/integrated-proofs/d01/playwright-types.ts`;
  10. `packages/app-shell/e2e/sucafina/native/journeys/u39.spec.ts`;
  11. `packages/app-shell/e2e/sucafina/native/journeys/u40.spec.ts`.
- **Compartilhados READ-ONLY:** `readiness.ts`/F04 A8/A9, schema de produto, todos os workstreams do host, A4 UI. Desktop path permanece apenas compatibilidade histórica do PR, **não** reintroduz gate/entrega desktop ao SF.
- **Grafo:** independente em W1; **X/Y concluídos antes de A9 rodar U39/U40**, e Z/parecer antes de A6 incorporar PR #240 ou A10 congelar C.
- **Tarefas:** especializar ramos literais ou passar union real como parâmetro sem `as` artificial; trocar casts dos decoders por tipo que prove requisitos `never` ou demonstração compilável da instância real; preservar asserts/negativos/exclusão de atores. Não adicionar “cenários presentes” só porque o tipo os declara: `selected-installation.ts` continua exigindo provisionamento real.
- **Comandos:**

```bash
(cd modules/sucafina && bun run typecheck)
(cd packages/app-shell && bun run typecheck:sf-e2e --listFiles --pretty false)
(cd modules/sucafina && bun test Sucafinav1/test/native-ui-contract/memory.test.ts Sucafinav1/test/native-ui-contract/operations.test.ts Sucafinav1/test/native-ui-contract/reviews.test.ts)
git diff --check
```

- **DoD:** ausência de X/Y nas linhas auditadas com inferência estática genuína; testes positivos/negativos e consumidores SF Web/host typechecked no SHA integrado, não apenas trecho alterado; X/Y/Z assinados por revisor; PR #240 segue bloqueado se não houver run real. U39/U40 **não recebem PASS de execução** neste agente.
- **Bloqueio/mitigação:** não existem atores/prova F04 no runner comum. A5 produz correção de tipo; A9/owner responde por execução live. Não misturar desktop packaging com Web Azure.

### Agente A6 — integrador exclusivo do CI, B1/B3/M2/M3

- **Contexto:** a cabeça `sf-ci-lean` não herda `1cb77b8deb`/`524f6ed87e`; fazer esse merge **primeiro**, confirmando ancestralidade e diff. B1 removeu `--showConfig`/`--listFiles`/verificador E2E. B3 reduziu CLI/Atlas sem matriz de requisitos. M2 perdeu `generate + git diff`; M3 usa outra base de guards. O Epic é referência read-only.
- **Arquivos exclusivos:** `.github/workflows/sf-ci.yml`; `script/sf2h/final-bundle/verify-e2e-typecheck.mjs`; `sf/ci/equivalence/{recipe-equivalence.md,e2e-inclusion.md,guard-base-comparison.md}`. Merge `close-final-candidate → sf-ci-lean` sob lease único, sem força/merge de PR/rewrite de head não relacionado.
- **Compartilhados READ-ONLY:** `sf/ci/suites.json`/`gate.mjs` A2, `requests.json` e `sf2-epic.yml` históricos, `origin/dev`, arquivos protegidos. B2 integrado via CLI de A2, nunca duas listas de seleção.
- **Grafo:** F0 = primeiro ato de integração; B1/M2/M3 podem ser implementados enquanto A2 desenha contract; YAML seleciona por manifest **após** A2 entregar interface; B3 exige revisão A1 e fontes históricas.
- **Tarefas:** (i) merge sem afirmar ausência de conflito até diff real; (ii) portar E2E inclusão real, mostrando config, lista de arquivos, exit codes, hash do grafo e artifact independentemente de TS do produto; (iii) executar `bun run generate` + `git diff --exit-code -- .` além de `check:generated`; (iv) checar guards com base `origin/dev` como Epic, comparar com PR-base no mesmo tree, guardar base SHA/recibo; (v) cotejar oito recipes históricos vs manifesto/coverage real e justificativa para **cada exclusão Linux/canônica**; nenhuma exclusão Linux pertinente aceita sem prova.
- **Comandos de chegada e evidência:**

```bash
git fetch origin close-final-candidate sf-ci-lean dev
git checkout sf-ci-lean
git merge --no-ff origin/close-final-candidate
git merge-base --is-ancestor 1cb77b8deb HEAD
git merge-base --is-ancestor 524f6ed87e HEAD
git diff --check
(cd modules/atlas/boundary && bun run check:generated && bun run generate && git diff --exit-code -- .)
git fetch origin +dev:refs/remotes/origin/dev
bun run check:spawn-imports
bun run check:guards --base origin/dev
node script/sf2h/final-bundle/validate-requests.mjs
```

**B1 — comando obrigatório a portar para `sf-ci.yml` (dentro da Actions no C, com `SF_PRODUCT_TREE` e variáveis Actions reais):**

```bash
# Executar e capturar dois exit codes independentes; mesmo em falha preservar logs.
(cd packages/app-shell && bun run typecheck:sf-e2e --showConfig)
(cd packages/app-shell && bun run typecheck:sf-e2e --listFiles --pretty false)
node script/sf2h/final-bundle/verify-e2e-typecheck.mjs --config sf-e2e-typecheck-evidence/effective-config.json --log sf-e2e-typecheck-evidence/typecheck.log --config-status 0 --typecheck-status 0 --output sf-e2e-typecheck-evidence/inclusion.json
```

No YAML, redirecionar a saída dos dois comandos aos paths indicados, capturar **os exit codes verdadeiros, não zeros hardcoded**, e chamar o verificador com esses valores. Publicar `inclusion.json` + digests + logs sem segredos; uma entrada omitida em `--listFiles` deve **quebrar o job**. O exemplo acima descreve o caminho verde, não autoriza forjar `--*-status 0` em falha.

- **DoD:** `sf-ci-lean` contém ambos commits de produto; `B1` tamper com spec/helper ausente ou tsconfig excluindo arquivo resulta RED; `M2` geração altera working tree → RED; `M3` comparação `origin/dev`/PR-base documenta delta por arquivo/guard e preserva enforce; `B3/CI-04` compara todas oito receitas, com lista exata de casos/contratos, destino de cada exclusão, revisor assinado; test graph/Omni/Task/Relay host Linux não órfãos; todo consumidor executa seleção A2. Só então A1 pode parecer `CI_HARNESS_VALIDATED`.
- **Bloqueio/mitigação:** `ci-recipes.json` indicado no brief está ausente neste branch; usar `requests.json` + Epic e proveniência dos commits para reconstrução **auditável**, recuperar original se acessível; até comparação/review suficiente, B3=`BLOCKED_SOURCE`. O wrapper CI gerador não pode ser “check-only” se o Epic exigia execução determinística.

### Agente A7 — implantação VM e persistência Linux

- **Contexto:** `azure-hardening` relata fundação/Caddy 503, não aplicação SF instalada. AZ-01 requer Web+host Linux funcional em HTTPS correto; AZ-03 requer restart/migrations/idempotência/persistência/backup/restore/rollback real, inclusive substituir obrigação local macOS/Litestream por **prova de Linux**, não fingir `parity-pitr` PASS.
- **Arquivos exclusivos:** `sf/azure/vm/**`, `sf/azure/runtime/**`, `sf/azure/data/**`, `sf/azure/recovery/**`, `sf/azure/runbooks/**`; A7 preserva o arquivo histórico `modules/sucafina/Sucafinav1/test/parity-pitr.test.ts` sem remoção, e qualquer edição excepcional requer lease atualizado. Qualquer módulo compartilhado fora destes paths deve ser corrigido pelo respectivo owner.
- **Compartilhados READ-ONLY:** Azure hardening historical, `sf-release.yml`/`sf/release-target.json` A10, security A8, F04 A9.
- **Grafo:** preparar W1 em paralelo; instalação do **mesmo C** só W4 após A10 freeze; libera A9 juntamente com A8. A10 integra release gate depois de prova.
- **Tarefas:** definir instalação/restart como serviço não privilegiado, Caddy/TLS/origens, variáveis secretas fora do repo, health de app com identidade/host, transação real, migrations fail-closed, storage durável, backup snapshot+restore isolado+rollback sob falha, idempotência e retention. Digests dos binários e front servidos precisam corresponder ao C.
- **Comandos de inspeção no alvo (variáveis fornecidas por dono; nenhum valor inventado):**

```bash
test "$(uname -s)" = Linux
test "$(uname -m)" = x86_64
test -n "$SF_PUBLIC_ORIGIN"
test -n "$SF_SERVICE_NAME"
systemctl is-active "$SF_SERVICE_NAME"
curl --fail-with-body --silent --show-error "$SF_PUBLIC_ORIGIN/health"
sha256sum "$SF_ARTIFACT_PATH"
# Restore/rollback: comando real documentado no runbook e logado com exit code,
# verificação de integridade/revisão da fonte e reinício da aplicação instalada.
```

- **DoD:** VM identificada/attested, app Web e host instalados, SHA/digest da versão realmente servida, TLS/origens, processo/rota e smoke de transação; reinício com dados retidos; backup/restore e rollback com **dados verificáveis** no mesmo C, exercício de falha/retention, laudo assinado. HTTP 200 isolado não qualifica release.
- **Bloqueio/mitigação:** acesso VM, backups e secrets dependem do dono. Se não provisionados: `AZ-01/03=BLOCKED_BY_OWNER/ENV`; A10 mantém release vermelho; sem fake Litestream e sem shell local macOS.

### Agente A8 — Entra/OIDC real, admissão, origem, sessão e políticas

- **Contexto:** autenticação Azure Web não observada; shellOrigin pode diferir de publicOrigin, logo CORS permissivo não é solução; sessão Microsoft precisa binding real à instalação e principal. Verificar negativa após revogação, stale fence, cross-project, cross-installation, CAS e fonte original, preservando Permission/Relay/Task.
- **Arquivos exclusivos:** exatamente os paths A8 da matriz (host/runtime/transport/readiness + `sf/azure/identity/**` e `sf/azure/security/**`). Não editar UI A4, specs U39/U40 A5, F04 suite A9, ou protected guards.
- **Compartilhados READ-ONLY:** `sf-release.yml` A10, `transport-integration.test.ts` A9, workflows A6, manifest/testes A2, implementação de VM A7.
- **Grafo:** W1 revisão código; W4 login/cookies/CSRF no mesmo C instalado por A7; A9 consome binding real. A10 mantém rollout bloqueado até provas positivas e negativas.
- **Tarefas:** validar Microsoft identity real (issuer/audience/PKCE/state/nonce, sessão/cookie seguro/CSRF, logout/revogação), origem real vs bridge autorizada, nenhuma credencial no renderer, host/owner/project binding; barrar GET sem sessão, papéis errados, duplicação selectors, permissão revogada, source CAS staleness e namespace atravessado. Guardrails rodando mesmo com TS vermelho; qualquer path protegido só após aprovação separada humana.
- **Comandos de contraprova sem credencial (rodar no ambiente instalado; positiva exige ator real em sessão Playwright protegida):**

```bash
test -n "$SF_PUBLIC_ORIGIN"
test -n "$SF_MOUNT"
status=$(curl --silent --show-error --output /dev/null --write-out '%{http_code}' --max-time 30 "$SF_PUBLIC_ORIGIN$SF_MOUNT/api/ui/context")
test "$status" = 401 || test "$status" = 403
bun run check:spawn-imports
git fetch origin +dev:refs/remotes/origin/dev
bun run check:guards --base origin/dev
```

- **DoD:** prints/resumos sanitizados de autorização positiva por ator real, negativa guest/denied/malformed/stale/revoked, redirects/CSRF/session origins, cookies sem export, identidade com provedor, CAS com 409/422 observados quando aplicáveis e nenhum bypass; testes de host Linux no C; revisor security distinto. Sem acesso ao tenant/atores, `AZ-02=BLOCKED_BY_OWNER`.
- **Bloqueio/mitigação:** app/tenant/atores dependem de A7/dono; dados privados confinados ao host de prova e não ao artifact de CI. Se proteção de path surgir, owner aprova PR separado; agente **não** modifica guard engine.

### Agente A9 — F04 live, U39/U40, AM01–AM06, paridade release

- **Contexto:** dois Q01 portable continuam no PR; três negativas F04 de `transport-integration.test.ts` são **release-only**. `u39.spec.ts` e `u40.spec.ts` possuem 1.176 LOC no brief, testam boundary de uso ilegítimo: exigem atores e manifesto instalado, não devserver. Os seis conjuntos AM são aceites independentes, não resultado de Bun unit. `PROD-08` inclui `parity-pitr.test.ts` local macOS cujo análogo Linux é obrigação A7/A9.
- **Arquivos exclusivos:** `sf/proofs/**`, `script/sf-release-proofs/**`, `validation/azure-proofs/**`, `transport-integration.test.ts` e `integrated-proofs/am01/**`…`am06/**` exceto o teste sequence-integrity de A5. Nenhuma edição de U39/U40/selected-installation/readiness.
- **Compartilhados READ-ONLY:** `u39.spec.ts`/`u40.spec.ts` e `selected-installation.ts` A5, `readiness.ts` A8, CI/manifest A2, VM A7, release workflow A10.
- **Grafo:** preparar matrizes AM em W1; execução real em W4 **somente após A5(X/Y/Z), A7(AZ-01/03), A8(AZ-02), A10 freeze C**. Qualquer falha de código volta ao owner, rejeita resultado, refreeze e re-run.
- **Tarefas:** executar oito recipes integrados (os oito IDs) e AM01–AM06 no **mesmo C instalado**, com recibos individuais e proveniência; F04 `sf2h.native-installed-manifest.v1` **emitido pelo instalador autorizado**, arquivo 0600 dentro de `scratchRoot` de diretório 0700, owner efetivo, sem symlink, SHA C, três alvos errados distintos e atores reais requester/holder/denied/(dashboardAdmin). Confirmar três negativas `Q01-TRANSPORT-GUEST`, `INVALID-OWNER`, `STALE-FENCE`; U39/U40 reais; positivos/negativos de sessão, política, origem, revogação e CAS. Screenshots/logs privados, witness assinado/digest, nenhum token em artifact.
- **Comandos no runner protegido com manifesto real já emitido (NÃO setar `GITHUB_ACTIONS=true` para falsificar o ambiente):**

```bash
test "$GITHUB_ACTIONS" = true
test "$RUNNER_OS" = Linux
test "$RUNNER_ARCH" = X64
test "$(git rev-parse HEAD)" = "$SF_NATIVE_CANDIDATE_SHA"
test -f "$SF_NATIVE_INSTALLED_MANIFEST"
stat -c '%a %U %n' "$SF_NATIVE_INSTALLED_MANIFEST"
(cd packages/app-shell && bun test --conditions=browser --preload ../../script/test-omni-control.ts --preload ./happydom.ts ./test-browser/sucafina-native/transport-integration.test.ts)
(cd packages/app-shell && bun run test:e2e:local e2e/sucafina/native/journeys/u39.spec.ts --config e2e/playwright.production.config.ts --workers 1 --retries 0)
(cd packages/app-shell && bun run test:e2e:local e2e/sucafina/native/journeys/u40.spec.ts --config e2e/playwright.production.config.ts --workers 1 --retries 0)
```

AM tem fixtures sob `modules/sucafina/Sucafinav1/test/product/integrated-proofs/am01/**` a `am06/**`; o runner de prova deve enumerar **cada arquivo/caso** e executar comandos normativos da campanha verificados por A9, produzir lista+contagem executada+exit code real por AM, **não** usar wildcard vazio, somente arquivo “passou” ou `--pass-with-no-tests`. Dado que o brief não fornece credenciais/VM nem o dispatcher AM concluído, esses comandos são **pré-condições operacionais** e não logs de execução.
- **DoD:** F04 manifest com permissão/owner/identidade C, 3 negativos reais + U39/U40 reais, seis AMs completos, oito recipes executados/recibados no mesmo C, witness de skill/Task/Permission/Relay, artefatos assinados/hash, nenhum skip/falso positivo e paridade de backup Linux observada A7. Se qualquer autorização/VM/ator falta, `AZ-04/05=BLOCKED_BY_ENV` e A10 veta release.
- **Bloqueio/mitigação:** não existe ambiente F04 real comprovado nesta foto; não substituí-lo por fixture. A5 corrige typecheck; A8 entrega atores/origens; A7 entrega host; A10 recebe apenas prova assinada.

### Agente A10 — freeze, evidence, release protegido, migration de checks

- **Contexto:** `sf-release.yml` é fail-closed inerte com `AZURE_APP_ACTIVATION_NOT_COMPOSED` e `sf/release-target.json` bloqueado. Isso é proteção correta até instalação/aprovação; não trocá-lo por 200/health verde. Branch protection via MCP retorna 403; required checks não podem ser manipulados por agente sem acesso humano.
- **Arquivos exclusivos:** `.github/workflows/sf-release.yml`, `sf/release-target.json`, `sf/ci/PENDING-WORK.md`, `sf/ci/README.md`, `sf/ci/RELEASE-ATTESTATION.md`, `validation/final-bundle/evidence-template.md`, `installed-proof-checklist.md`, `ci-round-10-13-digest.md` (três últimos inexistentes no branch, criar de novo com prova e data, não recuperar imaginariamente).
- **Compartilhados READ-ONLY:** ledgers A1, CI A2/A6, produto A3/A4/A5, host A7/A8, F04/AM A9, regras protegidas. Settings de GitHub pertencem exclusivamente a pessoa autorizada.
- **Grafo:** pode preparar templates em W1 sem afirmar PASS; freeze C em W3 depois de PRs/revisão; release integration em W5 depois de A7+A8+A9 e três revisores; CI-14/AZ-08 **apenas por decisão explícita do dono**.
- **Tarefas:** CI-13 obter do owner screenshot/export dos branch protection/rulesets e exatos status contexts; CI-14 desenhar transição **sem janela desprotegida**, adicionar novo required check `sf/verify` após prova no C, observar branch protegida, só depois remover Epic em PR separado com rollback; CI-15 atualizar PENDING-WORK com SHA final/aceite distinto. M1 separar CI de produto instalado. AZ-06 congelar C+tree+digests e obter 3 revisores finais independentes; AZ-07 workflow protegido com OIDC/segredos restritos, artifact imutável, smoke transacional, rollback validado, no green inerte; AZ-08 autorização humana e checks reversíveis, nunca antecipar.
- **Comandos de qualificação/metadata (executados pelos agentes no Linux/Actions; mudanças em settings feitas somente pelo owner):**

```bash
git rev-parse HEAD
git rev-parse 'HEAD^{tree}'
sha256sum "$SF_ARTIFACT_PATH"
gh run view "$SF_RUN_ID" -R gustavomhss/Orchestra-SF --json status,conclusion,headSha,event,jobs
gh api "repos/gustavomhss/Orchestra-SF/actions/runs/$SF_RUN_ID/artifacts"
gh api repos/gustavomhss/Orchestra-SF/branches/close-final-candidate/protection
# Em caso de 403: STOP, registrar owner+request ID; NÃO interpretar como protection=off.
```

- **DoD:** evidence-template tem todos campos necessários e nunca campos preenchidos como PASS antes de observar; digest de rounds com URLs/jobs/times/sha256, checklist installed-proof marca cada item `PASS/RED/BLOCKED/NOT_RUN`; `CI_HARNESS_VALIDATED` e `PRODUCT_CI_GREEN` aprovados por trilhas separadas; `AZURE_RELEASE_QUALIFIED` só após host/Entra/F04/AM/restore/rollback em C e três revisores; workflow protegido implantando digest exato e comprovando rollback/health de produto. Regras GitHub confirmadas pelo **proprietário**, required contexts migrados de modo reversível, Epic desligado apenas em PR separado após observação. O único verde agregado é `sf/verify` verdadeiro.
- **Bloqueio/mitigação:** 403/protected env/VM/tenant = `DECISÃO DO DONO`. A10 pode preparar e registrar, mas **não** inventar permissão. Se não houver prova externa, conservar `sf-release` RED e `release-target.activation.status=BLOCKED`.

## 6. Checklist de fechamento — ownership unitário para **cada** item

**CI (cada item tem exatamente um DRI; outros só fornecem insumo):**

| ID | DRI | Aceite que impede falso positivo |
|---|---|---|
| CI-01 | A1 | Run FINAL completo, sem cancelamento, head/merge SHA, job IDs e término de todos os 12 jobs |
| CI-02 | A2 | preflight Linux X64, manifest/negative selectors, incluindo 39 regressões reportadas, executadas em run atual |
| CI-03 | A2 | `sf/verify` falha corretamente por upstream RED **antes** de procurar artifact |
| CI-04 | A6 | 8 recipes históricos vs seleção atual, rastreabilidade por requisito + cold review, fonte histórica recuperada ou reconstrução auditada |
| CI-05 | A2 | source-of-truth único, seleção real por caso+arquivo, novos arquivos entram, omitidos falham |
| CI-06 | A2 | receipt/artifact SHA256+run+attempt+runner+SHA+casos, negativas e sigilo |
| CI-07 | A2 | bail após RED, verde exaustivo sem retries/skips |
| CI-08 | A2 | Linux-only e trigger único, sem ABI cross-OS |
| CI-09 | A6 | spawn/guards executados mesmo com TS RED, comparação `origin/dev`, nenhum guard autoaprovado |
| CI-10 | A1 | todos os RED classificados com causa, caso e owner |
| CI-11 | A1 | tempo/custo real e p50/p95 com tamanho da amostra declarado |
| CI-12 | A1 | revisão independente PR #242, diff inteiro e concorrência |
| CI-13 | A10 | ruleset/branch protection comprovado por humano, 403 não vira bypass |
| CI-14 | A10 | migração só após green+equivalência+release, ato/PR separados com autorização do dono |
| CI-15 | A10 | PENDING-WORK e encerramento CI com C real, sem GO_LIVE implícito |

**Produto/PR e achados de cold review:**

| Item | DRI | Prova exigida |
|---|---|---|
| PROD-01 Planner TS2322 | A3 | fix `524f6ed87e` presente após F0 + typecheck fresco |
| PROD-02 Q01 registry/extensões | A4 | catálogo congelado, 2 portable Q01, sem mudar referência para passar |
| PROD-03 Procurement CAS/drafts | A4 | source mutation, 409/422, owner, quarantine, positivo+negativo |
| PROD-04 SF/CORES/XLSX/OPEX | A3 | suíte SF completa Linux sem silenciar bail |
| PROD-05 Operations | A4 | jornada real + recibo, sem fake HTTP 200 |
| PROD-06 Decisions | A4 | locator/choice/policy/receipt real sem retry oportunista |
| PROD-07 Reports | A4 | status de run reconsultado e jornada sem timeout artificial |
| PROD-08 paridade release | A9 | 2 Q01 portáteis sob A4; 3 F04 sob A9 e restore Linux sob A7; nenhum “PASS” por realocação |
| B1 | A6 | inclusão E2E por `--showConfig/--listFiles` + verificador + controle omitido RED |
| B2 | A2 | Yaml consumido por A6; manifest governa cada seleção, drift negativo RED |
| B3 | A6 | CI-CLI/Atlas/8 recipes ↔ requisitos reais comparados, exclusões auditáveis |
| M1 | A10 | `sf/verify` não vende Azure instalado; AZ provas separadas |
| M2 | A6 | `bun run generate` + `git diff --exit-code`/equivalência demonstrada |
| M3 | A6 | guards `origin/dev` comparados, recibo base+tree |
| M4 | A2 | casos+arquivos reais, baseline, não aceita suíte quase vazia |
| X (PR #240) | A5 | sem casts union CAP04/CAP05 artificiais |
| Y (PR #240) | A5 | decoders com requisitos de Context provados por tipo |
| Z (PR #240) | A5 | typechecks e consumidores Web/Azure; A10 valida evidência de C |
| PR #242 | A1 | independent cold review; A6 integra correções, owner decide merge |
| PR #240 | A5 | X/Y/Z + independent review, owner decide merge |
| PR #243 | A1 | acompanha label/verifica permissão e ordem; owner decide; **não é dependência** |
| Merge `close-final-candidate→sf-ci-lean` | A6 | integra `1cb77b8deb`/`524f6ed87e`, ancestralidade comprovada, sem rewrite |
| U39/U40 fonte | A5 | typecheck/seleção reais; execução live **não** aqui |
| U39/U40 execução F04 | A9 | host/atores/manifest reais; caso negativo e positivo, não PR unit |
| Evidência/checklist/digest | A10 | templates preenchidos por observação; missing no snapshot não vira “já pronto” |

**Azure/release:**

| Item | DRI | Prova exigida |
|---|---|---|
| AZ-01 | A7 | app+host reais em Azure VM Linux X64 + HTTPS, artifact/C matching |
| AZ-02 | A8 | Entra/OIDC real, sessão/origem/CSRF/owner/CAS/revogação positivo+negativo |
| AZ-03 | A7 | storage/migration/restart, backup/restore/rollback Linux efetivos |
| AZ-04 | A9 | F04 manifest privado real, witness + 3 negativas Q01 |
| AZ-05 | A9 | AM01–AM06 e 8 receitas integradas em mesmo C, receipts completos |
| AZ-06 | A10 | freeze exato C+tree+3 reviews independentes; mudança reinicia qualificação |
| AZ-07 | A10 | workflow release protegido, artifact imutável, deploy real/smoke/rollback; owner aprova |
| AZ-08 | A10 | decisão humana, required check `sf/verify` e Epic retirement separados/reversíveis |

## 7. Registro dos riscos que bloqueiam avanço (não são autorização)

| Risco / incógnita | DRI | Observação para liberar | Status inicial |
|---|---|---|---|
| Regra protegida `[protected-paths]` e waiver #243 | A10; **dono aprova** | PR separado, approver write/same-day/label, guard efetivo; nenhuma autoaprovação | `DECISÃO DO DONO` |
| Branch protection/rulesets (403) | A10; **dono executa** | export current contexts, confirmação required `sf/verify`, plano rollback sem janela | `BLOCKED_BY_OWNER` |
| Recorte CLI/Atlas e `ci-recipes.json` ausente | A6 | comparação reprodutível `requests.json`+Epic+fontes e revisão assinada, provenance do original se localizado | `BLOCKED_SOURCE` |
| Mutação de cobertura não detectada (B2/M4) | A2 | testes negativos de drift/omissão em run real | `RED_HARNESS` |
| Inclusão E2E/Atlas generation/guard drift (B1/M2/M3) | A6 | dois compiler commands+verificador, generate+diff, guarda base/prova | `RED_HARNESS` |
| Planner fix não no CI branch | A6/A3 (DRI do merge A6) | ancestralidade e typecheck atual | `PENDING_MERGE` |
| Reports run ainda `IN_PROGRESS` na coleta | A1 | reconsultar run/jobs até conclusão, não inferir PASS | `UNKNOWN_UNTIL_FETCH` |
| VM/Azure hardening sem app | A7 | artefato instalado+hash+serviço+HTTPS transacional no C | `BLOCKED_BY_ENV` |
| Microsoft tenant/sessões/atores/autorização | A8; **dono provê** | OIDC real, binding e negativas sem segredo em artifacts | `BLOCKED_BY_OWNER` |
| Manifest F04, raízes 0700, ator denied e witness | A9 | arquivo 0600 emitido pelo instalador e proof live C | `BLOCKED_BY_ENV` |
| Linux backup/restore vs Litestream local | A7, consome A9 | restore/rollback Linux com dados e stamps reais | `BLOCKED_BY_ENV` |
| AM01–AM06, 8 recipes, 3 revisores | A9 executa/A10 aceita | matriz casos completa, run/artifacts por AM, pareceres nominados | `NOT_RUN` |
| Artefato imutável e workflow protegido | A10; **dono aprova** | digest de C servido, smoke, rollback e env protection observados | `BLOCKED_BY_OWNER` |
| Digest/template/checklist inexistentes no branch | A10 | criação posterior com dados e links verificados; nunca fingir fonte preexistente | `PENDING_EVIDENCE` |

**Critério de STOP global:** qualquer item da tabela com status não-PASS que seja pré-requisito do próximo gate mantém o próximo gate RED/BLOCKED. **Não** promover `sf-ci-lean` como único required check sem B1–B3 e sem `PRODUCT_CI_GREEN`. **Não** habilitar release antes de AZ-01..08 e três pareceres. **Não** remover o Epic enquanto o fallback obrigatório não for preservado e provado.

## 8. Protocolo de congelamento C, prova completa e handoff definitivo

1. A1 reconsulta branch/PRs e triagem; A6 garante o merge de `1cb77b8deb` e `524f6ed87e`, controla a fila de integrações, A2–A5 entregam patches disjuntos e revistas. PR #243 só na ordem/autorização do dono; nunca pré-requisito escondido.
2. Antes de freeze, A2+A6 obtêm negativos B1/B2/M4, equivalência de B3, M2/M3; A3/A4/A5 corrigem reds reais preservando produtores e qualidade; review independente do PR #242 e PR #240. A10 **não** dá `CI_HARNESS_VALIDATED` só por preflight.
3. A10 congela C: commit 40 hex, tree SHA, manifests/config/workflows/guards/Omni/build hashes, refs/PR parentage, e identifica exatamente como `workflow_dispatch`/PR Actions vai testar C. **Não** chamar run de merge ref diferente de “run em C”.
4. Run final **novo e sem cancelamento** no SHA C: preflight, static, Omni, as cinco Bun (`CI-SF`, `CI-CLI`, `CI-APP-SRC`, `CI-APP-BROWSER`, `CI-ATLAS-BUSINESS`), três Playwright (`OPERATIONS`, `DECISIONS`, `REPORTS`) e verify. Guard base `origin/dev` e source commit registrados. A1 captura job IDs/status final e p50/p95 conforme amostra; A2 confere oito recibos, seleção por caso, SHA256 e ausência de skip. Um RED exige novo patch → **novo C**, não replay seletivo de green anterior.
5. A7 implanta **artefato imutável de C** na VM e prova persistência/restore/rollback, A8 prova Entra/origem/sessão/revogação. A9 usa esse **mesmo C** e atores autorizados para F04/U39/U40/AM01–06 e oito recipes instalados, com digest e witness. Não aceitar ambiente de mock/devserver nem CI PR como F04.
6. A10 colhe três cold reviews independentes, audita checklist com evidência endereçável e valida release protegido. Se nenhum access/token/VM: **parar com BLOCKED** e relatório completo, não perguntar ao agente “o que fazer agora” nem inventar permissões.
7. Só após `PRODUCT_CI_GREEN` + `AZURE_RELEASE_QUALIFIED`, dono decide required check `sf/verify` em branch protection; janela sem proteção proibida, rollback documentado. Aposentadoria do Epic é PR **separado** e posterior à verificação da migração. A10 atualiza evidence/template/digest/PENDING-WORK com estado final honesto.

**Matriz de flags finais (não preencher previamente):**

| Marco | Só escrever PASS se... | Caso contrário |
|---|---|---|
| `CI_HARNESS_VALIDATED` | B1–B3/M2–M4, pré-controles, receipts/seleção/Omni/guardas negativos e revisão fria no SHA | `PARTIAL/RED_HARNESS` |
| `PRODUCT_CI_GREEN` | run C, 12 jobs completos, 8 famílias inteiras, static+Omni/preflight e `sf/verify=success` | `RED_PRODUCT/NOT_RUN` |
| `AZURE_RELEASE_QUALIFIED` | deploy imutável C, Entra, segurança, backup/rollback, F04/U39/U40, AM01–06/8 recipes, 3 revisores e owner | `BLOCKED_BY_ENV/OWNER/NOT_RUN` |

Nenhum agente precisa de nova rodada de planejamento para saber **o que fazer**. Os dados que só o dono pode fornecer (VM/tenant/atores/approval/settings) têm owner, artefato de evidência, sequência e estado de bloqueio definidos. Fim de escopo é **release Web+Linux Azure**, não reconstrução do Orchestra canônico.

## 9. Adversarial self-review — **tripla revisão do próprio rascunho, antes do commit**

**Método e critério:** três passes sequenciais contra o `0.1` do brief; este apêndice registra *achado real → gravidade → mudança incorporada acima → estado final*. Inicialmente o rascunho usava owners amplos por área. Foram examinados (i) todos os IDs do `3` do brief; (ii) intersecções de leases e arestas do DAG; (iii) modelos de falso PASS e fontes de evidência. **Zero BLOCKER de desenho permanece sem resolução no plano**; bloqueios **de execução** continuam visíveis e vetam PASS. A revisão foi substantiva, não uma chancela do texto original.

### Pass 1 — Cobertura (orfãos, duplicados e agentes vazios)

| Achado real | Severidade | Mudança que entrou no plano | Estado |
|---|---|---|---|
| **P1-ORPHAN-PR243:** PR #243 estava tratado como “já aprovado”, mas sem owner para verificação de label, ordem de merge e decisão humana. | **BLOCKER** | A1 recebe tracking explícito #243; A10 recebe checagem de política; **dono** é único autorizador. A dependência desnecessária de #243 foi removida do caminho crítico. | **RESOLVIDO NO PLANO; MERGE CONTINUA DECISÃO DO DONO** |
| **P1-ORPHAN-B1/M2/M3:** proposta inicial de “CI em A2” deixava prova de inclusão E2E, regenerate+diff e guard-base sem arquivo exclusivo. | **MAJOR** | A6 recebe `sf-ci.yml` + verificador E2E e ownership B1/M2/M3; A2 mantém manifest/gate; handshake A2→A6 obrigatório. | **RESOLVIDO** |
| **P1-ORPHAN-U39/U40:** separar PR240 e F04 sem definir quem edita spec vs quem executa com atores reais deixaria U39/U40 sem prova operacional. | **BLOCKER** | A5 único editor dos 2 specs e fixture selected; A9 único executor release-only após A5+A7+A8; aceites distintos no `6. | **RESOLVIDO NO PLANO; EXECUÇÃO BLOCKED_BY_ENV** |
| **P1-ORPHAN-SOURCES:** `ci-recipes.json` e três evidências que o brief dizia estarem no branch retornam 404 e não constam nos diretórios. Copiá-los como “lidos” criaria falso aceite B3 e prova inexistente. | **MAJOR** | `1` registra ausência verificável; A6 exige reconstrução com proveniência ou recuperação histórica + cold review; A10 cria os docs **apenas depois** de evidence. | **RESOLVIDO COMO GATE FAIL-CLOSED; B3 NÃO ESTÁ PASS** |
| **P1-EMPTY-AGENT:** havia risco de A1 virar mero supervisor sem output verificável e A10 duplicar seus relatórios. | **MAJOR** | A1 recebe ledgers exclusivos com IDs/custo/triagem/revisores; A10 recebe somente release-evidence/PENDING-WORK; ambos têm DoD e comandos próprios. | **RESOLVIDO** |

**Resultado do Pass 1:** CI-01..15, PROD-01..08, AZ-01..08, B1/B2/B3/M1–M4, X/Y/Z, merge pendente, PR #243, U39/U40 F04 e evidence/checklist aparecem na tabela de DRIs; não existe item sem owner. Fontes ausentes permanecem explicitamente ausentes, nunca “cobertas por leitura”.

### Pass 2 — Obstrução (conflitos, serial disfarçado, permissão real)

| Achado real | Severidade | Mudança que entrou no plano | Estado |
|---|---|---|---|
| **P2-COLLISION-YAML:** A2 e A6 inicialmente editariam ambos `sf-ci.yml` ao implementar B2 vs B1. | **BLOCKER** | `sf-ci.yml` **exclusivo A6**; `suites.json` e `gate*` **exclusivos A2**; A2 publica contrato/negativos, A6 conecta consumo sem duplicar lista. Leases A1 obrigatórios. | **RESOLVIDO** |
| **P2-COLLISION-BROWSER:** A4 “todos os testes Browser SF” colidiria com a prova F04 instalada A9 em `transport-integration.test.ts`. | **BLOCKER** | Exclusão textual explícita no mapa; A4 tem 2 portáteis, A9 3 F04. Compartilhado só leitura. | **RESOLVIDO** |
| **P2-COLLISION-UNIT-AM:** A3 “toda árvore de testes SF” conflitaria com A5 nos cinco arquivos PR240 e A9 nos dirs am01..06; A7 assumiria `parity-pitr` como verde. | **MAJOR** | Precedência de exceções por paths exatos, ownership AM A9, file A5 preservado, `parity-pitr` preservado/sem PASS e substituição Linux A7. | **RESOLVIDO** |
| **P2-HIDDEN-SERIAL:** A9 poderia começar F04 “em paralelo” à correção U39/U40, VM e Entra, criando dias de testes inválidos. | **BLOCKER** | DAG exige A5(X/Y/Z) + A7 instalado + A8 atores/Entra + A10 C antes de executar A9. A9 só prepara matrizes antes. | **RESOLVIDO NO PLANO; AMBIENTE AINDA PENDENTE** |
| **P2-PROTECTION-403:** A10 não tem API de branch protection e guard paths exigem aprovação humana; planejamento de merge automático não seria executável. | **BLOCKER** | Owner externo nomeado para rulesets, PR separado e label same-day; CI-13/CI-14/AZ-08 gatilhados por prova do owner; sem alteração protegida pelos agentes. | **RESOLVIDO COMO DEPENDÊNCIA EXTERNA EXPLÍCITA** |
| **P2-MERGE-ORDER:** “Faz CI e depois merge 524f” permitiria falha repetida de TS e DoD avaliado no SHA errado. | **MAJOR** | F0 passa ao início, com `merge-base --is-ancestor` para ambos refs; W3 run somente no C após integração/review. | **RESOLVIDO** |

**Resultado do Pass 2:** prefixos amplos têm exclusões exatas; nenhuma edição paralela incide no mesmo arquivo. B2→A6 e A5/A7/A8→A9 são **seriais declaradas**, não paralelo fictício. PR #243 e migração required checks não têm um agente “com poder imaginário”.

### Pass 3 — Prova de verdade (recibo, cobertura, ambiente e causa-raiz)

| Achado real | Severidade | Mudança que entrou no plano | Estado |
|---|---|---|---|
| **P3-FALSE-GREEN-M4:** JUnit com `product_executed>=1` pode deixar uma suíte quase vazia parecer completa; B2/YAML drift também pode eliminar casos sem falha. | **BLOCKER** | A2 deve confrontar arquivos/casos **coletados vs executados** e baseline aprovada, com controle negativo que remove caso/arquivo; A6 força consumer manifest. O mínimo “≥1” deixou de ser DoD. | **RESOLVIDO COMO CRITÉRIO; IMPLEMENTAÇÃO NÃO FEITA** |
| **P3-FALSE-GREEN-B1:** `bun run typecheck:sf-e2e` pode passar sem compilar arquivos omitidos; piloto não executa `--listFiles`/`verify-e2e-typecheck`. | **BLOCKER** | A6 tem verificador + dois outputs/exit codes reais + tamper negative e receipt com C/tree; restore obrigatório antes de B1 PASS. | **RESOLVIDO COMO GATE; EXECUÇÃO PENDENTE** |
| **P3-STALE-SHA:** run `43956369500` ocorreu antes de merge do fix, Reports estava IN_PROGRESS à coleta, e `sf/verify` não foi observado verde. | **MAJOR** | A1 proíbe conclusão por snapshot, reconsulta todos jobs; A10 congela novo C; todos receipts são do run/attempt real, PR merge SHA não vale como C se divergente. | **RESOLVIDO** |
| **P3-ENV-F04:** F04/AM/Entra/backup/rollback não possuem VM/atores/manifest reais comprovados; seria fácil marcar “N/A porque fora do PR”. | **BLOCKER** | AZ-01..08 e U39/U40 têm DRIs com `BLOCKED_BY_ENV/OWNER`, três Q01 LIVE e backup Linux com recibo, workflow release permanece vermelho até execução. | **RESOLVIDO NO PLANO; RELEASE CONTINUA BLOQUEADO** |
| **P3-SYMPTOM-TS:** “Planner consertado” poderia gerar verde por reexecutar no head antigo e reclassificar 14 erros sem integrar `524f6ed87e`. | **MAJOR** | A6 prova ancestralidade F0; A3 requer typecheck no C; A1 correlaciona log/arquivo/commit. Sem patch sintomático em gate. | **RESOLVIDO** |
| **P3-SCOPE-CONFLATION:** `CI_HARNESS_VALIDATED` poderia ser declarado `PRODUCT_CI_GREEN` e liberar o Azure por associação. | **BLOCKER** | `0`/`8` instauram três flags separadas com evidência independente e ordem rígida, A10 não habilita deploy nem mexe required checks pela validação parcial do harness. | **RESOLVIDO** |

**Resultado do Pass 3:** nenhum `PASS` pode nascer de job inexistente, typecheck sem inclusão, XML quase vazio, artifact/digest errado, SHA reaproveitado, release-only não executado ou HTTP 200 isolado. Classificações de RED exigem causa-raiz e prova posterior. **Veredito da tripla revisão: PLAN_READY / EXECUTION_NOT_AUTHORIZED_BY_THIS_DOCUMENT / CI_PARTIAL / PRODUCT_RED / AZURE_BLOCKED.** Não há BLOCKER de **desenho do plano** pendente; há BLOCKERs reais **de engenharia/ambiente/propriedade** preservados com DRIs, ordem e gates fail-closed, sem transformá-los em PASS.
