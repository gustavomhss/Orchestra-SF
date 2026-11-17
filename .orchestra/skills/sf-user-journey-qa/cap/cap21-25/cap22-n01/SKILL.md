---
name: sf-user-journey-qa-cap-cap21-25-cap22-n01
description: "QA manutenção SF: executar story SF-CAP22-N01 (CAP22: contraprova — Excluir taxa de EUR e comparar proposta) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP22-N01 ou o caso específico CAP22: contraprova — Excluir taxa de EUR e comparar proposta"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP22-N01"
---
# SF-CAP22-N01 — CAP22: contraprova — Excluir taxa de EUR e comparar proposta

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Superfícies:** CAP22 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-planner/fx` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30

**Resultado de negócio:** Como QA adversarial, quero desafiar Planner: FX rates no contexto FX-EURUSD-SEP26 · EUR→USD =1.08 · fonte sintética 2026-09-30 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP22-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Excluir taxa de EUR e comparar proposta

## Oráculos observáveis (não reescrever para passar)

- UI declara comparação indeterminada e impede escolha baseada em FX fictícia
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- UI declara comparação indeterminada e impede escolha baseada em FX fictícia

**Fontes de teste existentes:** u45. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
