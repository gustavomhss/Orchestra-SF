---
name: sf-user-journey-qa-ui-ui29-33-ui33-n01
description: "QA manutenção SF: executar story SF-UI33-N01 (UI33: contraprova — Criar caso com referência de outra instalação) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI33-N01 ou o caso específico UI33: contraprova — Criar caso com referência de outra instalação"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI33-N01"
---
# SF-UI33-N01 — UI33: contraprova — Criar caso com referência de outra instalação

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI33 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CASE-EDI-01 · selecionar fornecedor + timeline de TI

**Resultado de negócio:** Como QA adversarial, quero desafiar Lista/criação de casos no contexto CASE-EDI-01 · selecionar fornecedor + timeline de TI para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI33-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Criar caso com referência de outra instalação

## Oráculos observáveis (não reescrever para passar)

- Criar/reler é recusado, sem copiar dado cross-tenant
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Criar/reler é recusado, sem copiar dado cross-tenant

**Fontes de teste existentes:** u16. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
