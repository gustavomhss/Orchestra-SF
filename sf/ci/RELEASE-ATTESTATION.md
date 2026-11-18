# Orchestra-SF — registro de atestação para release (A10)
**Criado 2026-11-16, W1. Estado: PREPARATION_ONLY / NOT_SIGNED / RELEASE_BLOCKED.**
Este documento prepara o aceite, não o concede. Sem VM/Entra/F04/AM/restore/rollback e autorização humana, `.github/workflows/sf-release.yml` permanece inerte/vermelho e `sf/release-target.json.activation.status=BLOCKED`. Não executar release ou mudar rulesets pelo A10 em W1.

## Gate zero — três estados SEM equivalência
| Milestone | Status demonstrado nesta fotografia | Prova distinta requerida |
|---|---|---|
| `CI_HARNESS_VALIDATED` | PARTIAL, contraprovas e equivalência ainda pendentes | B1/B2/B3/M2/M3/M4; CI-03/04/06; revisão fria no C |
| `PRODUCT_CI_GREEN` | NO (histórico `sf/verify=failure`) | 12 jobs `success`, 8 receipts íntegros, mesmo checkout/run/attempt + casos executados |
| `AZURE_RELEASE_QUALIFIED` | BLOCKED_BY_ENV/OWNER | real app instalada/Entra/backup/restore/F04/U39-U40/AM01–06/rollback **+ ADMIN-SURFACE no mesmo C**, digest e 3 pareceres |
| `ADMIN-SURFACE` (novo subgate do go-live, vinculado a AZ-02) | NOT_RUN / BLOCKED_BY_SOURCE/OWNER/ENV | Graph delegado/consentimento comprovados, grupo supremo exclusivo, papéis por tela aplicados pelo host e **zero writes em Entra/Teams** |

## Freeze C — apenas W3 e após A1/A6 e PRs integrados
| Campo | Evidência / owner | Status |
|---|---|---|
| PRs aceitos, revisão fria e head candidato C 40hex | A1/A6 + urls | NOT_RUN |
| SHA `HEAD^{tree}`, manifest SHA256, workflow e guards | A10 + Actions | NOT_RUN |
| Build e artifact imutável ID/SHA256 | A7 + release owner | BLOCKED_BY_ENV |
| Re-run das 12 conclusões e 8 receipts em C | A1/A2/A6 + A10 | NOT_RUN |
| Invalidação por commits pós-freeze e nova rodada | A10: change log | NOT_RUN |
| Três revisores independentes, achados fechados | A1 + revisores humanos | NOT_RUN |

Não usar `head_sha` do PR como se fosse automaticamente `github.sha` do run; quando checkout em merge ref, atestar ambos e comprovar que o byte C promovido corresponde à árvore qualificada. Qualquer alteração versionada relevante invalida o freeze.

## CI-13 — solicitação formal de evidência ao proprietário (não automatizar)
Em 2026-11-16 o GET `/repos/gustavomhss/Orchestra-SF/branches/close-final-candidate/protection` retornou **403 Resource not accessible by integration**. O GET de rulesets listável retornou `[]` na credencial de integração; isso **não** significa ausência de branch protection. Responsável **dono do repositório com acesso administrativo** fornecerá export/screenshot com timestamp, branch(es) realmente protegida(s), required status contexts **exatos** e respectivo GitHub App/actor, políticas de bypass/admin, merge/review/approvals e rollback. Guardar o arquivo sensível fora do pacote público, expondo apenas referência restrita+hash, aprovações e URLs do registro.

## CI-14 / AZ-08 — ordem reversível, sem janela sem proteção; executar APENAS por decisão do dono
1. **Pré-condição:** `PRODUCT_CI_GREEN` e `AZURE_RELEASE_QUALIFIED` comprovados sobre C, B1/B2/B3/M2/M3/M4 resolvidos, 3 cold reviews assinados, `sf/verify` em branch/PR alvo real e contexts exatos confirmados pelo owner. Epic existente **permanece obrigatório**; não mudar rulesets por script ou neste PR.
2. Dono aprova **por escrito** plano/horário, target branch(es), matriz de permissões e saída de rollback; exporta configuração **antes** da mutação. Confere que `sf-ci.yml` dispara para todos os branches/fluxos protegidos que vão requerer o novo context; `sf/verify` must be created by the expected App; ausente = BLOQUEIO, não desproteção.
3. Dono **ADICIONA** `sf/verify` à lista required **mantendo os checks Epic já exigidos** (estado intermediário mais restritivo, nunca menos). Testa PR de controle/commit fresco com ambos requeridos e verifica bloqueio por ausência/failure de cada um; registra screenshot/export e URL do run.
4. Só após prova positiva e reversão testada, dono altera a lista necessária removendo contexts antigos **sem nunca remover o novo**; confirma policy protegida, PR bloqueado para check negativo, aprovação e ausência de bypass.
5. **Depois**, retirar Epic somente por **PR separado**, revisão e autorização explícita, com mecanismo de rollback documentado e `sf/verify` ativo. Em erro: restaurar settings exportados/required checks anteriores, manter ou reativar Epic e requalificar C; nunca soft-pass. Não fazer merge de PR de aposentadoria sem teste de regresso do caminho de enforcement.

**Proprietário, ação, aprovação e links:** `NOT_SIGNED / NOT_EXECUTED`. Apenas este plano textual foi preparado. Nenhum required status foi migrado.

## AZ-07 — release protegido (projeto de integração; não editar YAML em W1)
Implementar na wave W5 após A7/A8/A9: `workflow_dispatch`/promoção só do C 40hex aprovado; `environment` GitHub protegido com reviewers, deployment branch restrictions e gate manual do dono; permissões mínimas (`contents:read`, `id-token:write` exclusivamente para job que usa Azure OIDC, sem secrets permanentes); artefato imutável identificado por ID+SHA256/assinatura e sem reconstrução silenciosa; validar SHA do checkout vs C e digest da aplicação efetivamente servida; HTTPS/host real e login Entra; smoke **transacional** com dados não sensíveis + negativos de origem/identidade; checar migrations, restart, backup/restore Linux e rollback real do mesmo ambiente/artifact; failure cancela promoção e registra reversão. Qualquer `HTTP 200`, Caddy 503, health isolado, output vazio, artifact ausente ou aprovação simulada => RED.

O workflow atual está **corretamente fail-closed** (`AZURE_APP_ACTIVATION_NOT_COMPOSED`, exit 1); um patch que apenas retire a falha seria violação do gate. A10 não solicita credencial de tenant no chat nem grava tokens/cookies nos recibos.

