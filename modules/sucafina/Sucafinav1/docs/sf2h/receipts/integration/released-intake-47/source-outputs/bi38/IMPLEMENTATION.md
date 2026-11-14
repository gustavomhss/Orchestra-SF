# Missão38 — M27-BI09-WATERFALL-MOUNT

## Entrega e fronteira

Esta entrega implementa a montagem do waterfall de custos do BI09 para o par persistido de cenário/comparação e para a combinação equivalente de portfólio. A fonte permanece `astra-wp05` / PR24, continuando `0881fee21f07bf8a9a1153d7d55727837cdf497a` após o ACK `d37494ad4015525c39062c9679f69b7e1f731ed8`. A mudança de produto ocupa somente os cinco paths autorizados; os testes e recibos novos ocupam os diretórios próprios da missão. Nenhum produtor financeiro de Portfólio ou contrato normativo foi alterado.

O patch em `integration/M38-BI09-WATERFALL.patch` é a unidade de consumo. Seu manifest contém os blobs de entrada e saída e cópias integrais dos arquivos. Ele foi preparado sobre os preimages materiais de C11 `e7e97591edfc15f230856a035e32951f2f700c2f`, idênticos nos cinco paths a C9 `c1bd1c91b0e0d32db3074408e815e36107384073` e ao head observado `c5ab23fd7c9b231917bf70123958c9ff03e7d420`. O último acrescenta somente documentos frente a C11.

A branch fonte é anterior às dependências já integradas em C11. Publicar os cinco postimages autorizados nela não importa o restante de C11. As diferenças herdadas de C9 nos mesmos arquivos são explicitadas pelos preimages fonte e integração; não representam novo trabalho financeiro desta missão. O consumidor deve aplicar o delta contra preimages conferidos, sem intake integral ou cherry-pick cego da branch antiga. Nenhuma outra montagem fora desses cinco arquivos foi identificada como necessária no alvo observado: `createSfBiServices`, factory e renderer já estão instalados lá.

## Origem dos valores

`createScenarioCostBiHost`, em `analytics/scenario.ts`, monta o produtor existente `plannerScenarioBiPresentation`. O produtor é dono dos componentes, deltas, ordem, rótulos, endpoints, valores de tabela e plano. O adapter não soma custos, não produz um segundo cálculo financeiro, não cria categoria residual e não converte ausência em zero.

O caminho valida a comparação C08 persistida, as referências exatas do baseline e candidato, as identidades de caso e encarnação e os resultados resolvidos pelo host canônico. O baseline pode ser histórico do mesmo caso, enquanto o candidato continua exigindo a versão exata do caso da comparação. Isso segue a política de `planner/persistence.ts` e `readHistoricalScenarios`; a promoção humana sequencial normalmente cria baseline v2 e candidato v3. As identidades antigas não são reescritas. Um candidato também histórico, após outra revisão do caso, continua sujeito à recusa do leitor existente; esta missão não amplia essa política.

A leitura acontece no snapshot read-only existente. Fonte, recibos e par resolvido são observados novamente antes da saída. A comparação usa a identidade material de projeção, preservando os fences de autorização, cancelamento, escopo, versão e mudança da fonte. O selector continua sendo seleção, não concessão de acesso.

## Montagem no consumidor

Em `bi-services.ts`, somente BI09 de cenário usa a rota `projectedScenario` com o host de custos. BI10 e BI11 conservam a rota anterior, suas tabelas e exigência de sensibilidade persistida. As rotas Dashboard, Planner e Procurement permanecem na configuração existente. A lista de indisponibilidades continua declarando a timeline ausente: esta correção não conclui BI10.

Para Portfólio, o bridge exige uma única combinação persistida correspondente a `sourceScenarioRef`, a comparação dessa análise e igualdade exata dos componentes. Confere a projeção original de Portfólio contra a projeção do cenário mais os `missing` já produzidos para combinações sem análise. Consome o mesmo produtor do par persistido e restaura o envelope original de Portfólio. Só `values` e `components` são substituídos pelas observações canônicas; decisão, resultados, contexto, cobertura, moeda, horizonte, fontes e versões permanecem.

O seam opcional `project` de `bindStoredPortfolioBiPort` preserva o caminho anterior com `present`. Clona argumentos e resultados; recusa mutação dos argumentos, alteração da seleção/autorização, outro view e qualquer mudança no envelope além de values/components. Relê a fonte pelo reader capturado e exige identidade material antes de devolver a projeção. Custos de operações externas não quantificados permanecem desconhecidos, conforme o produtor existente.

## Renderer e reconciliação

