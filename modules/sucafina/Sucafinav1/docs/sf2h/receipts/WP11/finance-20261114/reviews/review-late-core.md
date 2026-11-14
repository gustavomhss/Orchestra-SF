# Revisão independente — dois deltas tardios WP11

**Parecer: nenhum bloqueador adicional encontrado nos quatro arquivos congelados, dentro do recorte estático revisado. Validação remota pendente.** O revisor não executou produto, Bun, testes, CI ou escrita remota e não alterou fontes de produto. Este parecer não declara READY, DONE, C/D ou aceitação do bundle.

Revisor: `/root/review_late_core`. Autor dos deltas: `/root/late_composition_review`. Baseline W18: `92f6d97d2df5ebf53cd845f4cfe93355d10b0f6f`, tree `a843c5d5767c4a055fcacb77668c3798fd8a564c`. Os deltas ainda são identificados pelos blobs locais congelados; o integrador deve ligar estes blobs ao commit/tree publicado.

## Arquivos congelados

Prefixo dos paths: `modules/sucafina/Sucafinav1/`.

| Arquivo | Blob baseline W18 | Blob revisado |
| --- | --- | --- |
| `product/decisions/mutations.ts` | `81513bbca0d087211e4d3d46afe805941bb98a6c` | `3e7575cddfd52d9f5751c0ee6179c747bb318c98` |
| `test/product/wp11/source-promotion-coverage.test.ts` | `novo` | `1c2d45332907483ec7c816ebdc64ea81ee8b215e` |
| `product/decisions/hot-topic-draft.ts` | `dc480a2e1e343e7f2a8844a3c23ec9f06582d5ad` | `5e0b80a470958dd201db4283bde96d594935e68d` |
| `test/product/wp11/hot-topic-draft-domain.test.ts` | `novo` | `d75d700de4a9a607550691382dc0e14237c289a0` |

Os quatro blobs, respectivos SHA-256 e tamanhos foram recalculados independentemente e coincidem com `late-own-deltas-manifest.json`. O JSON acompanhante contém hashes completos e o diff integral dos quatro arquivos, incluindo os testes novos. O baseline de `mutations.ts` veio do conteúdo capturado em `finance-W18-changes.json`; a cópia histórica de `hot-topic-draft.ts` foi aceita somente após conferir seu blob com o mapa W18.

Produtores canônicos lidos em COMPOSE6, head `35b9fd4f532abeb1058f00281d4ad8885ca9966f`:

- `apps/cli/src/sucafina-product/portfolio-coverage.ts`: `d8a668281ea9cac6a3a04c6bea19811ee8954808`.
- `apps/cli/src/sucafina-product/dashboard-decisions.ts`: `f8914c141ba5c72439f5fdba50e9153c4cd477d4`.

As cópias finais de suporte também foram conferidas byte a byte por hash. Um newline extra da hidratação foi identificado e normalizado pelo autor; o parecer usa os blobs canônicos acima.

## Findings e conclusão por delta

| ID | Severidade | Estado | Conclusão |
| --- | --- | --- | --- |
| LATE-CORE-01 | P1 | Correção presente no código; Actions pendente | Promoção sem operações agora pede a prova atual de cobertura e usa a reavaliação canônica mesmo quando o assessment inicial coincide. |
| LATE-CORE-02 | P1 | Correção presente no código; Actions pendente | O draft de Hot Topic entrega o snapshot Dashboard ao verificador de Dashboard do produtor. |
| LATE-CORE-OBS-NA | P2 externo | Restrição preexistente preservada | O produtor baseline de COMPOSE6 recusa `not-applicable`; este incremento não qualifica essa rota para N/A. |

### LATE-CORE-01 — prova de cobertura no caminho sem operações

No produtor canônico, `remember` remove a prova anterior, `entries` é o único local que executa `proofs.set`, e `verifySnapshot` exige essa prova além da igualdade do resultado completo, basis, identidade da Request, binding, estado de caso/preferences e source fences. Pular `entries` por igualdade do assessment torna o commit impossível. Esse é um defeito funcional de recusa; não foi demonstrado bypass.

O delta remove somente a condição `reassessed` da chamada ao provider e dá prioridade ao `reassessScenarioCoverage` canônico quando o provider existe. Reavaliar também é necessário: o produtor pode ordenar `evaluatedSourceRefs` a partir da basis, enquanto a observação original começa pela fonte. Apenas chamar `entries` e persistir o resultado antigo continuaria divergindo da prova exata.

O erro do provider continua retornando antes da gravação. Permanecem `validateScenarioCoverage`, o source fence síncrono em `saveCase`, `verifyMutation`, as verificações de autoridade/incarnação/versão e o CAS do C08. O fallback sem provider e assessment igual permanece restrito pelo comportamento existente; um resultado completo sem provider continua recusado. O replay exato sai antes de produzir um novo resultado, como antes.

