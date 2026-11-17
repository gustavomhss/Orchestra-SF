---
name: sf-user-journey-qa-ui-ui44-48-ui47-n01
description: "QA manutenção SF: executar story SF-UI47-N01 (UI47: contraprova — Dois itens de projeto têm nomes idênticos e um) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI47-N01 ou o caso específico UI47: contraprova — Dois itens de projeto têm nomes idênticos e u"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI47-N01"
---
# SF-UI47-N01 — UI47: contraprova — Dois itens de projeto têm nomes idênticos e um item está sem origem

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI47 · **Jornadas:** J05.

**Entrada UI indicada:** `/orchestra/sf-reviews/agenda` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** REV-EXEC-NOV · 25 projetos + budget + risks + PR

**Resultado de negócio:** Como QA adversarial, quero desafiar Seleção da pauta no contexto REV-EXEC-NOV · 25 projetos + budget + risks + PR para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI47-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Dois itens de projeto têm nomes idênticos e um item está sem origem

## Oráculos observáveis (não reescrever para passar)

- Snapshot exige IDs distintos, bloqueia/explicita ausência em vez de omitir silenciosamente
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Snapshot exige IDs distintos, bloqueia/explicita ausência em vez de omitir silenciosamente

**Fontes de teste existentes:** u25. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
