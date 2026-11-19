# Handoff — finish-choice-20261119

SHA: 07862279c8de45199ab20f0295a257e84a5e9805 (código; este documento é um checkpoint posterior)
Data: 2026-11-19
Estado: partial

## Feito

- Branch criada de Assembly30 fa3f3850494f0a42e9096858af0a447f44c61774, árvore 204c42ac7e0b8335e467ecedc87fe9e29ed14f34. Não faz merge da integração.
- Binding separado em 5da8d863a1f865b1c44bbc5cd782b996c3d7bf5f: decisions.decision-compare, POST {mount}/dashboard?sf=decision-compare, effect read, input fechado caseRef/baselineAlternativeId/alternativeId/criteria, resposta original request + ScenarioComparison, limite de 262144 bytes. Usa o codec original e preserva diferença conhecida/total indisponível, negativas e CAS.
- Fonte de produção confirmada: apps/cli/src/sucafina-product/decision-domain-http.ts:13–16, 41–74 e 93–96. O grant é decisions.portfolio.read; origem, Request, withCase atual e revalidação permanecem no produtor. O portfolio-http.ts atual não atende decision-compare.
- modules/sucafina/Sucafinav1/product/decisions/comparison.ts:20–43 resolve as duas alternativas em resultados C08, chama o Planner original, compara referências e relê caso/resultados antes da resposta. Não há cálculo financeiro no cliente.
- Schema reusa SfSourceInput_sf_scenario_compare e SfSourceScenarioComparison existentes. common e SfOperationExtensions recebem somente o novo ID; o baseline congelado de 305 IDs permanece intacto. O cliente adiciona um método tipado explícito.
- Teste de codec em packages/client/test/sucafina/decision-compare.test.ts verifica rota original, input fechado/CAS, ausência de autoridade injetada e preservação de conditioned com completeDifference:null. É uma prova de codec/rota, não de C08 ou fluxo humano.
- Health separado em 07862279c8de45199ab20f0295a257e84a5e9805 adiciona compare/choose/criteria ao observador de intenção existente, ao tipo nativeReadBinding e ao recurso choice. Mantém binding real da instalação, mesmas instâncias, admissão/revalidação, duas leituras de cada namespace e grant humano atual.
- Compare verifica cases READ e preferences READ; choose verifica cases WRITE e preferences READ; criteria verifica cases WRITE e preferences WRITE. result-store.ts lê resultados em cases; criterion-rules.ts:35–43 lê cases/preferences e :99 registra em preferences com namespace cases adicional. A qualificação de execução dessa saúde ainda está pendente.
- O callback do host usa as instâncias reais decisionDomain.compare, portfolioServices.mutations.recordChoice e decisionDomain.criteria.register, com seus adapters, armazenamento e withCase. Não publica readiness pelo catálogo sozinho.

## Pendente

- packages/app-shell/src/orchestra/chapters/sucafina/decisions/choice/index.tsx:35 — UI38 existente apresenta o trio A04 current-choice/read/prepare/promote; falta autoria da escolha C10 com comparison original e critério numérico humano. Nenhuma UI antiga foi recriada.
- packages/app-shell/e2e/sucafina/decisions-support/initial-alternatives.ts:15, :198 e :221 — controles e URL legados ainda ativos. Devem ser migrados preservando os componentes mensais 100/200, subtotais 1200/2400, coverage pendente com 9 categorias, par explícito e perda/retry do mesmo Promote.
- packages/app-shell/e2e/sucafina/decisions-support/choice-history.ts:43–78 — a prova exige perda de resposta, reload, mesmo body/key, dois POSTs e uma escolha. O F02 atual só retém memória do transporte; recuperação após reload ainda precisa de ligação explícita à intenção original não confiável e à reautorização C08. Não remover reload/contagem nem contornar o transporte.
- modules/sucafina/Sucafinav1/product/ui/decision-choice.ts:9–25, :73 e :292–319 — consumidor original persiste intenção fechada por scope em sessionStorage, conserva body/key antes do POST e restaura estado desconhecido após reload. Isso não é autoridade nem receipt. O port nativo dessa política ainda não está implementado.
- packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts:1 — C12 permanece sob coordenação com WP2; não fabricar escolha, proposta, aprovação ou receipt para atingir o caminho.
- apps/cli/src/sucafina-product/native-ui/decision-intent-health.ts:28–30 e apps/cli/src/sucafina-product/host-context.ts:1021–1033 — nova disponibilidade aguarda typecheck/execução sobre a composição. O gate do codec não qualifica esse código.

## Decisões e justificativas

- Nenhuma asserção foi removida, pulada, esvaziada ou teve timeout aumentado. Os testes legados pendentes continuam executáveis.
- A operação de comparação é um POST read do produtor atual, com grant humano de leitura de portfolio; não cria approval, total completo, receipt ou key de mutação.
- Adicionar um ID ao registry não autoriza IO nem assegura a existência da instância. Os demais fences e o codec original continuam obrigatórios.
- F02 permanece sem edição nesta branch. A recuperação de escolha após reload não foi liberada por hipótese.
- modules/sucafina/Sucafinav1/runtime/application.ts permanece sem edição. Nenhum novo sf-ci foi disparado e não há declaração de GO.
- O UI35 separado em finish-decisions@14464dbf7ddb85e4018154985c17de493b9a49cd copia os inputs originais via structuredClone(unwrap(...)); esse delta não pertence a esta branch nem ao core UI33/34 já qualificado.

## Como retomar

1. Continuar em finish-choice-20261119 no código 07862279c8de45199ab20f0295a257e84a5e9805. Transplantar somente os deltas desta branch sobre a composição atual; preservar os demais callbacks do host.
2. Aguardar o gate estreito do codec 44620658522. Não interpretar esse resultado como sucesso do renderer/health.
3. Criar a folha nativa de comparação/registro com os campos publicados por projection.case, controls.read e decision-compare. Mostrar o resultado original e exigir ação humana explícita; não calcular diferenças nem criar coverage.
4. Implementar o port de intenção retida de choice-history depois de conservar o contrato original body/key/scope e revalidação do produtor. Persistência de entrada do browser nunca substitui autoridade.
5. Portar os helpers para controles nativos e qualificar o spec mais estreito que exercita a mudança. Atualizar este documento com o resultado terminal e as pendências exatas.

## Comandos e resultados

- Nenhum shell, filesystem ou teste local utilizado. Todas as alterações e verificações são pelo GitHub.
- [44620658522](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44620658522) IN_PROGRESS neste checkpoint, job 135901100420. Snapshot 55561a8f878e83fe2a22a4a119f2620ad60f803c, código 5da8d863a1f865b1c44bbc5cd782b996c3d7bf5f. Requisição: {"package":"client","runner":"bun","args":["test/sucafina/decision-compare.test.ts"]}.
- CLI/app/E2E typecheck desta nova fatia health/renderer: ainda não executado. Guards/full sf-ci: não executados por este WP.
- Prova independente Operations: [44618682048](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44618682048) SUCCESS 2/2 para PR/Supplier nativos com reload; não qualifica Decisions. O gate completo Operations6 [44619924653](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44619924653) está em andamento na composição Assembly30 + 2 blobs de 877f8d, separado desta branch.
