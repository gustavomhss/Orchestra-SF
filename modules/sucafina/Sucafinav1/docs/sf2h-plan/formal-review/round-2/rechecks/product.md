# Rechecagem adversarial de produto — rodada 2

**Veredicto: APPROVED_FOR_EXECUTION.** O achado **P-R2-01 está CLOSED** no commit exato `1feb949244357b8ee7ea7a0c27310281accc7592`. Os quatro fechamentos originais permanecem ratificados. Não identifiquei novo defeito demonstrável nas bordas alteradas.

**Implementação: NOT_RUN.** Esta aprovação julga a coerência do planejamento de produto; não aceita a implementação, não demonstra que as rotas executam e não mede a duração de duas horas.

## Identificação e método

- **Revisor:** produto, UX e completude — `/root/sf_formal2_product`.
- **Repositório/branch:** `gustavomhss/Orchestra-SF`, `sf-product-plan`.
- **Baseline de código:** `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`.
- **Candidato:** cópia congelada `sf2h-candidate-1feb949`; li o recibo `sf2h-work/candidate-1feb949.json`, que informa 110 blobs conferidos por SHA1 via GitHub MCP e 49 arquivos alterados dentro do plano. Não repeti pessoalmente as 110 consultas remotas.
- **Parecer anterior preservado:** `sf2h-recheck/product.json` e `product.md`, revisão `R2-PRODUCT-3898638`, sobre `38986380cd7b5697c0be30c1f55d43eddee63045`.

Reexaminei a correção e suas consequências de produto: concessões, quatro workflows alterados, matriz de consumo, schemas/aliases, produtores e consumidores, autoridade C16, admissão C07 e provas AM02/AM06. Comparei os contratos e critérios dos achados originais para detectar regressão. Li o código do validador como documento; não executei validators ou testes de produto, não alterei o candidato e não li pareceres dos outros revisores.

As referências abaixo são relativas a `modules/sucafina/Sucafinav1/docs/sf2h-plan/`. O JSON acompanhante enumera os caminhos e seletores examinados.

## P-R2-01 — CLOSED

### A interseção agora possui caminhos positivos

`campaign.json:resident_ai.operation_call_routes` contém **39 rotas únicas para as mesmas 39 operações** dos packs. Conferi a existência dos IDs e, para cada rota, a compatibilidade entre perfil da operação, perfil da skill, skill permitida pelo perfil e operação concedida tanto ao perfil quanto à skill. Não encontrei rota inválida, produtor/schema divergente ou consumidor vazio. Todas exigem `SkillLoadReceipt`; `sf_routine_run` exige admissão C07 atual.

A reprodução que antes revelava sete lacunas agora retorna `[]`:

```sh
jq '[.resident_ai.mcp_packs[].operations[].id] - [.resident_ai.skills[].allowed_operations[]] | unique' campaign.json
```

Essa diferença vazia, isoladamente, não fecharia o achado. O fechamento também depende dos percursos concretos abaixo.

| Operação antes inalcançável | Perfil/skill e percurso corrigido | Saída e consumo |
| --- | --- | --- |
| `sf_dashboard_read` | Rota nomeada `sf_maestro` / `sf-produzir-bi-contextual`; WP02.T01 fornece a mesma projeção autorizada usada pela UI. | `AuthorizedDashboard` alimenta a proposta de BI; gráfico e tabela preservam fontes, filtros e versão, com consumo WP05.T05/WP01.T05. |
| `sf_import_preview` | Rota nomeada `sf_finance` / `sf-explicar-forecast`; também concedida a `sf-enquadrar-decisao` sob `sf_maestro`. Entrada opcional de análise usa arquivo admitido, base autorizada e caso real. | WP06.T02 produz `ImportManifest` C04; `IntentFrame`/`FinancialAnalysis` preservam `importPreviewRef`; WP06.T03 abre deltas/erros e identifica a simulação. |
| `sf_routine_catalog`, `sf_routine_prepare`, `sf_routine_run`, `sf_routine_status`, `sf_routine_result` | `sf_maestro` / `sf-preparar-revisao-executiva`; pedido humano percorre catálogo, proposta, admissão C07, execução e retorno por WP09.T01. | Proposta/estado/resultado chegam aos componentes existentes; `DecisionBrief` preserva `runRef`/`resultRef` e alimenta pauta/mesa, com WP09.T02/T07 e WP07/WP01. |

**Fontes:** `campaign.json:resident_ai.skills`, `operation_call_routes`, `output_aliases`; `resident-ui-consumption.json`; C11/C15/C16; WP06.T02/T03, WP09.T01/T02/T07, WP01.T05 e WP05.T05. Os espelhos `agents-atlas-mcp.json`, `resident-ui-consumption.json`, `contracts.json` e WP06/WP09 JSON conferem com suas seções canônicas.

### A correção conserva as fronteiras de produto

