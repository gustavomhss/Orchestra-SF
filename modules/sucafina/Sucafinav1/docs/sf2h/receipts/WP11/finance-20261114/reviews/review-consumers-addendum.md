# Adendo independente de consumidores — W10

## Pin e método

Revisão somente por leitura do produto `660db9a46e4c1d7ff87c23f6bb37f451cc703ccb`, árvore `bbc79890ba339e0fca0fb34f55bd4d1c69a7953e`, no snapshot imóvel `/workspace/scratch/a97ca4c53050/review-660db9a`. O revisor não é autor das correções. Este documento complementa `review-consumers-report.md`, sem alterar seu registro W3.

Recalculei os Git blobs dos **734 arquivos não documentais** do manifesto: **zero divergências**. Li o código e os testes das correções, comparando os caminhos relevantes com W3. Não executei produto, teste, navegador, build, typecheck nem CI; escrevi apenas este adendo e seu JSON.

## Resultado por achado

| Achado | Estado contra W10 | Limite para fechamento |
|---|---|---|
| C1 — A/B sem navegação | Defeito original corrigido no código: marca e tabelas oferecem escolha explícita, e consumidor verifica referência integral na mesma linha atual | Nova regressão C1R de foco; testes ainda não executados; rota/assets externos instalados não comprovados |
| C2 — actual ausente confundido com zero | Corrigido no produtor compartilhado e no runtime Overview realmente chamado | Teste discriminante escrito; execução Actions e fluxo HTTP instalado não comprovados |
| G2 — diferença assinada sem prova DOM | Rótulo canônico e assertions DOM adicionados para custo alternativa − referência: **−30000 → +10000** | Literal **+30000 → −10000** de WP05.T05.CHK.20 permanece apenas no objeto advantageComparison; sem PASS de navegador |
| G3 — composição externa | Fábrica CLI e avanço nested C17 reconhecidos | Intake COMPOSE4 usa W2; não comprova instalação dos novos componentes W10 nem rota completa da seleção da marca |

## C1: correção implementada, com uma regressão própria aberta

`product/analytics/source-navigation.ts:8–30,35–60` mantém o delta e usa as referências canônicas fornecidas pelo produtor. Uma origem singular continua direta; duas origens exigem escolha humana. Os rótulos identificam tipo, registro e versão; A/B são nomes das opções, não uma inferência financeira a partir da ordem. Não foi inventado um calculation ID, não há abertura silenciosa da primeira referência e `product/planner/bi-difference.ts` permanece sem mudança.

`view.ts:182–197,332–348,387–396` e `waterfall.ts:57–85,130` aplicam a mesma seleção ao gráfico, tabela equivalente e tabela de composição. `consumer.ts:51–70` redispatcha a projeção, localiza a mesma `valueId` e compara o objeto canônico integral por `digestSfValue`, não somente o campo `refDigest`. Preserva versão de projeção/engine, contexto/período, resolução C17, igualdade de currentRef, accessRevision e revalidações finais.

Os discriminantes escritos são específicos:

- `test/product/wp05/planner-origins.test.ts:12–135`: produtor/issuer Planner reais, BI02 e BI03, contribuição zero e não zero, A/B, mouse/teclado/tabelas, payload exato e rejeição de terceira referência. O callback é capturado e a fronteira C17 é um harness explicitamente descrito; não é o HTTP/Atlas instalado.
- `test/product/wp05/consumer.test.ts:132–174`: rejeita campos/versão alterados, outra linha, contexto/engine/projeção/selection diferentes, fonte revogada, currentRef diferente e revogação após resolução.

### C1R — Média — retorno de foco encontra botão oculto do seletor

**Aberto no W10.** Em `source-navigation.ts:27`, os botões A/B recebem o mesmo `data-bi-focus` da marca. O chooser é inserido antes do SVG (`view.ts:186`; `waterfall.ts:57–59`). Ao escolher uma origem, `source-navigation.ts:50` apenas define `hidden=true`: os botões continuam no DOM. `view.ts:421–428` procura o primeiro atributo coincidente, chama `focus()` sem verificar visibilidade ou resultado e retorna `true`.

Reprodução deduzida do código, sem navegador executado:

1. Renderizar contribuição com duas origens em BI02 ou BI03.
2. Abrir seletor e escolher A ou B, preservando o mount para detalhe/retorno.
3. Mover o foco para um controle de detalhe/retorno e chamar `restoreBiFocus(container, selection)`.
4. O primeiro candidato é o botão sob o fieldset oculto; a marca visível não recebe o foco, embora o helper informe sucesso.

Cancel/Escape funciona por um caminho diferente que usa `returnFocus` diretamente. É justamente o único retorno testado no novo `planner-origins.test.ts:109–116`. Os testes anteriores de foco usam referências singulares e não criam esse seletor preenchido.

Correção delimitada: limpar o conteúdo ao ocultar após escolha, ou ignorar candidatos ocultos/desconectados e confirmar o foco efetivo antes de retornar sucesso. O discriminante deve escolher A e B em ambas as visualizações, mover foco e invocar o **export real** de restauração no mesmo mount, afirmando `document.activeElement` na marca visível. Afeta WP05.CMP.02, WP05.T01.CHK.05, WP05.T02.CHK.05 e WP05.T04.CHK.04.

