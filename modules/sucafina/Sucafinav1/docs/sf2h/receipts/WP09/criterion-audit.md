# WP09 — auditoria independente da promoção de critérios

## Conclusão

O mapa contém **112 IDs únicos**: 22 do WP e 90 das sete tasks. A execução hospedada W5 verificou 172 testes em 30 arquivos, com zero falhas, incluindo consumidores reais de Planner/C06, Procurement, documentos WP06, revisões WP07, Hot Topics e comandos de decisão. Isso não fecha automaticamente os 112 critérios.

**Recomendação conservadora sobre o mapa auditado: 51 `verified_surgical`, 21 `partial` e 40 `blocked_external`.** São cinco reclassificações dos 56 `implemented_unverified` anteriores. Nenhum `partial` ou `blocked_external` anterior foi promovido nesta auditoria.

`verified_surgical` significa que o comportamento próprio e delimitado no texto do critério está sustentado por implementação inspecionada e pelos testes hospedados indicados; não significa GNATIVE, READY_FOR_REVIEW, integração UI completa, execução de provider/judge nem aceitação global do WP. As parcelas nativas explicitamente pedidas permanecem parciais/bloqueadas.

## Evidência examinada

- Produto W5: `ed9a1da0420a0575e16c48118c6ce52edac6ae50`.
- Snapshot CI: `5fbdb55cc56ef0935471b8d674b811995c0385a9`.
- [Run 43537797828](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43537797828), job `132270915451`, `test-ci`, seleção de 28 arquivos WP09 e dois arquivos documentais WP06.
- Log observado: **172 pass, 0 fail, 911 expect(), 30 files, 60.41 s**. Omni positive control: **not applicable**; não ocorreu spawn Omni.
- Mapa auditado: `criterion-map.json`, estado anterior 56/16/40.
- Leitura estática dos produtores próprios e testes associados, com atenção a `review.ts`, `review-host.ts`, `dossier.ts`, `forecast.ts`, `lifecycle.ts`, `schedule-native.test.ts`, `authority-dispatch.test.ts`, `request-dossier.test.ts`, `review-product-consumer.test.ts`, `actions.test.ts`, `handoff.test.ts` e `followup-consumer.test.ts`.

O typecheck W5 não está verde; a matriz possui correção de tipagem pendente de nova evidência hospedada. Esta auditoria não afirma resultado de W6. Nenhum produto, teste ou typecheck foi executado localmente. As únicas operações locais foram leitura e escrita deste recibo e contagem estrutural do JSON.

## Cinco critérios a manter parciais

### WP09.QLT.20

**Texto canônico:** Pendência de revisão material, dado extraído sem confirmação e fonte indisponível são estados diferentes com próximo passo adequado.

**Parcela verificada:** Os estados material-review/unconfirmed, pending/rejected/unavailable e os gaps são distintos; testes reais de C06 e documentos passaram.

**Parcela sem prova:** Falta demonstrar o próximo passo adequado de cada pendência no consumidor. review.ts devolve kind/reason; dossier.ts devolve gaps. lifecycle.nextAction trata estado da execução, não a resolução específica de revisão material, candidato documental e fonte indisponível.

**Próximo passo:** Apresentar e testar a orientação/ação por tipo, por exemplo rever material atual autorizado, confirmar o candidato na porta documental existente ou resolver acesso/fonte sem expor conteúdo.

### WP09.T02.CHK.02

**Texto canônico:** Tópico sem atualização e sem confirmação válida é pendência. Em CONFIRM-SCOPE, janeiro confirmado v7 continua encerrado após edição isolada de fevereiro v8; edição de janeiro reabre uma única cobrança. Mostrar idade/faltantes; unavailable por revogação não expõe dados nem solicita revisão ao ator sem acesso.

**Parcela verificada:** CONFIRM-SCOPE janeiro v7/fevereiro v8, cobrança única por mudança material, faltantes e ocultação após revogação passaram nos testes.

**Parcela sem prova:** A parcela mostrar idade não está demonstrada. review.ts conserva sourceObservedAt, que é a data da observação da fonte; não é necessariamente a data da última atualização do conteúdo nem uma idade exibida. O teste preparation-egress só compara esse timestamp.

