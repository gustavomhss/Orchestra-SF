# WP00.T03 — protocolo de medição da interface real

Estado desta edição: matriz ampliada para sete fluxos; W7 concluiu os checks com falha e a próxima revisão W8 aguarda CI. Não há aceite antecipado de UI. O resultado hospedado W5 permanece como histórico: corpus preparado no SQLite real, bootstrap bloqueado em C15 antes da autenticação e zero medições de UI. O baseline temporal de referência ainda não foi medido. Todos os datasets são sintéticos e não representam volume conhecido da Sucafina.

O [pack canônico de WP00](../../../sf2h/control/handoff/astra/WP00.pack.json), em WP00.T03, exige corpus declarado e ao menos 30 repetições por fluxo comparável, separando resposta visual de conclusão. CAMP.QLT.02 exige verificar 320, 768 e 1440 px e zoom de 200%. CAMP.QLT.05 define dois requisitos distintos: resposta perceptível em até 200 ms, inclusive indicador de trabalho, e investigação de regressão superior a 20% no p95 de conclusão antes do aceite. A existência do harness e a aprovação de checks de domínio não satisfazem essas observações.

## Corpus, preparação e matriz

O gerador [volume.ts](../../../../test/product/wp00/fixtures/volume.ts) fornece 1.000 linhas financeiras, 200 pedidos/requisições e 100 projetos conforme `corpus-v2.json`. Os mesmos dados alimentam os consumidores de domínio. O helper [prepare-installation.ts](../../../../../../../packages/app-shell/e2e/sucafina/wp00/prepare-installation.ts) acrescenta três versões explícitas do Planner, propostas sintéticas de sourcing e nomes únicos para os projetos; persiste as superfícies pelo `openLocalStore.transaction` existente e registra um digest SHA-256 do corpus completo. Alternativas preparadas no Planner são inputs sintéticos: não demonstram geração por IA nem a jornada composta J05.

O inventário executável está em [flows.ts](../../../../../../../packages/app-shell/e2e/sucafina/wp00/flows.ts). Cada fluxo tem um resultado utilizável observado e uma conclusão com assertions específicas:

| Fluxo | Resposta visual utilizável registrada | Conclusão exigida |
| --- | --- | --- |
| `dashboard-budget-filter` | Filtro de exercício aplicado e actual OPEX do exercício 2027 visível com o valor esperado. | Forecast correto, gráfico mensal presente e tabela com os 12 meses. |
| `procurement-volume-open` | Identidade e valor da primeira requisição sintética visíveis na tabela real. | 200 requisições, com identidade e valor da última também conferidos. |
| `planner-scenario-compare` | Outlook da alternativa de 84.000 observado no plano selecionado. | Alternativa de 78.000, comparação das identidades e budgets, actual preservado e retorno à base com valores conferidos. |
| `procurement-sourcing-rank` | Proposta B com valor convertido e FX declarado visíveis. | Cabeçalhos, scores, posições de A/B e indisponibilidade de C conferidos no consumidor real. |
| `report-search-docx` | Busca retorna o projeto de identidade exata. | Download DOCX real, seção All Projects selecionada explicitamente e cada um dos 100 nomes presente uma única vez no artefato. |
| `report-search-pptx` | Busca retorna o projeto de identidade exata. | Download PPTX real, seção All Projects selecionada explicitamente e cada um dos 100 nomes presente uma única vez no artefato. |
| `import-preview-exact-reimport` | Preview visível, destino identificado e outlook preservado. | Reconsulta real antes do apply, manifesto aplicado, reload e exportação XLSX com as mesmas células de negócio. Isso não comprova versões internas do store nem idempotência de recibos C04. |