## C2: ausência e zero corrigidos sem reescrever a regra numérica

`product/planner/actual-presence.ts:3–11` qualifica o total existente com presença da entrada e da conversão, preservando `domainValue`. O produtor mensal (`product/planner/port.ts:203–206`), a célula do runtime e o SVG (`runtime/planner.ts:1072,1084,1854–1880`) consomem essa mesma função. Zero registrado fica visível em mês aberto ou fechado; entrada ausente ou sem preço fica indisponível com explicação. Não há mais decisão de presença baseada em `value === 0`.

`runtime-overview-presence.test.ts:9–65` usa a exportação real de render do runtime e o produtor Planner real. Afirma closed/null, closed/0, open/0, FX ausente e actual HR independente de rate de budget. Verifica estado e texto da tabela, existência/título dos pontos no SVG, alinhamento com C02 e snapshot persistido inalterado. O próprio teste afirma que o total numérico legado continua zero e que o HR sem rate mantém budget ausente, sem apagar um actual zero conhecido.

**C2 está corrigido por inspeção de implementação.** A prova escrita ainda não foi executada. `page.setContent` do render real não equivale a navegação instalada com sessão/HTTP.

## G2: convenção clara e assertion útil, sem quitar o literal diferente

`product/analytics/decision-view.ts:18–22` agora diz “diferença conhecida (alternativa − referência)”, identifica ambos os resultados e explica o sinal. `choice-history-bi.test.ts:120–134` verifica essas frases e os números realmente renderizados, **−30000 antes e +10000 depois**. Não há recomputação financeira no BI.

O pack preservado exige em **WP05.T05.CHK.20**:

> A mesma revisão de AI-RENEWAL-OMITTED-CATEGORY aparece no gráfico e tabela: pending sem barra zero; training = 40000 altera total210000→250000 e diferença 30000→-10000, com fontes e snapshot histórico preservados.

Os valores **+30000 → −10000** continuam nas assertions de `advantageComparison` em `choice-history-bi.test.ts:55,78–79`, fora do DOM. A diferença de custo inversa é coerente e explicitamente rotulada; isso não é um erro financeiro. Porém a nova assertion visual não é prova literal da vantagem pedida. Assim, a ambiguidade e a ausência de assertion da convenção exibida foram corrigidas; o critério não pode receber aceite integral por esse delta. Não foi observado PASS de navegador.

A prova do mesmo caso continua distinguindo mutações reais `addAlternative`/`recordChoice` e persistência de fixture de autoridade/captures sintéticos. A escolha permanece histórica e os assertions conservam zero preparedChanges/receipts e estado não aplicado; não há claim de aplicação real.

## Consumidores externos e limites atuais

A fábrica CLI real em `foreign-intake/WP10/apps/cli/src/sucafina-product/bi-services.ts:114–120` já consome `plannerDifferencePresentation` para BI02/BI03. O intake COMPOSE4 de `4306b310e4d6dac77f9beab461adad4e8e924849` registra a incorporação de W2 `981ad44102b2e2e67d31bfc8fb7d97208e390e5b`, incluindo o consumidor anterior. Não equivale à instalação do novo blob de `consumer.ts` nem de `source-navigation.ts`/assets W10.

O avanço nested C17 existe no código fornecido: `foreign-intake/COMPOSE4/apps/cli/src/sucafina-product/planner-calculation-services.ts:67–73` fornece replay/evidence, e `business-services.ts:334` liga `planner.simulateScenario` e contexto. Isso é composição real de fonte/replay; não demonstra por si o percurso de uma marca até o destino de detalhe no navegador.

O finding de INTERFACE6 `docs/sf2h/receipts/WP01/astra-interface/findings/bi-refresh-lifecycle.md` registra que os consumidores atuais bi-entry/extended-bi-browser não registram `sucafina:main-refresh`. Também explicita que um GET autorizado do shell não reautoriza a projeção anterior e que retenção positiva/releitura/integração BI continuam sem prova. O finding é evidência do owner, não uma execução independente deste revisor.

Não inferi ausência de callers pelo snapshot esparso nem atribuí ao host externo inteiro a restrição do HTTP anteriormente inspecionado. A revisão externa deste adendo é limitada aos arquivos e intakes fornecidos; a rota completa e os assets devem ser demonstrados pelo owner.

## CI, critérios e conclusão limitada

O coordenador informou W9 check `43582252267`: 131 diagnósticos externos mais três diagnósticos próprios de tipagem de fixture WP05; guards PASS. Informou também que os testes de navegador ainda não rodaram e anunciou sucessor W11 apenas de tipagem. Não consultei nem executei CI, não atribuo PASS ao W10 e não incluo código futuro neste pin.

O relatório W3 conferiu literalmente 303 IDs/textos. Este adendo não reconferiu os receipts vivos, que não fazem parte do manifesto não documental W10, e não concede aceite comportamental integral. G1 mensal/409/annual-spread não foi reavaliado contra INTERFACE6 neste escopo; não se torna resolvido nem é automaticamente reafirmado por este adendo.

**Contra W10: C2 corrigido em código; C1 original corrigido em código com C1R médio aberto; G2 ganha sinal DOM verificável, mas literal e execução permanecem abertos. Sem READY, DONE ou veredicto global C/D.**
