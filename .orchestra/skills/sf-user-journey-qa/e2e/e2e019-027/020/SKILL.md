---
name: sf-user-journey-qa-e2e-e2e019-027-020
description: "QA manutenção SF: executar story SF-E2E-020 (Graph indisponível não autoriza uma árvore parcial) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-020 ou o caso específico Graph indisponível não autoriza uma árvore parcial"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-020"
---
# SF-E2E-020 — Graph indisponível não autoriza uma árvore parcial

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:**  · **Superfícies:** UI67 · **Jornadas:** J08.

**Dependência de release:** PR270_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Graph paging: 2000 users, grupos nested, 429 throttle, 403 restricted guest.

**Resultado de negócio:** Como CIO, diante da situação descrita, preciso injetar throttling, paginação incompleta e falta de permissão no diretório, para evitar decisões de acesso apoiadas em dados incompletos.

## Pré-condições específicas

- Graph paging: 2000 users, grupos nested, 429 throttle, 403 restricted guest.

## Passos, mecanismos e limites das ferramentas

1. **[READ_ONLY_WITNESS]** Conferir leitura `/users` com múltiplas páginas
2. **[CONTROLLED_FAULT]** Simular página com nextLink em ciclo para testar limite — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
3. **[CONTROLLED_FAULT]** Simular 429 com retry autorizado e budget finito — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
4. **[CONTROLLED_FAULT]** Simular grupo oculto ou transitiveMembers 403 — somente com harness de falha já existente e autorizado; senão BLOCKED_ENVIRONMENT
5. **[UI_ACTION]** Validar que admin não renderiza org parcial como completo
6. **[UI_ACTION]** Tentar salvar alteração quando Graph está incompleto
7. **[UI_ACTION]** Recuperar Graph e repetir leitura
8. **[READ_ONLY_WITNESS]** Verificar ausência de bearer token no DOM e logs

## Oráculos observáveis (não reescrever para passar)

- Erro de qualquer etapa crítica resulta em 503 sem conclusão parcial
- Nenhuma alteração de role/grant ocorre sem snapshot Graph válido
- Paginação lida com limites, ciclos e duplicatas
- Nenhum redirect externo é seguido
- Uma falha não habilita escopo mais permissivo

## Contraprovas

- Injetar nextLink host externo: blocked
- Conjunto de usuários vazio por falha não pode apagar grants legítimos

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
