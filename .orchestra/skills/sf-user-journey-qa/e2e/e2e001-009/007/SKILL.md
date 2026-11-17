---
name: sf-user-journey-qa-e2e-e2e001-009-007
description: "QA manutenção SF: executar story SF-E2E-007 (Drill-down executivo precisa fechar com a fonte) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-007 ou o caso específico Drill-down executivo precisa fechar com a fonte"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-007"
---
# SF-E2E-007 — Drill-down executivo precisa fechar com a fonte

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** FINANCE, LEADER · **Superfícies:** CAP03, CAP04, CAP05, CAP09, UI45, UI46 · **Jornadas:** J02, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Executivo questiona por que forecast indica 590000 mas outra visualização indica 602000.

**Resultado de negócio:** Como CIO, com apoio de FINANCE, LEADER, diante da situação descrita, preciso rastrear KPIs de BI até registros originais, filtros, moedas e data de referência, para sustentar decisões com números conciliáveis e sem contagem dupla.

## Pré-condições específicas

- Executivo questiona por que forecast indica 590000 mas outra visualização indica 602000.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** CIO abre visão BI geral e identifica a versão mostrada
2. **[UI_ACTION]** Sofie abre Planner OPEX e localiza 72000 oficial/84000 cenário A
3. **[UI_ACTION]** CIO acessa drilldown de BI e inspeciona sourceRef
4. **[UI_ACTION]** Caio abre portfolio e confirma que orçamento não foi aplicado ao projeto
5. **[UI_ACTION]** CIO alterna de cenário A para official
6. **[UI_ACTION]** QA compara data de atualização, intervalo e escala de moeda
7. **[UI_ACTION]** Inspeciona um registro missing e outro valor zero
8. **[UI_ACTION]** Retorna à visão geral mantendo o filtro

## Oráculos observáveis (não reescrever para passar)

- Cada KPI identifica fonte, competência e versão
- 590000 official e 602000 cenário A não são tratados como conflito de soma
- Missing/zero têm semânticas diferentes
- Trocar versão não altera fonte de domínio
- Drilldown revalida grants na navegação

## Contraprovas

- Revogar sourceRef após abrir painel: reconsulta não vaza linha
- Mudar unidade USD para EUR sem FX: KPI não é calculado com taxa arbitrária

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
