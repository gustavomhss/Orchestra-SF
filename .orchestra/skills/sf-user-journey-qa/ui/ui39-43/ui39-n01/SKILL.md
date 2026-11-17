---
name: sf-user-journey-qa-ui-ui39-43-ui39-n01
description: "QA manutenção SF: executar story SF-UI39-N01 (UI39: contraprova — Enviar mesma confirmação em paralelo após time) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI39-N01 ou o caso específico UI39: contraprova — Enviar mesma confirmação em paralelo após tim"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI39-N01"
---
# SF-UI39-N01 — UI39: contraprova — Enviar mesma confirmação em paralelo após timeout de resposta

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI39 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/changes/:changeRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CHANGE-EDI-01 · CASE-EDI-01 · PR-32000

**Resultado de negócio:** Como QA adversarial, quero desafiar Mudanças preparadas no contexto CHANGE-EDI-01 · CASE-EDI-01 · PR-32000 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI39-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Enviar mesma confirmação em paralelo após timeout de resposta

## Oráculos observáveis (não reescrever para passar)

- Consultar attempt original, recuperar recibo e não duplicar efeito
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Consultar attempt original, recuperar recibo e não duplicar efeito

**Fontes de teste existentes:** u18. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
