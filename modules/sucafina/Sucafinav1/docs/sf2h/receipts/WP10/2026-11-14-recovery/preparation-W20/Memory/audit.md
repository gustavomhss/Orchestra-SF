# W20 — identidade do seletor de memória

**Correção própria congelada; resultado hospedado ainda pendente.**

No W19, `memory.prepare` terminou em 24.678 ms, com `analysis-source-unavailable`, sem cancelamento. O log tem 7 leituras de case, 10 testemunhas C08 e exatamente um recall Atlas canônico concluído. Não é o timeout W18.

A API Atlas recebe `{id, incarnation}`. `selectCandidates` produz esse objeto. O rank reabre a prova na saída por `candidate.envelope.caseRef`, que também contém a versão preservada. O cache próprio usava id/incarnation como chave e o objeto inteiro como digest, invalidando a mesma operação no primeiro egress. A segunda observação independente de `prepare` sequer começava.

A correção calcula a identidade reutilizável somente a partir dos dois campos do contrato. Cada argumento completo continua tendo digest próprio, verificado após os awaits, de modo que mudança durante a chamada é recusada. A seleção externa versionada, Request/headers, binding/lease, C08 completo, fonte, captura original e continuidade canônica permanecem obrigatórios. Nenhuma lógica foreign ou regra fresh/historical foi alterada. Isso é independente do conserto de `readSourceFences` feito pelo outro builder.

O teste real existente agora também exige dois recalls Atlas completos para as duas observações independentes do produtor. Mantém todas as contraprovas, deadline cooperativo de 225 s e teto Bun de 240 s. Não executei produto localmente. Latência corrigida e fases posteriores só podem ser concluídas pelo CI do SHA publicado.
