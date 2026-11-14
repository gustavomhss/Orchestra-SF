# Adendo independente — vantagem canônica G2 no W14

**Conclusão: a lacuna literal G2 está corrigida na implementação e nas assertions DOM escritas.** O produto agora representa **30000 condicionado → −10000 completo** como vantagem conhecida, recebida de uma comparação inversa persistida. Não identifiquei novo defeito concreto nos oito blobs revisados. A execução do S6 e a integração instalada continuam pendentes.

## Pin, captura e método

- Produto: `fe13ee693bdcec1830190bcdb5cc7f2794942c1f`.
- Árvore informada: `1ce4e9fcb2e9fb81e12dcfd773aa2daae64be39a`.
- Captura lida: `/workspace/scratch/a97ca4c53050/finance-W14-changes.json`.
- Identidades Git recalculadas: **8/8 correspondentes, zero divergências**.

A revisão é independente e somente por leitura. Comparei os caminhos relevantes com o snapshot W10 e a captura W12 anteriormente revisados; não utilizei código do working tree em alteração. Não executei produto, teste, browser, build, typecheck ou CI. A conferência cobre estes oito blobs, não a reconstrução completa da árvore W14.

| Caminho, sob `modules/sucafina/Sucafinav1/` | Blob verificado |
|---|---|
| `product/analytics/stored-scenario.ts` | `f5bb6d732ffc588626553097d53d3c0e1457a81c` |
| `product/analytics/scenario.ts` | `b7174b16b485323f767d63e6842f3d61284245eb` |
| `product/analytics/advantage-view.ts` | `47b271f492292956a8d8696cc32cd999e9878661` |
| `product/analytics/view.ts` | `4a6d481a8c7de805d7e13a3d3ab334beffd5692e` |
| `product/analytics/projection.ts` | `29f32617de3ce33bbf414a7439f97d64806bbaa9` |
| `test/product/wp05/choice-history-bi.test.ts` | `40fbaf6eb4a7b88c3f4feb54773961188cd007da` |
| `test/product/wp05/stored-bi-fences.test.ts` | `2e18729fa382d1c8c1cc68d98703644e5c018be7` |
| `test/product/wp05/projection.test.ts` | `52e71583353ca80cfbba6746c5bb0dadac48d042` |

## Semântica e cercas de evidência

`product/analytics/stored-scenario.ts:21–31` aceita `advantageComparisonRef` opcional e não vazio. O cenário e a comparação original continuam ligados aos IDs selecionados e ao mesmo `caseRef` completo. A vantagem precisa ser exatamente o resultado selecionado, pertencer ao mesmo caso/encarnação/versão e inverter a dupla exata `baselineResultRef`/`alternativeResultRef` da comparação original. Não basta um valor com o sinal desejado.

Em `:36–55`, permanecem as cercas de instalação, projeto, principal, política, acesso, moeda e horizonte. Uma projeção que já ocupe o slot de comparação é recusada quando a vantagem foi pedida. Os dois callbacks de revalidação recebem clones e não podem modificar seleção/projeção/caso. Cenário, comparação original, vantagem e sensibilidade opcional são lidos novamente; a igualdade cobre o registro persistido integral. Uma troca do valor ou da evidência na segunda observação não é aceita.

`product/analytics/scenario.ts:19,31–43` transmite a referência opcional recebida do resolver autenticado e verifica se o leitor retornou esse resultado exato. Mantém as proteções contra mutação de seleção e projeção pelo presenter. A alteração de `sameBiProjection` em `projection.ts:11–22` normaliza somente o instante de observação das fontes do contexto da comparação. Referência, versão, engine, valores, evidências e demais campos materiais continuam participando da comparação.

A correção utiliza o slot `DomainProjection.comparison` existente. Os oito blobs não modificam contratos compartilhados.

## Ausência de cálculo financeiro duplicado

Em `stored-scenario.ts:58–65`, o valor exibido é copiado diretamente de `advantage.value.result.knownDifference`, junto com estado e fontes do resultado persistido. O BI não calcula `-difference`, não subtrai subtotais e não refaz a comparação. As operações numéricas de `advantage-view.ts:42–58` são coordenadas de desenho.

`knownDifference:null` produz evidência ausente. Um valor completo fica confirmado; um valor condicionado fica estimado e traz a qualificação correspondente. Zero conhecido conserva seu valor; não há preenchimento de ausência com zero.

