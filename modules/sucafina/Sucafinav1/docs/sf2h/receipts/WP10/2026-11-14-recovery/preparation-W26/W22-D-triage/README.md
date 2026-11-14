# D22 — observação parcial e triagem causal

O run **43610668152**, job **132494810814**, terminou como **cancelled** em W22 `4bc9c7220f04f113609393aaba38934a7e69878b`, snapshot `c00c167bdf368d89273d60ca29e5eb24c01dc577`. O cleanup **132507288922** terminou **success**, inclusive a exclusão da branch de snapshot. O recibo não converte a conclusão em `timed_out` nem identifica quem cancelou.

O bruto exato tem 97.263 bytes, UTF-8, 998 LF e nenhum CRLF; SHA256 `98e1ca1414d36cccbe9a52f881dfc2f92c77c851ba830451647dae109b1654b5`. A igualdade com o conteúdo devolvido pelo GitHub MCP foi verificada. A API de artifacts retornou `[]`; não houve ZIP para baixar.

## O que foi observado

Há **29 linhas nomeadas: 27 pass e 2 fail**, além de **um erro entre testes**. São contagens parciais, não totais da suíte. Aparecem cabeçalhos de **9 dos 18 arquivos selecionados**. Não há resumo Bun completo nem recibo Omni final. Totais completos, asserts, duração da suíte e contadores Omni ficam `null`/`not-observed`.

O normalizador estrito não foi executado. A saída específica é `evidence/W22/normalized/D-portfolio-finance-partial/{terminal.json,test-observations.json}`, schema `wp10-hosted-partial-observation-v1`. O selo da captura é `capture-seal.json`; o resumo é `evidence/W22/terminal-D-capture-summary.json`.

Os três arquivos próprios sem cabeçalho ou resultado são `alternative-selection.test.ts`, `portfolio-promotion.test.ts` e `portfolio-reconciliation.test.ts`. Nenhum recebe crédito de critério nesta execução. Os testes publicados de `renewal-source-admission` e `renewal-case-read-scope` tiveram linhas de resultado observadas; isso não prova a conclusão de toda a seleção.

## Causa observável e mecanismo estático

O teste WP13 que percorre training `omitted`, `bundled` e `confirmed` continuou emitindo fases após seu timeout nomeado. Durante `omitted`, os tempos entre marcas foram:

| Trecho | Tempo observado |
| --- | ---: |
| Inicialização da fixture | 13,698 s |
| Primeira `evaluateAndStore` | 260,243 s |
| Leituras de samples e binding | 70,940 s |
| Cold read | 132,945 s |
| Verificação direta | 32,034 s |
| Retry idempotente | 247,158 s |

Essas fases pertencem ao primeiro loop WP13. As fases `bundled` continuaram depois do primeiro fail; não são medições do segundo teste. Este registrou `bootstrap-start` e, 1.383,745 s depois, a guarda de 180.000 ms falhou com `counts: {}`. O log não permite creditar-lhe cálculo ou escolha concluída. O comportamento de agendamento/timeout não foi perfilado.

O caminho estático explica repetição substancial: `sensitivity-store.read` chama `bindings.read` duas vezes; `criterion-rules` reproduz `verifySensitivity` duas vezes em cada leitura. Assim, um cold read bem-sucedido faz **quatro** reproduções completas. A primeira persistência faz **sete** (três no bind/readback e quatro na leitura final); o retry já bound faz **seis**, além de recalcular antes do lookup. Cada reprodução mantém unidades atuais, C08, samples, C10, busca exata/bordas e fences. Os tempos observados são compatíveis com esse mecanismo, sem constituírem um profiler ou uma previsão de ganho.

O teste independente de histórico renewal passou em **149,86665 s**. Seu último trace acumulado registrou 3.273 chamadas de `c08.read.cases`, 564 de `c08.read.preferences` e 21.214 de `host.revalidate`; o JSON de estado passou de 38.346 para 1.367.149 bytes. `state-provider.read` clona o estado inteiro e autoriza antes/depois; LocalStore decodifica snapshots no root e clona o snapshot no leitor aninhado. **Essas são contagens de API, não de conexões físicas ou de transações SQL distintas.** Tempos inclusivos de chamadas aninhadas não podem ser somados.

