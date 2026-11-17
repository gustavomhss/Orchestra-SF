---
name: sf-user-journey-qa-e2e-e2e010-018-013
description: "QA manutenção SF: executar story SF-E2E-013 (Revogação deve valer inclusive para documentos já gerados) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-013 ou o caso específico Revogação deve valer inclusive para documentos já gerados"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-013"
---
# SF-E2E-013 — Revogação deve valer inclusive para documentos já gerados

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** AUDITOR, LEADER · **Superfícies:** UI48, UI50, UI31, UI62, UI67 · **Jornadas:** J05, J08.

**Dependência de release:** BASELINE; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Leitor autorizado abriu revisão confidencial R1 e documento de Supplier; acesso é revogado antes do download.

**Resultado de negócio:** Como CIO, com apoio de AUDITOR, LEADER, diante da situação descrita, preciso cortar acesso a tela, histórico e download após perda da permissão, para assegurar que material sensível não sobreviva à revogação.

## Pré-condições específicas

- Leitor autorizado abriu revisão confidencial R1 e documento de Supplier; acesso é revogado antes do download.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** CIO cria R1 e documento acessível ao leitor temporariamente
2. **[UI_ACTION]** Leitor abre link da R1 e solicita relatório
3. **[UI_ACTION]** Admin revoga grant de leitura na instalação
4. **[UI_ACTION]** Leitor recarrega página sem relogar
5. **[UI_ACTION]** Tenta baixar DOCX já gerado e abrir revisão por URL direta
6. **[UI_ACTION]** Tenta pesquisa de título e similar cases
7. **[UI_ACTION]** Tenta usar URL antiga em segundo navegador
8. **[UI_ACTION]** Auditor consulta log de permissão e snapshots de ausência de vazamento

## Oráculos observáveis (não reescrever para passar)

- A revalidação não depende do clique inicial
- Downloads após revogação negados
- Search e similar cases não revelam conteúdo/nome privado
- Mudança de grant é aplicada a sessões válidas já existentes
- Sem fallback local-operator na nuvem

## Contraprovas

- Replay de link assinado sob principal diferente: negado
- Cache offline com conteúdo sensível precisa invalidar/expirar segundo contrato

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
