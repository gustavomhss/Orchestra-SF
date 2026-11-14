# OPS-C12-CAS-REGRESSION — restauração de delta publicado

O intake Finance substituiu `apply.ts` por um blob que contém a prova de revisão nova, mas não contém a reconciliação pós-commit já publicada em PR #23 e consumida no W1. A proposta une os dois deltas publicados: mantém o produtor de review binding completo e restaura, literalmente, o bloco de releitura/CAS do produtor anterior.

O recibo de domínio cerca também o namespace `cases`, cujo storageVersion avança. A reconciliação do blob Finance usa a versão capturada antes do commit e retorna indisponível. O bloco restaurado relê o caso, exige igualdade integral, confere o recibo autoritativo e autoridade atual, usa o CAS novo e mantém igualdade integral também no callback sob lock. Assim um caso realmente editado recebe conflito; um caso idêntico pode reconciliar sem reaplicar o domínio.

As três falhas Bun24 (H02/H03: 200→503; H05: 409→503) e o sucesso de recuperação H06 são compatíveis com essa cadeia. O log não imprime o JSON da falha: o reason descrito é deduzido da fonte, não um corpo capturado.

`finding.json` registra pins, hashes completos, números dos hunks e exigências de validação. `restore-reconciliation.patch` e `apply.proposed.ts` são a proposta para revisão/consumo pelo integrador. Nenhuma mudança foi aplicada em produção por este agente; nenhum teste local foi executado.
