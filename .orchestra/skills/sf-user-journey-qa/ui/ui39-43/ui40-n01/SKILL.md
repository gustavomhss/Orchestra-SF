---
name: sf-user-journey-qa-ui-ui39-43-ui40-n01
description: "QA manutenção SF: executar story SF-UI40-N01 (UI40: contraprova — Attempt existe mas resposta foi perdida após c) pela UI; ator AUDITOR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI40-N01 ou o caso específico UI40: contraprova — Attempt existe mas resposta foi perdida após "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI40-N01"
---
# SF-UI40-N01 — UI40: contraprova — Attempt existe mas resposta foi perdida após commit

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** AUDITOR · **Superfícies:** UI40 · **Jornadas:** J04, J06.

**Entrada UI indicada:** `/orchestra/sf-decisions/:caseRef/receipts/:receiptRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** RECEIPT-EDI-01 · attempt CHANGE-EDI-01

**Resultado de negócio:** Como QA adversarial, quero desafiar Recibo/histórico de aplicação no contexto RECEIPT-EDI-01 · attempt CHANGE-EDI-01 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI40-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Setup comprovável deste caso (não substituir por fixture imaginada)

1. Criar caso sintético com uma mudança preparada e confirmação humana legítima; registrar caseRef, digest e attemptRef antes da operação.
2. Usar interception já existente de Playwright em QA isolado: deixar o produtor confirmar e abortar APENAS a entrega HTTP; se não houver interceptador autorizado, BLOCKED_ENVIRONMENT.
3. Reabrir recibo pelo mesmo attemptRef na UI, reler fonte e provar um efeito; não clicar Apply novamente por incerteza.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Attempt existe mas resposta foi perdida após commit

## Oráculos observáveis (não reescrever para passar)

- Recuperação retorna mesmo receiptRef e nunca emite nova ordem
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Recuperação retorna mesmo receiptRef e nunca emite nova ordem

**Fontes de teste existentes:** u18. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
