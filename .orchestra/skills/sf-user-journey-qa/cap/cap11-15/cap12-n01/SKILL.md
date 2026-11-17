---
name: sf-user-journey-qa-cap-cap11-15-cap12-n01
description: "QA manutenção SF: executar story SF-CAP12-N01 (CAP12: contraprova — Fonte do denominador indisponível retorna nul) pela UI; ator SECURITY, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP12-N01 ou o caso específico CAP12: contraprova — Fonte do denominador indisponível retorna nu"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP12-N01"
---
# SF-CAP12-N01 — CAP12: contraprova — Fonte do denominador indisponível retorna null em vez de 200

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** SECURITY · **Superfícies:** CAP12 · **Jornadas:** J08.

**Entrada UI indicada:** `/orchestra/sf-operations/security` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: IT Security KPIs no contexto SEC-SEP-26 · 4 endpoints críticos sem patch / 200 · 0 breaches conhecidos para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP12-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Fonte do denominador indisponível retorna null em vez de 200

## Oráculos observáveis (não reescrever para passar)

- Taxa não é calculada nem apresentada como 0%
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Taxa não é calculada nem apresentada como 0%

**Fontes de teste existentes:** u29. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
