<!-- FINANCE-CURRENT-RECONCILIATION -->
# Reconciliação atual e escopo do registro histórico

Esta observação usa Finance `0c4a2545a63b4903c7eedb00d3f0989eb74ed398` e as fontes inspecionadas Compose `ed10a3806a4ffdf6ad5891e2065d93a4c91412cf`, Interface `cccd00c568aea65bb0c1b5cb4a82c2a236c7e775` e drift `4bd1f807e449d040e3db61c4d2b1e177b205ac69`. O [registro central de dependências](../../WP11/finance-20261114/external-reconciliation.md) prevalece sobre diagnósticos e campos chamados “atuais” no documento histórico abaixo.

Compose já adotou `advantageComparisonRef` e implementou seis destinos BI protegidos com retorno de foco. A proposta de seleção inversa abaixo é histórica; o host atual avançou além dela. Os novos consumidores ainda precisam de validação e o teste owner tem TS2345. C17 com ledger, fonte record-only e captura Atlas protegida prévia também existe; seus limites permanecem explícitos. Não reaplicar os patches COMPOSE4 superados.

Mensal contrato/HTTP/UI conserva os três blobs base do patch, sem adoção. N/A exige rota/prova humana; Procurement exige a closure canônica publicada de quatro arquivos. Preservar Finance apply/result/request e os incrementos W25 de mutations/Hot Topic. O run BI S16 `43591377679`, W25, passou 1 caso/86 assertions; isso não concede aceitação nativa, C/D ou do bundle.

## Documento histórico integral preservado

Todo o conteúdo abaixo permanece no seu instante e pin originais, inclusive suas antigas palavras “atual”, “pendente” ou “não aplicado”. Não constitui nova instrução de intake nem resultado de execução nos heads acima.

# WP05 — deltas delimitados para integração

## Reconciliação posterior — COMPOSE6 / interface0c3d98

O estado atual está em [external-reconciliation.md](../../WP11/finance-20261114/external-reconciliation.md), nos pins COMPOSE `35b9fd4f532abeb1058f00281d4ad8885ca9966f` e interface `0c3d98dd1263a305ce294c78ad5939cdda110a78`. **C17 histórico está implementado em código para o caminho delimitado de ledger autorizado, capture Atlas anterior e closure record-only ainda fresh.** Primeiro capture depois do avanço, histórico nested/misto, assumptions/replacement e fonte materialmente alterada continuam fora desse helper; a execução composta ainda precisa de prova. F2/AsyncLocalStorage e o delta central WP13 também estão presentes; preservar a validação real de 55000/15000 e suas condições. O campo BI `advantageComparisonRef` ainda precisa do delta de seleção. Mensal contrato/HTTP/UI conservam os três blobs base do patch. W20 publica os fixes próprios de proof na promoção sem operações e snapshot Dashboard no Hot Topic, ainda com execução pendente nesta observação. O S12 passou os nove casos de reconciliação do apply W18, mas falhou como run: 17 pass / 5 fail. Não transferir esse resultado para outro head.

## Registro histórico abaixo — propostas e pins anteriores

As seções restantes preservam o diagnóstico e as propostas nos pins originais; o registro atual acima prevalece quando as supera. Os antigos gaps genéricos F1 de C17 e F2 de Map não são pendências atuais equivalentes, e patches COMPOSE4 não devem ser reaplicados automaticamente. Preservar as provas que ainda faltam sem declarar READY/DONE.

## Pins e limite de aceite

Fonte normativa: `dbf9547211d9b0fade619790de7c19c0869b7c7d`, campaign SHA256 `703dd257274bed829a978705de548cd1383225bf7aac76445104c053e2bb5fba`. Handoff: `a3d29d011ba3607a57914701300f09117a3e2de9`. O trabalho anterior de PR #24 foi consumido no head `0881fee21f07bf8a9a1153d7d55727837cdf497a`, sem alterar seus receipts.

