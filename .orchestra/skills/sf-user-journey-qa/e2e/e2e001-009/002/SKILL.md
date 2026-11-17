---
name: sf-user-journey-qa-e2e-e2e001-009-002
description: "QA manutenção SF: executar story SF-E2E-002 (Duas versões de forecast diante do comitê financeiro) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-002 ou o caso específico Duas versões de forecast diante do comitê financeiro"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-002"
---
# SF-E2E-002 — Duas versões de forecast diante do comitê financeiro

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Outros atores:** BUDGET_OWNER, CIO · **Superfícies:** CAP03, CAP17, CAP18, CAP22, CAP23, UI45, UI46, UI49 · **Jornadas:** J01, J02, J05.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Sofie e Budget Owner discordam do aumento anual da licença; official=590000, WhatIf-A=602000, WhatIf-B=596000.

**Resultado de negócio:** Como FINANCE, com apoio de BUDGET_OWNER, CIO, diante da situação descrita, preciso comparar hipóteses conflitantes de renovação de licença com budget e actual oficiais intactos, para apresentar ao comitê as diferenças financeiras verificáveis antes de uma decisão.

## Pré-condições específicas

- Sofie e Budget Owner discordam do aumento anual da licença; official=590000, WhatIf-A=602000, WhatIf-B=596000.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Sofie abre versão official locked e anota USD590000
2. **[UI_ACTION]** Cria A baseada em 72000 e altera OPEX-LIC-01 para 84000
3. **[UI_ACTION]** Outro ator cria B independente e altera para 78000
4. **[UI_ACTION]** Ambos comparam ao orçamento 600000
5. **[UI_ACTION]** CIO abre BI com versões A/B, sem assumir merge
6. **[UI_ACTION]** Finance remove FX para testar uma linha adicional EUR
7. **[UI_ACTION]** CIO compara cenário e registra decisão, sem publicar official
8. **[UI_ACTION]** Releitura por terceiro atesta que official/actual seguem imutáveis

## Oráculos observáveis (não reescrever para passar)

- A=602000 e delta +12000; margem vs budget -2000
- B=596000 e delta +6000; margem vs budget +4000
- A/B jamais alteram 590000 da fonte official
- Dado EUR sem FX fica incompatível/indeterminado, não zero
- CIO sabe qual versão está vendo em todos os capítulos
- Mudança de budget só ocorre mediante produtor autorizado separado

## Contraprovas

- Ator com versão stale tenta save de OPEX e recebe conflito
- Usuário sem Finance tenta gravar versão locked e é negado

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
