---
name: sf-user-journey-qa-e2e-e2e010-018-017
description: "QA manutenção SF: executar story SF-E2E-017 (Grupo concede papel; perfil recebe grant independente) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-017 ou o caso específico Grupo concede papel; perfil recebe grant independente"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-017"
---
# SF-E2E-017 — Grupo concede papel; perfil recebe grant independente

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** PROC_ADMIN, BUYER · **Superfícies:** UI67, CAP25, CAP26 · **Jornadas:** J08.

**Dependência de release:** PR270_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Admin supremo define role por grupo para Dashboard, Planner, Procurement e grants diretos separados.

**Resultado de negócio:** Como CIO, com apoio de PROC_ADMIN, BUYER, diante da situação descrita, preciso configurar papel herdado de grupo e permissão direta por perfil sem confundi-los, para aplicar o modelo de acesso projetado pelo administrador.

## Pré-condições específicas

- Admin supremo define role por grupo para Dashboard, Planner, Procurement e grants diretos separados.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Daniel seleciona grupo Graph existente como dashboard contributor
2. **[UI_ACTION]** Seleciona finance para Planner em outro grupo
3. **[UI_ACTION]** Configura procurement buyer para grupo de Pedro
4. **[UI_ACTION]** Concede a um profile object ID operações exatas de um domínio
5. **[UI_ACTION]** Salva via POST com revisão e confere PRG 303
6. **[UI_ACTION]** Reloga como Pedro e testa comandos reais de buyer, não só UI
7. **[UI_ACTION]** Tenta executar operação fora da grant e valida 403
8. **[UI_ACTION]** Volta ao admin e consulta audit from/to e versão após restart

## Oráculos observáveis (não reescrever para passar)

- Grupo→role e profile→grant são duas dimensões independentes
- Role de Buyer sem grant suficiente não inventa operações
- Grant sem role correspondente não inventa autoridade
- Estado persiste de forma atômica com actor objectId
- Nenhuma escrita toca Microsoft Graph
- Auditoria recupera from/to e UTC

## Contraprovas

- Enviar role fora do enum ou namespace/operation não admitidos: 422 e no commit
- Enviar group ID inexistente: rejeição; não criar Graph group fictício

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