Incremento próprio W1: `8184761b61f78d6aeac73232fdc879e93f85bc5e`, tree `dca3e3c3aca7dadbd348c71b1c9a3d5934ac4a05`, PR #35. Snapshot de CI solicitado pelo integrador: `880e0f05557abe8b6c4bb71f5f8cc3ad7272fae4`. A execução recebeu triagem de timeout reportada pelo coordenador; os outcomes e SHAs finais permanecem sujeitos à reconciliação central, sem PASS presumido. O mapa integral é `criteria.json`, com 108 requisitos preservados e nenhum aceite integral inferido.

Incremento W2: `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`, tree `a67576fae5212720d3e695138b0979931d4f7c79`. Inclui o fence final C17, recusa de `currentRef` divergente e diagnóstico cirúrgico das falhas de browser. Check hospedado `43579025258`: zero diagnósticos TypeScript em WP03/WP05/WP11, 131 externos; guards PASS (78 regras, 753 paths, 14 warnings, zero erros). Isso mantém o typecheck global em FAIL; os testes de produto W2 e o W3 ainda aguardam execução/reconciliação pelo integrador.

Os fontes CLI WP10 abaixo foram relidos no pin `417038d6b3cfd1817f40ffc60e56f42e505b50a5`. O handler HTTP foi depois comparado ao astra-compose `ff7a99753d1fd1bc8b68b4f2642fed26e3cadbdf` (blob `23c183666cef9d97925ba05c67fe678d9b058255`); a alteração observada usa callback em `replace("</body>", ...)`, sem mudar o destino C17. Scope/port de Dashboard foram relidos em astra-interface `903bcee2e007809f7614a7fff39dd5019f7f7733`. Nenhum desses arquivos foi editado por WP05. O artifact-store compartilhado continua com astra-compose; host, identidade e contratos permanecem com os produtores canônicos.

## Consumo real localizado

| Fonte ou consumidor | Estado observado no pin | Consequência |
| --- | --- | --- |
| `apps/cli/src/sucafina-product/bi-services.ts#createSfBiServices` | Compõe `createSfBiFactory` com Dashboard BI01/07/08, Planner BI01/04, diferença Planner BI02/03, Procurement BI05/06, cenário persistido BI09/10/11 e portfólio persistido BI09/10 quando disponível. | Não se deve repetir o diagnóstico antigo de ausência total da fábrica CLI. Esta inspeção identifica o consumidor de produção, mas não é prova de execução instalada/native. |
| Mesmo arquivo, `scenarioProjection` | Usa `createStoredScenarioBiProjection`, store de resultados real, sensibilidade persistente quando disponível, comparação de seleção/ref/case/projeção e host revalidate. | Os snapshots/fences próprios WP05 são consumíveis sem novo contrato ou nova fórmula. |
| Mesmo arquivo, `dispatchPresentation` | Usa `callScope.run`, `withinCase` e `dispatchBiPresentation` com autoridade compartilhada. | A política e o C16 permanecem no host canônico. |
| Mesmo arquivo, `decisionPresentation` | Retorna `series: []`; anuncia explicitamente ausência de plano waterfall/timeline para BI09/10. | Tabelas persistidas estão disponíveis, mas não são evidência de gráfico waterfall/timeline completo. |
| `product/integration/bi-http.ts#createSfBiHttp` em COMPOSE `ff7a9975` | Compõe fonte Dashboard própria, admite apenas apresentação BI01/07/08 e abre `bi-source` usando só selectionRef. | O entrypoint HTTP ainda não usa toda a fábrica CLI e não carrega a seleção da marca. |
| `product/analytics/consumer.ts#readBiDestination` | Reabre a projeção pela mesma capacidade, confere valueId, versão, engine, contexto e referência exata, resolve C17 e exige fonte fresh autorizada, depois revalida na saída. | Este é o consumidor disponível para o destino granular. O HTTP observado não o chama. |
| `test/product/wp05/consumer-dashboard.test.ts` | Harness usa produtor Dashboard, UI lease/dispatcher e `readBiDestination`, com source revocation e referência exata. | É prova delimitada de consumidor/porta; não é o handler HTTP instalado. |

## Delta externo 1 — destino de marca C17

Owner: astra-compose/WP10. Arquivos delimitados: `product/integration/bi-http.ts` e o respectivo consumidor browser, com composição em `apps/cli/src/sucafina-product/bi-services.ts` se essa for a entrada comum selecionada.

