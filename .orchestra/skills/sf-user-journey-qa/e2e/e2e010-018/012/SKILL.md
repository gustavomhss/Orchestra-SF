---
name: sf-user-journey-qa-e2e-e2e010-018-012
description: "QA manutenção SF: executar story SF-E2E-012 (Duas pessoas editam a mesma linha no Planner) pela UI; ator FINANCE, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-012 ou o caso específico Duas pessoas editam a mesma linha no Planner"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-012"
---
# SF-E2E-012 — Duas pessoas editam a mesma linha no Planner

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** FINANCE · **Outros atores:** BUDGET_OWNER · **Superfícies:** CAP18, CAP23, UI53 · **Jornadas:** J01, J02.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Duas janelas no mesmo registro OPEX-LIC-01 v3; Sofie muda para 84000 e Budget Owner tenta salvar 78000 sobre v3.

**Resultado de negócio:** Como FINANCE, com apoio de BUDGET_OWNER, diante da situação descrita, preciso preservar a edição válida e rejeitar submissão obsoleta sob CAS, para não perder atualizações em períodos de fechamento.

## Pré-condições específicas

- Duas janelas no mesmo registro OPEX-LIC-01 v3; Sofie muda para 84000 e Budget Owner tenta salvar 78000 sobre v3.

## Passos a executar na interface

1. Ambas contas leem v3 simultaneamente
2. Finance salva 84000 com CAS v3 e obtém v4
3. Budget Owner mantém editor antigo carregado
4. Budget Owner envia 78000 usando v3
5. QA registra status e diff mostrado
6. Usuário decide reload e cria hipótese B em vez de sobrescrever A
7. Reabre Fonte A e B em sessões separadas

## Oráculos observáveis (não reescrever para passar)

- Segundo update recebe conflito, sem gravar 78000 sobre A
- Mudança local pode ser recuperada/reaplicada conscientemente
- A termina 84000 e B 78000, cada uma na versão correta
- Audit não registra sucesso para update stale
- Não há pending falsa em mês independente

## Contraprovas

- Mudar principal no meio da requisição: binding stale rejeitado
- Responder 200 sem commit seria falha crítica

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