[measurements.ts#createMeasurementPlan](../../../../../../../packages/app-shell/e2e/sucafina/wp00/measurements.ts) combina cada fluxo com larguras de viewport de 320, 768 e 1440 px, altura configurada de 900 px e zoom real de 100% e 200%. São **7 × 3 × 2 = 42 configurações**, com **30 repetições por configuração = 1.260 tentativas planejadas**. A matriz não representa 1.260 execuções já observadas. A largura CSS efetivamente observada pode mudar com o zoom e deve permanecer no recibo de zoom, separada da largura configurada.

Preparação, navegação até o estado inicial e exportação do arquivo de entrada ficam fora do cronômetro de cada repetição. As ações do fluxo, observação do resultado utilizável, verificações de conclusão e, quando aplicável, download e inspeção do artefato ficam dentro da medição. Não somar preparação à latência de uma ação sem mudar e declarar o método.

A cada configuração deve-se registrar também qualquer overflow, controle inacessível, perda de conteúdo ou necessidade de resumo explícito encontrada. Conseguir executar ações e produzir screenshots não encerra sozinho a verificação de teclado, foco, legibilidade ou toda a CAMP.QLT.02.

## Duas medidas e o requisito de 200 ms

`visualReadyMs` mede o tempo observado pela automação desde o início do fluxo até um resultado de negócio utilizável, com valor ou identidade atual conferidos. Navegação, HTTP 200, título, DOM anexado ou visibilidade genérica não bastam. `completionMs` termina após as assertions do resultado completo; exige `completionMs >= visualReadyMs`. Nenhum timestamp pretende medir diretamente o paint do compositor.

O harness atual **não mede separadamente o primeiro indicador de trabalho nem toda a primeira resposta perceptível**. A observação de um resultado utilizável pode fornecer um limite superior conservador para esse resultado, incluindo o custo de observação da automação. Ela não autoriza declarar CAMP.QLT.05 aceito. Uma amostra de resultado acima de 200 ms tampouco demonstra, por si só, violação: o indicador permitido pelo critério pode ter aparecido antes. O aceite do requisito de 200 ms precisa de evidência específica da resposta perceptível, com marco inicial e método declarados, além da cobertura exigida de navegação, edição e atualização de gráficos.

Cada resumo inclui `perceptibleResponseBudget`, com `criterion: "CAMP.QLT.05"`, `limitMs: 200` e `evidenceBasis: "usable-result-upper-bound"`. Os campos `observedWithinLimit`, `observedAboveLimit` e `unobserved` explicitam quantos tempos utilizáveis foram observados dentro/acima do limite e quantas tentativas planejadas não têm essa observação. Esses contadores preservam também resposta utilizável observada em tentativa cuja conclusão depois falhou; as distribuições de mediana/p95 continuam restritas a resultados bem-sucedidos. `state: "OBSERVED_WITHIN_LIMIT"` só ocorre quando todas as 30 tentativas da configuração têm sucesso e todos os tempos utilizáveis observados são ≤200 ms; nos demais casos o estado é `NOT_PROVEN`. Esse marcador trata apenas o início declarado do fluxo. Não mede cada ação interna nem transforma um limite superior >200 ms em falha comprovada da resposta perceptível.

Manter ambas as séries e a correção do resultado separadas. Não substituir resposta visual por duração de função de domínio, pelo tempo de um teste unitário ou por média conjunta com a conclusão.

## Harness real e probe de zoom separado

[baseline-ui.spec.ts](../../../../../../../packages/app-shell/e2e/sucafina/wp00/baseline-ui.spec.ts) usa o runner Playwright existente e `packages/app-shell/e2e/playwright.production.config.ts`. No runner Actions, prepara uma instalação privada, inicia o CLI e o `local/entry.ts` originais por `AppProcess`, autentica pelo enrollment real de operador local e visita as rotas do produto. Não substitui bundle residente, provider, autorização ou resposta HTTP. As alternativas sintéticas e a identidade local delimitam a prova: não qualificam Microsoft/Entra, GNATIVE, atores restritos ou todos os contratos de importação.

[browser.ts](../../../../../../../packages/app-shell/e2e/sucafina/wp00/browser.ts) inicia o Chromium empacotado por `AppProcess`, em perfil isolado, e conecta Playwright por CDP. Uma extensão própria usa `chrome.tabs.setZoom/getZoom`; o recibo registra o zoom retornado, DPR, largura/altura CSS e escala de visual viewport. CSS zoom e emulação de page scale não substituem zoom do browser. Os contadores observados de Omni pertencem a esse escopo Playwright; não são o controle canônico Bun do protocolo de CI.

[zoom-capability.spec.ts](../../../../../../../packages/app-shell/e2e/sucafina/wp00/zoom-capability.spec.ts) é um probe independente contra o servidor de produção já previsto na configuração Playwright. Verifica a transição 100% → 200% → 100%, incluindo DPR e largura CSS, e produz `wp00-browser-zoom`. Pode revelar capacidade ou falha do instrumento mesmo quando o bootstrap Sucafina está bloqueado. Não usa o corpus de negócio, não integra as 42 configurações/1.260 tentativas e não prova autenticação, fluxo Sucafina, latência de negócio ou GNATIVE. Seu resultado deve ser registrado separadamente.

A configuração de typecheck do prefixo próprio inclui os arquivos do harness explicitamente e é conferida pelo script oficial do app no CI. A existência dessa configuração ou seu êxito não demonstra execução de UI.

## Recibo, identidade e falhas

O anexo `wp00-raw-measurements`, schema `wp00-real-ui-measurements-v2`, preserva três camadas:

| Camada | Conteúdo |
| --- | --- |
| `plan` | As 42 configurações e as 30 repetições planejadas em cada uma, inclusive as não alcançadas. |
| `observations` | Uma linha por tentativa realmente iniciada, com `flow`, `repetition`, `viewportWidth`, `viewportHeight`, `zoomPercent`, `startedAt`, `visualReadyMs`, `completionMs`, `outcome`, `failureReason` e `resultEvidenceRef`. |
| `summaries` | Contagens `attempted`, `passed`, `failed`, `cancelled`, motivo de cancelamento e distribuições separadas de resposta utilizável e conclusão para cada configuração. |

No envelope, `productCommit` identifica o commit de produto W; `executedSnapshotCommit` identifica o snapshot CI S realmente executado. O spec lê o objeto commit de HEAD, recompõe seu SHA e o compara a `GITHUB_SHA`; extrai o pai conforme o protocolo do snapshot CI, que tem W como pai. Essa verificação funciona com checkout shallow e não transforma S em W. O recibo CI da entrega deve preservar a relação W/S e os artefatos. `baselineReferenceCommit` identifica `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf` como referência ainda não cronometrada.

`environment` registra `datasetDigest`, `runtimeVersion`, `operatingSystem`, `device`, `browserVersion`, `cacheState` e `method`. Esses campos comuns pertencem ao envelope; não precisam ser duplicados em cada amostra. Valores não observados ficam `null`, com causa em `unavailableEnvironmentReasons`, e não recebem zero ou descrição de ambiente pretendido como se fosse observado. `state` mantém etapa, saída do processo, autenticação, corpus e falha; `zoomObservations` vincula a observação de zoom à configuração.

Uma tentativa iniciada que falha continua em `observations` como `failed`, com razão real e apenas tempos efetivamente observados. Não há retry oculto de ação que altera estado nem substituição da linha por uma tentativa bem-sucedida. Tentativas não iniciadas são contadas como `cancelled` no resumo, com motivo; não ganham linhas de sucesso, timestamps nem latências sintéticos. Por configuração:

- `attempted = passed + failed`;
- `attempted + cancelled = 30`;
- a identidade `flow:viewportWidth:zoomPercent:repetition` é única.

Em falha de bootstrap antes da UI, `observations` permanece vazio e os resumos preservam as 1.260 tentativas não executadas com causa. Uma falha de fluxo interrompe suas repetições subsequentes; fluxos independentes podem revelar seus próprios resultados. Cancelamento do escopo não autoriza iniciar novos fluxos ou marcar sucesso depois da interrupção. Um registro ativo ainda incompleto recebe a causa real do encerramento, conservando latências ausentes como `null`.

`wp00-server.log` e o estado no JSON preservam a causa do bootstrap; o código de enrollment e o cookie não devem aparecer nos anexos. Screenshots e arquivos de resultado anexados devem corresponder às identidades verificadas; a ausência de artefato fica explícita em `resultEvidenceRef: null`. Artefato da repetição final não implica que cada repetição tenha screenshot próprio.

## Mediana, p95 e comparação com baseline

O resumo calcula estatísticas **somente sobre tentativas bem-sucedidas**, mantendo todas as falhas e cancelamentos nos totais e no conjunto bruto. Uma distribuição parcial é descritiva e não passa a ser uma configuração completa. Sem sucessos, `samples = 0`, `medianMs = null` e `p95Ms = null`.

A mediana é o valor central ou a média dos dois centrais; p95 usa nearest rank, posição `ceil(0.95 × n)` na série ordenada. Com 30 amostras, a mediana usa as posições 15/16 e p95 é a posição 29. Informar população, método, tamanho da amostra e contagens de falha/cancelamento junto de cada distribuição. Não agregar viewports, zooms ou fluxos distintos em um único percentil.

O comparador requer os mesmos campos de ambiente, corpus e método, a mesma matriz de configurações e, nesta implementação, **30/30 observações bem-sucedidas em ambos os recibos de cada configuração**. Amostras duplicadas, contagens incoerentes, quantis inválidos, métodos diferentes ou latências ausentes impedem a comparação. Deve-se conferir os brutos e sua proveniência: a validação aritmética dos resumos não autentica uma execução.

Registrar diferenças de mediana e p95 em milissegundos e percentuais, sem transformar comparabilidade em aceite. Para CAMP.QLT.05, aumento **superior a 20% no p95 de conclusão** exige investigação antes do aceite. O marcador `regressionInvestigation` indica essa necessidade; ausência de marcador não aprova por si só o produto. Uma referência zero não permite divisão percentual: conservar diferença em milissegundos, percentual `null` e estado `baseline-zero`; aumento positivo sem percentual definido também deve ser investigado.

**O baseline temporal não foi medido.** O spec fornece baseline nulo ao comparador, que retorna comparação indisponível. Não inferir regressão, melhoria ou cumprimento do limiar comparativo a partir de números do candidato isolado. A referência deve ser medida no mesmo ambiente e com o mesmo corpus/método; o digest W5 pertence ao corpus W5 e não pode ser reutilizado como prova de equivalência com o corpus ampliado.

## Cobertura de domínio e limites

`baseline-corpus-coverage.test.ts` consome o corpus pelo Planner real, pelo `quoteAssessment` real e pelos renderizadores DOCX/PPTX. `corpus-consumer.test.ts` cobre inputs de domínio, conversão/FX ausente e volume. Essas verificações podem detectar inconsistências nos inputs e resultados esperados, mas não substituem observações de browser, persistência após reload, autorização do host ou jornadas nativas.

O harness ampliado torna os sete fluxos executáveis; completar a matriz continua dependente do bootstrap real, dos consumidores e dos artefatos de uma execução hospedada. O probe de zoom, a comparação temporal com baseline, a primeira resposta perceptível de CAMP.QLT.05 e as demais jornadas/autorização retêm evidências próprias. Este documento não declara esses gates aprovados.

## Histórico hospedado W5

O run [43522985791](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522985791), produto `70476b99e0a34c4432d48f5d2f3710c26562aa1b` e snapshot `2160a52ea84ab1315ec2ae8fd1c5c5f82b2ce6b9`, preparou o corpus 1000/200/100 com digest `7b37f785864261ec218f53368b42c2f5a3a181ae3bb95197676e96b00ca7ccea`. O CLI real encerrou com `Profile policy mismatch: sf_portfolio` antes de readiness/autenticação. O recibo registra `authenticated: false`, `cacheState: null` e `observations: []`.

Nesse histórico não há mediana/p95, comparabilidade temporal, viewport aprovado ou zoom observado. A configuração e o typecheck daquele harness passaram separadamente no run [43522928224](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43522928224). O [recibo histórico completo](../../../sf2h/receipts/WP00/ui-bootstrap-observations.json) preserva as duas tentativas anteriores e a correção dos metadados. W5 usava o harness anterior; seus resultados não são execução da matriz ampliada.

## Resultado W7 e próxima revisão W8

O run de contratos W7 [43536802706](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536802706), snapshot `72fa3ea9ba156c8ff656772b0f25a08c1c26e780`, concluiu com `success`. O run de checks [43536792411](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536792411), snapshot `20c38eaabbbc8bbb20ba7ca1560d084762c267a3`, concluiu com falha: 149 diagnósticos Sucafina, sendo 144 herdados e cinco introduzidos nesta entrega. Os cinco receberam correção para a próxima revisão, ainda dependente de CI. O typecheck específico da UI cobriu seis arquivos e passou; os guards examinaram 606 paths com 78 regras, sem erro de gate, com 11 avisos e zero erros.

Esses resultados não são observações de UI, do probe de zoom ou das 1.260 tentativas planejadas. W8 ainda aguarda CI nesta edição. O resultado da matriz e qualquer alteração de status dependem da conclusão e leitura dos recibos/artefatos do CI correspondente; não se transporta êxito de contratos, de typecheck ou de W5 para uma prova de browser posterior.