**Próximo passo:** Obter a idade/última atualização da projeção real responsável, preservar sua semântica separada de evaluatedAt/observedAt e provar apresentação com tópico sem atualização.

### WP09.T04.QLT.01

**Texto canônico:** O resultado explica evidência e custo da escolha em linguagem curta; fonte cadastral e condição negociada são distinguíveis.

**Parcela verificada:** Ranking, valores, justificativa humana registrada, referência documental e distinção entre proposalTerms e supplierRegister not-selected passaram.

**Parcela sem prova:** O retorno é estruturado em summary/draft/CommercialComparison; não foi identificado ou executado um consumidor que explique evidência e custo da escolha em linguagem curta. Não confundir o texto da receita ou a existência de campos com essa explicação.

**Próximo passo:** Adicionar apresentação determinística curta rastreável aos campos ou demonstrar o renderer real que já os transforma nessa explicação; provar sua leitura com fonte e custo da escolha.

### WP09.T06.CHK.01

**Texto canônico:** Uma ocorrência não significa run concluído: verificar o estado real de admissão e execução.

**Parcela verificada:** Schedule/SessionInput reais persistem o prompt, deduplicam e permanecem admission-pending. Casos negativos impedem anunciar conclusão pela mera ocorrência/resultRef.

**Parcela sem prova:** A parcela verificar o estado real de admissão e execução está ausente: schedule-native.test.ts declara o limite e seus casos terminais usam readRun/readExecution injetados. Eles verificam o contrato de leitura, não uma execução C07/Relay real.

**Próximo passo:** Compor o leitor nativo terminal e a ocorrência admitida no host e anexar seus recibos correlacionados. Manter os testes atuais como evidência de fronteira.

### WP09.T06.DOD.18

**Texto canônico:** Descritores C16 de sf_watch_prepare são implementados e consumidos por T06 com referências reais.

**Parcela verificada:** Descritor, schema, dispatcher comum, lease consumida, recibos UI e matriz dos seis exports passaram.

**Parcela sem prova:** sf_watch_prepare recebe caseRef/conditionRef/recipeRef de callbacks injetados nos testes. Não existe testemunho do consumo T06 com referências reais dos produtores e ocorrência nativa qualificada.

**Próximo passo:** Compor o descriptor com a porta real de watch/ocorrência e demonstrar o vínculo exato caso/condição/publicação/recorrência no consumidor T06.

## Critérios com promoção cirúrgica recomendada

Os 51 IDs abaixo podem receber o run W5 com as provas delimitadas dos arquivos associados. O root deve conservar limitações por critério e a correspondência de blobs entre o produto executado e o head entregue. Caso algum desses arquivos mude, anexar a execução afetada antes de promover no head novo.

