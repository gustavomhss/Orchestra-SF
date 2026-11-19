# Handoff — finish-choice-20261119

SHA: b7c1cb40e8b5ee3e1a501c3aabbb842c9a0ef1d9 (código; este documento é um checkpoint posterior)
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

- Folha UI38 em c8a941331e8a4748f1f037d7b34804f504d727eb: novo choice/record.tsx, ligação mínima em choice/index.tsx e textos EN/BR em sf-u18.ts. Exige par explícito de alternativas originais, conserva todos os critérios obrigatórios, exibe a comparação original e permite registrar regra numérica sobre a métrica original planner:known-subtotal-difference com evidência publicada por controls.read.
- O registro da escolha mantém body/chave/owner/geração/stamp/case version originais, desabilita edição durante o comando e oferece apenas retry humano da mesma intenção quando o resultado fica desconhecido. Após sucesso, exige caseRef original avançado em uma versão e relê a projeção; o histórico renderiza os fatos armazenados da escolha, inclusive coverage parcial, total indisponível e ausência real de operações.
- Os builders de comparação, regra e escolha usam structuredClone(unwrap(...)) para enviar os mesmos dados revisados sem proxies de Solid Store; nenhuma mudança ao codec ou às exigências do produtor.
- A folha existente A04 de current-choice/read/prepare/promote foi preservada. Não há autoridade, resultado de cenário ou receipt criado pelo renderer.

- Recuperação da folha em bd310bfffc4b17733a2077e902f0d12b9f80bc88: antes do primeiro POST, retém somente a intenção original fechada em sessionStorage por instalação/projeto/host/principal/caso. O conteúdo é não confiável: após reload exige codec fechado, owner atual idêntico e GET original pelo inspectRecordedChoice. Só a escolha completa e seu evento exato version+1/principal permitem reconstituir o botão de retry humano. A inspeção não faz POST e o clique conserva corpo/chave; o C08 original continua decidindo o replay.
- O F02 requerido está no delta separado finish-choiceretry-20261119, código 175d8d2f5f407fe1dddcffcae80614a3b367bf19, head 572fe40a058c8ed1fbd956ba1bbb3c8b1b21ff60. Run 44627326343 SUCCESS: 22 pass / 0 fail / 403 expect, 288 ms. É prova de codec/limite IPC sintético, não de C08 instalado. A folha nativa ainda precisa do cenário completo.
- Rota canônica conferida em route-registry.ts:609–612: UI38 entry, /orchestra/sf-decisions/:caseRef/choice; referência deve usar encodeSfRouteRef.

## Pendente

- packages/app-shell/src/orchestra/chapters/sucafina/decisions/choice/record.tsx:109, :169 e :270 — comparação, registro de regra e escolha nativos implementados, ainda sem typecheck ou gate de navegador nesta fatia. A leitura do produtor fundamenta os campos; não substitui qualificação de execução.
- packages/app-shell/e2e/sucafina/decisions-support/initial-alternatives.ts:15, :198 e :221 — controles e URL legados ainda ativos. Devem ser migrados preservando os componentes mensais 100/200, subtotais 1200/2400, coverage pendente com 9 categorias, par explícito e perda/retry do mesmo Promote.
- packages/app-shell/e2e/sucafina/decisions-support/choice-history.ts:22–174 e comparison-rule.ts:8–67 — portados para UI38 e projeção original tipada, mas ainda não executados. A prova conserva perda de resposta, reload, mesmo corpo/chave, dois POSTs/uma escolha, regra humana 2000 e comparação/histórico exatos. O pré-requisito initial-alternatives ainda dirige controles legados e impede o cenário completo.
- modules/sucafina/Sucafinav1/product/ui/decision-choice.ts:9–25, :73 e :292–319 — consumidor original persiste intenção fechada por scope em sessionStorage, conserva body/key antes do POST e restaura estado desconhecido após reload. Isso não é autoridade nem receipt. O port nativo deste checkpoint conserva a intenção como dado não confiável, acrescenta a prova GET atual e ainda aguarda o gate instalado.
- packages/app-shell/e2e/sucafina/decisions-support/procurement-closure.ts:1 — C12 permanece sob coordenação com WP2; não fabricar escolha, proposta, aprovação ou receipt para atingir o caminho.
- apps/cli/src/sucafina-product/native-ui/decision-intent-health.ts:28–30 e apps/cli/src/sucafina-product/host-context.ts:1021–1033 — nova disponibilidade aguarda typecheck/execução sobre a composição. O gate do codec não qualifica esse código.

## Decisões e justificativas

- Nenhuma asserção foi removida, pulada, esvaziada ou teve timeout aumentado. Os testes legados pendentes continuam executáveis.
- A operação de comparação é um POST read do produtor atual, com grant humano de leitura de portfolio; não cria approval, total completo, receipt ou key de mutação.
- Adicionar um ID ao registry não autoriza IO nem assegura a existência da instância. Os demais fences e o codec original continuam obrigatórios.
- F02 permanece em branch separada. A folha usa a exportação pública SfRecordedChoiceIntent e inspectRecordedChoice do código 175d8d2. SessionStorage nunca restaura lease, grant, receipt ou stamp ativo; guarda apenas a intenção que a leitura atual precisa provar. Nenhum envio automático foi adicionado.
- modules/sucafina/Sucafinav1/runtime/application.ts permanece sem edição. Nenhum novo sf-ci foi disparado e não há declaração de GO.
- O UI35 separado em finish-decisions@14464dbf7ddb85e4018154985c17de493b9a49cd copia os inputs originais via structuredClone(unwrap(...)); esse delta não pertence a esta branch nem ao core UI33/34 já qualificado.