Os caminhos, linhas, pins, traces e limites estão em `causal-triage.json` e `triage-source-manifest.json`. Não foi feita alteração de produto.

## Delta publicado causal disponível

Uma consulta MCP encontrou PR35 ainda em `ec052c2c3bef96f492512f3d5f663919580f25c8`, sem novo delta. PR36 está em `48486a2186c0cc07a3a5558e34e2aa94c89ad5e9`. O compare integral e 13 fontes exatas foram arquivados em `publisher-audit/`; todos os blobs recuperados foram verificados.

A proposta em `publisher-audit/selection-manifest.json` contém **sete blobs exatos**, sem aplicar ou aceitar o candidato:

| Papel | Caminhos |
| --- | --- |
| Produtores WP13 | `product/portfolio/sensitivity-store.ts`, `verification.ts`, `threshold-proof.ts` |
| Integração real existente | `test/product/wp13/coverage-sensitivity-integration.test.ts` |
| Contraprovas publicadas | `persistence-recovery.test.ts`, `sensitivity-retry-boundary.test.ts`, `threshold-recertification.test.ts` |

O fechamento tem **89 imports relativos, nenhum ausente**. Os produtores não exigem um novo argumento público obrigatório. O novo parâmetro estrutural é opcional, e o tipo/produtor de intervalo já está presente em W22. Essa é uma auditoria estática, não um resultado de typecheck.

O delta faz uma leitura final canônica do binding, consulta o resultado bound antes de recalcular e recertifica o candidato de threshold com intervalo atual e duas bordas IEEE. Preserva a leitura canônica dupla do binding, sources/samples, igualdade do resultado completo, C10 e fences finais. As 57 linhas de assertions originais da integração estão preservadas, com 20 adicionais; os três nomes e os budgets 300.000/300.000/120.000 ms permanecem. Recovery/retry têm fixtures de orquestração explicitamente controladas; não substituem prova financeira, autorização de produção ou aceite nativo. Nenhum ganho medido ou PASS é atribuído ao delta.

Os dois arquivos WP11 incluídos em PR36 são **downrev** contra PR35 `ec052`: removeriam a verificação de caso em um único scope e guards de identidade/scope/projeção/última autenticação. A proposta os exclui integralmente e mantém os blobs PR35 já publicados. Não há síntese de hunks estrangeiros. Os outros caminhos do compare ficam excluídos com razões individualizadas, inclusive AI e o grupo source-scenario não associado à falha observada.

## Recortes próprios pendentes

Três envelopes completos, sem binding de snapshot e sem dispatch, estão em `cuts/`. Todos mantêm `--timeout 120000`, Omni `strict`, todos os casos do arquivo e os overrides originais. A execução continua sequencial, decidida pela raiz.

| Recorte | Casos estáticos | Soma nominal dos limites individuais |
| --- | ---: | ---: |
| `portfolio-promotion.test.ts` | 8, incluindo a matriz de três corridas | 28 min |
| `alternative-selection.test.ts` | 9, incluindo os três anuais 2026 | 18 min |
| `portfolio-reconciliation.test.ts` | 1 | 6 min |

Essas somas não são previsões medidas nem garantias de duração. Os três juntos somam 52 minutos nominais; isolá-los evita que outro arquivo impeça um resultado identificável. Não há teste estrangeiro repetido nesses recortes. Se a raiz admitir o delta WP13, a integração afetada e suas novas contraprovas precisarão de validação hospedada própria na nova fonte, preservando o D22 como histórico parcial.

Nenhum teste, build, typecheck ou import de produto foi executado localmente. Nenhum CI, branch, ref ou publicação foi criado ou modificado por esta tarefa. Esta auditoria auxiliar não é uma das três revisões independentes.
