---
name: sf-user-journey-qa-ui-ui44-48-ui44-n01
description: "QA manutenção SF: executar story SF-UI44-N01 (UI44: contraprova — Entrada usa taxa -1, NaN ou unidade percentual) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI44-N01 ou o caso específico UI44: contraprova — Entrada usa taxa -1, NaN ou unidade percentua"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI44-N01"
---
# SF-UI44-N01 — UI44: contraprova — Entrada usa taxa -1, NaN ou unidade percentual misturada

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** FINANCE · **Superfícies:** UI44 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-portfolio/sensitivity/:caseRef/:resultRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SENS-EDI-01 · EURUSD 1.08 ±0.05

**Resultado de negócio:** Como QA adversarial, quero desafiar Sensibilidade no contexto SENS-EDI-01 · EURUSD 1.08 ±0.05 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI44-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Entrada usa taxa -1, NaN ou unidade percentual misturada

## Oráculos observáveis (não reescrever para passar)

- Validação recusa e mantém cálculo anterior
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Validação recusa e mantém cálculo anterior

**Fontes de teste existentes:** u19. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
