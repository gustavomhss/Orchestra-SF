---
name: sf-user-journey-qa-cap-cap26-28-cap28-n01
description: "QA manutenção SF: executar story SF-CAP28-N01 (CAP28: contraprova — Regular Buyer tenta editar configuração de ap) pela UI; ator PROC_ADMIN, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP28-N01 ou o caso específico CAP28: contraprova — Regular Buyer tenta editar configuração de a"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP28-N01"
---
# SF-CAP28-N01 — CAP28: contraprova — Regular Buyer tenta editar configuração de aprovação

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** PROC_ADMIN · **Superfícies:** CAP28 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/settings` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD

**Resultado de negócio:** Como QA adversarial, quero desafiar Procurement: Settings no contexto PROC-POLICY-2026 · estágios PR/SRC/PO · limite sintético 30000 USD para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP28-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Regular Buyer tenta editar configuração de aprovação

## Oráculos observáveis (não reescrever para passar)

- Form/action oculto ou negado, sem alteração na política
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Form/action oculto ou negado, sem alteração na política

**Fontes de teste existentes:** u36. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