## Quadro de decisão humana (preencher só com prova real)
| Decisão | Autoridade | Evidência assinado/data/link | Estado |
|---|---|---|---|
| Freeze C aprovado | A1 + A10 + 3 revisores externos | NOT_OBSERVED | NOT_RUN |
| Azure access / tenant / protected environment | Dono Azure/GitHub | NOT_OBSERVED | BLOCKED_BY_OWNER |
| Release técnico, smoke, F04, AM, restore, rollback | A7/A8/A9 + owner | NOT_OBSERVED | BLOCKED_BY_ENV |
| CI-13 export branch protection / contexts | Repo owner | NOT_OBSERVED | BLOCKED_BY_OWNER |
| CI-14 required checks mutation sem gap | Repo owner | NOT_OBSERVED | NOT_AUTHORIZED |
| AZ-08 go-live e aposentadoria Epic | Repo owner, PR separado | NOT_OBSERVED | NOT_AUTHORIZED |

**Conclusão assinável: NÃO ASSINADA; go-live não autorizado.** Links dos recibos e revisores vão ao `validation/final-bundle/evidence-template.md` somente após execução real.

---

## PACOTE DE PROMOÇÃO — OWNER ONLY / EXECUÇÃO CONDICIONAL (2026-11-16)

**Estado deste pacote:** RUNBOOK_PREPARED, NOT_EXECUTED. O SHA C ainda não foi congelado, o release workflow ainda termina intencionalmente com AZURE_APP_ACTIVATION_NOT_COMPOSED, e não há evidências Azure/Entra/F04/AM/restore/rollback. Os comandos abaixo são para o DONO executar **apenas após cada pré-condição ser observada e aprovada**; A10 não os executa, não altera ruleset/protected-paths, não promove, não faz merge nem publica tokens. Se uma coleta retorna 403, 404, vazio, divergência ou valor não observado: **STOP**. Não reinterpretar um PR verde como produção homologada.

**Contratos de leitura para o owner:** A7 sf/azure/runbooks/AZ-01-VM-HTTPS-ACTIVATION.md e AZ-03-LINUX-DATA-RECOVERY.md no branch sfa-vm; A8 sf/azure/identity/AZ-02-W0-W1-handoff.md em sfa-identity; A9 sf/proofs/F04-AM-W1-RUNBOOK.md em sfa-f04. São handoffs **não integrados nem provas executadas**. A1/A6 precisam entregar versões integradas/revisadas antes da execução; não executar um comando de branch temporário como se já estivesse em C.

### P0. Portão de autorização, ordem e invariantes

**Mudança de escopo, decisão do dono em 2026-11-16 — supersede apenas o recorte anterior de release:** a tela nova de administração do organograma/equipes/perfis Microsoft Graph e configuração de papéis por tela é **obrigatória** para go-live. Donos de execução: **ADMIN-SURFACE** (produto) e **DEMO-FLAMENGO** (fixtures/cenários sintéticos), com **A8** responsável pela prova AZ-02 e **A10** apenas pelo gate/evidências. Antes de qualquer freeze definitivo, A1/A6 integram estes PRs com novos testes no CI aplicável; o conjunto de 12 jobs atual NÃO pode ser chamado suficiente sem verificar inclusão dos novos casos. Sem entrega e prova => STOP.

1. **A6/A1:** integrar somente PRs revistos/aceitos, fechar B1/B2/B3 e M2/M3/M4 com testes negativos, equivalência CLI/Atlas, guards; resolver X/Y/Z de #240. Revisão fria independente do #242. O dono decide os merges; **nenhum agente move a branch protegida**.
2. **A10/A1:** declarar um commit C 40-hex congelado, tree SHA, lista de commits/PRs aceitos e hashes de arquivos normativos. Rodar sf-ci **novamente no C real**; 12 jobs success, 8 artifacts/receipts e sf/verify success com identidade run/attempt, checkout == C e nenhum skipped/retry/waiver mascarado. Se C muda, invalidar tudo e refazer.
3. **A7/A8/A9:** qualificar a instalação Azure Linux x86_64 com bytes de C e mesmo digest, HTTPS/host, Entra real, autorização de origem/owner/projeto/instalação, migração/restart, backup e restore **isolado**, rollback, F04 (Q01 e U39/U40), AM01–AM06 e as oito receitas sem omissão. Três revisores independentes assinam C e achados fechados.
4. **A10/owner:** validar environment de produção com **required reviewers**, restrições de branch/tag, Azure OIDC sem segredo estático e artifact imutável; workflow release real, aprovado e sem sentinel inerte **somente após implementação legítima em PR próprio**. Colher autorização humana explícita de produção, reversão e migração de contexts. Não trocar a falha deliberada atual por saída exit 0.
5. **Owner, por último:** migração de required checks **aditiva antes de subtrativa**, observando enforcement efetivo e teste de PR bloqueado. Aposentar Epic **somente por PR separado e posterior**; se GitHub não permite detectar política, CONTINUAR BLOQUEADO.

Os três vereditos são independentes: CI_HARNESS_VALIDATED, PRODUCT_CI_GREEN e AZURE_RELEASE_QUALIFIED. **Ordem sem dependência circular:** antes do deploy, exigem-se harness/product CI PASS e AZ-01..06 em instalação real/staging equivalente no C, rollback e três pareceres, mais aprovações; o deploy protegido produz a evidência AZ-07. **Só depois** o dono pode executar a mutação de policy de AZ-08 com fallback íntegro. O status agregado AZURE_RELEASE_QUALIFIED só vira PASS **após AZ-01..08 observados**, não é pré-condição de si mesmo. Sem esses passos, GO_LIVE=BLOCKED. Estados agora: PARTIAL / NO / BLOCKED.

### P1. Comandos exatos do OWNER — inventário de proteção e baseline 403

Rodar do seu terminal com **sua própria sessão GitHub com permissão Admin** (não usar token do MCP, nem colar secrets em chat ou no repo). O resultado de 403 da integração foi **reproduzido** em 2026-11-16 no GET /branches/close-final-candidate/protection: `403 Resource not accessible by integration`; GET /rulesets?includes_parents=true na integração retornou [] (não atesta ausência de política). O owner precisa descobrir os objetos e salvar baseline no diretório privado local abaixo, nunca em commit/Actions público.

