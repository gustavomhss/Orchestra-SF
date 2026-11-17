---
name: sf-user-journey-qa-ui-ui49-53-ui51-n01
description: "QA manutenção SF: executar story SF-UI51-N01 (UI51: contraprova — Usar string de título “EDI Santos” em vez de r) pela UI; ator LEADER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI51-N01 ou o caso específico UI51: contraprova — Usar string de título “EDI Santos” em vez de "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI51-N01"
---
# SF-UI51-N01 — UI51: contraprova — Usar string de título “EDI Santos” em vez de ref canônico

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** LEADER · **Superfícies:** UI51 · **Jornadas:** J01, J06.

**Entrada UI indicada:** `/orchestra/sf-work/relations/:relationRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004

**Resultado de negócio:** Como QA adversarial, quero desafiar Relações entre registros no contexto REL-EDI-01 · HOT-EDI-07 ↔ PR-32000 ↔ P-004 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI51-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Usar string de título “EDI Santos” em vez de ref canônico

## Oráculos observáveis (não reescrever para passar)

- Handler não aceita associação ambígua ou forjada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Handler não aceita associação ambígua ou forjada

**Fontes de teste existentes:** u44. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
