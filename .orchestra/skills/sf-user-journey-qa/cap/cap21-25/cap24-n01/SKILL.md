---
name: sf-user-journey-qa-cap-cap21-25-cap24-n01
description: "QA manutenção SF: executar story SF-CAP24-N01 (CAP24: contraprova — Pedido PR-32000 muda de estágio durante leitu) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-CAP24-N01 ou o caso específico CAP24: contraprova — Pedido PR-32000 muda de estágio durante leit"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-CAP24-N01"
---
# SF-CAP24-N01 — CAP24: contraprova — Pedido PR-32000 muda de estágio durante leitura do dashboard

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Superfícies:** CAP24 · **Jornadas:** J04.

**Entrada UI indicada:** `/orchestra/sf-procurement/overview` (rota do app-shell; confirmar owner e mount reais).

**Situação / dados sintéticos:** PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel

**Resultado de negócio:** Como QA adversarial, quero desafiar Procurement: Dashboard no contexto PR-32000 · draft→PR→sourcing→PO · 3 pedidos sintéticos no painel para demonstrar ausência de efeito indevido, vazamento e regressão.

## Pré-condições específicas

- Story SF-CAP24-P01 concluída apenas como preparação, em estado sintético conhecido.
- Capturar estado da fonte, revisão, permissões e contadores de aplicação ANTES da tentativa.
- Executar a ameaça somente na instalação de QA isolada com atores autorizados para teste negativo.

## Passos a executar na interface

1. Abrir a superfície pela rota direta e pela navegação normal, para distinguir UI de autorização do host.
2. Pedido PR-32000 muda de estágio durante leitura do dashboard
3. Repetir a tentativa após refresh e com uma segunda sessão independente, sem alterar a intenção do teste.
4. Reconsultar fonte, snapshot e auditoria; preservar resposta HTTP, tela e evidência de ausência de mutation.

## Oráculos observáveis (não reescrever para passar)

- Refresh mostra fila e aging consistentes, sem status fantasma
- Nenhum efeito parcial, alteração em outro principal, escalada de papéis ou duplicata; erro deve ser explícito e não expor conteúdo protegido.
- Registrar se o comportamento foi DENIED_EXPECTED, BUG ou BLOCKED_ENVIRONMENT; não marcar PASS sem confirmação da fonte.

## Contraprovas

- Refresh mostra fila e aging consistentes, sem status fantasma

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
