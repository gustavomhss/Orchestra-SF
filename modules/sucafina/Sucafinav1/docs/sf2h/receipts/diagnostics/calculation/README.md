# Gargalo de cálculo/persistência — proposta para WP10

**Estado: PROPOSAL_READY. Patch: NOT_APPLIED. Contraprovas propostas: NOT_RUN.**

## Conclusão localizada

O trabalho dominante observado é a amplificação de leituras de fonte, evidência e recertificação ao redor dos produtores financeiros. O trace existente do sucessor W27 localiza o vencimento do prazo na **primeira recertificação anterior ao commit do binding**, depois de o writer real ter retornado `ok` para a sensibilidade. A fonte canônica é resolvida 4.885 vezes no run completo; o caminho compartilhado W26/W27 abre **quatro envelopes de transação Planner por resolução bem-sucedida**, com duas observações independentes. Há dois envelopes evitáveis de preparação, sem necessidade de eliminar leitores ou provas. [S1][S2][R27]

A correção mínima proposta é consolidar a preparação do seletor e a observação correspondente em uma transação Planner, preservando as duas observações, seis autenticações diretas, quatro revalidações e o kernel canônico de identidade/projeção. O patch fica somente em [proposed/0001-wp10-source-observation.patch.txt](proposed/0001-wp10-source-observation.patch.txt). A melhora temporal e o fechamento da jornada inteira em 285.000 ms permanecem sem execução. A cauda de recertificações ainda não alcançada pode continuar dominante.

## Escopo e proveniência