O branch `bi-source` do pin observado só permite chaves `sf` e `selectionRef`, resolve uma seleção Dashboard e devolve `/dashboard?page=<page>&year=<year>`. Isso perde `viewId`, `valueId`, `projectionVersion`, `engineVersion`, contexto original e referência C17 da marca. É o fallback de overview explicitamente proibido por WP05.T04.CHK.04.

Proposta delimitada: transportar a seleção tipada `BiSelection` e a solicitação original `BiViewRequest`, associadas à admissão UI real; consumir `readBiDestination` com a mesma `BiPresentationPort`, autoridade e `BusinessContextService` já compostos. O destino deve abrir o `source.authorizedProjection` retornado ou um detalhe de domínio equivalente que conserve a mesma referência, em vez de reconstruir uma URL de coleção. Fonte ausente/revogada/histórica/replaced e seleção alterada permanecem recusas explícitas. Recorte visual pode ser menor que o período autorizado, sem substituir o período original de evidência.

Prova necessária do owner: dos oito gráficos, clique, teclado e botão da tabela chegam à mesma referência/detalhe; moeda/período/versão/contexto não mudam; back restaura filtros/foco. Mutar valueId/versão/ref ou revogar fonte com sessão ainda válida recusa o detalhe sem valores. Nenhuma nova regra de identidade ou cálculo é necessária.

## Delta externo 2 — planos de decisão canônicos

Owner: produtor de projeção Planner/Decisions/Portfolio em conjunto com astra-compose. Arquivo de composição delimitado: `apps/cli/src/sucafina-product/bi-services.ts#decisionPresentation`. WP05 não deve inventar os componentes de waterfall, ranking, calendário financeiro ou completude para preencher `series`.

Fornecer, pelo produtor já autorizado, o plano de apresentação reconciliado BI09 e o plano de períodos BI10, com IDs/componentes e referências do resultado persistido. A composição deve passar esse plano aos consumidores próprios. Enquanto o produtor não o fornecer, manter `series: []` e a limitação explícita; não classificar BI09/10 como completos por existir uma tabela ou SVG vazio.

Provas discriminantes: custo de referência 240000; bridge 60000, implantação 45000 e novo serviço 105000; categorias compartilhadas reutilizam o componente sem somar dinheiro novamente; N/A exige evidência; total/subtotal/estado são os emitidos pelo domínio. Implantação 70000 deixa a transição em 235000, com vantagem conhecida de 5000 sobre a renovação, insuficiente para a meta de 20000; prazo pendente não vira custo zero. O limite de implantação 55000 e o limite 15000 após training 40000 vêm do solver canônico e mantêm condições reais.

## Delta externo 3 — fonte de marcos e prova instalada

Owner da fonte: WP02/astra-interface; integração: astra-compose. A falha histórica de `milestone:p:undated:date` está preservada no receipt anterior (Full35 run 43535162840). O código atual de astra-interface `903bcee2e007809f7614a7fff39dd5019f7f7733` já corrige a causa: `scope.ts` (blob `f53d0509b6f727947ec9b00888bce9dae1420094`) preserva marcos sem data como null e conserva status só quando o dia de observação está no recorte; `port.ts` (blob `b5acfaf9b03c4e03a60c375248cf2ecbd1f32811`) emite a linha date null/absent, a lacuna e o status com seu período de observação.

Ação remanescente concreta: consumir o par compatível do owner e executar `test/product/wp05/dashboard-integration.test.ts` no produto composto. O arquivo port atual também importa `createDashboardRecordEvidenceHost` de `sources.ts` e usa `DomainProjection.comparison`; intake deve preservar essas dependências do produtor, sem extrair só uma linha e declarar equivalência do pin. Até a execução atual, o resultado é `FIX_PRESENT_IN_OWNER_PENDING_COMPOSITION_PROOF`, não PASS e tampouco o diagnóstico de que o source atual continua removendo undated.

## Delta externo 4 — sensibilidade persistida de um resultado de fonte

