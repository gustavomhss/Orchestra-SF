# Rodada 3 — rechecagem independente de contexto

**Candidato corrigido:** `9a1812f360fa245fa2fac9aacf4938ddf8f21381`  
**Candidato do parecer inicial preservado:** `10a99bf06c5578ec02dab590a680ab18766c7ff4`  
**Baseline do código:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`  
**Veredicto:** **APPROVED_FOR_EXECUTION**, no escopo de contexto/seleção deste SHA.  
**Achados abertos:** P0=0, P1=0, P2=0.  
**Produto e provas de implementação:** **NOT_RUN**.

## Resultado

Os quatro achados do parecer inicial foram corrigidos e encerrados. O compilador 1.0.1 fecha as dependências de leitura em contratos, handoffs, produtores, rotas, skills, perfis, provas e evidência. Os 23 pacotes passaram pela inspeção independente dessas relações, e a ampliação não alterou atribuições, branches, leases ou autoridade de escrita. Os 12 controles negativos documentais foram reproduzidos e recusados.

A medição corresponde exatamente aos arquivos publicados: **3.688.283 bytes** para o arranque das cinco coordenadoras, frente aos **12.990.095 bytes** da baseline, redução de **71,61%**. O custo das definições acrescentadas está incluído. Essa comparação continua sendo de bytes de documentos, sem alegar redução equivalente de tokens, latência ou duração de execução.

Não li rechecks dos outros agentes e não reabri a investigação do produto inalterado.

## Disposição de cada achado

| Achado inicial | Severidade | Disposição no candidato corrigido |
| --- | --- | --- |
| R3-CTX-01 — contratos ausentes | P1 | **CLOSED_CORRECTED** |
| R3-CTX-02 — handoffs de GNATIVE ausentes em S3 | P1 | **CLOSED_CORRECTED** |
| R3-CTX-03 — rotas sem skill/prova resolvida | P2 | **CLOSED_CORRECTED** |
| R3-CTX-04 — medição desatualizada e referência quebrada | P2 | **CLOSED_CORRECTED** |

### R3-CTX-01 — contratos

O compilador agora coleta referências do conteúdo efetivamente selecionado, incluindo intervalos de contratos, e fecha as definições transitivamente. `validate_contract_selection` verifica que as referências resolvem definições canônicas e que dependências residentes conservam o anexo correspondente.

Conferi todas as `consumer_edges` e operações dos 23 pacotes: **nenhuma aponta para contrato ausente**. As oito arestas e as sete operações de produtores diretos enumeradas no inicial estão resolvidas. S1-A recebe C15 e `specs/resident-runtime.md`; S1-C e S4-B recebem C10. Todos os contratos incluídos são iguais ao catálogo canônico.

Reproduzi cinco controles: remover C15 de S1-A, remover C10 de S1-C, remover C10 de S4-B, remover o anexo residente de S1-A e inserir C99 no trabalho de WP01.T05. Todos foram recusados. O último controle comprova que uma dependência desconhecida não é silenciosamente ignorada durante a geração.

### R3-CTX-02 — fases e handoffs

A seleção agora incorpora `requires` e `full_runtime_requires` das fases antes de montar os handoffs. O pack S3 contém os cinco inputs completos de GNATIVE: **AI-NATIVE, NATIVE-CASE, NATIVE-PLANNER, NATIVE-RUNTIME e NATIVE-COMPOSE**.

Conferi todos os handoffs referenciados por fases nos 23 pacotes contra a fonte: corpos integrais, paths de receipt, status, readiness e aceite coincidem. Quando o produtor está fora da atribuição, há também o seu `dependency_context`. A seleção não lhe transfere autoria.

Remover cada um dos três handoffs originalmente ausentes de S3 foi recusado por `validate_dependency_selection`.

### R3-CTX-03 — rotas, skills e provas

O fechamento das rotas inclui as skills e perfis referenciados, reavalia as operações necessárias e seleciona as provas das rotas/packs com seus pacotes evidenciais. Os cenários UI das skills acompanham essa leitura.

Todas as rotas selecionadas resolvem skill, perfil, prova de execução, prova residente e cenário UI. As definições de skill/prova foram comparadas ao canônico. Todos os pacotes de evidência exigidos por essas provas estão incluídos no respectivo ator.

S2-A recebe `sf-comparar-sourcing` e AM02. Seu fechamento atual contém cinco skills e AM01–AM06 como **definições de leitura**, com os `execution_actor` canônicos preservados. A nova `reference_context_rule` explicita que ler contratos, rotas, skills e provas não transfere ownership, escrita ou execução. Remover a skill de sourcing ou AM02 do seu pacote foi recusado.

O P2 foi corrigido; não foi adiado nem convertido em obrigação opcional.

### R3-CTX-04 — medição e referência

O receipt de baseline agora resolve para `formal-review/round-3/analysis/context-baseline.json`, existente no candidato. O SHA de plano registrado na medição coincide com `campaign.json`.

Comparei as listas por coordenadora com o conjunto obrigatório de prompt, COMMON, pack, workflow, manifesto, fontes, README formal e anexos: **são conjuntos exatos, sem duplicatas**. As somas coincidem byte a byte:

| Sessão | Bytes registrados | Bytes observados |
| --- | ---: | ---: |
| S0 | 788.588 | 788.588 |
| S1 | 711.403 | 711.403 |
| S2 | 806.833 | 806.833 |
| S3 | 743.698 | 743.698 |
| S4 | 637.761 | 637.761 |
| **Total** | **3.688.283** | **3.688.283** |

A diferença para a baseline é **9.301.812 bytes**, ou **71,61%** após arredondamento. Os 23 packs somam separadamente **9.516.800 bytes**, com mínimo de 281.827 e máximo de 545.587. Esses números não são apresentados como economia total da execução.

O P2 fica encerrado no SHA examinado. Qualquer mudança posterior em um documento contado exige recalcular a medição correspondente.

## Verificações e regressões

| Verificação | Resultado |
| --- | --- |
| Deltas dos dois scripts alterados lidos antes de executar | Conforme |
| `python -B tools/render_fast_context.py --plan campaign.json --check` | PASS; 50 artefatos; drift vazio |
| `python -B tools/render_plan.py --plan campaign.json --check` | PASS; 100 artefatos; drift vazio |
| `python -B tools/validate_plan.py` com output externo | PLAN_STRUCTURE_PASS |
| Auditoria independente de dependências dos 23 packs | Zero omissões nas relações verificadas |
| Controles documentais negativos | 12/12 recusados |
| Alterações em atribuições e autoridade | Nenhuma |
| Mutação da fonte pelo compilador | Nenhuma |
| Medição publicada | Exata |
| `sha256.json` | 204 entradas conferidas |
| Hash, tamanho e digest Markdown dos 23 packs | Todos conferem |
| Hashes canonical/COMMON e source receipts | Todos conferem |
| Imutabilidade do snapshot | 205 arquivos idênticos antes/depois |

Os controles incluem também os dois checks novos de `validate_execution_plan.py`: a identidade de evento por lane/SHA foi recusada com `EVENT_IDENTITY_DRIFT`, e retirar GLOBAL_RELEASE da topologia foi recusado com `EVENT_ROSTER_DRIFT`. Isso verifica a mudança do gate documental, sem substituir o parecer do escopo de supervisão sobre o protocolo completo.

Comparei os campos de cada ator com o candidato inicial: `assignment`, `write_authority`, `allocation`, `physical_slot`, `criterion_ids`, `proof_bindings`, `work_packages`, `branch_provenance`, `review_assignment` e `review_sources_read_only` permanecem idênticos. A correção, portanto, amplia leitura sem criar tarefas ou permissões novas.

Na fonte canônica, contratos, work packages, resident AI, handoffs, dependências de fase, atribuições de prova, ownership e timebox também permanecem iguais ao inicial. Mantêm-se **15 WPs, 74 tasks, 17 contratos, 1.610 critérios, 18 skills, 39 operações, 23 identidades e 19 handoffs**. Nenhuma prova de implementação passou de NOT_RUN para PASS.

## Evidências e hashes

A enumeração por ator e os controles reproduzidos estão em `context-recheck-evidence.json`. A saída do validador está em `context-recheck-structure.json`; a conferência de integridade em `context-recheck-integrity.json`. O inventário anterior aos comandos foi preservado em `context-recheck-snapshot-before.json`. O parecer inicial permanece inalterado.

| Arquivo | SHA-256 |
| --- | --- |
| campaign.json | `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba` |
| tools/render_fast_context.py | `ac9650762b0296a78198d6106b099bd4bf2cf23a9273f783077c9c2a8d4278e9` |
| tools/validate_execution_plan.py | `a1084f6971001285e9063099947484ee85646247a4da99dd10efede9b9c3cb2b` |
| execution/manifest.json | `fb6a94a2dc868bb24b95f2924921584888a088ef4af25401daf82e154d6d8471` |
| execution/COMMON.md | `a518cf4b3136d5c1126d59304afedf71b5f93168314f1f2f56743dcae719c94e` |
| execution/context-measurement.json | `a9a3f3d889a5ccf7cad5f39e7ae13a804fae96efb801207046e689cfe7d8a9ed` |
| context-recheck-evidence.json | `4ccded02f35a5846cdd36e9f834d4093de05626d9f3cab28363f7753241a43a7` |

## Limites da aprovação

A aprovação vale para a seleção/contexto e as bordas corrigidas do candidato **9a1812f360fa245fa2fac9aacf4938ddf8f21381**. A identidade remota foi fornecida pela supervisora com sua conferência MCP; esta rechecagem confirmou os bytes e hashes locais, sem repetir materialização remota ou o guard de 78 regras.

Todos os comandos foram documentais, com `python -B`; os controles usaram cópias em memória e os resultados foram gravados fora do snapshot. Não houve produto, testes do repositório, CI, Actions, modelo, MCP de negócio, Atlas, Relay, deploy, publicação ou mensagens externas.

Este veredicto não certifica implementação, capacidade operacional disponível ou prazo de 120 minutos. A execução futura deve satisfazer os gates e produzir suas próprias provas. Mudanças posteriores no compilador, na fonte ou nas atribuições exigem rechecagem proporcional; alterações em documentos da medição exigem novos totais no SHA correspondente.