## Remapeamento das observações de UI38

- O DOM data-context legado foi substituído pela projeção original tipada de case, mantendo as verificações de identidade, versão, principal, critérios, evidências e histórico completo. readCase passa a reutilizar readCaseProjection sem alterar sua resposta pública.
- O evento domcontentloaded após o replay foi substituído pela resposta GET original da mesma projeção e pelos controles novamente editáveis; a UI nativa atualiza sua projeção sem recarregar o documento. O reload explícito ANTES do retry foi preservado.
- A observação do botão legado desabilitado "Prepare changes from this choice" foi remapeada para preparedChanges:[] no produtor, scenario.operations:[], mensagem nativa explícita de nenhuma operação, ausência de Apply e zero outros POSTs Dashboard durante a prova. Não foi criado um botão sem operação original apenas para repetir o console.
- As antigas ausências de "Total:" e "Difference:" são agora afirmações explícitas de "Complete total: Unavailable" e "Complete difference: Unavailable", publicadas pelo registro original com null. Subtotal 2400 e diferença conhecida1200 permanecem exatos; após fonte3600, o registro completo deve permanecer idêntico.
- O capítulo renderiza o estado/versão/período/moeda atuais e a revisão da regra recebida do POST; não calcula métricas. Rota UI38 e links usam o catálogo e o codec opaco existentes.
- Não foram removidas provas de negócio, perda/retry, contagens ou valores. Não há skip, aumento de timeout ou POST de fixture.

## Como retomar

1. Continuar em finish-choice-20261119 no código bd310bfffc4b17733a2077e902f0d12b9f80bc88. Transplantar somente os deltas desta branch sobre a composição atual; preservar os demais callbacks do host.
2. O gate estreito do codec 44620658522 terminou SUCCESS (3/0/14 expect). Não interpretar esse resultado como sucesso do renderer/health; compor a fatia nativa e executar os typechecks canônicos antes do gate humano.
3. Compor os três arquivos de F02 de 175d8d2, revisar a recuperação da folha bd310bf e portar os helpers de comparação/regra para os controles reais. Preservar todos os valores e fatos de provenance publicados, sem recriar os seletores do console.
4. Implementar o port de intenção retida de choice-history depois de conservar o contrato original body/key/scope e revalidação do produtor. Persistência de entrada do browser nunca substitui autoridade.
5. Portar os helpers para controles nativos e qualificar o spec mais estreito que exercita a mudança. Atualizar este documento com o resultado terminal e as pendências exatas.

## Comandos e resultados

- Nenhum shell, filesystem ou teste local utilizado. Todas as alterações e verificações são pelo GitHub.
- [44620658522](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44620658522) SUCCESS, job 135901100420, cleanup 135902269670 SUCCESS; 3 pass / 0 fail / 14 expect, 251 ms. Prova de codec/rota/contrato, sem qualificar C08 ou o renderer. Snapshot 55561a8f878e83fe2a22a4a119f2620ad60f803c, código 5da8d863a1f865b1c44bbc5cd782b996c3d7bf5f. Requisição: {"package":"client","runner":"bun","args":["test/sucafina/decision-compare.test.ts"]}.
- CLI/app/E2E typecheck desta fatia health/renderer c8a9413 + recuperação bd310bf: ainda não executado. Guards/full sf-ci: não executados por este WP.
- Prova independente Operations: [44618682048](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44618682048) SUCCESS 2/2 para PR/Supplier nativos com reload; não qualifica Decisions. O gate completo Operations6 [44619924653](https://github.com/gustavomhss/Orchestra-SF/actions/runs/44619924653) terminou FAILURE, 1 passed / 4 failed, na composição Assembly30 + 2 blobs de 877f8d, separado desta branch. Aprovação/arquivos/observação de resposta estão sendo corrigidos em branches próprias; nenhum desses resultados qualifica UI38.

- Recorded-choice boundary: run 44627326343 SUCCESS, test job 135924505197, cleanup135925839162 SUCCESS; primeiro gate44626583090 falhou por exigir maxRequestBytes ausente no metadata original, corrigido sem relaxar limite publicado. Nenhum desses testes sintéticos declara efeito C08 instalado.

## Checkpoint de port nativo b7c1cb4

- Oito arquivos de produto/helpers: cases/route.ts, intent/index.tsx, choice/index.tsx, choice/record.tsx, sf-u18.ts, journey.ts, comparison-rule.ts e choice-history.ts.
- F02/health não são sobrescritos por este commit. Dependências separadas175d8d2 (F02) e07862279 (readiness UI38) ainda precisam composição preservando os callbacks atuais do host.
- Typechecks e cenário nativo desta fatia: ainda não executados. O PASS44627326343 continua limitado ao boundary do transporte.
