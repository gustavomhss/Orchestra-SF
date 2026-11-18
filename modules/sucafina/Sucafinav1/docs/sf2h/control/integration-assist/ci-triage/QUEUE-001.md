# Fila 001 — triagem acionável

Missão15, branch `sf2-ci-triage` → `sf2-control`. Produto e CI somente leitura. Este incremento é consumível pelo integrador14; não representa aceite final.

| ID | Classificação | Disposição | Próxima ação |
|---|---|---|---|
| TRIAGE-FIN-001 / FIN-IND-005 | Produto/performance | OPEN | Isolar custo remanescente em qualificação/revalidação confirmada. S6 abortou; não repetir a jornada inalterada. |
| TRIAGE-ACK-001 | Fixture | OPEN | Corrigir resolução de dependências do produtor pinado no loader temporário; onze casos não chegaram ao comportamento do ACK. |
| TRIAGE-EXPORT-01 | Produto/exportação | Corrigido na origem | Consumir correção já validada na PR57; manter falha antiga no W antigo. |
| TRIAGE-EXPORT-02 | Produto/exportação | Corrigido na origem | Consumir total correto por linha; não transferir PASS para sf2-stack. |

Os campos executáveis, W/treeW, S/treeS, request, fase, evidência, confiança, owner, dependências e seleção sugerida estão em [queue-001.json](queue-001.json). O [ledger-001.json](ledger-001.json) conserva os três runs reais e seus limites. Todos os rechecks são sugestões, não disparos.

Os logs de forecast, Memory e typechecks já estão sendo analisados para o próximo incremento. A leitura integral restante do pack S0-A continua em andamento, declarada no ACK, sem transformar essa pendência em aprovação.
