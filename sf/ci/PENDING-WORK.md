# Orchestra-SF — Backlog integral para encerrar CI/Testes e habilitar go-live

> **Status:** CI RESCUE INTEGRATED / FOLLOW-UP IN REVIEW / PRODUCT QUALIFICATION PENDING / AZURE RELEASE BLOCKED
>
> **Atualizado:** 2026-11-19 (America/Sao_Paulo). Integração: `sf-join-four`. A segunda rodada está no [PR #425](https://github.com/gustavomhss/Orchestra-SF/pull/425). SHAs e resultados focados ficam em [PERFORMANCE.md](./PERFORMANCE.md); nenhum deles qualifica automaticamente um SHA posterior.
>
> **Referência histórica preservada:** o [PR #242](https://github.com/gustavomhss/Orchestra-SF/pull/242) continua aberto, draft e não mergeado em `close-final-candidate`. O snapshot de 16/11 (`sf-ci-lean@0e4848847b85d3d5f97d03de63574c5461c50cba`, base `1cb77b8deb144e01a655c36987922338b1474003`, [run 43956369500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500)) é histórico; as suas falhas não são uma triagem atual do head de integração.

Este documento é o **backlog operacional das pendências**. Não é uma declaração de homologação. Distingue explicitamente (A) **entrega do harness CI**, (B) **correção da suíte/produto**, e (C) **qualificação de release Azure**. Qualquer item sem prova real fica ABERTO/BLOQUEADO, nunca PASS ou NOT_APPLICABLE.

## 0. Estado operacional reconciliado

O primeiro rescue foi integrado pelos PRs [#413](https://github.com/gustavomhss/Orchestra-SF/pull/413),
[#418](https://github.com/gustavomhss/Orchestra-SF/pull/418) e
[#419](https://github.com/gustavomhss/Orchestra-SF/pull/419). O writer compartilhado está em `dev`
pelos PRs [#408](https://github.com/gustavomhss/Orchestra-SF/pull/408) e
[#416](https://github.com/gustavomhss/Orchestra-SF/pull/416). A execução focada
[44661129868](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44661129868)
passou 176 testes e o typecheck real de Sucafina; o relatório registra o SHA exato e a prova de cache.

A rodada do PR #425 trata os inputs omitidos do cache, a preparação duplicada do Node,
o registro de tempos de execuções verdes/vermelhas, a geração vinculada dos oito shards e
a publicação de diagnósticos antes do limite total do job. O seu estado de validação e promoção
fica em [PERFORMANCE.md](./PERFORMANCE.md).

Pendências de qualificação continuam explícitas:

- `CI-SF`, `CI-UI-DECISIONS` e `CI-UI-REPORTS` ainda têm baseline `PENDING_REAL_COMPLETE_RUN`.
- O baseline browser de 32 arquivos precisa ser reconciliado com o inventário atual, que já cresceu; somente uma execução real verde pode fornecer o novo inventário de casos.
- As frentes de composição/runtime, incluindo [#414](https://github.com/gustavomhss/Orchestra-SF/pull/414),
  [#420](https://github.com/gustavomhss/Orchestra-SF/pull/420) e [#403](https://github.com/gustavomhss/Orchestra-SF/pull/403),
  estão em trabalho independente. O rescue não substitui suas provas.
- A comparação global com `origin/dev` ainda encontra `protected-paths` em `godfile-waivers.json` e
  `script/spawn-allowlist.json`, herdados da integração. A validação focada mede regressões sem conceder
  aprovação a esses paths; a integração final precisa da revisão correspondente e de guards estritos verdes.
- Depois do fechamento dos WPs, o próximo lote deve congelar um SHA integrado, gerar novamente
  o plano e os oito requests e medir o custo real. Rerun de um snapshot antigo conserva seu código e sua lista antiga.
- O próximo `sf-ci` completo só ocorre quando esses WPs estiverem fechados. Provas focadas
  podem continuar; não se deduz `PRODUCT_CI_GREEN` delas.

As tabelas de falhas nas seções 3 e 5 preservam a captura de 16/11, com sua origem explícita.
Os IDs de aceite das seções 4 e 6 continuam sendo obrigações; não se fecham por inferência a partir
de um PR de performance. Required checks e Azure não foram alterados nesta rodada.

## 1. Decisão de produto congelada — não reabrir o escopo

O Orchestra-SF é um **web app + host/runtime nativo Linux x86_64 em VM Azure**. Não é a distribuição canônica cross-platform do Orchestra. **Windows, macOS, installers desktop, matrizes ABI multi-OS, MUSL/Windows guest e publicadores canônicos** estão fora do gate obrigatório SF, mas isso **não** autoriza suprimir regras de autorização, Task/Permission/Relay, Omni Linux, host real, segurança de fonte, proveniência, CAS, drafts, revogação, provas financeiras ou jornadas aprovadas.

As **oito famílias** do aceite CI continuam: `CI-SF`, `CI-CLI`, `CI-APP-SRC`, `CI-APP-BROWSER`, `CI-ATLAS-BUSINESS`, `CI-UI-OPERATIONS`, `CI-UI-DECISIONS`, `CI-UI-REPORTS`. Suas seleções/obrigações estão em [`suites.json`](./suites.json). As provas independentes `AM01`–`AM06` **não foram substituídas** pelo CI de PR.

Não alterar o contrato para satisfazer os testes. Não reduzir asserts, criar identidades, simular aprovação humana, inventar serviços, ampliar CORS, ignorar erros de TypeScript, habilitar `continue-on-error`, marcar testes pulados como aprovados ou produzir recibo verde após falha.

## 2. Três linhas de chegada distintas

| Marco | Critério de conclusão objetivo | Situação na evidência atual |
|---|---|---|
| **CI_HARNESS_VALIDATED** | Preflight/negative controls, seletor Linux, CLI/Atlas/Browser selections, Omni, checks de proteção, JUnit/Playwright e `sf/verify` fail-closed demonstrados no **mesmo** commit; classificação exaustiva das falhas; revisão de equivalência | **VALIDAÇÃO FOCADA REGISTRADA**: rescue revisado e integrado; percurso completo do gate e qualificação final do candidato permanecem pendentes |
| **PRODUCT_CI_GREEN** | Static + **oito famílias completas** verdes, com recibos íntegros do exato SHA e sem falha/skips; `sf/verify=success` | **NÃO COMPROVADO NO HEAD ATUAL**: WPs ativos e baselines completos ainda pendentes; RED históricos estão na seção 3 |
| **AZURE_RELEASE_QUALIFIED** | Azure instalado real + identidade/autorização/origem, persistência/backup/restauração, smoke/rollback, F04, AM01–AM06 e revisores independentes na mesma release candidata | **BLOQUEADO**, sem ativação validada no workflow de release |

**Regra de decisão:** podemos aprovar a *arquitetura do harness* com `PRODUCT_RED` documentado, **mas não** podemos declarar `sf/verify` verde, migrar gates obrigatórios como se o produto estivesse aprovado, nem declarar go-live.

## 3. Snapshot histórico verificado do run de referência (16/11)

Fonte: [Actions run 43956369500](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43956369500), PR head `0e4848847b85d3d5f97d03de63574c5461c50cba`. A execução de PR usa SHA de **merge ref**; conservar o SHA real de `github.sha` de cada run em todos os recibos. Status congelado **no momento da coleta**, não inventar conclusão posteriormente.

| Job do novo SF CI | Estado observado | Evidência/pendência |
|---|---|---|
| `sf/preflight` | **PASS** | Testes negativos do gate, inventário Q01 e 39 regressões do seletor Linux passaram |
| `sf/linux-native-omni` | **PASS** | Binários Omni Linux x86_64 preparados e verificados |
| `sf/test-CI-CLI` | **PASS** | 12 arquivos explicitamente selecionados pelo manifesto; host SF |
| `sf/test-CI-APP-SRC` | **PASS** | Unidade de código-fonte App |
| `sf/test-CI-ATLAS-BUSINESS` | **PASS** | Seleção Atlas; geração verificada no static |
| `sf/static-and-contracts` | **FAIL — PRODUCT** | `TS2322` em `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx:331:91`; guarda de repositório: **78 regras, 0 gates, 1 warn, 0 erros de motor** |
| `sf/test-CI-SF` | **FAIL — PRODUCT/TEST TRIAGE** | Assertions de Planner, XLSX/OPEX, navegador privado; `--bail=5` depois de falhas reais |
| `sf/test-CI-APP-BROWSER` | **FAIL — PRODUCT/TEST TRIAGE** | Q01 registry contra catálogo congelado, drafts/revisões Procurement, fixture/browser |
| `sf/test-CI-UI-OPERATIONS` | **FAIL — PRODUCT** | 3 passaram, 2 falharam; jornadas de operações/procurement esperam HTTP 200 e observaram resposta divergente |
| `sf/test-CI-UI-DECISIONS` | **FAIL — PRODUCT/TEST TRIAGE** | 2 casos falharam, incluindo prazo de 180 s e locator esperado ausente |
| `sf/test-CI-UI-REPORTS` | **IN_PROGRESS à coleta** | Não atribuir PASS/FAIL sem o término do job; run anterior [43951326271](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43951326271) teve 2 timeouts `locator.fill` de 180 s |
| `sf/verify` | **AINDA NÃO PROVADO VERDE** | Só pode emitir PASS após `preflight/static/omni/unit/ui` verdes + 8 conjuntos íntegros de evidências |

O snapshot citado é anterior à criação deste arquivo. **Ao mudar docs/CI, o SHA muda e exige nova execução.** Não reutilizar resultados entre commits.

## 4. Backlog P0 — concluir a campanha de CI/testes (responsabilidade do harness)

Itens abaixo são a linha de chegada **da nossa campanha**, separada da correção de funcionalidades.

| ID | Prioridade | Responsável funcional* | Ação exata | Definition of Done / evidência |
|---|---|---|---|---|
| CI-01 | P0 | CI/Harness | Capturar um **run completo sem cancelamento** no head final deste PR; guardar run ID, merge SHA, head SHA, job IDs, horários e conclusões de cada job emitido, incluindo os oito shards SF | Tabela revalidada com status final de **cada** job; in-progress não vira sucesso por inferência |
| CI-02 | P0 | CI/Harness | Validar preflight independente: Linux X64, `gate.test.mjs`, regressões atuais de `test-ci-request`, 8 suites e inventário das provas release-only | Logs `sf/preflight=success`, regressões `0 fail`; alterações de manifesto/paths/ABI precisam falhar |
| CI-03 | P0 | CI/Harness | Exercitar `sf/verify` real na presença de upstream RED, confirmando o diagnóstico **antes** do download de artefatos | O job final termina em **failure** e informa todos os upstream failures; não há green, skip camuflado ou diagnóstico enganoso de artifact |
| CI-04 | P0 | CI/Harness + revisor independente | Revisar equivalência dos 8 recipes entre `modules/sucafina/Sucafinav1/docs/sf2h-plan/ci-recipes.json` e `sf/ci/suites.json`; mapa de cobertura por requisito e dependência real | Checklist assinado, especialmente por redução de `CI-CLI` e `CI-ATLAS-BUSINESS`; nenhuma dependência Linux usada pelo SF ficou órfã |
| CI-05 | P0 | CI/Harness | Validar seleção de testes por manifesto, não por lista YAML paralela: paths CLI/Atlas existem e são realmente executados; browser varre `test-browser/sucafina-native`; SF unit tree é admitida | Teste de seleção vazia/duplicada/alterada falha; teste novo em diretório admitido entra automaticamente; recibo exige execução não vazia |
| CI-06 | P0 | CI/Harness/Security | Validar integridade: resultado JUnit/Bun e JSON Playwright, sanitização, SHA256, run ID/attempt, runner OS, SHA checkout/PR, contagem, skipped/failure e artifact ausente/corrompido | Falha fechada em cada contraprova, **sem** expor tokens, cookies, stdout privado ou trace de ator |
| CI-07 | P0 | CI/Harness | Confirmar que `--bail=5` e `--max-failures=2` só param **depois** de falha real; no verde, todos os testes selecionados executam | Evidência de run vermelho rápido e execução completa quando o produto estiver verde; sem alteração de timeout/assert/resultado |
| CI-08 | P0 | CI/Harness | Confirmar workflows Linux-only: `sf-ci.yml`, `test-ci.yml`, `script/test-ci-request.ts`, `script/test-ci.ts`; nenhum trigger push duplicando PR | Inspeção da matriz e check negativo de Windows/macOS/ARM64/all/both; nenhum runner fora de Ubuntu x64 |
| CI-09 | P0 | CI/Harness/Security | Confirmar `check:guards` e `check:spawn-imports` executados mesmo se TS de produto falhar, sem autoaprovação de paths protegidos | Log com 78 regras, 0 gate, 0 engine errors no snapshot; revalidar no HEAD final; `AGENTS.md` idêntico à base |
| CI-10 | P0 | CI/Harness | Registrar cada RED como `PRODUCT_BUG`, `TEST_FIXTURE`, `MISSING_REAL_ENV` ou `CI_HARNESS`, com log/arquivo/caso, sem mexer em runtime nesta campanha | Nenhum erro de harness conhecido sem dono ou prova; produto vermelho permanece listado e bloqueante |
| CI-11 | P1 | CI/Harness | Medir tempo/consumo real do novo CI (fila, instalação Bun, build, Omni, cada suite, wall-clock e runner-min) e comparar com o Epic legado | Baseline observada com run ID, p50/p95 após amostra suficiente; nenhum número de SLA inventado |
| CI-12 | P1 | CI/Harness + responsável do repo | Revisão fria final do PR #242, concorrência com outras branches e mudança de base; revisar todos os arquivos alterados, inclusive teste Q01 dividido | Revisor independente confirma scope/test integrity e risco de regressão; comentários tratados antes de integrar |
| CI-13 | P1 | Proprietário do repo | Conferir **branch protection/rulesets**, required status contexts reais e política de merge. A integração usada aqui retornou **403** ao consultar protection | Evidência capturada por pessoa com permissão; plano de migração com rollback e required context estável `sf/verify` |
| CI-14 | P1 | Proprietário do repo | Só depois de CI equivalente **e** produto qualificado no SHA congelado, migrar required check para `sf/verify`; então aposentar `sf2-epic.yml` em PR separado | Checks novos verificados, sem janela de branch desprotegida, sem retirar Epic antecipadamente, plano de reversão |
| CI-15 | P1 | CI/Harness | Atualizar este documento com o run final, SHA e aceite por gate; substituir `IN_PROGRESS`/hipóteses por prova ou BLOCKED | Assinatura do encerramento da campanha **de CI**, sem escrever `GO_LIVE` por engano |

*Responsáveis são **papéis sugeridos**, não pessoas já designadas. Atribuição nominal permanece pendente.*

## 5. Backlog P1 — falhas reais da suíte/produto (não resolver por silenciamento de CI)

Esta tabela preserva a captura histórica de 16/11; cada item precisa ser confrontado com os fixes e evidências atuais antes de ser tratado como defeito ainda aberto. As correções pertencem às equipes de **produto/fixtures**. Elas são **bloqueadoras de `PRODUCT_CI_GREEN`**, mas não justificam recolocar Windows/macOS ou aceitar falso positivo.

| ID | Dono sugerido | Defeito/família | Arquivo/evidência | Aceite |
|---|---|---|---|---|
| PROD-01 | SF UI/TypeScript | `TS2322` JSX SVG `focusable`/atributos em Planner | `packages/app-shell/src/orchestra/chapters/sucafina/planner/overview/index.tsx:331` | Typecheck real do App passa sem `any`, `ts-ignore` ou mudar política de tipos |
| PROD-02 | Schema + UI host | Divergência Q01 entre `SfOperationRegistry`, extensões e catálogo congelado | `packages/app-shell/test-browser/sucafina-native/transport-contract.test.ts`; caso `Q01-TRANSPORT-REGISTRY` | Comparação do catálogo/rotas passa **sem** atualizar baseline arbitrariamente nem ampliar permissões |
| PROD-03 | Procurement + browser fixture | `createDraft` ausente foi corrigido; continuam falhas de review, fonte alterada, 409/422, quarantine e estados; distinguir bug de produto de fixture/happy-dom | `packages/app-shell/test-browser/sucafina-native/procurement-draft-leaves.test.ts` e demais `sucafina-native/*.test.ts` | Testes positivos e negativos passam com produtor correto e sem perder barreiras de CAS/owner/revocation |
| PROD-04 | SF Runtime | Falhas de Planner chart/cores, XLSX/OPEX, browser privado e contratos locais no tree SF | `modules/sucafina/Sucafinav1/test/` e run 43956369500, job `CI-SF` | Seleção CI-SF Linux completa e verde, não apenas os primeiros casos até `--bail=5` |
| PROD-05 | Operations/Procurement | Duas falhas da jornada Operations; respostas divergentes do HTTP 200 esperado | `packages/app-shell/e2e/sucafina/operations.spec.ts`, run 43956369500 | Playwright instalado `CI-UI-OPERATIONS` passa 100% com autorização real |
| PROD-06 | Decisions/Planner | Jornada Decisions: versão/choice, timeout e locator de resultado/recibo ausente | `packages/app-shell/e2e/sucafina/decisions.spec.ts`, run 43956369500 | `CI-UI-DECISIONS` verde com fluxo real de escolha/aprovação; sem retries para mascarar corrida |
| PROD-07 | Reports/Review | Timeouts `locator.fill` de 180 s em run anterior; classificar resultado do último run quando terminar | `packages/app-shell/e2e/sucafina/reports.spec.ts`, run 43951326271 e 43956369500 | `CI-UI-REPORTS` verde, evidence real, sem subir timeout por conveniência |
| PROD-08 | Test owners | Testes de macOS-local e F04 instalados realocaram de suites Bun para prova de release; confirmar **equivalência funcional** no Linux | `modules/sucafina/Sucafinav1/test/parity-pitr.test.ts`; `packages/app-shell/test-browser/sucafina-native/transport-integration.test.ts`; ver `sf/ci/suites.json` | Original preservado, 2 Q01 portable continuam ativos e 3 F04 live não são declarados PASS; prova Linux equivalente definida e executada em ambiente real |

Se após correção um teste falhar por fixture, corrigir o fixture **preservando a asserção e a autoridade do produtor original**, e anexar prova no commit. Se for defeito real, corrigir o produto em PR separado, integrar pelo processo normal e requalificar **novo** SHA.

## 6. Backlog P2 — go-live Azure e provas independentes (fora da campanha de CI)

| ID | Responsável sugerido | Ação / limite | Evidência obrigatória |
|---|---|---|---|
| AZ-01 | Infra Azure + produto | Integrar a **aplicação** na VM Linux real. O estado conhecido de `azure-hardening` representa fundação/Caddy, **não** comprova aplicação instalada | SHA e digests de artefatos, processo/serviço real, HTTPS/URL, health funcional, origem correta |
| AZ-02 | Security/Identity | Validar Microsoft Entra/OIDC real, origens shell vs host, cookies/CSRF, sessão real, binding owner/projeto/instalação, source authorization, revogação e CAS | Casos positivos e negativos reais; nenhum token no renderer, aprovação simulada, issuer forjado ou bypass Task/Permission/Relay |
| AZ-03 | Runtime/Data | Persistência Linux, migrations e restart, idempotência, source revisions, retention, arquivos privados, backup/restauração, rollback e ensaios de falha | Prova observada na VM, inclusive **backup/restore Linux** substituindo o requisito do teste de Litestream do operador local macOS |
| AZ-04 | Native Integration | Executar **F04** com manifesto `sf2h.native-installed-manifest.v1`, SHA de candidato, instalação/atores reais e raiz privada, em ambiente autorizado | As 3 negativas `Q01-TRANSPORT-GUEST/INVALID-OWNER/STALE-FENCE` passam sem credenciais falsas; witness e screenshots/logs seguros |
| AZ-05 | QA/Produto | Executar provas integradas **AM01–AM06**, 8 recipes, jornadas previstas e critérios aceitos no **mesmo C congelado** | Evidence package + recibos assinados/vinculados ao mesmo SHA; nenhum aceite implícito por unit test |
| AZ-06 | Engenharia + revisores | Revisão independente prevista pelo plano (incluindo revisores frios), congelamento exato do candidato e triagem de qualquer mudança pós-freeze | Registro de revisores, parecer e eventuais pendências; change no C força requalificação |
| AZ-07 | Release owner | Conectar `.github/workflows/sf-release.yml` a ambiente protegido, autorização humana, artefato imutável, smoke/rollback e provas do host real | Só substituir o `BLOCKED` inerte após testes negativos e revisão; **não** gerar deploy green apenas porque Azure responde 200 |
| AZ-08 | Owner repo / mudança controlada | Aprovar implantação e, posteriormente, aposentar CI legado sem perda de proteção | `PRODUCT_CI_GREEN` e `AZURE_RELEASE_QUALIFIED` documentados, com migração reversível de required checks |

## 7. Ordem de execução — caminho crítico, sem reabrir o canônico

**Fase A — concluir o aceite do CI integrado.** O rescue focado já está integrado em `sf-join-four`; o piloto #242 continua separado. Depois de fechar os WPs, capturar run final do candidato congelado, verificar `sf/preflight`, `sf/verify` fail-closed e oito recibos no percurso verde, cobrir seleção/release-only; classificar todos os RED, medir custo; revisão fria da seleção e políticas. Se o produto continuar RED, registrar `CI_HARNESS_VALIDATED / PRODUCT_RED`, não `CI_GREEN`.

**Fase B — fechar os WPs de produto ativos.** Manter PRs isolados para TypeScript, Procurement/browser, SF/Budget/Planner, Operations, Decisions e Reports. Cada correção deve passar testes focados **no Linux** e posteriormente o gate completo do **novo SHA**, sem pular testes. Sincronizar o candidato congelado C.

**Fase C — liberar Azure apenas quando demonstrado.** Integrar instalação Linux e identidade, provar F04/backup/restore, AM01–AM06, revisões e rollback. Autorizar migração de required checks sem janela de bypass; desligar o Epic somente em mudança separada e aprovada.

## 8. O que já foi entregue e não deve ser refeito

Entrega histórica do piloto #242, posteriormente evoluída na integração: workflow `sf-ci.yml` Linux-only; runner `test-ci` Linux-x64; um trigger PR; seleção autoritativa de CLI/Atlas pelo manifesto; pasta SF browser; verificador de recibos com SHA/attempt/runner/count/digest; evidência Playwright minimizada; fail-fast em vermelho; preflight separado; diagnóstico `precheck` antes do download; `AGENTS.md` idêntico à base; `sf-release.yml` fail-closed; prova F04 real separada da Q01 pura (cinco casos preservados); Litestream do operador local separado do release Linux.

**Provas efetivamente observadas:** preflight PASS (incluindo 39 testes do seletor Linux), Omni PASS, CLI PASS, App-src PASS, Atlas PASS em 43956369500; guards 78 regras, 0 gate, 1 warning; divergências do produto continuaram vermelhas. Resultados **não se transferem** a futuros SHAs.

## 9. Regras rígidas de encerramento

- `CI_HARNESS_VALIDATED` exige cobertura/review documentados e validação no novo commit, mas **não permite mascarar `PRODUCT_RED`**.
- `PRODUCT_CI_GREEN` exige oito famílias + static + Omni + `sf/verify` em PASS, não basta `preflight`.
- `AZURE_RELEASE_QUALIFIED` exige evidências instaladas F04, Linux backup/restore, AM01–AM06, segurança, rollback e reviewers no mesmo SHA.
- Nunca autoaprovar proteção de branch, nunca publicar segredos em artefatos, nunca afrouxar validações de origem/permissão/CAS/revogação, nunca declarar “não aplicável” por indisponibilidade.
- O PR #242 permanece **DRAFT, NÃO MERGEADO**; o Epic legado segue intacto. A ferramenta de leitura de branch protection retornou `403 Resource not accessible by integration`: a alteração de required checks precisa ser verificada por pessoa com permissão e **não foi executada**.

**Status operacional:** primeiro rescue de CI integrado e comprovado por testes focados; segunda rodada no PR #425; qualificação completa do produto e baselines pendentes; Azure release BLOCKED. As evidências históricas permanecem vinculadas aos seus SHAs.
