---
name: sf-user-journey-qa-cap-cap16-20-cap16-n01
description: "QA manutenção SF: executar story SF-CAP16-N01 (CAP16: contraprova — Subitem eliminado enquanto outro usuário revi) pela UI; ator OPS, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP16-N01 ou o caso específico CAP16: contraprova — Subitem eliminado enquanto outro usuário rev"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP16-N01"
---
# SF-CAP16-N01 — CAP16: contraprova — Subitem eliminado enquanto outro usuário revisa uma versão antiga

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** OPS · **Superfícies:** CAP16 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-operations/performance` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: IT Performance Contract no contexto PERF-01 · disponibilidade 99.7 vs SLA 99.9 · 3 subitens para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP16-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Subitem eliminado enquanto outro usuário revisa uma versão antiga

## Oráculos observáveis (não reescrever para passar)

- CAS e mensagem de conflito impedem ressurreição de subitem
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- CAS e mensagem de conflito impedem ressurreição de subitem

**Fontes de teste existentes:** u31. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