A diferença de custo já existente mantém sua orientação explícita “alternativa − referência”. A nova seção apresenta “referência − alternativa” e explica o significado do sinal. Portanto não renomeia silenciosamente a medida anterior nem confunde vantagem com aumento de custo.

## Apresentação, fontes e navegação

`advantage-view.ts:8–20` exige o metricRef esperado, referência não vazia e distinta da comparação original, versão/engine/contexto coincidentes, IDs de valores únicos, moeda/horizonte coerentes e estado reconhecido.

A seção nomeada “Vantagem conhecida da alternativa” contém uma barra com descrição acessível, tabela equivalente e texto de estado. A pendência aparece explicitamente antes da resolução. O resultado persistido pode ser aberto por `openResult(comparisonRef)` e cada fonte utiliza seu `BusinessEvidenceRef` original em `openEvidence`; não há reconstrução de URL ou referência. O render real `renderBiView` chama essa seção e encaminha seus callbacks existentes (`view.ts:57–62`).

O teste verifica a identidade recebida pelos callbacks. Isso é uma prova de seleção do renderer, não uma prova de que o host instalado resolveu a referência via C17 e retornou do detalhe. Os novos botões são acionados por clique no teste; não foi acrescentado um percurso de teclado/retorno instalado neste delta.

## O que os testes escritos agora discriminam

| Teste | O que demonstra por suas assertions | Limite |
|---|---|---|
| `choice-history-bi.test.ts:16–20,45–58,72–87` | Persiste a comparação inversa canônica da fixture, confere igualdade com o resultado do produtor, ref exata, valores 30000/−10000 e presença das duas origens | Ainda depende da execução; mantém as declarações sintéticas de autoridade/captures já explicitadas na fixture |
| `choice-history-bi.test.ts:132–155` | Barra e tabela mostram literalmente 30000 Condicionada e −10000 Completa; orientação, resultRef e cada sourceRef são verificados no callback | Renderer e callbacks capturados, sem navegação HTTP/C17 instalada |
| `choice-history-bi.test.ts:49–52,64–103,156–177` | Mantém training pendente sem componente zero, training40000 após resolução, subtotal210000/total250000, mesma identidade de caso, revisão nova, escolha/snapshot antigos preservados e seleção antiga recusada | Não demonstra aplicação; preparedChanges/receipts continuam vazios e o caso não está aplicado |
| `stored-bi-fences.test.ts:106–166` | Recusa referência vazia/trocada, caso/par incorretos, troca na segunda leitura, revogação, mutação no fence final, moeda/período conflitantes e ocupação prévia do slot; confere forwarding | Fixture de fronteira com comparação manual e sourceRefs vazios; não é o oráculo financeiro |
| `projection.test.ts:16–32` | Aceita somente mudança de observedAt e rejeita mudança material de referência, versão, engine, moeda, período, acesso ou fonte | Teste de igualdade de projeção, não navegação |

A vantagem inversa é obtida pelo produtor canônico já inspecionado na fixture; o teste desta captura apenas a persiste e verifica. Não transforma um valor financeiro calculado pelo teste em resultado do produto.

## Estado de G2 e limites de fechamento

**WP05.T05.CHK.20 agora possui a apresentação literal e assertions DOM de 30000 → −10000 que faltavam no W10.** Isso fecha estaticamente a lacuna específica identificada no adendo anterior. Não constitui aceite integral do critério sem execução e prova do contexto integrado.

S6 permanece pendente segundo o coordenador. Nenhum PASS foi atribuído. A captura fornece o campo opcional, o binder e o renderer, mas não inclui adoção dessa referência pelo resolver CLI externo nem publicação/revalidação dos assets do host. Hosts que omitem `advantageComparisonRef` preservam o comportamento anterior. A adoção e a navegação instalada precisam ser demonstradas pelo owner.

C1R não foi reaberto nem repetido: permanece coberto pelo adendo de foco W12. Este adendo também não reconfere os 303 receipts vivos, as demais alterações financeiras ou toda a árvore W14.

**Parecer: G2 corrigido por revisão estática da implementação e das assertions autoradas; execução e integração instalada pendentes. Sem aceite integral ou veredicto global.**
