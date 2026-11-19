---
name: sf-user-journey-qa-e2e-e2e019-027-022
description: "QA manutenção SF: executar story SF-E2E-022 (Mudança de grant deve produzir efeito na sessão ativa) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-022 ou o caso específico Mudança de grant deve produzir efeito na sessão ativa"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-022"
---
# SF-E2E-022 — Mudança de grant deve produzir efeito na sessão ativa

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** BUYER, APPROVER · **Superfícies:** CAP25, CAP26, UI67 · **Jornadas:** J04, J08.

**Dependência de release:** PR270_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Pedro já está logado; Daniel revoga operação grant de sourcing.

**Resultado de negócio:** Como CIO, com apoio de BUYER, APPROVER, diante da situação descrita, preciso retirar ou acrescentar grant e comprovar releitura server-side sem depender de relogin, para manter autorização efetiva atualizada.

## Pré-condições específicas

- Pedro já está logado; Daniel revoga operação grant de sourcing.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Pedro abre página sourcing com versão V3
2. **[UI_ACTION]** Daniel acessa admin e revoga grant específico de Pedro
3. **[UI_ACTION]** Pedro tenta POST sourcing a partir de form antiga
4. **[UI_ACTION]** QA captura 403, snapshots before/after e accessRevision
5. **[UI_ACTION]** Pedro recarrega página e valida ação desabilitada
6. **[UI_ACTION]** Daniel readiciona grant em ambiente controlado
7. **[UI_ACTION]** Pedro reloga/recarrega e testa nova permissão
8. **[UI_ACTION]** Auditor valida que nenhuma tentativa negada escreveu PO

## Oráculos observáveis (não reescrever para passar)

- Revogação efetiva sem aguardar restart
- Rota visível não concede capacidade de mutation
- 401/403 observados conforme sessão e policy real
- Group role sozinho não permite operação sem direct grant quando exigido
- Nenhum dado histórico é perdido por revogação

## Contraprovas

- Tentar POST após grant revogado usando cookie de sessão antiga: negado
- Role admin da tela não concede supreme admin

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