### LATE-CORE-02 — snapshot correto para Hot Topic

`valid()` restringe o destino a `dashboard/hotTopics`. O consumidor canônico `dashboard-decisions.ts` injeta um `verifySnapshot` que chama `dashboardSourceCurrent` sobre o target e todas as refs Dashboard. O C08 usa `domainSurface` para escolher qual snapshot entrega ao callback. O antigo valor Planner era incompatível com esse contrato.

A única edição de produto nesse arquivo troca `domainSurface: "planner"` por `"dashboard"`. Não altera `human.authorize(decisions.edit)`, grants de namespace, participação no caso, verificação das fontes, private write set, versão esperada, digest ou idempotência. A consequência de usar a transação Dashboard foi examinada: o `local-store` lê snapshots de Dashboard, Planner e Procurement dentro do scope/lock também nessa transação, preservando `currentSnapshots` para o callback canônico. O delta seleciona o domínio correto e não cria autorização.

### LATE-CORE-OBS-NA — limitação externa que permanece

`portfolio-coverage.ts` canônico, linhas 86–89, contém uma recusa explícita quando qualquer entry baseline é `not-applicable`. O fix próprio não remove essa regra. A nova fixture de promoção usa mappings `included` de um bundle declarado sintético; portanto não demonstra N/A pelo consumidor instalado. A integração deve demonstrar a rota canônica aplicável ou encaminhar um delta delimitado ao owner com prova de aplicabilidade. Essa observação não justifica copiar autoridade ou relaxar a recusa em WP11.

## Invariantes conferidas

A reavaliação canônica permanece sem alteração: conserva components, knownSubtotal, moeda e horizonte; retém a origem de categoria omitida; exige evidência atual; e conserva `total: null` para cenário condicionado. O delta não cria valor, FX, imposto, limiar ou cálculo paralelo. Shared continua significando que um componente pode cobrir várias categorias sem criar outra contribuição monetária. As provas globais de ausência versus zero, N/A e sensibilidade não são substituídas por estes testes.

`analysis-promotion.ts` permanece no blob `43e1de8c347faea2953ff5baa2919b3b061fc4e4`. O caminho separado de AlternativeDraft mantém checks de outputDigest, run, aceitação humana e proveniência; os dois deltas não transformam `addAlternative` em aceitação de saída do modelo. Este recorte não requalifica a cadeia nativa inteira.

Promoção de cenário persiste alternativa/resultado; draft de Hot Topic persiste campos preparados. Nenhum desses caminhos registra automaticamente um ChoiceRecord ou aplica comando de domínio. Essa distinção está expressa nas assertions novas. Autoridade, source fences, CAS e replay não foram trocados por um resultado positivo da simulação.

## Revisão dos testes novos — sem execução

`source-promotion-coverage.test.ts` declara sete casos: duas fontes com ordens distintas de refs no mesmo caso; cenário alterado ainda hipotético/condicionado com total nulo; e negativas para recusa em `entries`, alteração de fonte, alteração concorrente do caso, revogação de autoridade e abort. Verifica persistência do mesmo resultado, ausência de escolha/prepared changes/receipts, ausência de aplicação no Planner e retry sem nova chamada a `entries`. A variante beta distingue a correção completa de uma correção que apenas chamasse `entries`.

`hot-topic-draft-domain.test.ts` declara um caso com fontes deliberadamente diferentes em Planner e Dashboard. Verifica recusa do grant humano antes do callback, gravação de duas refs de draft, retry sem nova gravação, domínio intacto no sucesso e recusa de alteração concorrente no Dashboard antes do commit, sem draft parcial nem edição do caso/Planner.

Os testes consomem Planner/classificação/reavaliação e C08/local-store reais nos respectivos caminhos. Grants humanos, lookup de evidência e callbacks de prova/verificação são fronteiras sintéticas declaradas nos próprios arquivos. Não equivalem a host instalado, prova nativa, BI C17 ou Atlas. São arquivos novos, com timeout declarado de 60000 ms; nenhuma assertion ou timeout existente foi afrouxado neste delta.

## Evidência executada e pendências

Foram executados somente leitura, comparação textual, parsing de manifests e cálculo de hashes com Python. Nenhum teste foi rodado ou disparado pelo revisor. Nenhum green anterior foi atribuído a estes blobs.

A próxima evidência necessária é a seleção cirúrgica dos dois arquivos WP11 no commit publicado correspondente, seguida dos consumidores canônicos de promoção e draft na composição. Typecheck/guards do candidato, N/A nessa rota, threshold real de 55000, cenários de sensibilidade, provas nativas e gates C/D permanecem fora da comprovação deste parecer. Os critérios completos dos três WPs continuam no mapa do grupo; esta revisão cobre apenas os deltas descritos.
