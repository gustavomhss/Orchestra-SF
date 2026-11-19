---
name: sf-user-journey-qa-cap-cap01-05-cap05-n01
description: "QA manutenção SF: executar story SF-CAP05-N01 (CAP05: contraprova — Tentar editar CAPEX na versão official/locked) pela UI; ator BUDGET_OWNER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP05-N01 ou o caso específico CAP05: contraprova — Tentar editar CAPEX na versão official/locke"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP05-N01"
---
# SF-CAP05-N01 — CAP05: contraprova — Tentar editar CAPEX na versão official/locked com role de leitura

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** BUDGET_OWNER · **Superfícies:** CAP05 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/capex` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: CAPEX Projects no contexto CAPEX-SCANNER-01 · USD 91827 · 2027 · Projeto P-009 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP05-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Em Planner → Versions identificar versionRef official/locked; com role real de leitura, selecionar esse ID em Planner CAPEX e comprovar edição recusada/indisponível sem unlock. Só tentar mutação se houver controle UI autorizado; reler official, não o Dashboard, para provar não-commit.

## Oráculos observáveis (não reescrever para passar)

- UI e produtor recusam operação; nenhuma mudança no total publicado
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- UI e produtor recusam operação; nenhuma mudança no total publicado

**Fontes de teste existentes:** u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
