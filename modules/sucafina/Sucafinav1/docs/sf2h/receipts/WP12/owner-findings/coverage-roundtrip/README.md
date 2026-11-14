# C10: preservar a categoria derivada na promoção

Proposta para o owner WP10/integração. **Não aplicada a fontes do host; verificação de produto pendente.**

O mutator WP11 publicado em `65509f0b8c435b88fb0ec9949299571f011d2347` passa a obter a prova de cobertura mesmo quando a avaliação não mudou. Isso corrige a ausência de prova C08 no caminho de promoção sem operações. O produtor do host, porém, devolve `baseline.entries` já normalizado pelo C10. Essa lista inclui uma entrada sintética `pending/missing-category` para cada categoria omitida. Ao reapresentá-la como entrada humana ao reassess, a categoria deixa de aparecer em `derivedMissingCategoryIds`.

O patch proposto remove desse novo input somente as entradas sintéticas identificadas pela própria avaliação canônica. As mesmas funções do domínio continuam calculando a cobertura. As entradas explicitamente pending, os valores zero observados e as verificações de fonte, intenção, Request, binding, C08 e igualdade final permanecem.

## Reprodução preparada

O helper WP12 `native-scenario-preparation.ts` usa fontes Planner sintéticas como dados de entrada, emite referências pelo produtor real, chama `baseline-coverage` e `decision-promote` e lê o caso persistido. Nenhum resultado C10, alternativa, contribuição ou receipt é pré-gravado. O candidato A omite inteiramente training na fonte e na classificação, mantendo a categoria no inventário comum. A contraprova exige a identidade derivada da omissão; o candidato B fornece 40000 em fonte e classificação reais.

A fonte atual é `apps/cli/src/sucafina-product/portfolio-coverage.ts`, blob `d8a668281ea9cac6a3a04c6bea19811ee8954808`. O mesmo clone de entradas aparece no blob W18 `ec824f54d67630edce6ef218e2e1301193362f3c`. O owner deve publicar a correção compatível com sua versão; WP12 consumirá o SHA exato. Este documento não altera política financeira nem atribui prova de inferência ao cenário.