| Critério | Testes hospedados associados |
| --- | --- |
| `WP09.DOD.20` | `planner-confirmation-consumer.test.ts`, `request-dossier.test.ts`, `review-product-consumer.test.ts` |
| `WP09.INV.02` | `review-product-consumer.test.ts`, `sourcing-consumer.test.ts`, `followup-consumer.test.ts`, `decision-answer-consumer.test.ts`, `recipes.test.ts` |
| `WP09.INV.03` | `lifecycle-presentation.test.ts`, `result-access.test.ts`, `schedule-native.test.ts`, `planner-confirmation-consumer.test.ts`, `sourcing-consumer.test.ts` |
| `WP09.INV.20` | `planner-confirmation-consumer.test.ts`, `request-dossier.test.ts` |
| `WP09.QLT.10` | `lifecycle-boundaries.test.ts`, `result-access.test.ts`, `publication.test.ts`, `preparation-egress.test.ts` |
| `WP09.CMP.20` | `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts`, `request-dossier.test.ts` |
| `WP09.SUC.02` | `followup-consumer.test.ts`, `decision-answer-consumer.test.ts`, `review-product-consumer.test.ts`, `sourcing-consumer.test.ts`, `recipes.test.ts` |
| `WP09.T01.CHK.01` | `publication.test.ts`, `recipes.test.ts`, `lifecycle-boundaries.test.ts`, `capabilities.test.ts` |
| `WP09.T01.CHK.03` | `lifecycle-presentation.test.ts`, `result-access.test.ts`, `lifecycle-boundaries.test.ts` |
| `WP09.T01.INV.01` | `recipes.test.ts`, `publication.test.ts`, `capabilities.test.ts`, `lifecycle-boundaries.test.ts` |
| `WP09.T01.INV.02` | `authority-dispatch.test.ts`, `lifecycle-boundaries.test.ts`, `result-access.test.ts`, `discovery.test.ts` |
| `WP09.T01.INV.18` | `authority-dispatch.test.ts`, `lifecycle-boundaries.test.ts`, `planner-confirmation-consumer.test.ts`, `sourcing-consumer.test.ts` |
| `WP09.T01.QLT.01` | `lifecycle-presentation.test.ts`, `result-access.test.ts`, `schedule-native.test.ts` |
| `WP09.T01.QLT.18` | `authority-dispatch.test.ts`, `lifecycle-boundaries.test.ts`, `result-access.test.ts` |
| `WP09.T01.CMP.18` | `authority-dispatch.test.ts`, `lifecycle-boundaries.test.ts`, `capabilities.test.ts`, `export-matrix.test.ts` |
| `WP09.T07.INV.01` | `recipes.test.ts`, `decision.test.ts`, `decision-answer-consumer.test.ts` |
| `WP09.T02.CHK.01` | `review-product-consumer.test.ts`, `planner-confirmation-consumer.test.ts`, `review.test.ts` |
| `WP09.T02.CHK.04` | `review-product-consumer.test.ts`, `planner-confirmation-consumer.test.ts`, `preparation-egress.test.ts` |
| `WP09.T02.INV.01` | `review-product-consumer.test.ts`, `review.test.ts` |
| `WP09.T02.INV.02` | `planner-confirmation-consumer.test.ts`, `preparation-egress.test.ts`, `confirmation.test.ts` |
| `WP09.T02.QLT.02` | `review-product-consumer.test.ts`, `planner-confirmation-consumer.test.ts` |
| `WP09.T02.CMP.01` | `review-product-consumer.test.ts`, `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts`, `preparation-egress.test.ts`, `review.test.ts` |
| `WP09.T03.CHK.01` | `planner-confirmation-consumer.test.ts` |
| `WP09.T03.CHK.02` | `forecast-domain-consumer.test.ts` |
| `WP09.T03.CHK.03` | `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts` |
| `WP09.T03.CHK.04` | `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts`, `forecast.test.ts` |
| `WP09.T03.CHK.20` | `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts`, `confirmation.test.ts` |
| `WP09.T03.DOD.01` | `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts`, `forecast.test.ts` |
| `WP09.T03.INV.01` | `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts` |
| `WP09.T03.QLT.02` | `planner-confirmation-consumer.test.ts`, `forecast-domain-consumer.test.ts` |
| `WP09.T04.CHK.01` | `sourcing-consumer.test.ts` |
| `WP09.T04.CHK.02` | `sourcing-consumer.test.ts`, `preparation-egress.test.ts`, `request-dossier.test.ts` |
| `WP09.T04.CHK.03` | `sourcing-consumer.test.ts`, `dossier.test.ts`, `preparation-egress.test.ts` |
| `WP09.T04.CHK.04` | `sourcing-consumer.test.ts`, `request-dossier.test.ts`, `preparation-egress.test.ts` |
| `WP09.T04.CHK.20` | `request-dossier.test.ts` |
| `WP09.T04.INV.01` | `request-dossier.test.ts`, `sourcing-consumer.test.ts` |
| `WP09.T04.INV.20` | `request-dossier.test.ts`, `dossier.test.ts` |
| `WP09.T04.QLT.02` | `sourcing-consumer.test.ts`, `request-dossier.test.ts`, `preparation-egress.test.ts` |
| `WP09.T04.CMP.01` | `sourcing-consumer.test.ts` |
| `WP09.T04.CMP.20` | `request-dossier.test.ts`, `dossier.test.ts` |
| `WP09.T04.SUC.02` | `request-dossier.test.ts`, `sourcing-consumer.test.ts` |
| `WP09.T05.CHK.01` | `actions.test.ts` |
| `WP09.T05.CHK.02` | `actions.test.ts`, `followup-consumer.test.ts` |
| `WP09.T05.CHK.03` | `handoff.test.ts`, `followup-consumer.test.ts`, `actions.test.ts`, `review-product-consumer.test.ts` |
| `WP09.T05.DOD.01` | `handoff.test.ts`, `followup-consumer.test.ts` |
| `WP09.T05.INV.01` | `actions.test.ts`, `handoff.test.ts`, `followup-consumer.test.ts` |
| `WP09.T05.CMP.01` | `actions.test.ts`, `handoff.test.ts`, `followup-consumer.test.ts` |
| `WP09.T06.INV.01` | `schedule.test.ts`, `schedule-boundaries.test.ts`, `schedule-native.test.ts` |
| `WP09.T06.INV.18` | `authority-dispatch.test.ts`, `lifecycle-boundaries.test.ts`, `schedule-boundaries.test.ts` |
| `WP09.T06.QLT.18` | `authority-dispatch.test.ts`, `lifecycle-boundaries.test.ts`, `schedule-native.test.ts` |
| `WP09.T06.CMP.18` | `authority-dispatch.test.ts`, `lifecycle-boundaries.test.ts`, `export-matrix.test.ts` |