~~~bash
set -euo pipefail
export REPO=gustavomhss/Orchestra-SF
export BRANCH=close-final-candidate
umask 077
export SF_AUDIT_DIR="$(mktemp -d)"
gh auth status --hostname github.com
gh api "repos/$REPO/branches/$BRANCH" > "$SF_AUDIT_DIR/branch.before.json"
gh api "repos/$REPO/branches/$BRANCH/protection" > "$SF_AUDIT_DIR/protection.before.json"
gh api "repos/$REPO/branches/$BRANCH/protection/required_status_checks" > "$SF_AUDIT_DIR/required.before.json"
gh api --paginate --slurp "repos/$REPO/rulesets?includes_parents=true&per_page=100" > "$SF_AUDIT_DIR/rulesets.pages.json"
jq 'add' "$SF_AUDIT_DIR/rulesets.pages.json" > "$SF_AUDIT_DIR/rulesets.before.json"
gh api "repos/$REPO/rules/branches/$BRANCH" > "$SF_AUDIT_DIR/effective-rules.before.json"
jq '{protected,required_status_checks,required_pull_request_reviews,enforce_admins,restrictions,required_linear_history,allow_force_pushes,allow_deletions}' "$SF_AUDIT_DIR/protection.before.json"
jq '[.[] | {id,name,source_type,enforcement}]' "$SF_AUDIT_DIR/rulesets.before.json"
sha256sum "$SF_AUDIT_DIR"/*.json > "$SF_AUDIT_DIR/baseline.sha256"
~~~

**STOP imediato** se qualquer GET acima falha (incluindo 403/404) ou se policies efetivas e sua fonte não são explicadas. Inspecione **cada branch efetivamente protegido** (close-final-candidate, go-live-close e release/destino real, se aplicáveis); repita baseline com BRANCH distinto, sem pressupor que proteção é global. Registre nível de origem (branch protection, repository ruleset ou org ruleset), targets, checks e app/integration IDs, strict/up-to-date, reviews/code owners, bypass/admin, force-push/deletion e timestamp + hash dos exports. Rule set herdado de org exige **admin da organização**; não “resolver” criando policy concorrente. A API de lista retornar [] **não** substitui o GET de proteção nem a verificação na UI Settings → Branches / Rules.

### P2. Identidade de C e execução full no próprio SHA, sem PR merge-ref

Preencher C **somente** depois da convergência A6/A1 e do congelamento assinado. A criação de tag leve abaixo é **ação do dono** (admitir tag apenas sob política de não retag/force-push); se a política bloquear tag ou workflow_dispatch não estiver disponível na versão do workflow do branch default, STOP — não substitua pelo sucesso de merge-ref do PR. O arquivo sf-ci.yml deve já estar registrado no branch default e na árvore de C. Não usar SHA do PR como se fosse o SHA checkout de pull_request.

~~~bash
set -euo pipefail
export C=REPLACE_WITH_OWNER_APPROVED_40_HEX_COMMIT
[[ "$C" =~ ^[0-9a-f]{40}$ ]] || { echo "STOP: C nao congelado" >&2; exit 1; }
test "$(gh api "repos/$REPO/git/ref/heads/$BRANCH" --jq '.object.sha')" = "$C"
git fetch --no-tags origin "$BRANCH"
test "$(git rev-parse FETCH_HEAD)" = "$C"
git cat-file -e "$C^{commit}"
git checkout --detach "$C"
test "$(git rev-parse HEAD)" = "$C"
test -z "$(git status --porcelain)"
git rev-parse 'HEAD^{tree}' | tee "$SF_AUDIT_DIR/tree-C.txt"
sha256sum sf/ci/suites.json .github/workflows/sf-ci.yml .github/workflows/sf-release.yml sf/release-target.json | tee "$SF_AUDIT_DIR/inputs-C.sha256"
node script/sf-ci/gate.mjs manifest
export TAG="sf-freeze-$C"
test -z "$(git ls-remote --tags origin "refs/tags/$TAG")"
git tag "$TAG" "$C"
git push origin "refs/tags/$TAG"
test "$(git ls-remote --tags origin "refs/tags/$TAG" | awk '{print $1}')" = "$C"
gh workflow view sf-ci.yml -R "$REPO" --ref "$TAG" --yaml > "$SF_AUDIT_DIR/sf-ci-C.yml"
gh workflow run sf-ci.yml -R "$REPO" --ref "$TAG"
~~~

Copiar o **run ID fornecido pelo GitHub** no próximo bloco, nunca assumir “o último”. Se não houver workflow_dispatch no branch default, peça a A6/owner a integração/revisão necessária e **pare**. Não criar release só por sucesso do dispatch.

~~~bash
set -euo pipefail
export SF_CI_RUN_ID=REPLACE_WITH_ACTUAL_RUN_ID
[[ "$SF_CI_RUN_ID" =~ ^[1-9][0-9]*$ ]] || exit 1
gh run watch "$SF_CI_RUN_ID" -R "$REPO" --exit-status
gh run view "$SF_CI_RUN_ID" -R "$REPO" --json status,conclusion,headSha,event,attempt,jobs,url > "$SF_AUDIT_DIR/ci-C.json"
jq -e --arg c "$C" '
  .status=="completed" and .conclusion=="success" and .headSha==$c
  and .event=="workflow_dispatch"
  and ([.jobs[].name] | sort) == ([
    "sf/preflight","sf/static-and-contracts","sf/linux-native-omni",
    "sf/test-CI-SF","sf/test-CI-CLI","sf/test-CI-APP-SRC",
    "sf/test-CI-APP-BROWSER","sf/test-CI-ATLAS-BUSINESS",
    "sf/test-CI-UI-OPERATIONS","sf/test-CI-UI-DECISIONS",
    "sf/test-CI-UI-REPORTS","sf/verify"
  ] | sort)
  and ([.jobs[].databaseId] | unique | length)==12
  and all(.jobs[]; .conclusion=="success")
' "$SF_AUDIT_DIR/ci-C.json"
gh api "repos/$REPO/actions/runs/$SF_CI_RUN_ID/artifacts?per_page=100" > "$SF_AUDIT_DIR/ci-C-artifacts.json"
jq -e '([.artifacts[] | select(.name | startswith("sf-evidence-"))] | length)==8
       and all(.artifacts[] | select(.name | startswith("sf-evidence-")); .expired==false)' "$SF_AUDIT_DIR/ci-C-artifacts.json"
gh run download "$SF_CI_RUN_ID" -R "$REPO" --dir "$SF_AUDIT_DIR/ci-C-artifacts"
find "$SF_AUDIT_DIR/ci-C-artifacts" -type f \( -name receipt.json -o -name summary.json -o -name report.json \) -print0 | xargs -0 -r sha256sum > "$SF_AUDIT_DIR/ci-C-evidence.sha256"
~~~

A2/A6 validam que **todos os oito receipts** contêm run_id/attempt/runner/check-out efetivo/arquivos/casos e hashes, e que o sf/verify os aceitou; confirmar API de check-runs e a aplicação emissora do context antes de torná-lo required. O jq acima prova 12 conclusões e artifact *names*, não substitui auditoria de proveniência, casos e negativos. Se houver RED, cancelamento, drift, alteração de C ou tag móvel, bloquear e congelar **novo** C.

### P3. Preparar target, segredos e aprovação de produção (dono + A7/A8/A9)

**Nenhum destes nomes é afirmado como atualmente configurado.** Owner cria/valida environment de deploy (nome definitivo a ser assinado, exemplo *sf-production*), **reviewers obrigatórios independentes, impedir self-review, restringir refs de deployment** e configura Azure federated OIDC para o subject/repo/environment efetivos (id-token:write só no job deploy; permissions mínimos). A7 especifica artifact imutável de C, entrypoint Linux/Omni/Web, unidade systemd, volume canônico, slot anterior, endpoint de transação e procedimento de backup/restauração. A8 especifica Entra app registration, redirect/callback, tenant/issuer, grupos/grants, role, scripts de negativos, topologia de origem e contrato Web I00; **a partir da decisão do dono, inclui a prova dos quatro escopos delegados User.Read / User.Read.All / GroupMember.Read.All / Directory.Read.All, grant AllPrincipals e chamadas Graph realmente utilizadas**. ADMIN-SURFACE deve entregar gate de grupo supremo e alterações de papéis apenas no produto, sem write em Entra/Teams; DEMO-FLAMENGO entrega cenários sintéticos e contraprovas. A9 entrega dispatcher/recibos F04/AM efetivos. Se qualquer parte for “a definir”, **não ativar**.

~~~bash
set -euo pipefail
export SF_ENV=REPLACE_WITH_PROTECTED_GITHUB_ENVIRONMENT
test "$SF_ENV" != REPLACE_WITH_PROTECTED_GITHUB_ENVIRONMENT
gh api "repos/$REPO/environments/$SF_ENV" > "$SF_AUDIT_DIR/environment.before.json"
jq '{name,protection_rules,deployment_branch_policy}' "$SF_AUDIT_DIR/environment.before.json"
jq -e 'any(.protection_rules[]?;
  .type=="required_reviewers" and .prevent_self_review==true
  and (.reviewers | type)=="array" and (.reviewers | length)>0)
  and (.deployment_branch_policy.protected_branches==true
       or .deployment_branch_policy.custom_branch_policies==true)' "$SF_AUDIT_DIR/environment.before.json"
gh workflow view sf-release.yml -R "$REPO" --ref "$TAG" --yaml > "$SF_AUDIT_DIR/sf-release-C.yml"
! grep -q AZURE_APP_ACTIVATION_NOT_COMPOSED "$SF_AUDIT_DIR/sf-release-C.yml"
jq -e '.activation.status != "BLOCKED" and .safety.doNotDeployOrClaimGoLive != true' sf/release-target.json
~~~

**Esse bloco DEVE falhar no snapshot atual:** sentinel, release-target e ambiente não observados. Não editar os campos só para passar. **Circularidade de freeze:** se a implementação legítima do release workflow, o release-target ou qualquer input versionado for incorporado depois do primeiro freeze, esse commit anterior NÃO é mais C: integrar por PR revisto, declarar novo C, reexecutar sf-ci 12/12 e todas as provas de staging/Azure/Entra/F04/AM/restore dependentes de C. Só o C final que já contém o workflow completo pode ser promovido. Não promover C antigo usando YAML de branch mais novo. A integração futura em .github/workflows/sf-release.yml (arquivo do A10), aprovada em PR e testada por A7/A8/A9, deve exigir approval nativo do environment **antes** de emitir Azure OIDC, baixar o artefato por ID e verificar SHA256/assinatura, comparar bytes servidos, checkpoint de dados e teste de rollback em staging, smoke transacional + positivos/negativos reais, testemunhas e cleanup. A retirada do sentinel só é permitida **juntamente com implementação operacional completa e revisão**.

Ato do dono **somente após CI sobre C PASS + AZ-01..06 comprovados no alvo/staging real equivalente, protected environment validado, backup/restore/rollback ensaiados, artefato imutável, três reviews e assinatura explícita de promoção**. O próprio workflow protegido e seu smoke/rollback geram AZ-07; não exigir AZ-07 PASS antes de executar o ato que o comprova:

~~~bash
set -euo pipefail
export SF_RELEASE_RUN_ID=REPLACE_WITH_ACTUAL_RELEASE_RUN_ID
# O owner dispara somente uma versão aprovada do workflow que NÃO contenha o sentinel.
gh workflow run sf-release.yml -R "$REPO" --ref "$TAG" -f "candidate_sha=$C"
# Preencher SF_RELEASE_RUN_ID com a URL/ID retornado, verificar e aguardar aprovação do environment.
[[ "$SF_RELEASE_RUN_ID" =~ ^[1-9][0-9]*$ ]] || exit 1
gh run watch "$SF_RELEASE_RUN_ID" -R "$REPO" --exit-status
gh run view "$SF_RELEASE_RUN_ID" -R "$REPO" --json status,conclusion,headSha,event,attempt,jobs,url > "$SF_AUDIT_DIR/release-C.json"
jq -e --arg c "$C" '.status=="completed" and .conclusion=="success" and .headSha==$c' "$SF_AUDIT_DIR/release-C.json"
~~~

**Não acionar este bloco hoje.** Cada run de produção requer approval humano, artifact C verificado e rollback disponível. O “release workflow success” isolado jamais substitui os recibos live/segurança e a assinatura do owner.

### P4. Migração de required checks — comandos do OWNER, sem downgrade de policy

**Dependências rígidas:** C green do próprio workflow + **AZ-01..07 comprovados no mesmo C (AZ-08 ainda NOT_AUTHORIZED; AZURE_RELEASE_QUALIFIED permanece BLOCKED até o ato de policy)** + B1–B3/M2–M4 + 3 reviews + autorização separada do owner; regra exata e app ID identificados; rollout da nova CI observado no **PR contra cada branch alvo** (não apenas dispatch/tag). O sf-ci.yml atual dispara pull_request para close-final-candidate e go-live-close, **não** para todo branch automaticamente. Se a regra exige contexto em outro target, A6 corrige o trigger por PR próprio; não remover o legado para ocultar ausência. Se o legado não está disparando, a fase aditiva pode **bloquear merges**, nunca liberar remanejando o check antigo. Congelar mutações concorrentes de settings durante esta janela com owner.

**4A. Identificar e fixar o GitHub App emissor (read-only):**

~~~bash
set -euo pipefail
gh api "repos/$REPO/commits/$C/check-runs?per_page=100" > "$SF_AUDIT_DIR/check-runs-C.json"
export SF_VERIFY_APP_ID="$(jq -er --arg c "$C" '
  [.check_runs[] | select(.name=="sf/verify" and .head_sha==$c and .conclusion=="success") | .app.id] | unique |
  if length==1 then .[0] else error("sf/verify app ID ausente ou ambiguo") end
' "$SF_AUDIT_DIR/check-runs-C.json")"
test "$SF_VERIFY_APP_ID" -gt 0
jq -e '(.checks | type)=="array" and (.strict | type)=="boolean"' "$SF_AUDIT_DIR/required.before.json"
~~~

O GitHub App ID **não** é hardcoded. Se o status atual estiver governado por ruleset de org, STOP e peça ao admin da org; o endpoint de branch protection sozinho não muda a policy da org.

**4B. Branch protection clássico — fase ADITIVA (não remove antigos):**

~~~bash
set -euo pipefail
jq --argjson app "$SF_VERIFY_APP_ID" '
  if ([.checks[].context] | index("sf/verify")) then error("sf/verify ja exigido: reavaliar baseline")
  else {strict:.strict, checks:(.checks + [{context:"sf/verify",app_id:$app}])} end
' "$SF_AUDIT_DIR/required.before.json" > "$SF_AUDIT_DIR/required.add.json"
jq -e '(.checks | length)>0' "$SF_AUDIT_DIR/required.add.json"
# OWNER confirma diff do JSON e aprovação por escrito antes da próxima linha.
gh api -X PATCH "repos/$REPO/branches/$BRANCH/protection/required_status_checks" --input "$SF_AUDIT_DIR/required.add.json" > "$SF_AUDIT_DIR/required.after-add.json"
gh api "repos/$REPO/branches/$BRANCH/protection/required_status_checks" > "$SF_AUDIT_DIR/required.observed-add.json"
jq -e --slurpfile old "$SF_AUDIT_DIR/required.before.json" '
  ([.checks[].context] | sort) ==
  (([$old[0].checks[].context] + ["sf/verify"]) | sort)
' "$SF_AUDIT_DIR/required.observed-add.json"
~~~

Abrir/usar PR controle fresco: verificar em UI/API que **sf/verify pendente/falho impede merge**, que o check do App ID fixado aparece no commit efetivamente verificado, que **cada contexto legado continua obrigatório**, que approvals/restrições/strict/sem-bypass permanecem e que rollback de policy foi ensaiado **sem retirar proteção**. Registrar URL, horário, capturas e export após a adição. **STOP antes de subtrair** se qualquer check desapareceu, falta requisito, ruleset herdado, status ausente ou revisão pendente.

**4C. Caso source-of-truth seja um repository ruleset ativo (e NÃO um ruleset de organização):** o dono deve usar o ID **observado**, exportar configuração inteira com bypass_actors, preservar todas as regras e fazer diff antes do PUT. O exemplo abaixo **só adiciona** um context a uma única regra do tipo required_status_checks; se condição não for verdadeira, STOP e tratar manualmente com admin. Não executar 4B como substituto de 4C.

~~~bash
set -euo pipefail
export SF_RULESET_ID=REPLACE_WITH_VERIFIED_REPOSITORY_RULESET_ID
[[ "$SF_RULESET_ID" =~ ^[1-9][0-9]*$ ]] || exit 1
gh api "repos/$REPO/rulesets/$SF_RULESET_ID" > "$SF_AUDIT_DIR/ruleset.before.json"
jq -e '.source_type=="Repository" and .enforcement=="active"
  and (.bypass_actors | type)=="array"
  and ([.rules[] | select(.type=="required_status_checks")] | length)==1' "$SF_AUDIT_DIR/ruleset.before.json"
jq --argjson app "$SF_VERIFY_APP_ID" '{
  name,target,enforcement,bypass_actors,conditions,
  rules:[.rules[] | if .type=="required_status_checks" then
    .parameters.required_status_checks += [{context:"sf/verify",integration_id:$app}]
  else . end]
}' "$SF_AUDIT_DIR/ruleset.before.json" > "$SF_AUDIT_DIR/ruleset.add.json"
# OWNER inspeciona diff completo; confirmar updated_at original antes do PUT.
gh api -X PUT "repos/$REPO/rulesets/$SF_RULESET_ID" --input "$SF_AUDIT_DIR/ruleset.add.json" > "$SF_AUDIT_DIR/ruleset.after-add.json"
gh api "repos/$REPO/rules/branches/$BRANCH" > "$SF_AUDIT_DIR/effective-rules.after-add.json"
~~~

**4D. Fase SUBTRATIVA, só com novo required comprovadamente operacional:** o dono compõe a lista exata de **contextos Epic a retirar**, retirados do export original — nunca supor nomes por prefixo, nunca remover checks de segurança/reviews alheios. O arquivo legacy-contexts.json é **preenchido e assinado pelo owner**, array JSON não vazio de strings de contexts exatos. Se ruleset, aplicar a mesma operação *somente* no array required_status_checks dentro da regra correta e fazer PUT do conjunto completo preservando tudo; se houver org ruleset, o admin da org faz equivalente com export/rollback próprio.

~~~bash
set -euo pipefail
export LEGACY_CONTEXTS="$SF_AUDIT_DIR/legacy-contexts.json"
test -s "$LEGACY_CONTEXTS" || { echo "STOP: owner ainda nao assinou contextos legados exatos"; exit 1; }
jq -e 'type=="array" and length>0 and all(.[]; type=="string" and .!="sf/verify")' "$LEGACY_CONTEXTS"
gh api "repos/$REPO/branches/$BRANCH/protection/required_status_checks" > "$SF_AUDIT_DIR/required.before-retire.json"
jq -e --slurpfile legacy "$LEGACY_CONTEXTS" '
  . as $current | all($legacy[0][]; . as $c | ([$current.checks[].context] | index($c)) != null)
' "$SF_AUDIT_DIR/required.before-retire.json"
jq --slurpfile legacy "$LEGACY_CONTEXTS" '{
  strict:.strict,
  checks:[.checks[] | select(.context as $context | ($legacy[0] | index($context) | not))]
}' "$SF_AUDIT_DIR/required.before-retire.json" > "$SF_AUDIT_DIR/required.retire.json"
jq -e '([.checks[].context] | index("sf/verify")) != null and (.checks | length)>0' "$SF_AUDIT_DIR/required.retire.json"
# OWNER comprova que todos os outros checks e App IDs permanecem idênticos; aprova o diff.
gh api -X PATCH "repos/$REPO/branches/$BRANCH/protection/required_status_checks" --input "$SF_AUDIT_DIR/required.retire.json" > "$SF_AUDIT_DIR/required.after-retire.json"
gh api "repos/$REPO/branches/$BRANCH/protection/required_status_checks" > "$SF_AUDIT_DIR/required.observed-retire.json"
jq -e --slurpfile desired "$SF_AUDIT_DIR/required.retire.json" '
  ([.checks[] | {context,app_id}] | sort_by(.context)) ==
  ([$desired[0].checks[] | {context,app_id}] | sort_by(.context))
' "$SF_AUDIT_DIR/required.observed-retire.json"
~~~

**Caso ruleset:** a fase subtrativa é um **ATO SEPARADO DO DONO** com re-export de ruleset após fase aditiva; NÃO rode o PATCH clássico se a autoridade real é ruleset. Registre diff completo, teste novo PR com sf/verify bloqueando merge, mantenha Epic YAML intacto durante observação. Aposentadoria do Epic: **outro PR, revisão/approval separados**, só depois de enforcement comprovado e fallback recuperável; desabilitar um workflow antes de resolver os required checks pode deixar o repositório bloqueado.

### P5. Rollback completo: release, dados e política são três eixos independentes

**Gatilhos de ABORT/ROLLBACK:** sha/tree/artefato fora de C; assinatura/digest divergente; timeout/cancelamento/skip; sf/verify RED, check ausente ou policy/bypass indevido; HTTPS/Host/Entra/CSRF/session/owner/project/installation/CAS/revogação incorretos; migração/backup/restore não comprovado; smoke sem mutação/efeito; F04/AM com negativo aceito; erros pós-deploy ou divergência de revisão do produtor. Em qualquer gatilho: **parar admissão de novas escritas** de forma suportada, preservar evidências brutas privadas, **não** usar rollback de dados para silenciar falha.

**Antes do cutover:** owner/A7 registra artifact anterior ID+SHA256, path de release anterior realmente instalado, unidade systemd e symlink atual observados, DB schema+versão compatível, backup consistente com job/recovery point, restauração **isolada** bem-sucedida, RPO/RTO autorizados, estado de Task/Relay/CAS/outbox/drain, runbooks e autorização de rollback. Sem essa base, **NÃO iniciar promoção**.

**R1 — aplicação apenas (compatibilidade de schema comprovada):** executar **somente no host autorizado** e após o owner aprovar o abort/cutover. Variáveis obtidas de estado real, nunca de placeholders. Não executar se a versão anterior requer database downgrade ou se Task/Relay ainda escreve.

~~~bash
set -euo pipefail
: "$SF_PREVIOUS_RELEASE_DIR" "$SF_NEW_RELEASE_DIR" "$SF_SERVICE_NAME"
test "$(uname -s)" = Linux && test "$(uname -m)" = x86_64
test -d "$SF_PREVIOUS_RELEASE_DIR" && test -d "$SF_NEW_RELEASE_DIR"
test "$(readlink -f /opt/orchestra-sf/current)" = "$SF_NEW_RELEASE_DIR"
test -L /opt/orchestra-sf/current
test ! -e /opt/orchestra-sf/.current.rollback && test ! -L /opt/orchestra-sf/.current.rollback
# Owner/A7 já confirmou drain, schema compatibility e snapshot recuperável.
sudo ln -s "$SF_PREVIOUS_RELEASE_DIR" /opt/orchestra-sf/.current.rollback
sudo mv -Tf /opt/orchestra-sf/.current.rollback /opt/orchestra-sf/current
sudo systemctl restart "$SF_SERVICE_NAME"
test "$(systemctl is-active "$SF_SERVICE_NAME")" = active
test "$(readlink -f /opt/orchestra-sf/current)" = "$SF_PREVIOUS_RELEASE_DIR"
# A7/A8: repetir HTTPS + smoke TRANSACIONAL, Entra/origem, CAS e estado pós-restart.
~~~

Se diretório temporário .current.rollback já existir, **STOP e inspecionar manualmente**; não apagar nem usar force para contornar. Registrar comando, horário, exit code, owner, aprovação, digest realmente servido e resultados do smoke. Se serviço falhar, **fechar tráfego** e escalar; não apontar binário velho para DB incompatível.

**R2 — migração incompatível / persistência comprometida:** não fazer symlink rollback sozinho. Bloquear writes, preservar volume, não copiar SQLite WAL ao vivo, verificar recovery point e Backup/Restore job no Azure e **restaurar primeiro em VM/disk isolados** conforme A7 AZ-03. Conferir identidade do LUN, 0700/0600, SQLite integrity, schema/migrations, CAS/journal, sessões revogadas, origem e produtores externos. Delimitar transações após recovery point, aprovação humana de reconciliação/perda aceitável, plano de cutover controlado e prova nova de commit/bytes. **Nunca** restaurar sobre VM em produção, refazer chown recursivo para ocultar mismatch, reanimar tokens revogados ou restaurar fonte remota como se fosse DB local. Se recovery point inválido: manter serviço fechado e escalar incidente; NÃO declarar rollback PASS.

**R3 — policy/required checks:** congelar merges. Se o novo contexto quebrou, conservar a política mais restritiva (nenhuma janela sem checks); reativar/comprovar Epic antigo **antes** de restaurar a lista original. Em branch protection clássico, o arquivo inicial é export/rollback do owner; não alimentá-lo bruto ao PATCH (contém campos read-only):

~~~bash
set -euo pipefail
jq '{strict,checks}' "$SF_AUDIT_DIR/required.before.json" > "$SF_AUDIT_DIR/required.rollback.json"
jq -e '(.checks | length)>0' "$SF_AUDIT_DIR/required.rollback.json"
# OWNER certifica que cada check antigo está PRODUZINDO resultados no target,
# e que restauração não elimina toda proteção. Somente então:
gh api -X PATCH "repos/$REPO/branches/$BRANCH/protection/required_status_checks" --input "$SF_AUDIT_DIR/required.rollback.json" > "$SF_AUDIT_DIR/required.after-rollback.json"
gh api "repos/$REPO/branches/$BRANCH/protection/required_status_checks" > "$SF_AUDIT_DIR/required.observed-rollback.json"
~~~

Para repository/org rulesets, restaurar a **configuração completa exportada** por admin da fonte, via diff e endpoint apropriado, mantendo policy ativa e sem substituir por []/desabilitada; revisão posterior de bypass/approvals/force-push. Se Epic não puder ser reativado e provado, **não retire** sf/verify: bloqueie merges e trate a causa. Revalidar branch protection e a segurança do target após qualquer rollback de policy.

**Critério de conclusão do rollback:** probes de efeito real + Entra/origem/ACL/CAS, artifact e schema anteriores comprovados, persistência e recuperação de dados/reconciliation confirmadas, branch enforcement íntegro, incident/approval/revisor com timestamps, sem perda além do RPO aprovado. Um comando de systemctl bem sucedido ou uma policy PATCH 200 sozinho NÃO é aceite.

### P6. O que falta precisamente do dono para autorizar o go-live (owner-request)

| Owner/provedor | Entrega verificável (NÃO enviar valores secretos ao chat/PR) | Estado nesta foto |
|---|---|---|
| **Repo admin (você)** | Export real de branch protection + effective/org/repo rulesets de **cada** branch-alvo; contexts e check App/integration IDs, strict, bypass, reviews e enforcement; autorização escrita e janela de migração/rollback | **BLOCKED_BY_OWNER** (MCP 403, lista [] sem valor conclusivo) |
| **Repo admin + A6/A1 (você decide merges)** | Integrar PRs A2–A9 dentro de seus leases, fixar problemas restantes, congelar C + tree e rodar CI final em C, 12 jobs + 8 receipts e negativos B1–B3/M2–M4 | **NOT_RUN / CI_HARNESS_PARTIAL / PRODUCT_RED** |
| **Três revisores humanos independentes** | Nome + papel (segurança/identidade; infra/dados/rollback; produto/produtor/CI), parecer assinado com URL, C, timestamp e cada finding resolvido; autor não assina o próprio patch | **NOT_ASSIGNED / NOT_RUN** |
| **Azure subscription/RG/VM owner** | IDs reais de subscription/RG/VM/dataDisk/backup vault e item, acesso RBAC mínimo, Ubuntu x64, deploy outputs, DNS/TLS/URL, Caddy upstream, janela e service name, staging isolada para restore, RPO/RTO/retention | **BLOCKED_BY_OWNER/ENV** |
| **Artefato & runtime A7/A6** | Artifact imutável de C (ID, URI restrita, SHA256/assinatura), pacote Web+host+Omni, factory/caminho privado/entrypoint Linux, digest do servido, slot anterior, migrations compatíveis, smoke transacional | **BLOCKED_BY_SOURCE/ENV** |
| **Microsoft Entra admin / A8** | Tenant/client ID, issuer, redirect/callback URI, consentimento e registro app real; **quatro delegated scopes solicitados + grants reais AllPrincipals + scopes emitidos/usados**, grupos immutable IDs, papéis e grants, atores requester/holder/denied/admin com sessões distintas, contrato Web I00 e topology same-origin/Host | **BLOCKED_BY_OWNER/SOURCE; GRANT NOT_OBSERVED** |
| **ADMIN-SURFACE (novo agente)** | Superfície Graph organograma/times/perfis e papéis por tela dashboard/planner/procurement: implementação, API/rota server-side autorizada por grupo `a739232b-d5cb-4f41-873b-4c9d2340831e`, ACL e CAS/persistência do produto, negativos e auditoria de **ausência de writes Graph/Entra/Teams** | **BLOCKED_BY_SOURCE/ENV; NOT_RUN** |
| **DEMO-FLAMENGO (novo agente)** | Fixture e cenários sintéticos com papéis/telas, permissão negada para atores sem grupo, instalação controlada e recibos de execução; **não usar fixture para provar identidade Microsoft real** | **NOT_RUN; FIXTURES NÃO QUALIFICAM AZ-02** |
| **Secrets pelo canal privado do dono (não Git)** | Entra client credential (certificado/segredo segundo implementação), chaves separadas de sessão/estado/CSRF, credenciais de produtor/factory, acesso privado ao Key Vault e política de rotação; configuração runtime root 0700/0600; **nada em Actions logs/receipts** | **BLOCKED_BY_OWNER** |
| **GitHub Environment + Azure OIDC** | Environment real com required reviewers/branch restriction e prevent-self-review; federated identity do job de deploy; identificação verificável de Azure client/tenant/subscription como vars/claims, Key Vault gerenciado (sem long-lived Azure secret em GH); aprovação nativa observada | **BLOCKED_BY_OWNER** |
| **F04/AM A9 + negócio** | Ator e dados não sensíveis aprovados, F04 manifest privado/selected-installation 0700/0600; Q01×3, U39/U40, AM01–06, oito receipts reais, backup e restore Linux com witness, sem skips | **BLOCKED_BY_ENV/SOURCE** |
| **Assinatura final você** | Aprovar produção, reversão e política em registros separados, plano incident/RPO/RTO, três flags PASS com provas; autorizar migração required checks **só depois** e Epic retirement **em PR separado** | **NOT_AUTHORIZED** |

**Classificação dos “secrets” sem inventar variável de aplicação:** os IDs Azure subscription/tenant/client e URL/issuer são **configuração não secreta**, eventualmente environment variables do job; OAuth client secret/cert private, chaves de sessão/CSRF e credenciais de integração são **segredos reais** em Key Vault/arquivo privado; os nomes finais de environment vars e secret keys devem vir dos contratos reais A7/A8 e ser conferidos no YAML integrado. O workflow atual **não lê nenhum secret/OIDC**. Nunca solicitar/colar credential no chat. O owner pode fornecer apenas **nomes, disponibilidade e aprovações**, não valores.

**Assinatura final (preencher só depois de observar):** C=NOT_FROZEN; CI_RUN_ID=NOT_OBSERVED; RELEASE_RUN_ID=NOT_OBSERVED; SHA256=NOT_OBSERVED; AZ01..08=NOT_RUN/BLOCKED; REVIEW_1..3=NOT_ASSIGNED; OWNER_APPROVAL=NOT_SIGNED; CHECK_MIGRATION=NOT_AUTHORIZED; GO_LIVE=BLOCKED. A planilha endereçável de recibos está em validation/final-bundle/evidence-template.md; nenhum campo está preenchido por inferência.

---

### P7. CHANGE-2026-11-16 — ADMIN-SUPREMO: novo gate release-only + extensão AZ-02

**Origem:** decisão do proprietário em 2026-11-16. **Status:** ESCOPO ACEITO NO PACOTE / IMPLEMENTAÇÃO E PROVAS NOT_OBSERVED. A orientação anterior de "escopo congelado" não dispensa esta exigência; **nenhum C qualificado existe**. O produto continua Web+Linux Azure; esta nova superfície é pré-requisito do go-live e requer nova integração, C/tree e provas frescas.

**Autoridades e isolamento de leases:** ADMIN-SURFACE é o único autor do código da superfície, do produtor de leitura Graph e da política de papéis por tela em seus arquivos designados por A1; DEMO-FLAMENGO é o dono exclusivo de `sf/demo/flamengo/**` e cenários sintéticos; A8 valida AZ-02 em tenant real; A2/A6 provam que testes da feature entram no manifesto/CI sem omissão; A1 revisa colisões e três pareceres; A10 registra o gate e **não implementa produto nem mexe em branch protection**. Refs vistas nesta coleta: `sfa-admin-surface` (estado de implementação ainda não qualificado) e `sfa-demo-flamengo` com `org.json`, `catalog.json`, `scenarios.json`, `seed.mjs` sintéticos e `execution.status=PENDING`. Existência dos arquivos não é prova funcional.

**Novo contrato de consentimento delegado do Microsoft Graph — decisão declarada, NÃO medição de tenant:**

| Scope delegado requisitado | Evidência do Entra exigida (AZ-02) | Uso observado (não inferir) |
|---|---|---|
| `User.Read` | app registration: requested; grant efetivo no service principal | operação Graph e token `scp` no usuário de teste |
| `User.Read.All` | requested; grant efetivo no resource Graph | endpoint real de leitura de usuários/perfis e `scp` |
| `GroupMember.Read.All` | requested; grant efetivo no resource Graph | endpoint real de membros/grupos e `scp` |
| `Directory.Read.All` | requested; grant efetivo no resource Graph | endpoint real de hierarquia/diretório, se usado; `scp` |

O grant delegado deve comprovar `consentType=AllPrincipals`, tenant, `clientId`/servicePrincipal/resource do Microsoft Graph, escopos da concessão, identidade do concedente, timestamp e evidência administrativa **sanitizada**; `requested` ≠ `consented` ≠ `issued in scp` ≠ `actually used on an endpoint`. Registre cada etapa **separadamente**. Um escopo concedido e não usado deve aparecer como `NOT_USED_OBSERVED`, nunca "utilizado". Nenhuma permissão `Application` ou permissão de escrita é autorizada por esta mudança. Tokens, cookies e identificadores sensíveis não entram no bundle.

**Grupo exclusivo de acesso à superfície:** `fla-supreme-admin`, ID imutável `a739232b-d5cb-4f41-873b-4c9d2340831e`. Checagem por **ID e contexto do tenant real, no backend**, com revalidação ao entrar e em cada operação sensível; negar não-membros, sessão anônima, grupo removido/revogado, token expirado, tenant diferente e cross-installation. UI ocultar menu **não** basta: chamada direta a rota de leitura e endpoint de gravação da política do produto deve produzir `401/403` apropriado sem efeito. Falha do Graph/consentimento/lookup => **fail closed**, não fallback que torne qualquer admin geral em "supremo". Verificar ator dentro do grupo contra pelo menos um ator autenticado fora dele; incluir Zico (sem grupo) no cenário de demonstração, **sem presumir sua identidade Entra como prova Microsoft**.

**Fonte e destino das alterações:** organograma, times, pessoas e perfis são projeções de **leitura** do Graph no tenant/escopo autorizado. Definição/revogação dos papéis `dashboard`, `planner` e `procurement` escreve somente na **policy/dados locais do Orchestra-SF** (seu produtor autorizado), com auditoria e CAS/versionamento; validação na API do produto para cada tela e operação, inclusive depois de refresh/restart/revogação. Não promover um papel local a grupo do Entra, não editar Teams membership, usuário ou atributo Graph. Exportar captura sanitizada de calls Graph e auditoria Microsoft no intervalo da prova + review do código/config cliente para comprovar **zero mutações Entra/Teams**, inclusive falhas de tentativa (não basta ausência de eventos isoladamente). Operações Graph com método POST estritamente read-only, caso existam, precisam estar em allowlist explícita com semântica verificada; todo mutating endpoint/método é negado. Não relaxar o cliente Graph para alcançar um 200.

**Matriz de aceite obrigatória, no mesmo C, instalação e tenant real:**

| Prova | DRI execução / auditor | Resultado exigido e evidência | Estado |
|---|---|---|---|
| `ADM-01` — delegated consent | Entra owner + A8 | Quatro scopes: requested vs consented (`AllPrincipals`) vs token `scp` vs chamadas usadas por operação, com IDs/horários/endpoints sanitizados | **NOT_RUN / BLOCKED_BY_OWNER** |
| `ADM-02` — Graph read-only | ADMIN-SURFACE + A8 | organograma/times/perfis reais por endpoint permitido, paginação/limitação e falha por falta de consentimento; zero fallback sintético para qualificação | **NOT_RUN / BLOCKED_BY_ENV** |
| `ADM-03` — supreme-only | ADMIN-SURFACE + A8 | membro de `a739232b-d5cb-4f41-873b-4c9d2340831e` lê/administra, todos os não-membros 401/403 em UI/rotas/APIs; remoção de grupo/revogação nega imediatamente | **NOT_RUN / BLOCKED_BY_ENV** |
| `ADM-04` — roles por tela | ADMIN-SURFACE + A8 | mudança autorizada de papel em Dashboard/Planner/Procurement só no produtor do produto, auditável/versionada, CAS/restart/revogação, e enforcement de cada tela/ação nos atores-alvo | **NOT_RUN / BLOCKED_BY_ENV** |
| `ADM-05` — Graph/Teams immutability | ADMIN-SURFACE + security reviewer | nenhuma API mutável ou side effect no Entra/Teams/Graph; allowlist request, tentativas de escrita rejeitadas, logs e snapshots restritos antes/depois | **NOT_RUN / BLOCKED_BY_ENV** |
| `ADM-06` — demo sintética | DEMO-FLAMENGO + A1/A8 | fixture Flamengo/roles/cenários executados por API autorizada, casos positivos/negativos e Zico sem grupo; tenant Graph real **continua prova independente** | **NOT_RUN / BLOCKED_BY_SOURCE** |

**Encadeamento fail-closed:** ADMIN-SURFACE e DEMO-FLAMENGO entregam PRs revistos → A1 aloca leases e avalia testes/privacidade → A2/A6 incluem testes no CI com negativos anti-omissão → C novo, mesmo 12-job topology somente se suas suítes absorverem os casos sem omissões → A8/ADMIN-SURFACE provam ADM-01..05 no tenant real, DEMO-FLAMENGO ADM-06 em ambiente controlado → três revisores e owner assinam → só então AZ-02/AZ-06/AZ-07/AZURE_RELEASE_QUALIFIED podem subir a PASS. A matriz do candidato e o atestado recebem referências **novas** de source SHA/CI run/attempt/Graph read receipts/host/actor IDs opacos/tempo/digest/revisor. Se qualquer ADM-01..06 não tiver prova endereçável, **GO_LIVE=BLOCKED**; sem downgrade do gate nem dispensas pelo sucesso do resto do CI.

**Owner handoff extra:** confirmar a app registration/consent AllPrincipals efetivos em tenant (escopos solicitados ≠ concedidos); admitir atores reais membros e não-membros do grupo supremo; garantir Graph audit logs sanitizados, contas de demonstração isoladas, autoridade de roles per-screen e consentimento para uso de dados de diretório em demo; aprovar reviewers e política de minimização. Nenhuma credencial nem diretório de usuários real entra no Git/PR.
