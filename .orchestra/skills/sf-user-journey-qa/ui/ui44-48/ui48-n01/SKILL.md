---
name: sf-user-journey-qa-ui-ui44-48-ui48-n01
description: "QA manutenção SF: executar story SF-UI48-N01 (UI48: contraprova — Sessão de viewer é revogada enquanto apresenta) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI48-N01 ou o caso específico UI48: contraprova — Sessão de viewer é revogada enquanto apresent"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI48-N01"
---
# SF-UI48-N01 — UI48: contraprova — Sessão de viewer é revogada enquanto apresentação está aberta

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI48 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/reviews/:reviewRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004

**Resultado de negócio:** Como QA adversarial, quero desafiar Revisões preservadas no contexto REV-EXEC-NOV/R1 · 25 projetos · nota longa P-004 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI48-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Sessão de viewer é revogada enquanto apresentação está aberta

## Oráculos observáveis (não reescrever para passar)

- Refresh e link direto bloqueiam material e não retêm dados sensíveis no cliente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Refresh e link direto bloqueiam material e não retêm dados sensíveis no cliente

**Fontes de teste existentes:** u32. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
