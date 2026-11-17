---
name: sf-user-journey-qa-cap-cap21-25-cap25-n01
description: "QA manutenção SF: executar story SF-CAP25-N01 (CAP25: contraprova — Enviar PR com owner divergente ou estágio já ) pela UI; ator REQUESTER, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP25-N01 ou o caso específico CAP25: contraprova — Enviar PR com owner divergente ou estágio já"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP25-N01"
---
# SF-CAP25-N01 — CAP25: contraprova — Enviar PR com owner divergente ou estágio já alterado

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** REQUESTER · **Superfícies:** CAP25 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/requests` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PR-32000 · pedido USD 32000 · CC IT-BR

**Resultado de negócio:** Como QA adversarial, quero desafiar Procurement: Requests no contexto PR-32000 · pedido USD 32000 · CC IT-BR para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP25-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Enviar PR com owner divergente ou estágio já alterado

## Oráculos observáveis (não reescrever para passar)

- CAS/owner fence recusa submissão e não cria requisição duplicada
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- CAS/owner fence recusa submissão e não cria requisição duplicada

**Fontes de teste existentes:** u12. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
