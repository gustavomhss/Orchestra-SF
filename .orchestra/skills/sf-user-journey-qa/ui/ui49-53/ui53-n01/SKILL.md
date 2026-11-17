---
name: sf-user-journey-qa-ui-ui49-53-ui53-n01
description: "QA manutenção SF: executar story SF-UI53-N01 (UI53: contraprova — Terceiro modifica TASK-023 para v4 antes de co) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI53-N01 ou o caso específico UI53: contraprova — Terceiro modifica TASK-023 para v4 antes de c"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI53-N01"
---
# SF-UI53-N01 — UI53: contraprova — Terceiro modifica TASK-023 para v4 antes de confirmação v3

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI53 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work/confirmations/:selectionRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CONFIRM-EDI-01 · TASK-023 · versão observada v3

**Resultado de negócio:** Como QA adversarial, quero desafiar Confirmar sem alteração no contexto CONFIRM-EDI-01 · TASK-023 · versão observada v3 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI53-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Terceiro modifica TASK-023 para v4 antes de confirmação v3

## Oráculos observáveis (não reescrever para passar)

- Conflito informado e obrigação de reabrir v4 sem aplicar confirmação falsa
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Conflito informado e obrigação de reabrir v4 sem aplicar confirmação falsa

**Fontes de teste existentes:** u44. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
