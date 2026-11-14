# Missão41 — rotina nativa: owner binding

**Implementação independente entregue; admissão produtiva Request → Maestro e aceite integrado em HOLD.**

Produto W: `86e6a650b2b0a7417f0f8bcbdfdadfe679c8d1df`, tree `294407df8b80276a9f80737fd12531635eccc078`, mesma `astra-wp09` / PR30. Fonte41 encerrada; consumidor original33 reconciliado para sucessora42/S0.

- [Handoff completo](HANDOFF.md) e [terminal estruturado](terminal.json).
- [Implementação e limites](IMPLEMENTATION.md), [manifesto de arquivos](file-manifest.json) e [intake seletivo](assembly/selective-intake.json).
- [Montagem completa do host](assembly/README.md) e [capability exata ausente](assembly/missing-capability.json).
- [CI](ci-evidence.json), [casos executados](hosted-tests.json), [comparação do typecheck](typecheck-comparison.json) e [revisão de fonte](source-review.json).
- [98 critérios canônicos e sete cláusulas da missão](criteria.json), [autoridade inicial](authority.json) e [proveniência](input-provenance.json).

Resultado final dos dois arquivos novos: **87 pass, 0 fail, 368 assertions**. Typecheck: **FAIL, 78 diagnósticos externos idênticos à baseline, zero próprios**. Guards: **PASS**. As 14 regressões anteriores estão qualificadas separadamente em W1; não há claim de suíte única no mesmo head.

O patch de montagem é consumível e não foi aplicado nesta fonte. Sem uma origem de admissão autenticada válida, o postimage mantém zero descriptors de rotina; watch também aguarda Schedule. **AM02/AM06 NOT_PROVEN; GLOBAL_RELEASE false.**

