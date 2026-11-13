# Rodada 3 — revisão independente de contexto

**Candidato:** `10a99bf06c5578ec02dab590a680ab18766c7ff4`  
**Parent:** `0aa2405bb3668314f60d6a674d2bd53fd5003091`  
**Baseline do código:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`  
**Veredicto:** **CHANGES_REQUIRED** — dois P1 abertos e dois P2 com disposição explícita.  
**Produto e provas de implementação:** **NOT_RUN**.

## Escopo e conclusão

Revisei o delta do compilador `tools/render_fast_context.py`, sua integração em render/validate, COMMON, os 23 pacotes JSON/Markdown, os manifestos de execução/fontes, as entradas de lançamento e as dependências de leitura. O foco foi a seleção por ator e a preservação das relações entre tarefa, contrato, produtor, consumidor, lease e gate. Não reabri a investigação de produto inalterado nem li pareceres de outros revisores desta rodada.

A fonte preserva os **15 WPs, 74 tasks, 17 contratos, 1.610 critérios, 18 skills e 39 operações**. Os corpos de tasks selecionadas e seus axiomas são cópias exatas, os hashes conferem e os renderizadores reproduzem o candidato. O problema está no fechamento das referências **dentro de cada pacote**. A união global contém tudo, mas atores específicos não recebem definições ou handoffs que o seu próprio contexto exige. O gate documental atual aceita essas omissões.

## R3-CTX-01 — P1: contratos pertinentes ausentes dos pacotes

**Requisito.** O protocolo exige seleção completa de tasks, axiomas e contratos, acompanhando produtores/consumidores. WORKFLOW §2 e os prompts apresentam o pack como contexto suficiente para a atribuição, com expansão precisa quando uma dependência exige mais leitura.

**Localização.** `tools/render_fast_context.py`, linhas 163–169, 207–209, 232 e 235. `contract_ids` usa somente `WP.contract_reads + WP.contract_provides`. A seleção posterior de arestas, operações, tarefas e anexos não fecha as referências adicionais desses objetos. As verificações finais das linhas 286–289 são de união global, sem resolução por ator.

**Contraexemplo no candidato exato.** Os seguintes objetos estão nos packs, mas seu contrato está ausente de `/contracts`:

| Ator | Aresta selecionada | Contrato ausente |
| --- | --- | --- |
| S1-A | SKILL-UI-CONSUMPTION | C15 |
| S1-C | AIEDGE05 | C10 |
| S1 | PRODEDGE03 | C10 |
| S3-B | AIEDGE11 | C13 |
| S4-A | AIEDGE04 | C14 |
| S4-A | AIEDGE15 | C07 |
| S4-B | PRODEDGE03 | C10 |
| S4-C | AIEDGE08 | C12 |

O problema não depende apenas de arestas amplas de WP. S1-C é o produtor das operações `sf_forecast_compare`, `sf_scenario_simulate` e `sf_scenario_compare`, cujos descritores exigem C10. S2-A produz `sf_contract_read` e `sf_sourcing_compare`, com C14 e C10/C14 ausentes. S4-A produz `sf_case_draft` e `sf_alternative_draft`, com C11 ausente.

Há também referências diretamente no trabalho: WP01.T05 exige a matriz de 18 skills C15; WP03.T01 publica C10; WP12.T03 usa C10 na crítica de alternativas. A ausência de C15 em S1-A ainda faz o compilador deixar `specs/resident-runtime.md` fora dos seus anexos obrigatórios.

**Consequência.** O ator recebe a obrigação de integrar um contrato sem receber sua definição normativa no contexto declarado suficiente. Pode acabar implementando pelo nome/resumo ou fazer uma busca adicional não explicitada. Isso prejudica a completude e o argumento de redução de contexto, mesmo que uma integração posterior eventualmente descubra a falta.

**Correção mínima.** Calcular dependências de leitura a partir do conteúdo selecionado e das referências estruturadas de tasks, arestas, operações e contratos; normalizar IDs e recusar Cxx desconhecido. Incluir as definições pertinentes ou declarar expansão obrigatória exata por path/selector/digest. Derivar os anexos das dependências efetivas. A ampliação é somente de leitura: não muda assignment, branches, leases ou autoridade. Verificar por ator que cada referência necessária resolve; não apagar uma obrigação para fazer a seleção passar.

**Gate e rechecagem.** O candidato atual retorna `PLAN_STRUCTURE_PASS` e `drift=[]` em ambos os renderizadores. Portanto, esse é um contraexemplo real ao gate, não uma possibilidade abstrata. A rechecagem deve verificar todas as arestas e operações selecionadas e recusar controles com contrato requerido omitido ou desconhecido.

## R3-CTX-02 — P1: três handoffs de GNATIVE ausentes de S3

**Requisito.** WP00.T04 é tarefa primária de S3. A fase `GNATIVE18-20` exige cinco outputs em `task_output_dependencies.requires`; a seleção deve conservar os registros completos desses inputs até o consumidor e o gate.

**Localização.** `tools/render_fast_context.py`, linhas 169–170 e 233–234; `execution/actors/S3.json`, `/task_output_dependencies/0` e `/incoming_outgoing_handoffs`.

**Contraexemplo.** A fase de S3 exige `AI-NATIVE`, `NATIVE-CASE`, `NATIVE-PLANNER`, `NATIVE-RUNTIME` e `NATIVE-COMPOSE`. Os três primeiros não aparecem no seu conjunto de handoffs. Isso ocorre porque a seleção usa somente `producer_task` e `consumer_tasks` de cada output, sem incorporar `requires` e `full_runtime_requires` das fases já selecionadas. As linhas canônicas desses três outputs não enumeram WP00.T04 em `consumer_tasks`, embora a fase e as interfaces residentes o identifiquem como consumidor.

Ficam fora, entre outros dados, os receipts canônicos `WP12/handoffs/ai-native.json`, `WP11/handoffs/native-case.json` e `WP03/handoffs/native-planner.json`, sob `modules/sucafina/Sucafinav1/docs/sf2h/receipts/`.

**Consequência.** O qualificador de GNATIVE recebe os IDs e resumos dos inputs, mas não os registros completos de aceite, recibo e status desses produtores. A coleta no caminho crítico passa a depender de expansão implícita. A contagem global continua em 19 handoffs e não detecta a falta do consumidor S3.

**Correção mínima.** Selecionar primeiro as fases pertinentes e unir seus `requires/full_runtime_requires` à seleção direta de handoffs. Verificar que cada referência resolve exatamente uma linha canônica completa no pack. Não alterar autoria, readiness, critérios ou status para resolver o erro.

**Gate e rechecagem.** Os três validadores documentais passam no candidato atual. O pack corrigido de S3 deve conter os cinco handoffs de GNATIVE; a mesma verificação deve abranger todas as fases dos 23 atores e recusar a remoção de um input requerido.

## R3-CTX-03 — P2: rotas selecionadas sem skill/prova resolvida

**Requisito.** A rota positiva de uma operação conserva perfil, skill carregada, operação e prova AM02. A seleção pode expandir fontes sob demanda, mas deve tornar explícita a leitura normativa necessária.

**Localização.** `tools/render_fast_context.py`, linhas 171–201, 217–221, 240 e 246–248; campos `/resident` e `/execution_proofs` do pack S2-A.

**Contraexemplo.** S2-A recebe quatro rotas: `sf_request_read`, `sf_supplier_read`, `sf_contract_read` e `sf_sourcing_compare`. Todas apontam à skill `sf-comparar-sourcing` e à prova `AM02`, mas `resident.skills`, `resident.integrated_proofs`, `execution_proofs` e `resident_ui.skills` estão vazios. A seleção de skills antecede a inclusão das operações produzidas e não é fechada pelos `skill_id` das rotas; a seleção de provas também não inclui os IDs dos packs/rotas. S0-A tem cinco rotas cujas skills não estão no pack. A evidência auxiliar enumera os demais casos.

**Consequência e severidade.** O pack entrega referências sem o conteúdo normativo que sustenta carregamento, consumo e prova. A expansão dos anexos/fonte canônica permite recuperar a informação, e o owner global de AM02 conserva a obrigação. Por isso, classifico como **P2**; não afirmo que a prova global foi removida.

**Correção mínima e disposição.** Fechar as dependências de leitura das rotas em skills, cenários UI pertinentes e provas, ou declarar slices normativos obrigatórios com selectors/digests exatos. Validar cada referência resolvida e contabilizar as expansões obrigatórias. Essa leitura não dá ao produtor permissão de escrever a skill. **Disposição:** corrigir junto do fechamento de seleção nesta rodada e reavaliar com o candidato corrigido.

## R3-CTX-04 — P2: medição desatualizada e receipt quebrado

**Requisito.** A medição deve ser reproduzível no candidato publicado e manter clara a diferença entre bytes, tokens e duração.

**Localização.** `execution/context-measurement.json`, totais e linhas por sessão; `execution-workflow.json`, `/measurements/baseline/receipt`.

**Contraexemplo.** A soma real dos arquivos enumerados é **3.392.597 bytes**, mas o arquivo registra **3.392.562**, diferença de 35 bytes. Cada uma das cinco sessões tem 7 bytes a mais que o valor registrado. Para S0, são 787.435 observados contra 787.428 registrados. O workflow cita `context-volume-measurement.json`, que não existe no snapshot.

**Consequência e limites.** A diferença não altera o percentual arredondado de 73,88% e não constitui falsa alegação de velocidade. A baseline foi confirmada: os 15 documentos antes exigidos somam 2.598.019 bytes por coordenadora e 12.990.095 nas cinco. A comparação está corretamente limitada ao arranque das coordenadoras, sem afirmar economia total dos 23 atores ou cumprimento de duas horas. Ainda assim, o receipt atual não reproduz exatamente os bytes do candidato, e a referência está quebrada.

**Correção mínima e disposição.** Recalcular após o último ajuste dos documentos e da seleção, apontar para um receipt versionado existente e conferir automaticamente os arquivos/totais/referências. Conservar as exclusões de leitura de código real e expansão adicional e a distinção entre bytes, tokens e tempo. **Disposição:** regenerar no fechamento; não bloqueia isoladamente, mas o número antigo não deve ser apresentado como exato.

## Verificações concluídas

| Verificação | Resultado |
| --- | --- |
| AGENTS indicado, protocolo e scripts lidos antes da execução | Conforme |
| `python -B tools/render_fast_context.py --plan campaign.json --check` | 50 artefatos; drift vazio |
| `python -B tools/render_plan.py --plan campaign.json --check` | 100 artefatos; drift vazio |
| `python -B tools/validate_plan.py` com output externo ao snapshot | PLAN_STRUCTURE_PASS, limitado pelos achados |
| WPs/tasks/contratos/critérios | 15/74/17/1.610 preservados; nenhum ID de critério removido ou criado |
| Status dos 1.610 critérios | Todos NOT_RUN |
| Corpos de tasks, metadados e axiomas de WPs selecionados | Cópias exatas da fonte |
| Primários e proof_bindings | Conferem; somente WP10.T03 possui os três reviewers primários previstos |
| Resident AI, contratos, handoffs e leases de skills contra o parent | Conteúdo canônico preservado |
| União de handoffs/skills/operações | 19/18/39; não substitui fechamento local |
| Branches e pointers de proveniência | Todos resolvem o canônico |
| Leases de skills e distinção entre leitura/escrita | Seleção por writer/handoff_to preservada |
| Manifest, Markdown e COMMON | Todos os digests/tamanhos dos 23 packs conferem |
| `sha256.json` | 189 entradas verificadas, sem divergência |
| `execution/sources.json` | Baseline e cópias exatas de 11 receipts gerais e 61 receipts residentes |
| Anexos e fontes WP dos reviewers | Todos os paths existem; expansão normativa permanece obrigatória |

Os 23 textos de critérios alterados em relação ao parent pertencem ao delta de C/D e guias; não houve conversão de estado para PASS. A contagem de 1.852 objetos definidos do validador inclui mais tipos de objeto e não deve ser confundida com os 1.610 critérios.

## Evidência e hashes

Os detalhes reproduzíveis estão em `context-evidence.json`; a saída integral do validador está em `context-structure.json`. `context-snapshot-before.json` conserva o inventário de hashes usado para conferir a imutabilidade do snapshot. Os 23 digests dos packs estão no arquivo de evidência.

| Artefato | SHA-256 |
| --- | --- |
| campaign.json | `044c729f37c055bf81c1cf4832ad37ffcd96b77834e0c725b6a0da51c1a4421d` |
| tools/render_fast_context.py | `151da2ea446177dfec7501cec5387415a21d12e59188575cfbaa6429a790df68` |
| tools/render_plan.py | `7df6394361619b374a2dcc3a91dd63585d6d4314cb3289e2e66d5d2606e37a42` |
| tools/validate_plan.py | `0625420f9102cdd8d81f474d6ff224ff50c44a1f7e91ccecdf52ea0111e1fa7e` |
| execution/COMMON.md | `8e5a92df01791d602b3666533038d1bea6fe70e5ce84f2b8ffec4cd071658e86` |
| execution/manifest.json | `7065f3e0eb36a9118cf45c3067b6f0961752cbefdb0a95620356da32f0823065` |
| execution/sources.json | `fc75918615d53f0f5b226cd2f3272af362ba725f41c93b16098f0965780d9641` |
| context-evidence.json | `cc1f6e4031d8232f6e147d29dd6120566416aba4b1ac19b2dc8a334291665eae` |

## Limites e condição de aceite

Esta revisão verificou os bytes do snapshot local identificado na atribuição. A conferência do SHA remoto via GitHub MCP pertence à supervisora. Não executei código de produto, testes do repositório, CI, modelo, MCP de negócio, Atlas, Relay, deploy, publicação ou mensagens externas. Os comandos foram exclusivamente documentais, com `python -B` e resultados fora do snapshot.

Não realizei exploração exaustiva por mutações: os principais contraexemplos já existem no candidato exato e atravessam seu gate documental. Economia de bytes não demonstra economia de tokens, latência, custo, capacidade ou prazo. A correção deve preservar o escopo e as permissões, resolver os dois P1 e dar destino verificável aos P2. Só o candidato corrigido, após rechecagem proporcional, poderá receber `APPROVED_FOR_EXECUTION` neste escopo.
