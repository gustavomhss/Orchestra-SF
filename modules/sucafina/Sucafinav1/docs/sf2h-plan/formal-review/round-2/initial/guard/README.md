# Guard do primeiro candidato da rodada 2

Candidato: `38986380cd7b5697c0be30c1f55d43eddee63045`. Comando real: `bun run check:guards --base origin/dev`. Exit code 0; 78 regras, 98 caminhos alterados, zero bloqueios, um aviso, zero erros. [Recibo](receipt.json), [fidelidade](fidelity.json) e [saída](stdout.txt).

## Disposição do aviso

`large-file` é consultivo: `campaign.json` tem 1.310.343 bytes. O arquivo pertence ao Git porque é a fonte autoral canônica, legível e versionada do plano integral, com contratos, tarefas, axiomas, ownership, cronograma e provas. Não é mídia nem dado de execução. Os espelhos são reproduzíveis a partir dele. A revisão optou por preservar essa fonte legível; não há ignore, dispensa, alteração de regra ou `--warn` aplicado. O aviso permanece no recibo.

Esse resultado é apenas desse SHA e do guard. Correções posteriores exigem novo resultado; não é teste ou CI de produto.