Owner: produtor Portfolio e astra-compose. Arquivos delimitados: `product/portfolio/planner-sensitivity.ts`, `product/portfolio/product.ts` e a composição de sensibilidade persistente. O código composto de W3 `66bbe152c145f04c16223a938589c63cedb3b716` exige um `replace` explícito no cenário e só publica `exactThreshold` se os samples já forem completos. O resultado source-only confirmado tem `operations: []`; as probes que alteram um custo continuam corretamente hipotéticas e condicionadas. A existência do limite exato 15000 no solver WP03 e de um certificado C10 WP11 não satisfaz automaticamente essa outra cadeia.

Proposta delimitada: consumir o parâmetro de fonte atual emitido por `createPlannerSensitivityUnits` e o certificado de intervalo do produtor C10 na composição do Portfolio; não transformar a probe hipotética em aplicação ou cobertura completa por callback. Persistência/replay deve conservar request, metadata, regra, case version, resultados de amostra e evidência exata. Só após esse consumer produzir e reproduzir um `SensitivityResult` real se pode atribuir a BI11 o limite persistido do source-only. WP05 não construiu manualmente esse resultado nem substituiu o produtor com uma fórmula.

## Incrementos W3 publicados

W3 foi publicado em `66bbe152c145f04c16223a938589c63cedb3b716`, tree `f727ae5bfcef26383ff47a2b06bb65b161295dd2`. O check foi disparado pelo integrador e seu resultado ainda não integra este registro.

`capacity-numeric.test.ts` usa store, issuer de fontes escopado e dispatcher UI reais de WP03. Os dados sintéticos passam pelo Planner: fevereiro/março geram FTE 1/1.5 e custo 10000/20000. O consumidor compara escalas separadas, alinhamento, filtro e seleção exata por mouse, teclado e tabela, com nomes pessoais ausentes. Esse caso positivo fecha a lacuna de teste que havia entre FTE numérico e custo indisponível no papel restrito; ainda depende de Actions e não demonstra o destino HTTP instalado.

`engine-revision-fixture.ts` e `choice-history-bi.test.ts` consomem o mesmo caso durável do helper WP11. A fase inicial possui 210000 conhecidos e training omitido, com total indisponível; `recordChoice` registra a escolha humana condicionada. Uma fonte separada é criada pelos comandos canônicos `Versions.copy` e `OPEX.save`, com training 40000, preservando o digest da fonte antiga. C08/C10, `addAlternative` humano e cenário source-only produzem o resultado corrente 250000 completo, com vantagem -10000 sobre renovar. O BI reabre resultados/comparação reais e conserva o ChoiceRecord histórico. Os dois renders ocorrem enquanto sua respectiva versão ainda é corrente; o replay de refs antigos depois da revisão é recusado.

O scope dessa segunda fixture é explícito: referências de fonte são um harness com digest e verificação de projeção corrente, distinto do issuer escopado de capacity. O render verifica a tabela e marcas de período com SourceRef; ele não demonstra um waterfall financeiro completo nem um destino C17 instalado. O caso continua sem preparedChanges ou receipts e não está aplicado. Os testes W3 estão publicados e ainda não receberam resultado hospedado neste registro.

## Falhas históricas de browser — diagnóstico W2

O mesmo Full35 registrou duas falhas adicionais: Planner BI04 finance excedeu 60000ms durante um único `page.evaluate` que incluía importação ESM e renderização, antes dos asserts; a limpeza encontrou transporte conectado apesar de nenhum processo Chrome vivo. O approver falhou em `context.newPage()` do fixture compartilhado antes do corpo WP05. A causa composta não foi isolada, e o Target3 verde do mesmo produto não fecha nenhuma dessas duas falhas.

WP05 acrescentou diagnóstico cirúrgico próprio: fase setup registrada antes de `localBrowser`, importação do módulo separada de renderização nos dois consumidores afetados, e eventos de fechamento/desconexão com fase e elapsed. As assertions, o prazo interno de 60s, o limite de ação/navegação de 10s e o limite de teste de 180s permanecem; não há retry. O run solicitado deve selecionar somente `Sucafinav1/test/product/wp05/planner-integration.test.ts` e `Sucafinav1/test/product/wp05/procurement-stages.test.ts`, runner `bun`, package `sucafina`, directory `modules/sucafina`, Linux, env vazio. São testes bun:test que usam a biblioteca Playwright e `channel: chrome`; não são specs do runner playwright/app. Esses dados devem localizar import/render/transporte/setup antes de atribuir causa ou marcar a falha resolvida.

