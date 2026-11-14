# W26 — composição da leitura canônica de casos de Memory

Base: W25 `3d59829e5d9e438cbb443428a9479d7f63b5bf31`. Causa observada: run `43615096939`, job `132508295747`. Prepare, verify e acceptsOutput concluíram as duas observações Atlas independentes, mas o teste atingiu o prazo cooperativo de 225 segundos depois de `stale.preserve`; o restante do lifecycle/cancelamento/output/captura não ficou comprovado.

O caso histórico escolhido não satisfaz o escopo C12 de mudanças preparadas atuais. A composição agora permite que sua primeira leitura canônica use o escopo genérico de registros somente quando todos os seletores atuais do ator já estão materializados. As referências históricas continuam integrais; versões e campos distintos do mesmo refId não são colapsados. A elegibilidade não transforma a versão histórica em versão corrente. O leitor canônico ainda prova originais, captures, continuidade, C08, BCS e acesso a cenários.

As testemunhas externas de Memory e seus writers reais continuam fora dessa transação. Ausência de elegibilidade antes do trabalho conserva o caminho original; mudança ou falha depois do início fecha a observação sem retry. O resultado não cruza invocações nem observações independentes. O argumento de caso é clonado antes do await, e o escopo externo ainda rejeita alteração do argumento original.

Os 79 asserts anteriores foram preservados. Cinco novos asserts medem quatro contextos BCS reais agrupados nas fases prepare/verify/acceptsOutput e as duas leituras/completudes Atlas de acceptsOutput. O trecho desde `Only durable lifecycle metadata is seeded.` permanece byte exato. Os budgets cooperativo 225000 e externo 240000 não mudaram.

Esta é auditoria de autoria por leitura, hashes e diffs. Não executa produto local, não mede ganho de tempo e não substitui revisão independente. Aceite depende de CHECK e CI hospedado no sucessor publicado.