| Item | Pin / identificação | Uso |
|---|---|---|
| Produto fixado W26 | `a1434e7ea7340aa1d1c8ce6bb48958b724218170` | Preimage e análise do caminho |
| Tree W26 | `a9398de38c9e684d28c27b0188ab653e75bf3305` | Base da branch diagnóstica |
| X26 | run [43619479808][R26], S `4650ebf5948747a49f04120070765aa6317e6fd8` | Falha original |
| Sucessor W27 | `ab8fb4f29d078d179742a77679ef85e5c549b114`, tree `6b889a436fafe019580801edba3015d90fa75dfd` | Trace já existente, observado sem novo disparo |
| X27 | run [43623440133][R27], S `329a3b4547ec77c6b516ac1f28c732f0fc076902` | Localização temporal da falha |
| Norma | [sf2h-plan em dbf9547][N] | Semântica e ownership |
| Preparação | [preparation-W26 da PR #29][P26] | Intake e correções já presentes |
| Publicação | `diagnose-calculation → astra-wp10` | Somente os dois namespaces autorizados |

Os compares W26→S26 e W27→S27 mostram somente a adição de `.ci-run.json`. W27 também alterou scopes de Memory/Procurement, uma ligação do host, testes e recibos; portanto, sua execução não é atribuída a W26. Os dois preimages propostos e os produtores financeiros deste diagnóstico permaneceram iguais. O domínio Memory/Atlas não é objeto desta conclusão.

## 1. Call graph delimitado

| Fronteira | Caminho real e responsabilidade | Trabalho/fence relevante |
|---|---|---|
| Entrada | WP10: `createSfPortfolioServices → business.withCase → product.http.sensitivity` | Contexto de caso atual, Request, binding/grants/lease e autorização de egresso. [H1][H2] |
| Persistência de sensibilidade | Financeiro: `sensitivity-store.evaluateAndStore` | Consulta binding/idempotência; avalia; valida samples; escreve resultado; solicita binding; lê resultado canônico final. [S3] |
| Produção | Financeiro: `planner-sensitivity → sensitivity-units → preview-comparison` | Cenários históricos, caso, regra humana, cobertura e BCS atuais; simulação Planner real. [S4][S5][S6] |
| Limiar | Financeiro: `exact-threshold → interval-proof / validatePlannerThreshold` | Âncora, probes IEEE, fallback limitado, witnesses adjacentes e unidades atuais. [S7][S8] |
| Resolução repetida | WP10 + Financeiro: `stored-scenarios / result-store / cases / evidence.context → plannerSources.resolveForecastSource` | Referências, replay, ancestry, cobertura, projeção e autorização; leitores iniciais/finais independentes. [S1][S9][S10] |
| Fonte | WP10: `resolveForecastSource.read ×2 → describe.transaction + readScopedSource.transaction` | Cada estágio autentica o seletor e executa as duas autorizações do `observe`; revalidação fora da transação. [S1][S2] |
| Driver | Runtime existente: transação Planner → fila → `BEGIN IMMEDIATE` → snapshots → callback/commit ou rollback | Mesmo `commit:false` paga o envelope transacional. Não há patch de engine/driver. [S11] |
| Resultado bruto | Financeiro/C08: `results.write(kind=sensitivity)` | **Alcançado em X27**, 1.367 ms; retorno `ok`. [R27] |
| Binding antes do commit | `criterion-rules.bind → verifyBinding → proof.verifySensitivity` | Nova prova financeira e de fonte, contexto e lease atuais. **Ponto da interrupção X27.** [S12][S13] |
| Cauda obrigatória | Commit C08 do binding → `bind.read` → `sensitivity-store.read` | Mais duas provas no read de retorno do binding e duas no read final; depois a jornada de recomposição/retry/revogação. Não alcançada em X27. [S3][S12] |

A contagem estática para um primeiro armazenamento completo é **1 + 2 + 2 = 5 verificações de binding**. X27 iniciou apenas a primeira. A verificação persistida já recertifica o candidato guardado com prova atual de intervalo e vizinhos; ela não repete a busca inteira do limiar. O patch conserva todas essas chamadas. [S12][S13]

Ancestry é rastreada por contexto de cálculo com rejeição de ciclo/profundidade; não constitui cache de autorização nem um mutex. Não há trace que demonstre ciclo infinito neste incidente. Falhas próprias de ancestry continuam abertas nos recibos do owner. [S14]

## 2. Evidência de execução

| Medida | X26 original | X27 com trace |
|---|---:|---:|
| Fixture completa | 9.640 ms | 7.765 ms no phase logger; 7.766 ms no trace |
| `host.evaluate-and-store` | 275.640 ms | 277.391 ms |
| Leituras de environment dentro do host | 1.934 | 2.126 |
| Leituras de environment totais | 2.054 | 2.246 |
| Testes/arquivos | 1 / 1 | 1 / 1 |
| Resultado | 0 pass / 1 fail | 0 pass / 1 fail |
| Expects realmente alcançados | 3 | 3 |
| Duração informada pelo Bun | 285,82 s | 285,57 s |

Os números distinguem a fixture da fase do host. O prazo cooperativo é 285.000 ms e o timeout declarado do teste é 300.000 ms; a request mantém `--timeout 120000`. Não foi alterado nenhum desses valores. Os dois cleanups terminaram com sucesso. Omni foi `not applicable`, sem spawn/delegação; não existe prova de Omni nesta seleção. [R26][R27][X]

### Linha do tempo X27

Tempos desde o início do teste:

| Evento | Início → fim | Resultado |
|---|---:|---|
| Entrada no host | 7.772 ms | Fixture encerrada |
| Samples 80, 240 e 400 | Produtores até 42.546 ms; terceiro write até 45.498 ms | Produção atual concluída |
| Probes de limiar e vizinhos | Até 103.214 ms | Âncora 320 e valores IEEE adjacentes retornaram `ok` |
| Reemissão de unidades na produção | 105.967 → 116.043 ms | `ok` |
| Write da sensibilidade | **208.547 → 209.914 ms** | **`ok`, 1.367 ms** |
| Bind | **209.916 → 285.163 ms** | `denied` ao abortar |
| Primeira prova do bind | **212.103 → 285.163 ms** | `false` ao abortar |
| Units.resolve dessa prova | 212.149 → 234.956 ms | `ok`, 22.807 ms |
| Reexecução dos três samples | 244.302 → 268.073 ms | Todos `ok` |
| Units.issue seguinte | 272.984 → 285.163 ms | `stale` no abort; 12.179 ms |
| Retorno do host | 285.163 ms | Deadline excedido |

O retorno `ok` do writer indica que o caminho real de gravação foi alcançado; as assertions públicas de persistência utilizável, binding, recomposição, retry e revogação não foram alcançadas. O resultado bruto pode ficar órfão de binding, caso para o qual já existe recuperação específica. Não houve inspeção pós-run do SQLite para qualificar esse estado. [R27][S3]

### Contadores inclusivos do run X27 completo

| Span | Chamadas | Ms inclusivos acumulados | Máximo por chamada |
|---|---:|---:|---:|
| `shared.sources.resolveForecastSource` | 4.885 | 189.597 | 142 |
| `shared.evidence.context` | 1.003 | 269.829 | 820 |
| `shared.results.readHistoricalScenario` | 245 | 154.478 | 1.844 |
| `shared.cases.read` | 177 | 97.897 | 1.501 |
| `shared.sources.resolveForecastCoverage` | 370 | 39.850 | 1.419 |
| `shared.scenarios.resolve` | 44 | 124.342 | 6.314 |
| `shared.scenarios.resolveMany` | 24 | 73.923 | 6.108 |
| `primary.planner.simulateScenario` | 22 | **12.318** | 1.240 |
| `shared.results.write` | 6 | **3.717** | 1.367 |

Esses tempos se contêm e se sobrepõem; **não se somam como parcelas exclusivas**. Incluem a fixture. Todas as 4.885 resoluções de fonte e todas as 22 simulações retornaram `ok`. O trace não dá um delta exato do contador de fonte na entrada do host. Os [excertos](trace-excerpts.log) conservam timestamps, IDs/parentIds e índices das linhas; [evidence.json](evidence.json) contém os contadores e pins. [R27]

## 3. Causa demonstrada, inferência e hipótese

| Classificação | Conclusão | Limite |
|---|---|---|
| Observado | Produção numérica retorna; há milhares de observações de fonte/evidência e progresso até o primeiro bind. | Não atribui todo o tempo de CPU a uma função. |
| Observado | Write bruto de sensibilidade conclui; o prazo vence na primeira prova pré-commit do binding. | Não prova persistência utilizável nem retry/revogação. |
| Demonstrado no código | Cada resolver bem-sucedido faz duas observações; cada uma abre describe + scoped read. | Contagem estrutural, sem medir transações no trace antigo. |
| Inferência sustentada | A frequência de leitura multiplica envelopes caros de fila/decode/clone/auth/projeção no caminho crítico. | O custo exclusivo de cada componente ainda precisa de medição. |
| Sem evidência suficiente | Um lock único, deadlock, dependência circular ou espera externa explicaria a falha inteira. | Não há spans exclusivos de espera; o trace mostra retornos frequentes. |
| Pendente | Consolidação 4→2 fecha a jornada no budget original. | Deve ser demonstrado pelo owner; não é promessa deste diagnóstico. |

W26 já contém agrupamento de casos em `resolveMany`, deduplicação dentro de observações de BCS, self-comparison otimizado, recertificação do candidato guardado e clones sem roundtrip JSON. Eles não são apresentados como correções novas. [P26][S9][S13]

## 4. Correção mínima proposta

**Owner: WP10. Financeiro continua dono dos produtores.**

1. Extrair o corpo existente de `readScopedSource` para um kernel privado sem mudar sua lógica.
2. Acrescentar capacidade opcional `readScopedSourcePrepared` ao port existente. Validar identidades, passar clone isolado à preparação, executar o kernel na mesma transação e encaminhar o sinal do Request.
3. Em `planner-sources.read`, preparar o mesmo seletor/autorizador dentro dessa capacidade. Conservar fallback para ports antigos.
4. Manter `current` e `again` em transações independentes, `host.revalidate` fora delas, e a cauda de igualdade/incarnation/version/evidência byte a byte.

| Por resolução bem-sucedida | Atual | Proposto |
|---|---:|---:|
| Observações independentes | 2 | 2 |
| Envelopes Planner de fonte | 4 | 2 |
| Autenticações diretas | 6 | 6 |
| Revalidações diretas | 4 | 4 |
| Recertificações exigidas | Todas | Todas |
| Estado/prova entre invocações | Nenhum cache novo | Nenhum cache novo |

Aplicado à contagem observada, o modelo encontra **9.770 envelopes elegíveis para consolidação** (2 × 4.885). Isso não é economia medida, não é contador só do host e não implica redução proporcional do tempo.

A preparação recebe clone para não alterar o snapshot retido antes do guard de mutação do `observe`. O método chama o kernel diretamente; não abre transação aninhada, não lê outra superfície e não chama `host.revalidate` dentro do lock. Incarnation, versão, A→B→A, projeção, digests e materialização permanecem sob o código original. O driver real verifica abort depois do callback e antes do commit. [S1][S2][S11]

**Risco concreto a medir:** cada transação consolidada mantém o lock por preparação + observação, embora haja menos admissões na fila. Ocupação máxima, fairness e ganho líquido não foram medidos. O teste proposto registra duração do envelope, trecho até o callback e trecho do callback, sem usar tempo como oracle.

## 5. Preservação e contraprova

O patch não altera fórmulas, valores, `exactThreshold`, cobertura completa/pending/N-A/shared, ausência/zero, referências, replay, ancestry, C08, grants ou lease. Isso é uma propriedade do diff proposto, **não uma aprovação dinâmica desses fences**. A matriz executável e os critérios estão no [handoff](OWNER_HANDOFF.md).

O [teste próprio](../../../../../test/product/diagnostics/calculation/source-observation.test.ts) usa a fixture financeira, SQLite, lifecycle, projector, autoridade e resolver reais. Os wrappers somente contam/delegam e injetam mudança/revogação/abort nas fronteiras; não reproduzem cálculo ou regra de acesso. Confere:

- resultado de fonte e digest iguais entre fallback e candidato;
- 4→2 envelopes com 6 auth / 4 revalidate preservados;
- nova leitura fresca na mesma instância/contexto;
- snapshots duráveis estáveis;
- A→B→A recusado apesar de mesmo valor final;
- revogação no último egresso e recusa na invocação seguinte;
- abort após o último authorizer com recusa e sem mutação durável.

O abort específico já tem scope materializado pelo issuer; não é prova de primeira materialização nem de espera em fila. Os guards existentes de lifecycle/C08 e a jornada integral do host complementam esse corte. O teste falha explicitamente `OWNER_PATCH_NOT_APPLIED` se disparado antes da aplicação.

## 6. Validação e entrega

| Item | Estado |
|---|---|
| X26 / X27 já existentes | FAIL observado; logs/requests/pins registrados |
| Inspeção estática e revisão independente do patch | Concluídas; sem equivalência com execução |
| Patch em produto | **NOT_APPLIED** |
| Novo teste / regressões / jornada X no candidato | **NOT_RUN** |
| Typecheck e guards do head desta proposta / produto aplicado | **NOT_RUN** |
| Novas execuções de 285 segundos disparadas | **0** |
| Merge, alteração de outras branches/produto, runtime/deploy/permissões | Nenhum |

A PR publica somente diagnóstico, teste próprio e propostas nos namespaces autorizados. O head/tree final de entrega consta no corpo da PR, capturado depois do commit. O [manifest](proposed/manifest.json) fixa os preimages. As [requests](requests/) são insumos preparados para o owner, não snapshots executados. O próximo passo concreto é aplicar o patch pelo WP10, congelar W e cumprir os gates do [OWNER_HANDOFF.md](OWNER_HANDOFF.md) via [CI.md][CI].

[N]: https://github.com/gustavomhss/Orchestra-SF/tree/dbf9547211d9b0fade619790de7c19c0869b7c7d/modules/sucafina/Sucafinav1/docs/sf2h-plan
[P26]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/docs/sf2h/receipts/WP10/2026-11-14-recovery/preparation-W26/README.md
[CI]: https://github.com/gustavomhss/Orchestra-SF/blob/d3d411f7e2476a562a57aa7620823980eaf34e46/modules/sucafina/Sucafinav1/docs/sf2h/control/handoff/astra/CI.md
[R26]: https://github.com/gustavomhss/Orchestra-SF/actions/runs/43619479808/job/132521664604
[R27]: https://github.com/gustavomhss/Orchestra-SF/actions/runs/43623440133/job/132533968037
[H1]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/apps/cli/src/sucafina-product/portfolio-services.ts
[H2]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/portfolio/product.ts
[S1]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/integration/planner-sources.ts
[S2]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/integration/source-lifecycle.ts
[S3]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/portfolio/sensitivity-store.ts
[S4]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/portfolio/planner-sensitivity.ts
[S5]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/planner/sensitivity-units.ts
[S6]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/planner/preview-comparison.ts
[S7]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/planner/exact-threshold.ts
[S8]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/portfolio/threshold-proof.ts
[S9]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/planner/stored-scenarios.ts
[S10]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/decisions/result-store.ts
[S11]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/runtime/local-store.ts
[S12]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/decisions/criterion-rules.ts
[S13]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/portfolio/verification.ts
[S14]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/product/planner/calculation-evidence.ts
[X]: https://github.com/gustavomhss/Orchestra-SF/blob/a1434e7ea7340aa1d1c8ce6bb48958b724218170/modules/sucafina/Sucafinav1/test/product/wp10/integration/portfolio-exact-threshold.test.ts
