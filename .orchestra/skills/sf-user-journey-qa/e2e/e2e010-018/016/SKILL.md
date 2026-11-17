---
name: sf-user-journey-qa-e2e-e2e010-018-016
description: "QA manutenção SF: executar story SF-E2E-016 (O organograma oficial precisa vir do Graph) pela UI; ator CIO, registrar evidência e contraprovas."
internal: true
when: "O QA solicitou a story SF-E2E-016 ou o caso específico O organograma oficial precisa vir do Graph"
not-when: "Outra story; carregue a folha que possui o ID solicitado, não esta SF-E2E-016"
---
# SF-E2E-016 — O organograma oficial precisa vir do Graph

**Uso:** QA/manutenção interna; o LLM interpreta o(s) ator(es) como usuários, não é uma skill para o cliente. **Protocolo:** carregar `sf-user-journey-qa` antes desta folha; interagir exclusivamente pela UI instalada e preservar a evidência.

**Prioridade:** P0 · **Protagonista:** CIO · **Outros atores:** LEADER, BUYER · **Superfícies:** UI67 · **Jornadas:** J08.

**Dependência de release:** PR270_NOT_PROMOTED; confirmar instalado, nunca presumir habilitado.

**Situação / dados sintéticos:** SF-LAB-2026 · Feature proposta no PR #270: /sucafina/admin/access, FORA das 70 nativas; executar só após montagem real.

**Resultado de negócio:** Como CIO, com apoio de LEADER, BUYER, diante da situação descrita, preciso inspecionar hierarquia, cargo, times e grupos da organização de forma atual e completa, para administrar papéis a partir de identidade real, não cadastro paralelo.

## Pré-condições específicas

- Feature proposta no PR #270: /sucafina/admin/access, FORA das 70 nativas; executar só após montagem real.

## Passos a executar na interface

1. Daniel ou André autentica como membro efetivo do grupo supremo
2. Abre /sucafina/admin/access e verifica renderização da árvore
3. QA fornece hierarquia Graph com 2 raízes, grupos nested e perfis homônimos
4. Valida que manager 404 fica sem manager, não usuário forjado
5. Navega por departamentos, Teams e grupos do usuário
6. Caio/Pedro/Zico tentam GET direto e link na UI
7. QA confere que links admin só existem para supreme, sem confiar neles como guard
8. Inspeciona que Graph foi acessado somente no servidor

## Oráculos observáveis (não reescrever para passar)

- Árvore reflete todos os usuários retornados pela paginação sem duplicata
- Chaves são objectId, não título/username
- Caio/Pedro/Zico não veem link, recebem 403 em GET/POST
- Disconected roots são explicitadas; ciclo manager não causa loop
- Token Graph não aparece no HTML ou browser
- Se Graph falha, não há renderização parcial autoritativa

## Contraprovas

- Usuário admin de tela (sem supreme) recebe 403
- Faltar grant de Graph numa conta guest gera 503 explícito, não acesso parcial

**Evidência exigida:** registrar a sequência de ações, qual perfil autenticado agiu, estado anterior/posterior, revisões, recibo ou não-commit comprovado, e o veredito no modelo `docs/qa/sucafina/uat-cio/EVIDENCE-RECORD.json` em diretório privado. Se não houver navegador, tenant, sessão ou recurso instalado: `BLOCKED_*`, nunca PASS.
