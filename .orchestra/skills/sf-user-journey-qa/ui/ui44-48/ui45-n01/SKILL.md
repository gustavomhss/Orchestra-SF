---
name: sf-user-journey-qa-ui-ui44-48-ui45-n01
description: "QA manutenção SF: executar story SF-UI45-N01 (UI45: contraprova — Viewer procura visão de talentos que não possu) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-UI45-N01 ou o caso específico UI45: contraprova — Viewer procura visão de talentos que não poss"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-UI45-N01"
---
# SF-UI45-N01 — UI45: contraprova — Viewer procura visão de talentos que não possui grant

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** UI45 · **Jornadas:** J02.

**Entrada UI indicada:** `/orchestra/sf-bi` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** BI-EXEC-01 · orçamento, riscos, PR, backlog

**Resultado de negócio:** Como QA adversarial, quero desafiar Catálogo BI no contexto BI-EXEC-01 · orçamento, riscos, PR, backlog para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-UI45-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Viewer procura visão de talentos que não possui grant
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Catálogo ou requisição direta não revela dados, títulos privados ou contagem sensível
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Catálogo ou requisição direta não revela dados, títulos privados ou contagem sensível

**Fontes de teste existentes:** u20, u21, u22. Reusar para diagnosticar, não substituir a execução da UI.

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
