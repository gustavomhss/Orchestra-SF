---
name: sf-user-journey-qa-ui-ui64-68-ui66-n01
description: "QA manutenção SF: executar story SF-UI66-N01 (UI66: contraprova — Port do scheduler não suporta leitura de detal) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI66-N01 ou o caso específico UI66: contraprova — Port do scheduler não suporta leitura de deta"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI66-N01"
---
# SF-UI66-N01 — UI66: contraprova — Port do scheduler não suporta leitura de detalhes atuais

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI66 · **Jornadas:** J07.

**Entrada UI indicada:** `/orchestra/sf-routines/schedules/:scheduleRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT

**Resultado de negócio:** Como QA adversarial, quero desafiar Recorrência no contexto SCHED-EDI-DAILY · recipe ROUTINE-EDI-RISK-v1 · 08:00 BRT para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI66-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Port do scheduler não suporta leitura de detalhes atuais

## Oráculos observáveis (não reescrever para passar)

- Sem edição cega nem merge com defaults; ação permanece indisponível
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Sem edição cega nem merge com defaults; ação permanece indisponível

**Fontes de teste existentes:** u34. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
