## Atualização cronológica — resultado final do run 43580252381

Depois da observação inicial acima, a API passou a informar **completed / failure**, com `updated_at=2026-11-14T10:01:56Z`. A auditoria baixou via GitHub MCP os jobs e o log completo do job **132403235716**. Esta seção substitui somente o estado pendente daquele run; conserva as observações históricas e as identidades dos candidatos.

**O finding anterior de latência dos dois fluxos de recall direto Planner/Atlas está corrigido no pin f075e9824b7d8aed50b7f42c597528ef198177db.** Os dois testes exatos passaram dentro dos mesmos limites de 105.000 ms cooperativos e 120.000 ms do teste, embora o run completo tenha falhado por outros testes.

| Prova exata em planner-calculation.test.ts | Resultado | Tempo total | Linha do log |
| --- | --- | ---: | ---: |
| Planner calculation recalls the actual reopened Atlas record and does not append it twice | PASS | 45.206,01 ms | 1234 |
| Planner overlapping replays and Atlas recall disclose nothing after principal revocation | PASS | 45.544,43 ms | 1301 |
| Planner calculation survives SQLite and Atlas reopen with continuity, original and ancestor context | PASS | 65.272,49 ms | 1213 |
| Arquivo completo | 16 PASS / 0 FAIL / 0 SKIP | — | 1182–1481 |

Na cadeia **reopen-and-recall**, o log registra gravação Atlas real confirmada em 7.942 ms, SQLite/autoridade reabertos em 7.950 ms, início do recall em 16.088 ms e recall autorizado em 45.070 ms. O teste exige exatamente um registro, uma única resolução de cálculo durante aquele recall e novo emit retornando `already-committed`.

Na cadeia **overlapping-revocation**, o controle positivo encontra um registro após reabertura. Em seguida, o teste pausa no await real do ambiente, sobrepõe outra prova, revoga o principal e exige ambos os resultados de cálculo sem `ok`, além de contexto e recall Atlas `unavailable`. O PASS é dessa sequência completa. Os outros testes do arquivo também passam: source drift, membership, capture, coverage, selector, clock, principal, lease e isolamento lexical de chamada sobreposta.

### Totais, Omni e falhas que mantêm o run vermelho

O resultado exato é **198 PASS, 12 FAIL, 2 SKIP**, **212 testes em 24 arquivos**, **2.163 assertions**, duração reportada **2.274,65 s**. O controle Omni retorna **PASS**, com **22 testes declarados, 38 spawns Omni e zero delegados**. Esse controle demonstra o caminho de criação de processos; não constitui execução de Session/modelo/skill nativa.

As 12 falhas têm estes grupos verificáveis:

| Arquivo/grupo | Quantidade | Falha observada |
| --- | ---: | --- |
| WP02 host-workbench / workbench-recovery | 7 | Uma opção de caso esperada não aparece; uma contraprova recebe `ok` com listas vazias em vez de `stale`; cinco seleções da opção de caso expiram em 15 ou 30 segundos. |
| WP01 shell-recovery, teste sem nome | 1 | A fixture recusa a seleção porque exige a lane Linux explícita com `browser-lifecycle.test.ts` por último; a seleção usada não fornece esse ciclo de vida. |
| WP10 analysis-composition/alternative-selection | 4 | As duas provas de draft/capture para janeiro e as duas versões anuais excedem o prazo cooperativo de 105.000 ms. Não são os testes de recall direto Atlas acima. |

Os dois SKIPs são as contraprovas de UID estrangeiro de diretório e banco, declaradas dependentes de privilégios root. Nenhuma delas é convertida em PASS.

### Identidade e limites preservados

O snapshot executado continua **dd648c423ab97fbe6e806b620057a328a5816b5f**, tree **ac9a7f96aa0f8bd6b30200c5628c37058e8176b0**, com somente `.ci-run.json` sobre **f075e982**. O request SHA256 é **bc01cc977b331e5538d4dad42e38048c943a2747fde600eb7cee580fd05c371b**, já verificado no adendo anterior.

O head auditado **0cf10879** não é a identidade deste run. O finding de **features canônicas Planner do ranking WP14** permanece aberto, assim como o **produtor de candidateAccess nativo**. O PASS do recall direto UI não altera essas conclusões, e a atualização não declara aceitação nativa/global.

Artefatos para reprodução da leitura:

- `job-132403235716.log`: log completo, UTF-8 com BOM/escapes originais, **344.268 bytes**, SHA256 **fc1f7b522623b9f8d1a89535ce37873d6d1a572fec698a0832a8427ec0ef23a7**.
- `planner-final-evidence.log`: linhas exatas dos resultados Planner, fases dos dois fluxos, controle Omni e totais.
- `product-final-summary.json`: resultado, todas as 16 provas Planner, 12 falhas, dois SKIPs, limites e reconciliação do finding.
- `product-test-results.json`: as 212 ocorrências de testes, sem duplicar o sumário terminal.
- `product-final-status.json`: metadados finais de run/jobs.
- `final-evidence-manifest.json`: hashes e tamanhos dos artefatos desta atualização.

Nenhum produto foi editado, nenhum teste local foi executado e nenhum novo run foi disparado para obter essa evidência.

