---
name: sf-user-journey-qa-cap-cap01-05-cap03-n01
description: "QA manutenção SF: executar story SF-CAP03-N01 (CAP03: contraprova — Remover FX de EUR e abrir indicador consolida) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP03-N01 ou o caso específico CAP03: contraprova — Remover FX de EUR e abrir indicador consolid"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP03-N01"
---
# SF-CAP03-N01 — CAP03: contraprova — Remover FX de EUR e abrir indicador consolidado com linha em EUR

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP03 · **Jornadas:** J01, J05.

**Entrada UI indicada:** `/orchestra/sf-dashboard/budget` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: Budget Overview no contexto BUD-2026-IT · budget 600000 · actual Jan–Set 400000 · open 190000 USD para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP03-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Em Planner → FX (/orchestra/sf-planner/fx) verificar se há controle autorizado de retirar EUR para a competência de QA; só agir se existir, depois abrir Dashboard Budget por ano e observar incompatibilidade. Não inventar botão de FX no Dashboard nem manipular produtor fora da UI.

## Oráculos observáveis (não reescrever para passar)

- Indicador incompatível fica indeterminado/partial; não vira zero nem aplica conversão implícita
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Indicador incompatível fica indeterminado/partial; não vira zero nem aplica conversão implícita

**Fontes de teste existentes:** u02, u39, u40. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
