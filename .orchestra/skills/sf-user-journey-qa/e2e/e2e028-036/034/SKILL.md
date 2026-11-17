---
name: sf-user-journey-qa-e2e-e2e028-036-034
description: "QA manutenção SF: executar story SF-E2E-034 (Todas as telas, papéis e estados: prova transversal de UX) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-034 ou o caso específico Todas as telas, papéis e estados: prova transversal de UX"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-034"
---
# SF-E2E-034 — Todas as telas, papéis e estados: prova transversal de UX

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** LEADER, HR, BUYER · **Superfícies:** UI29, UI67, CAP24, UI50, UI66 · **Jornadas:** J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · 70 superfícies e 165 variantes de rota da revisão auditada; execução deve escolher atores/grants da política corrente.

**Resultado de negócio:** Como CIO, com apoio de LEADER, HR, BUYER, diante da situação descrita, preciso percorrer famílias de telas, rotas e estados de acesso usando matriz de risco, para identificar regressões que testes isolados não encontram.

## Pré-condições específicas

- 70 superfícies e 165 variantes de rota da revisão auditada; execução deve escolher atores/grants da política corrente.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** QA congela SHA e instala navegador real
2. **[UI_ACTION]** Para cada superfície, executa story SF-*-P01 e SF-*-N01 correspondente
3. **[UI_ACTION]** Para cada uma das 165 variantes, tenta entry/new/edit/detail/history dinamicamente com ref válida
4. **[UI_ACTION]** Tenta ref opaca inválida, URL truncada e prioridade static vs dynamic
5. **[UI_ACTION]** Repete navegação em 320/768/1440px e zoom 200%
6. **[UI_ACTION]** Testa foco teclado, ARIA, texto longo, estados vazios/loading/error
7. **[UI_ACTION]** Valida tema light/dark e redução de movimento quando disponível
8. **[UI_ACTION]** Reexecuta matriz após revogação e troca de owner
9. **[UI_ACTION]** Associa evidência a cada row, não a um print genérico

## Oráculos observáveis (não reescrever para passar)

- 70/70 superfícies recebem resultado por ator/feature instalada, sem false PASS
- 165/165 rotas recebem status e evidência na versão final
- Ref dinâmica não dá autorização a recurso
- Teclado, contraste, foco e layout ficam utilizáveis
- Erros e estados não exibem informação antiga após troca de contexto

## Contraprovas

- Se route reconhecida mas producer indisponível, estado é BLOCKED/UNAVAILABLE
- Um teste falhar em 320px não fica oculto por PASS em 1440px

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
