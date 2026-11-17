---
name: sf-user-journey-qa-cap-cap06-10-cap08-n01
description: "QA manutenção SF: executar story SF-CAP08-N01 (CAP08: contraprova — Revogar grant de RH após criar export e tenta) pela UI; ator HR, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP08-N01 ou o caso específico CAP08: contraprova — Revogar grant de RH após criar export e tent"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP08-N01"
---
# SF-CAP08-N01 — CAP08: contraprova — Revogar grant de RH após criar export e tentar baixar link anterior

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** HR · **Superfícies:** CAP08 · **Jornadas:** J02, J08.

**Entrada UI indicada:** `/orchestra/sf-people/talent` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** TAL-014 · rating fictício 3/5 · ciclo 2026-H2

**Resultado de negócio:** Como QA adversarial, quero desafiar Dashboard: Talent Review no contexto TAL-014 · rating fictício 3/5 · ciclo 2026-H2 para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP08-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

**Protocolo negativo compartilhado:** abrir rota e navegação com ator real, capturar before; produzir somente a contraprova específica abaixo; repetir refresh/segunda sessão se o risco exigir; reler fonte/auditoria para comprovar não-commit. Sem precondição admitida, marcar BLOCKED, não PASS.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Revogar grant de RH após criar export e tentar baixar link anterior

## Oráculos observáveis (não reescrever para passar)

- Download revalida acesso e nega sem vazar conteúdo
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Download revalida acesso e nega sem vazar conteúdo

**Fontes de teste existentes:** u47. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
