---
name: sf-user-journey-qa-ui-ui44-48-ui46-n01
description: "QA manutenção SF: executar story SF-UI46-N01 (UI46: contraprova — Linha de origem é revogada após renderização d) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI46-N01 ou o caso específico UI46: contraprova — Linha de origem é revogada após renderização "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI46-N01"
---
# SF-UI46-N01 — UI46: contraprova — Linha de origem é revogada após renderização do gráfico

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** UI46 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-bi/:viewId` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BI-OPEX-01 · USD590000; linha OPEX-LIC-01

**Resultado de negócio:** Como QA adversarial, quero desafiar Visual BI e drilldown no contexto BI-OPEX-01 · USD590000; linha OPEX-LIC-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI46-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Linha de origem é revogada após renderização do gráfico

## Oráculos observáveis (não reescrever para passar)

- Drilldown refaz autorização e não devolve linha privada por cache
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Drilldown refaz autorização e não devolve linha privada por cache

**Fontes de teste existentes:** u20, u21, u22. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
