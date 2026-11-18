# Finance — recheck independente da onda paralela

**Parecer preliminar: REQUEST_CHANGES no SHA Finance `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1`. FIN-IND-001–005 permanecem OPEN nesse pin.** Há correções úteis em outras árvores e melhorias de desempenho executadas na PR42. Nenhuma delas substitui a composição e as provas ainda faltantes. Este parecer não aprova o candidato final C.

## Corte, independência e continuidade

| Objeto | Identidade |
| --- | --- |
| Alvo Finance / PR42 | `7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1` |
| Árvore Finance | `2da074668b164b1aa5e051f8a70366969425906f` |
| Diagnóstico PR56 | `0d2e59ffb14c31ebfb0b717d3d0078985ab2a3b7` |
| Revisão anterior preservada / PR50 | `7155f90a6492597a3dd79cfcfda9330fef8be2a2` |
| Missão e COMMON da onda | `c708ec0609dbfc95b259707d8c38481617f74f11` |
| Plano / pack S2-R2 | `dbf9547211d9b0fade619790de7c19c0869b7c7d` |
| Corte das evidências | 2026-11-14 19:25:12 UTC |
| Escrita autorizada | `docs/sf2h/receipts/reviews/finance/recheck-wave/` nesta mesma branch |

Declaro independência e ausência de autoria do produto examinado. O revisor principal e três auxiliares novos fizeram somente leitura de produto, fontes, contratos e CI existente. O único escritor documental é o revisor principal. Não houve teste de produto, novo CI, navegador, merge, edição de produto, mensagem a terceiros ou outra branch/PR.

O §8 do REVIEW anterior declara a revisão documental concluída. PR50 e sua branch foram reconciliadas em `7155f90a…`, sem comentários concorrentes ou recibos no novo namespace. A retomada apoia-se nesse handoff terminal e na missão explícita; não em inferência a partir de silêncio. Os cinco arquivos da revisão original permanecem intactos.

A missão citava PR42 `ab38a14c…`; o head real já era `7a9a43b3…` e foi congelado antes da análise. O delta `3ea9dc2e→7a9a43b3` tem quatro commits e 25 paths: seis arquivos de produto, nove testes/helpers e dez recibos. O parecer não se estende a heads posteriores. [provenance.json](provenance.json) identifica as leituras e a política de delta.

## Parecer por finding

| Finding | Status neste Finance | Fundamentação | Próximo owner |
| --- | --- | --- | --- |
| FIN-IND-001 · P1 | **OPEN** | Caller C09 continua sem `verifyScenarioOperations`; produtor o exige. TS2741 no check do próprio SHA. | WP10/composição e S0; WP11 adjacente |
| FIN-IND-002 · P1 | **OPEN** | Neste pin, caller fornece `host/state/authorize*`, enquanto o produtor ainda exige `host/cases`. TS2353 confirmado. **W28 tem produtor compatível e não recebe essa acusação.** | WP10.T07 e S0 |
| FIN-IND-003 · P1 | **OPEN** | Provider não inclui `sf:portfolio:campaign:` na proteção privada. Contraprova histórica recebe `ok` sem grant; três blobs pertinentes continuam iguais. | WP10.T01/C08 e S0; WP13 consumidor |
| FIN-IND-004 · P2 | **OPEN** | Botão sem atributo `type`, seletor `button[type=submit]`, acesso a `disabled` antes do try. | WP01/S1-A e WP10/S0 |
| FIN-IND-005 · P1 | **OPEN / NEEDS_EVIDENCE** | Jornada longa alcançou mais fases, mas não concluiu teto 15.000 / witnesses 15.000–15.001 / histórico / replay / reabertura. S5 verde cobre outra seleção. | Finance/WP13 + WP11, com WP03/WP10/S0 |

Os registros completos, critérios, blobs e limites estão em [findings.json](findings.json). Não foram renumerados os findings nem promovidas inferências a execuções.

### 001 e 002: discriminar a árvore instalada

