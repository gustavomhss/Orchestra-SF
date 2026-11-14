# WP03 — evidência da retomada do Overview em 2026-11-14

A contribuição do Overview agora abre cada um dos sete totais em registros e meses. A seleção hospedada final passou: **170 testes, 0 falhas, 31 arquivos, 2.644 asserções**. A aceitação instalada/integrada permanece **false**.

## Produto e origem

| Referência | Valor |
|---|---|
| Produto congelado W | `d7be4567ea0eb47fe0022fcaf87ae497e33afcea` |
| Árvore de W | `76bbcb8759bccb65067c8e72a0d8fb5ef32f4125` |
| Snapshot CI S | `40792323ea4921f2c34b87720f407878290396ef` |
| Árvore de S | `5514a81e585067bc2d3ba316e9502afcf9f7843c` |
| Entrega anterior | `bc8342d0955de936873e7e1250f5bb8d3e091b79` |
| Handoff imutável | `4e4d873e7e93bba3dc82df45e243999e7c8e76b6` |
| Branch / PR | `astra-wp03` / [PR #22](https://github.com/gustavomhss/Orchestra-SF/pull/22), base `sf2-stack` |

Escopo: Sucafina/WP03, cinco tarefas e 112 critérios. Genesis e a implementação do WP05 ficam fora. O T0 original, `2026-11-13T04:01:10Z`, foi conservado; não há alegação de conclusão em duas horas.

## Avanço de implementação observado

Os totais são os próprios controles nativos de abertura. Cada detalhe conserva a medida correta, referência de versão, período e moeda, mostra subtotal por registro e componentes por mês e separa orçamento de outlook. As diferenças reutilizam `comparePlannerVersions`; os totais publicados pelo motor não foram recalculados por fórmula paralela.

A contribuição distingue composição reconciliada, incompleta, indisponível e divergente. Isso não altera `coverageState` nem declara cobertura financeira completa. Registro ausente, valor desconhecido e zero observado continuam diferentes. As medidas originais e a conversão em USD permanecem distinguíveis. Identidades opacas são escapadas e conservadas; metadados de referência ausentes recebem `Unavailable`.

Somente os trechos de implementação de **WP03.QLT.01, WP03.T05.QLT.01 e WP03.T05.SUC.01** avançam nesta rodada; todos continuam `PENDING_UI_PROOF`. Os testes inspecionam o HTML real com `HTMLRewriter` sobre fixtures reais de Planner/autoridade/SQLite. Não executam interação no navegador, foco/teclado/leitor de tela ou montagem do consumidor WP01.

## Validação hospedada e tentativas preservadas

| Execução | Candidato | Resultado observado |
|---|---|---|
| [RED 43534889692](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43534889692) | Produto anterior + somente o novo teste | 0 pass / 7 fail, 34 asserções; faltavam os controles de abertura. |
| [Tentativa 1 — 43535212218](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535212218) | `57ce87d7…` | 169 pass / 1 fail; um caso histórico encontrou `esc(undefined)` nas referências. A apresentação foi corrigida sem enfraquecer o teste. |
| [Tentativa 2 — 43535785426](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535785426) | W / S finais | 169 pass / 1 fail; Overview passou, mas o teste durável de persistência/WP11 excedeu 5.000 ms. |
| [GREEN final — 43536154582](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43536154582) | Mesmo W / S, mesma seleção e timeout | **170 pass / 0 fail**, 31 arquivos, 2.644 asserções, 45,98 s; job e cleanup concluídos com sucesso. |

O snapshot S difere de W somente pela adição de `.ci-run.json`. Request SHA256: `79addc3906450c91cad259c50397715bc68a7267b0cb86e1274f0070122ce69b`. Os 30 arquivos anteriores foram conservados e um foi acrescentado. Os 163 nomes/path anteriores e os sete novos foram encontrados exatamente uma vez no log final, inclusive linhas intercaladas após o marcador Omni.

O novo arquivo de testes permaneceu byte a byte igual do RED ao GREEN: SHA256 `039ae36c13927c4a0f9d30b3a398cf9a7af55d36d6a21de5152b9e7f6191af3c`. O nonce final é `a41faa1ba785d657f080e7868d201755`; Omni foi **not applicable**, sem spawn/delegação. Nenhuma prova nativa decorre disso.

### Limitação de tempo preservada

O teste `real WP11 rules bind a comparison, survive reopen and refuse a second binding or a stale rule` usa o mesmo blob `c5c29d7ac94354318bdb32a3328ed6b93dc887e9`. Levou 4.657,25 ms e 4.795,36 ms nas passagens anteriores, falhou em 5.198,39 ms e passou no retry exato em **4.929,99 ms**, com somente **70,01 ms de margem** para o limite de 5.000 ms. A repetição comprova o resultado daquele run; não resolve essa sensibilidade temporal.

A inspeção estática não encontrou importação/chamada de Overview nesse caminho. O caso reúne persistência, binding, retry, reabertura e recusas de estado obsoleto, com replays e revalidações reais. A causa específica da oscilação não foi comprovada. Nenhum timeout, teste ou verificação de consistência foi alterado para obter o resultado.

## Checks do produto

[Run 43535787078](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43535787078), job `132264325511`, conferido contra W e sua árvore exatos:

- Guards: **78 regras, 639 paths, 0 gates, 12 warnings, 0 erros**. Os 12 findings são os mesmos anteriores.
- Typecheck do pacote: **failure**, com **132 diagnósticos externos em 41 paths, 0 próprios e 0 sites introduzidos**.
- O log de tipos é byte a byte igual ao primeiro candidato deste incremento. Contra a entrega anterior, só os dois blocos WP06 preexistentes mudam textualmente; o arquivo tem o mesmo blob nos três pins.
- Artifact `14088959401`, ZIP SHA256 `8c3e1f426bbad40ff09c376843dac52c9324fffa078ecb7ac06fb6c1ae0e67db`. O log completo de tipos foi preservado em `typecheck-results.txt`.

Zero diagnósticos próprios não transforma o pacote em verde. Consulte [typecheck-attribution.json](./typecheck-attribution.json) e [guard-findings.txt](./guard-findings.txt).

## Matriz e limites de aceitação

| Estado | Critérios |
|---|---:|
| PRODUCER_VERIFIED | 79 |
| PENDING_UI_PROOF | 16 |
| BLOCKED_EXTERNAL | 9 |
| NATIVE_UNPROVEN | 8 |
| Total | 112 |

Os 112 IDs, textos literais, estados e `remaining_proof` foram preservados. O [catálogo](./test-proof-catalog.json) define novas observações `R20261114OV.BUN.*`; referências antigas permanecem históricas e não são rebatizadas. A [matriz](./criteria-matrix.json) resolve suas referências atuais nesse catálogo.

As observações de dependências, fixadas por SHA em [dependency-recheck.json](./dependency-recheck.json), conservam as pendências de contrato WP00, consumidores/rotas/preferências WP01 e boot instalado WP10. O histórico de browser falhou antes da UI por registro duplicado de rota; este incremento não repete essa execução nem altera arquivos dos outros owners. Não há prova de SessionV2, SkillLoadReceipt, grants/provedores reais, GNATIVE, consumo residente ou aceite integrado.

## Evidência e envelope de entrega

A revisão independente de `audit_wp06_wp08` cobriu produto, testes, contraprovas, correção de referências e reconciliação de nomes; não reivindica as três revisões globais da campanha. A atribuição de checks foi feita separadamente por `audit_wp03_wp05`.

[execution-evidence.json](./execution-evidence.json) registra os pins, runs, limites e fontes. [red-evidence.json](./red-evidence.json), [green-attempt1.json](./green-attempt1.json) e [green-attempt2.json](./green-attempt2.json) mantêm as falhas. [green-test-results.txt](./green-test-results.txt) conserva as 170 linhas aprovadas da execução final.

Esta entrega D acrescenta somente novos recibos UTF-8 sob o prefixo próprio `resume-20261114-overview/`, com W como parent esperado. O índice exclui o próprio hash e o SHA futuro de D. A verificação completa do envelope, o SHA de D e o guard posterior são publicados externamente no PR, sem editar estes recibos para anotar o próprio resultado. Código, testes, configuração e todos os recibos anteriores permanecem os de W. Não houve teste/typecheck local, merge ou deploy.
