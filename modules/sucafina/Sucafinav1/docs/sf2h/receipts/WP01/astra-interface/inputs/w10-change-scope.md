# W10 — escopo do incremento depois do W9

Pai publicado: `01633144c83fb1080e6d985ef226b8db2aa131cb`, árvore `63f3a45a86dd33679a44cf113f8a620a2052bf4e`.

## Causas observadas e mudanças necessárias

- W9 produto43586466170: 71PASS/3FAIL; duas falhas próprias de UX/contraprova e uma fronteira de identidade de origem. O ciclo físico do pool passou: um launch, seis aquisições/liberações e zero contextos; não atribuir prova completa a um driver independente cujo teste falhou antes de report().
- Conversa: a expectativa antiga de Confirm desabilitado pressupunha a ausência do primeiro issuer. W9 publicou esse consumo. Manter as provas reais de replay C03 e substituir a expectativa obsoleta por confirmação disponível, ausência de efeitos automáticos e confirmação explícita da mesma mensagem por C06/C08 reais. O caso separado sem selector nem identidade completa continua exigindo botão desabilitado.
- Tipos: estreitar answerRef e observedSourceVersion retornados como unknown por typeof explícito; nenhuma assertion removida ou cast amplo.
- Vistas: o status de remoção aparecia antes de a lista/DOM retirar a vista indisponível. Após confirmação real de remove, retirar o ID confirmado antes de anunciar sucesso. A contraprova segura a listagem posterior para verificar a ordem sem espera arbitrária.
- C12: consumir somente apply.ts exato de Operations4bdd12ac. Preservar prepared-apply a45436a6 e o receipt binding comum. Intake completo em operations-ba8-apply-w10.json.
- Findings C05 e C12 atualizados reconhecem os produtores já publicados e identificam a composição ainda necessária. Nenhum patch direto em host/contrato estrangeiro.

## Seleção cirúrgica proposta

Seis arquivos explícitos, sem filtro de teste: browser-startup, thread-recovery, unavailable-views, wp02/host-integration, wp02/workbench-recovery, browser-lifecycle.

thread e views validam mudanças próprias observadas. Os dois consumidores C12 reais verificam o novo apply publicado, inclusive resposta perdida e reload; a expectativa de recuperação não será relaxada se a composição ainda faltar. Startup/finalizer são o envelope obrigatório do pool, não rerun independente.

A falha W9 de retirada somente de escrita continua em finding próprio e preserva sua assertion. O consumidor/DTO não recebeu a prova física de continuidade necessária; sem input novo que altere essa causa, não executar novamente host-workbench apenas para reproduzir o mesmo vermelho.

O complemento de13 arquivos de jornadas não executadas no W8c permanece separado, condicionado ao término deste run. Exclui http/contextual-decision, já executados com sucesso no W9. Não é suite epic nem seleção por grupo.

## Limites

Produto somente Actions/GitHub MCP. Sem teste/check local, gh, push remoto, retries equivalentes ou alteração de fontes aprovadas. Typecheck: bun typecheck nos packages Sucafina e CLI; guards com base origin/dev. Nenhuma mudança de Protocol/Server HttpApi. Resultados novos só serão atribuídos depois do run e dos logs.