## Limites desta entrega

- Testes de produto são executados somente em GitHub Actions pelo protocolo CI.md; WP05 não iniciou runs duplicados nem execução local.
- Os testes financeiros usam Planner, stores e C10 reais com fontes sintéticas declaradas. Nenhum callback fornece um total financeiro calculado por analytics.
- Cobertura de fonte completa, prova estrutural de intervalo, simulação hipotética, ChoiceRecord humano e aplicação persistida são estados distintos. O consumidor preserva o que recebeu; não promove um ao outro.
- Provas native reais, revisão independente, gates C/D e epic composto final continuam com seus owners. Este handoff não declara READY ou DONE.


## Revisão independente W3 — correções C1/G2

O relatório de consumidores revisou `66bbe152c145f04c16223a938589c63cedb3b716` e identificou C1: contribuições A/B reais tinham duas `sourceRefs` e `drilldown: null`, ficando sem ação nos renderers. A correção própria preserva a row e o delta do produtor. A marca revela escolhas de origem A/B com tipo, registro e versão explícitos; ela não abre a primeira referência automaticamente. Tabela e waterfall apresentam as mesmas opções, e Escape cancela a escolha com retorno de foco local. A/B são identificadores de opções visíveis, não uma inferência financeira sobre a ordem de um `FinancialAnalysis` arbitrário.

`readBiDestination` admite somente uma referência integral da MESMA row autorizada e redispatchada, ou o drilldown singular fornecido pelo produtor. Conserva versão, engine, contexto, seleção, C17/currentRef e o fence final. `planner-origins.test.ts` usa scoped issuer, Planner e dispatcher reais para zero e contribuição não zero em BI02/BI03, com mouse, teclado, tabela comum, tabela waterfall e resolução exata A/B. O boundary C17 de teste delega os valores financeiros ao produtor e não representa a instalação HTTP/Atlas. `consumer.test.ts` acrescenta terceira fonte, fonte de outra row, fields/version/context alterados, currentRef diferente e revogação depois da resolução, sempre sem payload aceito.

G2 conservou a convenção canônica entregue ao BI: diferença de custo da alternativa menos referência. O resumo agora nomeia a orientação, os refs comparados e o significado do sinal. O DOM do mesmo caso exige `-30000` antes e `10000` depois. A vantagem inversa `30000`/`-10000` continua vindo da comparação inversa canônica no teste de domínio; analytics não nega números para produzir outra série. O teste de implantação70000/235000/vantagem5000 é coordenado com WP11, separado desta correção de rotulagem/consumo.

C1 foi publicado em W8 `453edcd3c3c2a20413ef0d3f679b0fbc46fca2b5`, tree `7f9fc2de8d5ee0a560c252413ab76d0e4564bab7`. G2 DOM foi publicado em W6 `df29a62e5ede5b9ff9344b4f5b51eba4102e2093`, tree `3e0a13a9085ca446aec553052a61041281c2e1d9`. Ambos aguardam a seleção cirúrgica de browser/C17. Nenhum resultado de Actions novo é inferido da revisão ou do código.

### Transporte UI observado novamente

O arquivo `product/interface/bi-entry.ts` do intake INTERFACE5 foi relido no pin `e5afff327dc64735bbd8a646124570a0c97a9c6b`, blob `305ee63cd74658f6665a6ebbca885fe5995ea95f`. `openSource` emite a seleção completa em evento local, mas transmite somente `selectionRef` ao `bi-source` e aceita apenas destino `page/year`. A fábrica CLI e os consumidores existem; o gap é conservar a seleção exata de A/B através dessas entradas, não ausência de caller. Os heads compose/interface informados posteriormente pelo coordenador exigem novo confronto de blobs antes de atualizar esta observação para o remoto mais recente. Os arquivos host não foram alterados por WP05.

### Risco observado de duração