## Restrições específicas para não transformar prova de fronteira em prova nativa

- `WP09.T01.CMP.18` e `WP09.T06.CMP.18`: a matriz cobre os cinco exports de rotina e o export de watch, sucesso/recibo, chamada direta, serialização/revogação, revogação durante await, stale e indisponível. Essa cobertura é do dispatcher, schemas e fronteiras; os serviços C08 são injeções explícitas. Não declarar UI/native/MCP equivalente, aprovação C07 ou execução Relay por causa dos 36 casos.
- `WP09.T01.QLT.18` e `WP09.T06.QLT.18`: a redação pede schema fechado, ausência/falha e provenance que permitam comparar os transportes. Essa propriedade de representação é verificável. A paridade de comportamento real dos três transportes não foi executada.
- `WP09.T04.CMP.20`: extraído/confirmado/stale/sem texto/acesso revogado são exercitados pelos produtores reais. O estado rejected é colocado por fixture explícita no armazenamento WP06 após extração real; isso qualifica seu consumo pelo WP09, sem afirmar uma ação humana pública de rejeição que WP06 não publica.
- `WP09.T05.CMP.01`: cancelamento não é ausência de chamada. O consumer real admite uma confirmação de update, encerra a autoridade via `human.finish` e verifica recusa, além de preservar o prazo original; a parte cancelamento está coberta.
- As invariantes de não aprovar negócio, não inventar compromisso/cálculo e não liberar resultado antigo podem ser verificadas pelas fronteiras e consumidores reais mesmo sem executar provider. Isso não permite promover critérios positivos de execução nativa.
- As receitas são publicadas/materializadas no AuthoringStore real. Sua lista de etapas/implementationRefs não equivale à execução das funções de domínio; não promover as DODs nativas por essa publicação.

## Lacunas anteriores preservadas

Permanecem todos os 40 `blocked_external` e os 16 `partial` originais, incluindo ausência do host governado, leitor terminal/artefato real composto, ocorrência Schedule com autoridade/CAS qualificada, retorno UI, continuação nativa de decisão, dados sec/el do Planner e idade variável na seleção WP07 de Procurement. Esta auditoria não altera os IDs nem o texto canônico e não substitui o mapa final do root.

## Revisão estática adicional — candidato W7

Após a auditoria W5, foi inspecionado o delta próprio de apresentação em `review.ts`/`dossier.ts` e cinco arquivos de teste consumidores. **Não foi encontrado um finding concreto nesse delta. O resultado do CI W7 ainda não foi observado nesta revisão.** As recomendações a seguir são condicionais à execução hospedada dos mesmos blobs e não reescrevem a conclusão histórica W5.

### WP09.QLT.20 — lacuna de implementação resolvida, execução pendente

