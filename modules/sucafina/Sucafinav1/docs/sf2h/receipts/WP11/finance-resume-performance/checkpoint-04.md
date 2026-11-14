# Checkpoint 04 — encerramento validado, FIN-IND-005 aberto

- Branch finance-resume; PR42 existente; head inicial confirmado: 3ea9dc2efe0de8d283f9625774697e431f55a0d7.
- Último produto W4: 7a9a43b3b05ee2fb18c9ee70901dbdf7014711a1; tree: 2da074668b164b1aa5e051f8a70366969425906f.
- Delta de produto: seis arquivos autorizados. Sem CLI, host-binding, integração WP10 ou namespace finance-journey.
- S5: 18e2a5dcf69b039dcd86e91f8fbf85db613acf6c; run 43630462257, job 132555694380: PASS, 36 testes, 0 falhas, 297 assertions, 368,57 s.
- Contraprovas preservadas: S1 duas buscas → S2/S5 uma; S4 dezesseis envelopes C08 → S5 dez. Duas observações completas de caso e callbacks explícitos por ocorrência preservados.
- S6: 0e68fec2e33e6c4c2103f368fed1d00dc832cb0c; run 43631582858, job 132559159277: FAIL, 0 pass, 1 fail, 18 assertions, 180025,69 ms.
- Guarda de 180000 ms observada em 180015 ms, durante confirmed.coverage.qualify → authority.is-still-valid → units.revalidate; retorna stale/coverage-authority-changed.
- S6 alcançou treinamento 40000, total 250000, diferença −10000, mesmo caso/encarnação. Não alcançou fronteira 15000/15001, histórico final, replay ou restart.
- CHECK run 43630618176: FAIL, 115 diagnósticos externos, 0 novas posições/códigos e 2 diferenças textuais; 43 gates/15 warnings iguais aos anteriores; 0 erros do engine de guardas.
- FIN-IND-005 e aceite global continuam abertos. As durações de S3/S6 não demonstram aceleração ponta a ponta.
- Proposta PR59@e80fdc933dfd25956a50c22dea76bf077e79815b pertence ao WP10 e não foi aplicada; manifesto 15a2048d7ec943a9fdfdbff191aef1d95fc0fe3b e preimages no HANDOFF-FINAL.md. Suficiência temporal não comprovada.
- Recibos, critérios integrais pertinentes, proveniência e CI-LEDGER adicionados neste encerramento. Inventário anterior de 371 critérios/18 tarefas/87 checks preservado.
- Nenhum teste/typecheck local, timeout ampliado, assertion removida, CI duplicado, merge/reset/force push ou nova branch de produto/PR.
- O commit que contém este checkpoint é somente de recibos. A PR42 registra seu SHA real e a comparação de conteúdo com W4.

