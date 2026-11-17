# Plano histórico de waves — substituído

> **STATUS: SUPERSEDED PARA EXECUÇÃO.**  
> Este arquivo preserva o contexto da estratégia antiga de seis waves e rebases individuais. Ele não deve mais dirigir branches, merges, closes ou paralelização.

## Plano canônico

Usar:

- `consolidation/README.md`;
- `consolidation/execution-plan.md`;
- `consolidation/runbook.md`;
- `consolidation/bundle-checklists.md`;
- `consolidation/ledger.schema.json`.

## Por que foi substituído

A revisão adversarial identificou que:

1. a auditoria original cobria os primeiros 100 PRs, não a fila inteira;
2. a fila viva possuía 242 PRs abertos no snapshot posterior;
3. rebasear cada branch transportaria ancestry obsoleta;
4. o diff de merge-base é um superset candidato, não “delta autoral” garantido;
5. merges seriais invalidariam rebases preparados contra bases anteriores;
6. a base não possui congelamento mecânico suficiente sem lease;
7. o plano aceitava a ideia de vermelho compartilhado por tempo demais;
8. o #237 é promoção automática de `close-final-candidate`, não feature PR comum.

## O que continua útil neste histórico

- a evidência de ancestralidade/blob da auditoria;
- as relações de duplicidade;
- os clusters de paths;
- os riscos de auth, provenance, drafts, host e shell;
- a regra de merge serial.

## Nova topologia

```text
inventário completo
→ B0 baseline
→ B1 plataforma/runtime
→ B2 produto/domínios
→ B3 shell nativo
→ #237 promoção
```

Não executar as listas antigas de waves.