O renderer existente recebe o plano real e mantém a tabela equivalente e navegação por origem, inclusive escolha explícita entre fontes e uso por teclado. Custos condicionados e seleções de Portfólio são identificados como subtotais conhecidos. Totais completos nulos continuam nulos. Pontos ausentes não são desenhados como zero.

`resolveWaterfall` agora confere também a relação de cada delta com os endpoints fornecidos (`end === start + amount`). Essa verificação usa a mesma operação do produtor, inclusive sua representação de ponto flutuante; não repara valores, arredonda, infere tolerância ou cria fechamento. Descontinuidade, contribuição incompatível e final divergente permanecem `unreconciled`; observações ausentes permanecem `unavailable`. Unidades, moeda e horizonte incompatíveis são recusados.

No caminho de tabela sem valores de gráfico, `view.ts` conserva período, moeda, versão e limitações do produtor. Assim, uma indisponibilidade de composição não apaga o motivo nem a tabela já disponível.

## Testes preparados

São quatro arquivos executáveis, com 45 casos declarados, e uma fixture auxiliar:

- `portfolio-binding.test.ts`: 17 casos de contrato do seam, compatibilidade e imutabilidade. Sua fixture é declaradamente de adapter, sem alegar admissão ou cálculo real.
- `waterfall-contract.test.ts`: 19 casos sobre observações fornecidas, incluindo oracle literal 100 +20 −5, deltas adulterados, descontinuidade, negativos, cancelamento, zero, ausência, unidades, moeda e período.
- `presentation.test.ts`: sete casos com SQLite, autoridades reais, fontes Planner declaradas, cobertura humana, promoções HTTP sequenciais, comparação C08 e dispatcher instalado. Inclui cenário completo com um custo confirmado próprio por categoria, condicionado, ausência, portfólio persistido equivalente e contraprov­as de acesso/fonte/identidade.
- `rendering.test.ts`: dois casos usando o resultado do dispatcher instalado e o renderer real em Chromium, sem servidor de transporte. Compara valores exatos na tabela e no title/aria-label das marcas, origens, teclado, largura de 320 px e ausência de marcas falsas para null.

Os testes de integração usam `compositionTestDeadline` existente, 105 segundos cooperativos e limite externo existente de 120 segundos. Não há skip, aumento de timeout ou fallback para fabricar cobertura completa. Apenas registros sintéticos de fonte e caso vazio são semeados; resultados financeiros, cobertura, referências persistidas e bindings são produzidos pelos serviços reais. Mutações de registros após a produção são exclusivamente contraprov­as adversariais declaradas.

O request do consumidor acrescenta o teste existente `wp10/integration/bi-decision-navigation.test.ts`, com sensibilidade realmente persistida. Esse teste complementar cobre projeção e navegação de BI11, não prova um positivo do dispatcher instalado de BI11 nem a totalidade dos oito views anteriores.

## Validação e consumo

`SOURCE.ci-request.json` seleciona explicitamente os quatro testes próprios. O único snapshot autorizado desta fonte é S descendente de W publicado em `astra-wp05`, com diferença exclusiva `.ci-run.json`. Não foi criado snapshot composto alternativo sobre C11 nem concedida autorização para isso. O workflow existente `astra-wp05-check` é a via delimitada para `bun typecheck` em `modules/sucafina` e `bun run check:guards --base origin/dev`. O resultado factual das Actions será registrado no recibo terminal, inclusive falhas de dependência e testes que não chegam a executar.

Para consumo, conferir os preimages do manifest, aplicar o patch integral de cinco arquivos e cinco arquivos de testes, preservar todos os outros paths e registrar W consumidor. Executar os checks e a seleção em `CONSUMER-33.ci-request.json` somente pela autoridade/fluxo vigente do consumidor, com S direto e prova de igualdade de blobs. Também é necessário typecheck dos packages relevantes no candidato integrado, inclusive `apps/cli`. Não transplantar um resultado da fonte para esse candidato.

O destinatário lógico pedido é sessão33. O head observado contém seu handoff terminal em `integration/latest-intake-33/HANDOFF.md` e o ACK de continuidade da integração42 em `integration/rolling-intake-42/authority-ack.json`. A entrega não afirma recebimento, ACK ou aceitação de M38 por nenhuma delas. Qualificação global, três revisões independentes, AM e gates do bundle continuam com a integração.

## Critérios

Os seis critérios literais pedidos estão copiados em `criteria-preflight.json`. A prova preparada é restrita ao finding M27. Ela não conclui os critérios de oito perguntas antigas mais três novas, nem o oracle histórico específico AI-RENEWAL-OMITTED-CATEGORY/training=40000. Revisão estática de helpers não é execução de testes nem aprovação independente do bundle. Os estados finais dependem dos logs e do consumo efetivo, sem promoção de NOT_RUN a PASS.
