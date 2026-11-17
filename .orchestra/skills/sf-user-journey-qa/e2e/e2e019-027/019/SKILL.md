---
name: sf-user-journey-qa-e2e-e2e019-027-019
description: "QA manutenção SF: executar story SF-E2E-019 (Colaborador saiu: as permissões órfãs continuam visíveis) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-019 ou o caso específico Colaborador saiu: as permissões órfãs continuam visíveis"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-019"
---
# SF-E2E-019 — Colaborador saiu: as permissões órfãs continuam visíveis

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** HR · **Superfícies:** UI67, CAP07 · **Jornadas:** J08.

**Dependência de release:** PR270_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Diretório Graph remove perfil de empregado, persistindo grant órfão na instalação.

**Resultado de negócio:** Como CIO, com apoio de HR, diante da situação descrita, preciso localizar identidades desaparecidas e revogar grants sem reconstruir pessoa falsa, para fechar acesso residual com auditoria.

## Pré-condições específicas

- Diretório Graph remove perfil de empregado, persistindo grant órfão na instalação.

## Passos, mecanismos e limites das ferramentas

1. **[UI_ACTION]** Admin carrega diretório completo com usuário sintético EMP-OLD-01
2. **[UI_ACTION]** Grava grant específico àquele objectId de teste
3. **[UI_ACTION]** Simula remoção do usuário do Graph na fixture
4. **[UI_ACTION]** Reabre admin e verifica seção de permissões órfãs
5. **[UI_ACTION]** Inspeciona scopes e ID sem inferir novo usuário pelo nome
6. **[UI_ACTION]** Revoga grant órfão via transação CAS
7. **[UI_ACTION]** Recarrega admin e confere desaparecimento do órfão
8. **[UI_ACTION]** QA relê audit, versão e snapshots depois do restart

## Oráculos observáveis (não reescrever para passar)

- Orfandade é declarada somente com Graph completo
- Grant órfão não é reatribuído a homônimo automaticamente
- Revogação é explícita, atômica e auditada
- Falha Graph 503 impede conclusão de órfãos
- A tela não escreve usuários no Entra

## Contraprovas

- Falha de paginação deve bloquear tela, não sugerir excluir grants vivos
- Ao recuperar Graph, orphan reaparece ou some conforme fonte

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
