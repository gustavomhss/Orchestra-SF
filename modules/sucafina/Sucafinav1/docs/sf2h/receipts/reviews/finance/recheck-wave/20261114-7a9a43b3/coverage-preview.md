# coverage-preview — revisão de autoridade e equivalência

## Disposição e versões

**NOT_APPLIED no produto Finance; proposta requer correção ou prova de equivalência antes de aceite.** Este é um suplemento de FIN-IND-005, sem novo finding de defeito numérico e sem alegação de exploração em runtime.

- Produto examinado: `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1`.
- [coverage-preview.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/portfolio/coverage-preview.ts): blob `9f7e12113b38e73befb64f99a94fb8ca28d05eee`.
- PR56 final: `0d2e59ffb14c31ebfb0b717d3d0078985ab2a3b7`.
- [Patch proposto](https://github.com/gustavomhss/Orchestra-SF/blob/0d2e59ffb14c31ebfb0b717d3d0078985ab2a3b7/modules/sucafina/Sucafinav1/docs/sf2h/receipts/review-fixes/finance-journey/attempt-01/coverage-issue.NOT_APPLIED.patch.txt): blob `07cfd30ecfda15e32c36e13ed6b1c9d2218da9a6`.
- Manifesto da proposta: blob `b0b93127f56a50d3d786843bf2a6bfe7e5291670`.
- Comparação textual do hunk original, 31 linhas a partir da linha 108: corresponde integralmente ao arquivo. Nenhum patch foi aplicado nem produto executado.

As otimizações efetivamente publicadas em Finance alteram outros seis arquivos. Não é correto atribuir ao patch NOT_APPLIED os resultados S2/S3/S5 ou dizer que `coverage-preview.ts` já recebeu a correção.

## Fluxo atual e diferença proposta

| Aspecto | Código atual no pin | Proposta e parecer |
| --- | --- | --- |
| Autoridade original | `detach` clona dados e conserva o callback; `issue` chama esse callback antes dos checks/prova, comparando depois o objeto original com o digest inicial (:85–111). | Remove a chamada antecipada. No sucesso consulta apenas a nova autoridade de `current()`. A equivalência não está demonstrada. |
| Objeto mutável | Compara o objeto retornado após o callback inicial; `current` faz o mesmo com sua nova resolução. | Acrescenta comparação do objeto original depois de `prepare()`, inclusive no sucesso. Esse acréscimo é útil, mas digest de dados não representa a validade da closure. |
| Saída antecipada/fallback | `issue` pode retornar `unavailable` por seleção, classificação, regra, evidência ou cobertura; prova estrutural também pode retornar não-ok. | Envolve os caminhos de preparação e verifica o predicate ORIGINAL nos retornos não-ok. Se ele falha, retorna `stale`, evitando fallback condicionado por autoridade inválida. Prova runtime ainda falta. |
| Consumidor | [planner-sensitivity.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts#L68-L72) aceita `unavailable` de `issue` como caminho condicionado; `stale/denied` encerram. | Isso torna insuficiente retirar somente a linha do predicate inicial. A versão final da proposta reconhece e trata essa diferença para saídas não-ok. |
| Identidade financeira | Seleção/caso/encarnação, alternativas, referências, fonte, classification/basis/rule, moeda/horizonte, categorias e componentes são verificados. `current` reobtém dados e compara authorityDigest/certificado. | Esses checks são preservados textualmente. Igualdade numérica isolada nunca substitui os digests/identidades. |
| Revogação | Callback de autoridade e portas canônicas controlam a validade; `current` resolve de novo e verifica o predicate dessa resolução. | Falha original em caminho não-ok é endurecida para stale. Sucesso ainda depende da substituição de predicate discutida abaixo. |
| Cleanup | Intervalo é inserido provisoriamente; falha normal de `current` remove a entrada (:131–134). | Preserva essa remoção e remove o intervalo ok quando o digest original final o invalida. Não há novo cleanup geral de exceções; não alegamos que uma exceção foi observada. |
| Scope e TTL | Scope é comparado na entrada de `current`; `prune` remove expirados na entrada e em pontos existentes; TTL é de 300.000 ms. | Comportamento preservado. Não acrescenta verificação explícita de TTL em toda saída após await, nem prova nova de retenção da identidade original do Request. |
| qualify/revalidate/verify | Releitura atual, prova estrutural, replay canônico e registro de qualification são conservados. | Corpos não alterados pela proposta. Ausência de diff não é execução de suas contraprovas no candidato modificado. |
| Fórmulas | Cálculos continuam nos produtores canônicos; cobertura completa não aplica o cenário. | Não há alteração aritmética no patch nem speedup global medido. |

A prova estrutural [interval-proof.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/planner/interval-proof.ts) reemite unidades, calcula previews nos extremos e reobserva metadados/cenário. Ela comprova o domínio Planner autorizado, não uma lei de equivalência entre dois callbacks opacos de cobertura.

## Bloqueio de equivalência no caminho de sucesso

O tipo `PortfolioCoverageAuthority` (:24–35) permite `isStillValid(context): Promise<boolean>`. O digest (:85) não inclui a função. `detach` (:86–89) conserva a função original. Já `current` (:96–103) chama uma função obtida de uma nova resolução.

A [linha62 da proposta](https://github.com/gustavomhss/Orchestra-SF/blob/0d2e59ffb14c31ebfb0b717d3d0078985ab2a3b7/modules/sucafina/Sucafinav1/docs/sf2h/receipts/review-fixes/finance-journey/attempt-01/coverage-issue.NOT_APPLIED.patch.txt#L61-L67) contém:

```ts
const valid = result.status === "ok" || await authority.isStillValid(context)
```

Se `prepare()` retorna ok, o callback original é saltado. Não foi encontrada, no tipo nem no encaminhamento de `product.ts:44,49`, uma regra que obrigue callbacks de duas resoluções com dados iguais a terem a mesma validade.

### Contraprova estática, não executada

| Passo | Entrada admitida pela interface |
| --- | --- |
| Primeira resolução A | Dados D válidos, callback original retorna false |
| Prova estrutural | Portas canônicas aceitam os dados/domínio |
| Resolução B em current | Dados D idênticos, callback dessa nova observação retorna true |
| Código atual | A primeira chamada original retorna false; `issue` recusa como stale antes da prova |
| Código proposto | `current` aceita B; `result.status === "ok"` salta A; digest original permanece D e o intervalo pode sair ok |

Isso demonstra que a transformação **não é equivalente para toda implementação da interface**. Não demonstra que o host autenticado instalado produz A/B dessa forma. O próprio manifesto já admite revisão necessária para callbacks opacos. A conclusão correta é `PROPOSAL_REQUIRES_CHANGES_OR_EQUIVALENCE_PROOF`, com `NEEDS_RECHECK`; não `RESOLVED_WITH_EVIDENCE` nem BUG runtime novo no produto.

A redução do custo precisa preservar a recusa original por um mecanismo demonstrável. Pode haver uma implementação de host cuja lei de validade torne a substituição segura, mas essa lei e suas contraprovas devem estar na composição qualificada. A simples igualdade dos objetos não basta.

## Contraprovas exigidas ao owner

| Caso | Observação necessária |
| --- | --- |
| Original false, novo true, dados iguais | Recusa sem liberar intervalo reutilizável; sem fallback condicionado ou nova escrita de sample |
| Original muta durante prova ou current | Detectar mudança de dados; remover intervalo provisório recusado |
| Unavailable antes da prova ou retornado pela prova | Autoridade original inválida vira recusa dura; autoridade válida com incompletude legítima conserva resultado condicionado |
| Case/incarnation/source/basis/classification/rule alterados | Recusar mesmo se os números forem iguais; preservar evidência original |
| Revogação, scope diferente e identidade do Request/lease alterada | Autoridade anterior não pode ser substituída silenciosamente; recusa depois do último callback pertinente |
| Intervalo desconhecido, expirado ou qualification forjada | Revalidate/qualify/verify recusam; registrar precisamente o comportamento de TTL ao atravessar await |
| Falha depois da inserção provisória | Intervalo recusado não reutilizável, inclusive na política explícita de exceções escolhida pelo owner |
| Controle positivo completo | Mesma jornada mantém 250.000/−10.000, teto 15.000 e 15.001 falha; histórico/replay/reabertura completos nos budgets originais |

Os testes atuais de `coverage-preview.test.ts` incluem source/rule/access/borrowed, métricas/componentes forjados, qualification não emitida, scope revogado e FX ausente. O caso borrowed muta seleção no callback que é chamado; ele **não substitui** o caso original false / novo true com dados iguais. Nenhum desses testes foi executado por esta revisão no patch proposto.

## Relação com CI e composição

PR56 executou diagnóstico e observadores sobre o preimage. A chamada candidata a evitar custou 4.438 ms naquele run; não foi medido ganho da proposta e isso não garante completar uma jornada de 180 s. S3 posterior mudou a fase do timeout por outras correções. S5 do W Finance atual passou 36 testes / 297 assertions, mas não aplica este patch e não seleciona a jornada longa. O S6 dessa jornada já está em voo no mesmo W (run 43631582858, observado em 19:25:12 UTC); seu resultado deve ser reconciliado sem novo dispatch.

No Finance congelado, a factory `createPortfolioProduct` existe, mas não está montada na cadeia CLI examinada. A composição futura precisa injetar autoridade autenticada e a prova exata efetiva; a fixture não concede aceite instalado.

**Owner:** WP13/Finance para a decisão de implementação e contraprovas, WP11 na jornada e WP10/S0 no intake/composição. Revisores permanecem somente leitura de produto.