O coordenador reportou timeout do `engine-coverage.test.ts` no W1, com duração aproximada de245s. A reconciliação exata dos logs permanece no receipt do coordenador. WP03 está reduzindo projeções repetidas de self-comparison e já tem fastpath de solver ainda não executado no W1. Não houve aumento de timeout, retry ou retirada de assertions no WP05.


### Reconciliação com COMPOSE4 / INTERFACE6

O intake `group35.json` no compose `4306b310e4d6dac77f9beab461adad4e8e924849` consome o grupo W2 `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`, incluindo os fences e consumidores próprios de analytics. O registro conserva `target_proof_status: NOT_REVALIDATED` e não transfere PASS de outro candidato. O host também tem composição nova de evidência/cálculo nested C17. Portanto não se classifica esse código como ausente; o restante concreto é transportar a seleção correta pela UI/HTTP e provar os destinos atuais.

O finding publicado em interface `a29565f763ddd90bc5bc3b8d298afb47ad84008d`, `bi-refresh-lifecycle.md`, confirma no compose4306 os blobs de `bi-entry.ts` `305ee63cd74658f6665a6ebbca885fe5995ea95f` e `bi-http.ts` `23c183666cef9d97925ba05c67fe678d9b058255`. Além do transporte da seleção, o owner exige que o consumidor reivindique e trate `sucafina:main-refresh` com nova leitura autorizada, coalescência/aborto, purge em revogação e proteção contra respostas tardias. Shell GET bem-sucedido não reautoriza uma projeção antiga. Essa montagem permanece fora dos paths WP05 e não foi implementada aqui.

O `planner-sensitivity.ts` atual de COMPOSE4 foi relido: já inclui snapshots e verificação de digests/replay, mas ainda exige uma operação replace do parâmetro e probes completas antes do threshold exato. O delta source-only de BI11 permanece delimitado; a nova proteção de replay não foi ignorada nem tratada como inexistente.

Check mais recente informado: W7 `a274302d15990919007dbe958d95653508c730a7`, run `43581794354`, zero diagnósticos WP03/WP05/WP11, 131 externos; guards PASS (78 regras, 762 paths, 13 warnings, zero erros). Esse check antecede C1W8 e não o valida. S4 `43581792536` está executando sete arquivos backend, incluindo engine-coverage; o root reconciliará W/S e outcomes. C1/G2 browser será a seleção posterior autorizada pelo coordenador, sem duplicar run em voo.


## Adendo W10 — foco W12 e vantagem canônica opcional

A revisão independente de W10 `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb` / tree `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e` confirmou o fix original C1 e encontrou C1R: os botões A/B permaneciam sob um chooser oculto, e a restauração podia anunciar sucesso sem focar a marca. FIN05-I foi publicado em W12 `217c9bcc75d499eff3884fb4afe662d5c0029935` / tree `eeae1c748b3e1e73be8686c3f1df325e2fac3824`. Ao fechar, o chooser remove seus botões; `restoreBiFocus` procura candidato visível/conectado e confirma `activeElement`. O teste usa o export real no mesmo mount, após escolher cada A/B, mover foco e restaurar a marca em BI02/BI03, zero e contribuição não zero. Publicação não é prova executada nem substitui a navegação instalada.

A mesma revisão identificou que W6 mostrava corretamente custo `-30000 → +10000`, mas a vantagem literal `30000 → -10000` de WP05.T05.CHK.20 continuava só no objeto do teste. FIN05-J foi publicado em W14 `fe13ee693bdcec1830190bcdb5cc7f2794942c1f` / tree `1ce4e9fcb2e9fb81e12dcfd773aa2daae64be39a` e acrescenta um caminho próprio opcional, ainda pendente de check/revisão/Actions neste registro:

