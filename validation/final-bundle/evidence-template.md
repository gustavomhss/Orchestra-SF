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
| `AZURE_RELEASE_QUALIFIED` | BLOCKED | C servido, Azure+Entra+F04+AM01–06+restore/rollback e 3 cold reviews |

## 5. Azure instalado — provas release-only do MESMO C
| Prova | Run/host control ID, digest, resultado observável | Estado inicial |
|---|---|---|
| AZ-01: app Web + host realmente instalado em VM Linux x64, HTTPS/URL e processo | NOT_OBSERVED | BLOCKED_BY_ENV |
| AZ-02: login Microsoft Entra/OIDC, origem, CSRF, cookies/sessão e revogação, CAS, Task/Permission/Relay | NOT_OBSERVED | BLOCKED_BY_ENV |
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
