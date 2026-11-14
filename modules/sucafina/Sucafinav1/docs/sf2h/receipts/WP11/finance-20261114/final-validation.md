# Validação final delimitada — Finance W33

**Os dois históricos que falharam em S22 passaram após a correção W33, mantendo os limites originais. O aceite integral dos três WPs continua aberto.**

Produto testado: `87e5164a1c87ac9f013d381d5e601ca5b4b6c677`, tree `052583ce35edbadd4b7ec68ffe021bb59e05a20f`. PR40 dc9 consumida no corte **2026-11-14 12:47:36 UTC**; 48 commits de origem. O último commit documental tem seu head/tree separado e não altera o código testado.

| Seleção | W | S | Run / job | Resultado |
| --- | --- | --- | --- | --- |
| S25 | `87e5164a1c87ac9f013d381d5e601ca5b4b6c677` | `34c2647395a03749e5bbc795bcf1656be5d10a03` | [43599384924](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599384924) / 132460663327 | 17 pass, 0 fail, 197 assertions, 375.28 s |
| S26 | `87e5164a1c87ac9f013d381d5e601ca5b4b6c677` | `62223d922ddeb4db39c28213ab8190b01bd0617e` | [43599387716](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599387716) / 132460671887 | 1 pass, 0 fail, 86 assertions, 75.76 s |
| S24 | `79531aefa2bf72a9d13deba5164f725ec7da0e0f` | `b791d889a6f14ea0b9f9ff2b950bf10da4fe5090` | [43597456215](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43597456215) / 132454926656 | 7 pass, 0 fail, 247 assertions, 1.73 s |

S25 cobre seis arquivos WP11; S26, o consumidor BI. S24 cobre quatro arquivos Planner no W32, cujos blobs de produção e testes WP03 permanecem idênticos no W33. W32→W33 tem quatro arquivos de teste/fixture e nove documentos, zero alterações de produção. Cada S altera somente `.ci-run.json`. O ledger conserva as 26 seleções completas, inclusive falhas, requests, hashes, jobs, casos e Omni.

## Correção de custo com fonte e autoridade preservadas

S22 terminou em failure: 14 pass, dois timeouts, 195 assertions, 560,64 s. A história excedeu 180000 ms durante threshold-after; a revisão de escolha excedeu o mesmo limite depois da preparação. Esses resultados permanecem em [s22-findings.md](s22-findings.md). Não houve aumento de timeout ou remoção de assertions.

W33 agrupa as verificações das alternativas somente nos dois consumidores readonly da fixture: histórico financeiro e escolhas humanas. Cada invocação usa um snapshot real consistente. Uma tentativa de write aninhado envenena a transação, mesmo quando o callback captura a rejeição. Todos os verificadores terminam antes do fechamento e a última revalidação assíncrona ocorre dentro do escopo protegido. A próxima invocação lê novamente.

O verificador individual permanece byte a byte igual. Seus sete testes diretos continuam verificando duas observações independentes, CAS real entre elas, revogação durante autenticação e nove variantes de escopo inválidas. A leitura agrupada demonstra consistência e recusa de escrita dentro do snapshot; não é descrita como duas transações de topo mutáveis. Nenhum resultado financeiro, C10 ou autoridade é memorizado entre chamadas.

| Histórico em S25 | Duração (ms) | Limite original (ms) |
| --- | ---: | ---: |
| `renewal-choice-history.test.ts` | 155286.57 | 180000 |
| `renewal-choice-revision.test.ts` | 141792.59 | 180000 |
| `implementation-quote-history.test.ts` | 76963.17 | 180000 |

O resultado medido pertence ao conjunto de mudanças e à execução observada. Os timers S19/S22 têm fronteiras diferentes e tempos sobrepostos; não se atribui ganho causal isolado por subtração desses contadores. [Revisão independente de 108 verificações](reviews/review-s22-grouped-read-scope.md).

## Semântica financeira e humana demonstrada

- Os históricos preservam a escolha com training omitido, o novo estado de fonte confirmada de 250000, a vantagem −10000 e o julgamento atualizado. A implantação confirmada de 70000 conserva total 235000 e vantagem 5000. Shared/N/A não recebem contribuição monetária duplicada.
- Os dois testes do leitor privado e o ciclo da escolha atual passaram dentro de S22; seus arquivos e consumidores não mudaram no W33. A reavaliação de operações hipotéticas mantém `conditioned`/`total:null` apesar do inventário completo. Promoção humana separada não aplica o Planner.
- S26 preserva a comparação inversa persistida, tabela e origens de mouse/teclado/tabela. O caso conserva zero receipts de aplicação.
- A aplicação real tem prova própria S19/W30: ChoiceRecord → preparação → revisão → concessão separada → commit Planner e receipt/retry. S19 passou 21 casos/448 assertions, incluindo Hot Topic, promoção e C17 histórico. Não se substitui essa prova por preview ou por S26.
- S24 passa sete casos/247 assertions de comparação, HR/redação salarial, FX ausente, preview descartável, operações e paridade UI/MCP de harness. Não comprova a SessionV2 residente instalada.

## Typecheck e guards

[Check16 — 43599389386](https://github.com/gustavomhss/Orchestra-SF/actions/runs/43599389386), job `132460676353`, executou `bun typecheck` no package `modules/sucafina` e guards na raiz no W33 exato. **Zero diagnósticos próprios e 131 externos; package failure.** Posições e mensagens permanecem iguais a check15/check14/check12. Guards: **78 regras, 1083 paths, 13 warnings, zero erros**.

Artifact `14115925874`, SHA256 `52948c721f838bfbabf5555423d0474c19c519dc374af6e4d9028595a3cdaff1`, baixado e conferido com seus três membros. Base de guards `a1d37698a7bb097c1578f827eba6a19b9917ef07`, merge-base `9e4f3d35833f9b2cea6abdf58f42331f3973d9bf`. [16 checks completos](hosted-checks.json) e [131 posições externas](external-typecheck-findings.json).

## Riscos e dependências abertos

Calculation-persistence em S14 passou em 175664,90 ms de 180000; a variante de treinamento composto de S10 passou em 170489 ms de 180000. A margem desses pins é estreita. O stall BI02 de S6 não reapareceu em S8, mas sua causa não foi demonstrada. Os timeouts S22 e as diferenças de fronteira de medição permanecem documentados.

A composição externa está delimitada em [integration-pins-final.md](integration-pins-final.md): mensal HTTP/UI e rebase, classificação N/A humana, limites C17/captura prévia e lease de stale analysis, persistência/replay WP13 de 55000/15000, closure Procurement de quatro blobs, planos/destinos BI e journeys instaladas C05/C12. Os owners permanecem no corte 12:19:40 UTC. O intake de código próprio não transfere qualificação de execução externa.

303 critérios e 14 tarefas continuam literais, sem aceite integral. Os três adendos vinculam os testes novos sem reescrever o mapa auditado W21. Os controles Omni focados são `not applicable`, com zero spawns. Prova nativa/instalada, C/G7, D/G8, AM01–AM06, oito seleções finais e epic do bundle de S0 continuam obrigatórios. Não se declara READY ou DONE.