`draft.nextSteps` diferencia revisão de alteração material, confirmação do recorte e indisponibilidade da fonte. Quando o acesso está indisponível, a orientação é genérica e não inclui a referência/timestamp/fingerprint ocultos nem pede confirmação do conteúdo. O dossiê orienta a conferir e confirmar o candidato pela superfície documental existente, mantém a rejeição fora das premissas, diferencia fonte sem acesso e retira a orientação de confirmar quando o candidato já está confirmado.

Os testes ampliados de Planner/C06, revisão WP07 e extração documental TXT/DOCX/PDF verificam a orientação entregue no retorno real das preparações. Nenhuma nova aprovação nem execução automática foi introduzida. Se esses testes passarem no snapshot W7, a lacuna apontada para `WP09.QLT.20` pode ser encerrada no nível cirúrgico do produtor/consumidor. Não é uma prova de navegação UI completa.

### WP09.T04.QLT.01 — lacuna de implementação resolvida, execução pendente

`explanation` agora contém texto determinístico curto com custo comparável, moeda, pontuação e elegibilidade de cada proposta. A explicação conserva os `evidenceRefs` da proposta calculada pelo domínio. A escolha humana é lida da seleção explícita do produtor; não é deduzida do primeiro colocado. Ausência de custo/FX ou de escolha permanece explícita, e a justificativa só aparece como justificativa registrada. A distinção entre condições negociadas das propostas e cadastro do fornecedor não selecionado permanece expressa em texto.

O consumer real de sourcing verifica a proposta B escolhida fora do topo, custo USD 30.240 calculado com FX submetido 1,08, justificativa preservada, exclusão técnica de C, seleção ausente e custo indisponível com FX faltante. Se a execução W7 desses testes passar, `WP09.T04.QLT.01` pode ser promovido para `verified_surgical` com essa evidência. A rotina não calcula novamente o preço nem seleciona fornecedor.

### Critérios que continuam parciais

`WP09.T02.CHK.02` continua parcial. `lastUpdate` declara `unknown` com motivo `source-update-time-unavailable`: o código não deriva idade de `observedAt`, de confirmação humana ou de `ageDays` do ciclo de Procurement. Essa declaração honesta melhora o retorno, mas não substitui a idade autoritativa ausente no contrato do produtor.

`WP09.T06.CHK.01` e `WP09.T06.DOD.18` não foram alterados pelo delta e continuam parciais pelas razões nativas já discriminadas.

**Contagem condicional após prova W7 dos dois critérios corrigidos: 53 `verified_surgical`, 19 `partial`, 40 `blocked_external`.** O root deve anexar o SHA/run/resultados efetivamente observados antes de adotar essa contagem.

### Blobs locais lidos nesta revisão estática

Os hashes SHA-256 abaixo vinculam esta leitura ao conteúdo; não são SHAs Git nem resultado de execução.

| Arquivo relativo a Sucafinav1 | SHA-256 |
| --- | --- |
| `product/routines/review.ts` | `57fb106e1055875119a6af9835e859bcbf6f117448189771633cfafbb79f0ca1` |
| `product/routines/dossier.ts` | `887fc25028e7f69fa6cdfec2a5e31eb6be82dc97182045b43adc658084f564fe` |
| `test/product/wp09/planner-confirmation-consumer.test.ts` | `20317ae6bab36b4d93c397e7176ec60d45b2dac033869f6d1f46c03d29b7d355` |
| `test/product/wp09/request-dossier.test.ts` | `130462bea88ee40730f07583cf271c9be333a7a6d4b1314f6503b88ee1d924ca` |
| `test/product/wp09/sourcing-consumer.test.ts` | `23c1becdd5d9c1bd5b1e9a0f8925d92f89cde2f0f273a8f109fac41584de402c` |
| `test/product/wp09/review-product-consumer.test.ts` | `7cf3a54a867798324dd3027206e77346acb5494252d51fbd1f156c73de6bdd68` |
| `test/product/wp09/preparation-egress.test.ts` | `5475eb467cb70e8fdae168feed81c0eee9954856da4e0f3bd4845d43978aaf9b` |