- `StoredScenarioSelection.advantageComparisonRef?: string` e o resolver de `bindStoredScenarioBiPort` transportam o ref de uma comparação inversa **já persistida**. Ausência conserva a apresentação anterior e não cria vantagem.
- `createStoredScenarioBiProjection` lê essa comparação duas vezes, com snapshots independentes. Exige ref exato, mesmo case/incarnation/version e endpoints exatamente inversos à comparação de custo corrente. Recusa uma comparação genérica preexistente para não sobrescrever outro produtor. As revalidações de seleção/projeção, moeda/horizonte e fontes permanecem; cada leitura real do result-store revalida autoridade, case e evidências.
- A vantagem usa o slot já tipado `DomainProjection.comparison`, com `metricRef: planner:known-subtotal-difference`, ref persistido, contexto/version/engine da projeção corrente e valores copiados de `knownDifference` e `comparisonStatus`. Analytics não nega, subtrai ou recalcula custos. O store/produtor conserva schema, fonte e semântica financeira; os checks locais só ligam a comparação correta à apresentação.
- O componente próprio `advantage-view.ts` mostra orientação **referência − alternativa**, barra geométrica e tabela equivalente. Antes: **30000 USD; Condicionada**, evidência estimada e disclosure de pendências. Depois: **-10000 USD; Completa**, conforme resultado canônico. O resumo anterior de custo **alternativa − referência** permanece com `-30000/+10000`.
- O teste do mesmo caso grava no result-store real o `advantageComparison` que já vem de `compareScenarios([selected, baseline], [])`, lê pelo adapter e exige barra/tabela/rótulo/sinal literais. Verifica que as fontes são exatamente as do resultado persistido, incluem as duas alternativas, e cada botão conserva a referência integral. ChoiceRecord e fonte antigos ficam intactos; zero preparedChanges/receipts e estado não aplicado continuam obrigatórios.

### Delta externo 5 — referência opcional da vantagem

Owner: astra-compose/WP10; transporte/refresh do navegador em coordenação com astra-interface. Pontos delimitados observados: `apps/cli/src/sucafina-product/bi-services.ts` (`scenario.resolve` e `scenarioProjection.revalidateProjection`) e o parser/serializador `readSfDecisionBiSelection` usado por esse arquivo. O consumidor CLI existe e resolve os refs originais; o novo ref opcional ainda não foi composto nesse pin.

O owner deve obter a comparação inversa por `compareScenarios` canônico e persistir o resultado no store existente, com o mesmo caso corrente e todas as fontes verificadas de ambas as alternativas. O identificador persistido entra na seleção autorizada como `advantageComparisonRef`; o parser/serializador precisa preservá-lo sem aceitar refs arbitrários de outro caso. `scenario.resolve` encaminha o campo e `scenarioProjection.revalidateProjection` compara também `parsed.advantageComparisonRef === selection.advantageComparisonRef` nas revalidações. O `callScope.read` e suas fences existentes continuam envolvendo o adapter. Nenhum cálculo ou autorização novo precisa residir no BI.

O HTTP não deve fabricar o inverso nem inferir seu ref a partir de números/ordem. Precisa usar a mesma seleção host autorizada e o protocolo de refresh/releitura já indicado pelo owner; a disponibilidade do opcional não corrige o gap separado de transportar `BiSelection` integral para C17. A tabela/resultado de vantagem usa as referências canônicas recebidas, e a abertura deve conservar autorização/revalidação do destino. A falta do opcional não deve produzir benefício zero ou confirmado.

Provas próprias a executar no novo pin: `test/product/wp05/choice-history-bi.test.ts`, `test/product/wp05/stored-bi-fences.test.ts`, `test/product/wp05/projection.test.ts`, além de `test/product/wp05/planner-origins.test.ts` para C1R W12. Sem testes locais, dispatch independente ou mudança de timeout. O source-reference harness do mesmo caso permanece distinto do issuer/native instalado.

## Resultado S4 observado — limite de execução permanece

O run `43581792536` encerrou. No log `test4-clean.log`, WP05 `engine-coverage.test.ts` teve PASS para o limite canônico55000 (92737.76ms), zero explícito versus preço ausente (167626.65ms) e revogação de fonte com UI ainda válida (83799.56ms). O caso omitted→training40000 excedeu180000ms e terminou em219940.58ms. A reconciliação exata W/S e os demais casos ficam no receipt central do coordenador.

Esses resultados são delimitados aos cases executados. Não fecham o novo same-case/DOM, C1R, G2 literal, fixture/browser histórica, nem o critério integral. O alto custo das revalidações reais é risco observado; o coordenador investiga a cadeia de produtores antes das próximas seleções pesadas. Não foram ampliados timeouts nem enfraquecidas assertions.
