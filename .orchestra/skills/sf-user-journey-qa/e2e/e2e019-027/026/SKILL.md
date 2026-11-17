---
name: sf-user-journey-qa-e2e-e2e019-027-026
description: "QA manutenção SF: executar story SF-E2E-026 (Agente nativo produz parecer, não aprovação automática) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-026 ou o caso específico Agente nativo produz parecer, não aprovação automática"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-026"
---
# SF-E2E-026 — Agente nativo produz parecer, não aprovação automática

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** FINANCE, BUYER · **Superfícies:** UI41, UI64, UI65, UI70, UI38 · **Jornadas:** J07, J04.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Run “analisar riscos de fornecedor” oferece recomendação para PR32000, mas não tem grant de aplicar negócio.

**Resultado de negócio:** Como CIO, com apoio de FINANCE, BUYER, diante da situação descrita, preciso executar rotina com skill e verificador, diferenciando proposta de mutação efetiva, para usar IA com controle humano e prova técnica.

## Pré-condições específicas

- Run “analisar riscos de fornecedor” oferece recomendação para PR32000, mas não tem grant de aplicar negócio.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Selecionar rotina com digest fixado e inputs versionados
2. **[UI_ACTION]** Admitir run com usuário autorizado, orçamento/modelo permitido
3. **[UI_ACTION]** Acompanhar estados reais até output terminal
4. **[CONTROLLED_FAULT]** Injetar output que propõe escolher C inelegível — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
5. **[UI_ACTION]** Verifier independente aponta falha ou alerta
6. **[UI_ACTION]** CIO registra escolha humana apenas com fontes admitidas
7. **[UI_ACTION]** QA inspeciona Procurement e confirma nenhum efeito autônomo
8. **[READ_ONLY_WITNESS]** Reexecutar run após revogar grant e verificar failclosed

## Oráculos observáveis (não reescrever para passar)

- LLM não transforma texto em autorização
- Output inválido não vira aprovado
- Todas contributions identificam model/skill/run/input
- Nenhuma PR/PO muda por conclusão do run
- Revogação remove acesso às fontes na execução/releitura

## Contraprovas

- Skill inexistente provoca unavailable, não fake completed
- Cancelamento em estágio terminal não forja cancelamento

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