**Prévia.** As duas skills recebem somente a ferramenta de prévia. O workflow conserva a importação determinística sem caso obrigatório e exige reprévia quando arquivo/base mudam. C11 e o alias `FinancialAnalysis` usam `analysisBasis=import-preview` e `domainApplied=false`; a saída não se apresenta como forecast aplicado. WP06.T03 conserva Apply humano explícito, revalidação e recibo real. A contribuição C11 persistida pelo host é separada da simulação de domínio sem escrita.

**Rotina.** O novo grant não cria admissão. O workflow só chama `sf_routine_run` após o host fornecer a referência e a versão de admissão válidas. Sem isso, encerra com `needs-input`/`AdmissionProposal`; a resposta humana inicia novo run e binding atuais. WP09.T07 mantém a continuação versionada, sem espera humana fictícia dentro do run anterior. O resultado factual de WP09.T02 continua utilizável mesmo se a síntese falhar.

**Recursão.** `HostBoundEntryMode` vem do host, não dos argumentos do modelo. Em `routine-result`, prepare/run são recusados, inclusive por retry ou chamada direta. O modo `interactive` permite o percurso autorizado com C07; a leitura/síntese do resultado não pode iniciar uma rotina filha.

**Chamada direta.** C16, `AGENTS-ATLAS-MCP.md:102` e `specs/resident-runtime.md:253–259` agora concordam: o harness de AM02 atravessa o wrapper com binding e skill carregada. A redação antiga que podia ser lida como exceção foi substituída. A interseção de principal, sessão/caso, perfil/skill, operação e domínio continua válida.

### Provas e responsabilidades estão vinculadas

AM02 nomeia skills, exige as 39 rotas positivas e conserva identidade do handler, entrada, saída, consumidor e recibo de carga. Seu negativo remove a última concessão de uma operação: discovery com recusa universal não pode passar como paridade. AM06 inclui o ciclo com C07 e a recusa de recursão.

WP00.T02, WP10.T06, WP12.T02, WP06.T02/T03 e WP09.T01 receberam critérios `.CHK.60` e axiomas correspondentes. `tools/validate_resident_plan.py:36–67` verifica alcançabilidade, concessão da rota nomeada, carga de skill, produtor/schema/consumidor e admissão das operações executáveis. Conferi a lógica por leitura; isso não é alegação de execução do validador ou de AM02/AM06.

O contraexemplo anterior deixa, portanto, de ser imposto pelo plano: uma pessoa autorizada, com rotina admitida, pode usar `sf-preparar-revisao-executiva` sob `sf_maestro` em modo `interactive` sem escapar de C16. A ausência de admissão ou de skill carregada, a revogação e o modo de resultado continuam exigindo as recusas pertinentes.

## Achados originais ratificados

| Achado | Estado | Fundamento da ratificação |
| --- | --- | --- |
| **P-F01** — decomposição/consumo residente | **CLOSED** | Mantidos cinco perfis, 18 skills, outputs tipados persistidos e prova de consumo após reload. A correção acrescenta percursos às skills existentes. Escopo, coverage, journeys e product_promise são idênticos ao candidato já revisto; P-R2-01 fecha separadamente. |
| **P-F02** — confirmação material versus versão | **CLOSED** | C06, CONFIRM-SCOPE e os critérios de produto de WP08.T03/T04 e WP09.T02/T03 permanecem idênticos. O novo workflow consome a projeção de validade; não reintroduz recobrança por versão global nem dispensa CAS. |
| **P-F03** — categorias omitidas/dupla contagem | **CLOSED** | C10, os oráculos e critérios de WP11.T02/T03 e WP13.T02/T03 permanecem idênticos. BI lê projeção canônica e a nova análise de import distingue simulação de dados aplicados. Mantidos inventário independente, pendência derivada, soma por identidade, zero/ausência distintos e histórico da escolha. |
| **P-F04** — documentação WP06–WP09 | **CLOSED** | C14 e trabalho/checks/axiomas de WP06.T05 e WP09.T04 permanecem idênticos. Extração obrigatória e consumo da mesma `evidenceRef` não foram substituídos pelo caminho novo de prévia. O P2 segue corrigido. |

**Novos achados:** nenhum demonstrável nas bordas alteradas.

## Limites do parecer

As observações de contagem, igualdade de espelhos e concessões são estáticas, sobre o plano. Persistência/recarga, consumidor real, execução nativa, autorização em corrida, prevenção efetiva de recursão e demais positivos/negativos continuam por provar na implementação. Não certifiquei novamente APIs, packaging Atlas, gates ou orçamento de 120 minutos; estimativas continuam estimativas.

A aprovação vale exclusivamente para `1feb949244357b8ee7ea7a0c27310281accc7592`. Alterações posteriores nos percursos exigem rechecagem correspondente. **implementation_test_status: NOT_RUN.**
