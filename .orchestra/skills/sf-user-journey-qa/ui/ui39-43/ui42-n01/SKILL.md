---
name: sf-user-journey-qa-ui-ui39-43-ui42-n01
description: "QA manutenção SF: executar story SF-UI42-N01 (UI42: contraprova — Candidato sem CAPEX conhecido é tratado como c) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI42-N01 ou o caso específico UI42: contraprova — Candidato sem CAPEX conhecido é tratado como "
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI42-N01"
---
# SF-UI42-N01 — UI42: contraprova — Candidato sem CAPEX conhecido é tratado como custo zero

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P1 · **Protagonista:** CIO · **Superfícies:** UI42 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-portfolio/scenarios/:caseRef` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD

**Resultado de negócio:** Como QA adversarial, quero desafiar Campanha/candidatos no contexto SCN-PORT-01 · 25 candidatos · teto sintético 200000 USD para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI42-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Candidato sem CAPEX conhecido é tratado como custo zero

## Oráculos observáveis (não reescrever para passar)

- Sistema deve identificar custo indeterminado e não aprovar combinação enganosa
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Sistema deve identificar custo indeterminado e não aprovar combinação enganosa

**Fontes de teste existentes:** u19. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