Em Finance, [business-services.ts:102–120](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/apps/cli/src/sucafina-product/business-services.ts#L102-L120) omite o callback que [case-port.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/decisions/case-port.ts#L76-L105) chama. A leitura válida cairia no catch e em `case-state-unavailable` se executada apesar da incompatibilidade de tipos. Isso é inferência estática corroborada pelo check, não um novo run funcional.

O mesmo cuidado vale para C17: [caller Finance](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/host-binding/business-context.ts#L170-L173) e [produtor Finance](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/decision-memory/source-access.ts#L175-L202) realmente divergem. O produtor do mesmo pin usa `cases.read`; não foi presumida a assinatura de uma versão antiga sem ler o código atual.

**A causa específica está corrigida em PR29/W28 `90f2c4f8…`.** Lá, o producer blob `41741c5131ea66242c881126c22c6d03cfd9c3c3` aceita `host/state/authorizeCase/authorizeEvidence` e o caller correspondente o fornece. O callback C09 também foi conectado. [C28](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627315630) teve dois testes C09/C17 e cinco de autoridade aprovados; o run completo ficou vermelho (8 pass/1 fail/136 assertions) por outro oracle de cálculo. Os quatro blobs pertinentes estão iguais em W28 e no head auxiliar PR29 `d4fb072f…`.

A correção externa deve ser reaproveitada por S0. Ela não foi consumida no Finance congelado. Os testes usam portas reais e dados/autenticação sintéticos; reabrem storage no mesmo processo. Não provam preparo completo de forecast, processo reiniciado, AM05 ou aceite final C.

### 003 e 004: correções externas disponíveis, sem intake

[State provider Finance](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/host-binding/state-provider.ts#L81-L95) protege os prefixos proposal-coverage e criterion-rule, mas não as chaves escritas por [campaign.ts](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/portfolio/campaign.ts#L273-L298). No [run histórico 43619812123](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619812123), a contraprova sem grant recebeu `ok` com campanha v1; a assertion posterior de inexistência não foi alcançada. Provider, consumidor e teste mantêm os blobs históricos. Isso sustenta a aplicabilidade da causa, sem afirmar exploração instalada ou novo runtime no pin atual.

PR32 `9048e0e6…` já tem o provider `2fd55c7304add0829d7434917c80664fe86356b9` com o prefixo de campanha. Falta intake e recheck do negativo/positivo na composição consumidora.

O [formulário Finance](https://github.com/gustavomhss/Orchestra-SF/blob/7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1/modules/sucafina/Sucafinav1/product/ui/forecast-analysis.ts#L75-L116) continua com o seletor incompatível. A consequência é estática e condicionada ao formulário renderizar; FIN-IND-001 pode impedir chegar ali. O teste que faz POST direto não atravessa o handler DOM. PR47/ui-work `79ebf555…` já contém `button:not([type]), button[type=submit]` no blob `973a2f09b394426364c514b923ecdc8e10ffb184`. Esse delta pode ser reutilizado; os greens de reply/confirm/guards daquela PR não qualificam forecast.

## Correções Finance efetivamente examinadas

Os seis deltas de produto são `result-store.ts`, `sensitivity-units.ts`, `stored-scenarios.ts`, `planner-sensitivity.ts`, `threshold-proof.ts` e `verification.ts`. Foram lidos os diffs, os caminhos de autoridade/consumo pertinentes e as contraprovas selecionadas.

Em `95f47448…`, a busca exata deixa de ser repetida na recertificação da mesma operação; os witnesses adjacentes continuam sendo reproduzidos, com revalidação atual. O replay persistido trata o número salvo como candidato e reconstrói a prova estrutural atual. A resolução de unidades reutiliza apenas a primeira observação destacada da mesma operação; conserva releituras finais e identidade do Request, binding e lease.

Em `7a9a43b3…`, somente envelopes C08 de cenários irmãos são agrupados. O registro por WeakMap conserva proveniência da função original; um reader substituído conserva o caminho escalar. As três fases C08, callbacks por ocorrência, releituras completas do caso e verificações finais permanecem. Isso não é snapshot atômico de fontes entre domínios.

### Evidência executada e seus limites

| Seleção | Run | Pass/fail/assertions | Resultado útil |
| --- | --- | ---: | --- |
| PR56 diagnóstico | [43625830145](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43625830145) | 0/1/18 | Timeout na primeira qualificação confirmada; zero samples escritos e zero chamadas ao solver confirmado |
| S1 antes da correção | [43627723188](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43627723188) | 0/1/27 | Duas buscas observadas versus uma esperada |
| S2 em `95f47448…` | [43628402812](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43628402812) | 15/0/159 | Uma busca, nove previews internos, duas emissões de unidade; witnesses/revalidações preservados |
| S3 jornada em `95f47448…` | [43629238602](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629238602) | 0/1/18 | Duas qualificações e dois samples confirmados concluídos; timeout em `confirmed.exact→confirmed.preview` |
| S4 diagnóstico de envelopes | [43629852422](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43629852422) | 0/1/6 | Dois irmãos corretos, 16 envelopes C08 versus 10 esperados |
| **S5 no W `7a9a43b3…`** | [43630462257](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43630462257) | **36/0/297** | **10 envelopes**, duplicatas/ordem/callbacks preservados; fontes/caso/resultado/Request/lease/reader/store alterados recusados |

S5 concluiu em 19:16:32 UTC. O snapshot `18e2a5dc…` é filho direto do W congelado e acrescenta somente `.ci-run.json`. São dez arquivos, quatro testes filtrados e 368,57 s. O request **não seleciona `journey-phase.test.ts` nem executa a proposta da PR56**. A alteração de um único resultado recusa o item afetado e permite o irmão intacto; não se exige recusa indiscriminada de todos os itens.

**S6 já está em voo no mesmo W:** [run 43631582858](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43631582858), job 132559159277, snapshot `0e68fec2…`, request idêntico ao S3 e somente `.ci-run.json` sobre W. Foi criado pelo owner às 19:20:42 UTC e observado `in_progress` às 19:25:12 UTC. **Adotar e reconciliar esse run; não disparar duplicata.** Não há conclusão terminal atribuída neste corte.

O check do **próprio W7a9a43b3**, [43630618176](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43630618176), continua **failure**: 115 diagnósticos TypeScript, nenhum nos seis arquivos Finance alterados; guards com 78 regras, 1.519 paths, 43 gates, 15 warnings e zero erros do motor. Zero diagnóstico no delta não é pacote verde; zero erro do motor não é aprovação dos guards.

[evidence.json](evidence.json) fixa todos os W/S/trees/requests/jobs e as bases de atribuição. Nenhum teste foi disparado por esta revisão. Não somamos passes como critérios aceitos nem tratamos tempos aninhados como wall time.

## FIN-IND-005: errata causal e semântica financeira

A observação original de que `createRenewalChoiceHistory` não concluía fica **refinada**: o construtor já tinha retornado. `transition-confirmed:complete` era o último checkpoint disponível, não a chamada ainda ativa. A PR56 localizou a fase posterior; o S3 Finance posterior voltou a mudar a fase alcançada. A lacuna permanece, com causalidade identificada por versão.

Na fixture, **240000 é `before.baselineResult.knownSubtotal` de custo**, não receita comprovada. As assertions executadas demonstram conhecido 210.000 / pending / total null antes da confirmação e treinamento de 40.000 levando a 250.000 completo, vantagem −10.000 e critério falho no mesmo caso/encarnação. O digest repetido em memória não prova a releitura histórica.

Continuam faltando, na mesma jornada concluída, teto 15.000, witnesses 15.000/15.001, releitura da escolha original, replay autorizado e fechamento/reabertura com recusas. Greens de recertificação, unidade, BI ou C17 não substituem essa cauda.

## coverage-preview.ts e a proposta PR56

**O arquivo Finance continua blob `9f7e12113b38e73befb64f99a94fb8ca28d05eee`, igual ao preimage da PR56. A proposta permanece NOT_APPLIED/PROPOSED_NOT_RUN.** O hunk de 31 linhas corresponde textualmente ao preimage; isso não é execução nem validação semântica.

A proposta preserva os checks de identidade, certificado e a saída final `current()`; protege retornos não-ok contra fallback condicionado usando a autoridade original e acrescenta a checagem final do objeto mutável com remoção do intervalo provisório. Há, porém, uma diferença não demonstrada como equivalente: [a linha 62 do patch](https://github.com/gustavomhss/Orchestra-SF/blob/0d2e59ffb14c31ebfb0b717d3d0078985ab2a3b7/modules/sucafina/Sucafinav1/docs/sf2h/receipts/review-fixes/finance-journey/attempt-01/coverage-issue.NOT_APPLIED.patch.txt#L61-L67) salta `authority.isStillValid` original quando o resultado é ok e usa somente o callback da nova resolução em `current()`. O digest dos dados não inclui a função.

**Disposição: PROPOSAL_REQUIRES_CHANGES_OR_EQUIVALENCE_PROOF / NEEDS_RECHECK**, dentro de FIN-IND-005. O contraexemplo estático A(dados D, predicate=false) → B(mesmos D, predicate=true) é aceito pela interface e pode liberar na proposta o que a versão atual recusa. Não foi demonstrado como cenário da composição autenticada, nem executado, nem contado como novo BUG aplicado ao produto.

[coverage-preview.md](coverage-preview.md) examina autoridade original, objeto mutável, saídas antecipadas, fallback, cleanup, identidade, revogação, TTL e a matriz de contraprovas necessária ao owner.

## Consumo instalado e próximos passos

No composition root Finance examinado, **a factory Portfolio não está montada**. `portfolio-services.ts` está ausente; `installation.ts→host-context.ts→business-services.ts` não instancia `createPortfolioProduct`. A factory disponível admite `resolveCoverageAuthority?` e `exactThreshold?`, mas isso não prova injeção em runtime. Esse limite de composição já existente é preservado, sem novo ID duplicado.

1. **WP10/S0:** integrar os pares compatíveis C09/C17 já publicados e o provider C08 correto; provar no novo candidato consumidor.
2. **WP01/S1-A + WP10:** consumir o seletor corrigido e demonstrar submissão real do forecast.
3. **Finance/WP13 + WP11:** adotar/reconciliar o S6 existente e reutilizar S5 terminal. Julgar a jornada inteira pelos resultados reais; decidir a próxima correção/qualificação somente depois, preservando budgets e assertions.
4. **WP13, com WP10/S0:** resolver a equivalência da proposta PR56 antes de adotá-la, incluindo original false / novo true, falhas antecipadas, mutação e cleanup.
5. **S0:** montar e qualificar a dependência real de Portfolio e congelar C. As três revisões finais ainda devem avaliar esse mesmo C.

**Handoff documental concluído. Produto não aprovado.** [HANDOFF.md](HANDOFF.md) fixa a retomada; os recibos originais e findings permanecem preservados.
