---
name: sf-user-journey-qa-cap-cap16-20-cap19-p01
description: "QA manutenção SF: executar story SF-CAP19-P01 (CAP19: Planejar CAPEX por projeto e período sem dupla contabilizaç) pela UI; ator BUDGET_OWNER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP19-P01 ou o caso específico CAP19: Planejar CAPEX por projeto e período sem dupla contabiliza"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP19-P01"
---
# SF-CAP19-P01 — CAP19: Planejar CAPEX por projeto e período sem dupla contabilização

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUDGET_OWNER · **Superfícies:** CAP19 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/capex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009

**Resultado de negócio:** Como Budget Owner sintético BO-01, quero planejar CAPEX por projeto e período sem dupla contabilização para tomar a próxima ação com prova e governança.

## Pré-condições específicas

- Fixture disponível: CAPEX-SCANNER-01 · 91827 USD · 2027 · P-009. Se produtor ou porta não estiver instalado, registrar BLOCKED/UNAVAILABLE sem simular PASS.

## Passos a executar na interface

1. Registrar no formulário de execução SHA/tenant lógico/instalação/principal/competência e capturar tela inicial.
2. Abrir Planner CAPEX na hipótese V-2027-WHATIF
3. Relacionar item de CAPEX a P-009 e janela 2027
4. Revisar aprovação e total consolidado
5. Comparar com visão CAPEX Dashboard
6. Recarregar a rota diretamente em nova navegação e capturar evidências de fonte, versão e estado final.

## Oráculos observáveis (não reescrever para passar)

- Uma única linha de CAPEX soma 91827 no período 2027
- Duas vistas exibem mesma fonte sob política comum
- Não mistura CAPEX 2027 ao forecast OPEX 2026
- Referência do projeto é preservada
- Evidência de execução deve relacionar ator, momento, URL, versão do registro, resultado e hash/recibo quando houver.

**Fontes de teste existentes:** u07, u48. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
